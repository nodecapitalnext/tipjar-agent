import { NextRequest, NextResponse } from "next/server";
import { decodeEventLog } from "viem";
import { TIP_SENT_ABI, TIPJAR_ADDRESS } from "@/lib/config";
import { mintThankYouNFT, formatAmount } from "@/lib/nft";
import { castTip } from "@/lib/farcaster";

const MIN_THRESHOLD = BigInt("100000000000000"); // 0.0001 ETH

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body).slice(0, 500));

    // Collect all logs from various Alchemy webhook formats
    const allLogs: unknown[] = [];

    // Format 1: event.activity[].log
    const activity = body?.event?.activity || body?.activity || [];
    for (const item of activity) {
      if (item?.log) allLogs.push(item.log);
      if (item?.logs) allLogs.push(...item.logs);
    }

    // Format 2: event.data.block.logs
    const blockLogs = body?.event?.data?.block?.logs || [];
    allLogs.push(...blockLogs);

    // Format 3: direct logs array
    if (Array.isArray(body?.logs)) allLogs.push(...body.logs);

    console.log(`Total logs to process: ${allLogs.length}`);

    const results = [];

    for (const log of allLogs) {
      const l = log as Record<string, unknown>;

      // Only process TipJar logs
      if (String(l.address || "").toLowerCase() !== TIPJAR_ADDRESS.toLowerCase()) continue;

      // Decode TipSent event
      let decoded;
      try {
        decoded = decodeEventLog({
          abi:    TIP_SENT_ABI,
          data:   l.data as `0x${string}`,
          topics: l.topics as [`0x${string}`, ...`0x${string}`[]],
        });
      } catch (_e) {
        continue;
      }

      const { from, to, amount, token, message } = decoded.args as {
        from: string; to: string; amount: bigint;
        token: string; message: string;
      };

      const amountStr = formatAmount(amount, token);
      console.log(`TipSent: ${amountStr} from ${from.slice(0,10)}...`);

      const result: Record<string, unknown> = {
        from, to,
        amount:  amount.toString(),
        token,
        message,
        txHash:  l.transactionHash,
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
          console.log(`NFT #${tokenId} minted`);
        } catch (e) {
          result.nftError = String(e);
          console.error("NFT mint failed:", e);
        }

        // 2. Cast on Farcaster
        try {
          const castHash = await castTip({
            from, to, amount, token, message,
            txHash:     String(l.transactionHash || ""),
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

    return NextResponse.json({
      success:   true,
      processed: results.length,
      results,
    });

  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "TipJar Agent webhook active" });
}
