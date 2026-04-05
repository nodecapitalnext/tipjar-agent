import { NextRequest, NextResponse } from "next/server";
import { decodeEventLog } from "viem";
import { TIP_SENT_ABI, TIPJAR_ADDRESS, ZERO_ADDRESS } from "@/lib/config";
import { mintThankYouNFT, formatAmount } from "@/lib/nft";
import { castTip } from "@/lib/farcaster";

// Minimum tip to trigger actions (0.0001 ETH)
const MIN_THRESHOLD = BigInt("100000000000000");

export async function POST(req: NextRequest) {
  try {
    // Verify Alchemy webhook signature
    const alchemyToken = req.headers.get("x-alchemy-token");
    if (process.env.ALCHEMY_WEBHOOK_TOKEN && alchemyToken !== process.env.ALCHEMY_WEBHOOK_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body).slice(0, 200));

    // Alchemy Activity webhook format
    const activity = body?.event?.activity || body?.activity || [];

    const results = [];

    for (const item of activity) {
      // Check if this is a log from TipJar
      const logs = item?.log ? [item.log] : (item?.logs || []);

      for (const log of logs) {
        if (log.address?.toLowerCase() !== TIPJAR_ADDRESS.toLowerCase()) continue;

        // Decode TipSent event
        let decoded;
        try {
          decoded = decodeEventLog({
            abi:    TIP_SENT_ABI,
            data:   log.data,
            topics: log.topics,
          });
        } catch {
          continue; // Not a TipSent event
        }

        const { from, to, amount, token, message } = decoded.args as {
          from: string; to: string; amount: bigint;
          token: string; message: string;
        };

        const amountStr = formatAmount(amount, token);
        console.log(`TipSent: ${amountStr} from ${from.slice(0,10)}...`);

        const result: Record<string, unknown> = {
          from, to, amount: amount.toString(), token, message,
          txHash: log.transactionHash,
        };

        if (amount >= MIN_THRESHOLD) {
          // 1. Mint Thank You NFT
          try {
            const { tokenId, txHash: nftTx } = await mintThankYouNFT(
              from, to, amount, token,
              `Thank you for the ${amountStr} tip on TipJar!`
            );
            result.nftTokenId = tokenId.toString();
            result.nftTxHash  = nftTx;
            console.log(`NFT #${tokenId} minted → ${from.slice(0,10)}...`);
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
            console.log(`Farcaster cast: ${castHash}`);
          } catch (e) {
            result.castError = String(e);
            console.error("Cast failed:", e);
          }
        }

        results.push(result);
      }
    }

    return NextResponse.json({ success: true, processed: results.length, results });

  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// Alchemy sends GET to verify webhook
export async function GET() {
  return NextResponse.json({ status: "TipJar Agent webhook active" });
}
