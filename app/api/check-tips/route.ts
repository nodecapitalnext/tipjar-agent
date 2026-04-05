import { NextRequest, NextResponse } from "next/server";
import { publicClient } from "@/lib/chain";
import { TIPJAR_ADDRESS, TIP_SENT_ABI, ZERO_ADDRESS } from "@/lib/config";
import { mintThankYouNFT, formatAmount } from "@/lib/nft";
import { castTip } from "@/lib/farcaster";

// Simple in-memory last block tracker
// In production use Vercel KV or similar
let lastProcessedBlock: bigint | null = null;

// Minimum tip to trigger NFT + cast (0.0001 ETH)
const MIN_THRESHOLD = BigInt("100000000000000");

export async function GET(req: NextRequest) {
  // Allow Vercel cron (no auth header) or manual with secret
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return await checkTips();
}

// Also allow POST for manual trigger
export async function POST(req: NextRequest) {
  return await checkTips();
}

async function checkTips() {
  const results: object[] = [];

  try {
    const latestBlock = await publicClient.getBlockNumber();

    // First run: start from last 100 blocks
    if (!lastProcessedBlock) {
      lastProcessedBlock = latestBlock - 7200n; // ~24 hours
    }

    // Don't re-process if no new blocks
    if (latestBlock <= lastProcessedBlock) {
      return NextResponse.json({
        message: "No new blocks",
        latestBlock: latestBlock.toString(),
        lastProcessed: lastProcessedBlock.toString(),
      });
    }

    console.log(`Scanning blocks ${lastProcessedBlock} → ${latestBlock}`);

    // Fetch TipSent events
    const logs = await publicClient.getLogs({
      address:   TIPJAR_ADDRESS,
      event:     TIP_SENT_ABI[0],
      fromBlock: lastProcessedBlock + 1n,
      toBlock:   latestBlock,
    });

    console.log(`Found ${logs.length} tips`);

    for (const log of logs) {
      const { from, to, amount, token, message, timestamp } = log.args as {
        from: string; to: string; amount: bigint;
        token: string; message: string; timestamp: bigint;
      };

      const amountStr = formatAmount(amount, token);
      console.log(`New tip: ${amountStr} from ${from.slice(0,10)}...`);

      const result: Record<string, unknown> = {
        from, to, amount: amount.toString(), token, message,
        txHash: log.transactionHash,
      };

      // Only process tips above threshold
      if (amount >= MIN_THRESHOLD) {
        // 1. Mint NFT
        try {
          const { tokenId, txHash: nftTx } = await mintThankYouNFT(
            from, to, amount, token,
            `Thank you for the ${amountStr} tip on TipJar!`
          );
          result.nftTokenId = tokenId.toString();
          result.nftTxHash  = nftTx;
          console.log(`NFT #${tokenId} minted`);
        } catch (e) {
          result.nftError = String(e);
          console.error("NFT mint failed:", e);
        }

        // 2. Cast on Farcaster
        try {
          const castHash = await castTip({
            from, to, amount, token, message,
            txHash:     log.transactionHash,
            nftTokenId: result.nftTokenId ? BigInt(result.nftTokenId as string) : undefined,
          });
          result.castHash = castHash;
          console.log(`Cast: ${castHash}`);
        } catch (e) {
          result.castError = String(e);
          console.error("Cast failed:", e);
        }
      }

      results.push(result);
    }

    // Update last processed block
    lastProcessedBlock = latestBlock;

    return NextResponse.json({
      success:       true,
      scanned:       `${lastProcessedBlock - 100n} → ${latestBlock}`,
      tipsFound:     logs.length,
      tipsProcessed: results.length,
      results,
    });

  } catch (error) {
    console.error("check-tips error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
