import { NextRequest, NextResponse } from "next/server";
import { decodeEventLog } from "viem";
import { TIP_SENT_ABI, TIPJAR_ADDRESS } from "@/lib/config";
import { mintThankYouNFT, formatAmount } from "@/lib/nft";
import { castTip } from "@/lib/farcaster";

const MIN_THRESHOLD = BigInt("100000000000000"); // 0.0001 ETH

// TipSent event topic0
const TIP_SENT_TOPIC = "0xa11ebbe219d358b6f0749f74bc1355e99cd107c7d4759804e3b4c450fc91c3f5";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("Webhook body keys:", Object.keys(body));
    console.log("Webhook FULL:", JSON.stringify(body).slice(0, 2000));

    const results = [];
    const allLogs: Array<Record<string, unknown>> = [];

    // ── Format 1: Alchemy Address Activity ──────────────────────────────
    // { type: "ADDRESS_ACTIVITY", event: { activity: [...] } }
    const activity = body?.event?.activity || body?.activity || [];
    for (const item of activity) {
      // Each activity item may have rawContract.rawValue or log
      if (item?.rawContract?.rawValue) {
        // This is a token transfer, skip
        continue;
      }
      // Internal transactions or contract calls
      if (item?.typeTraceAddress) continue;

      // Look for logs in the activity
      if (item?.log) allLogs.push(item.log);
    }

    // ── Format 2: Alchemy Custom Webhook (GraphQL) ───────────────────────
    // { event: { data: { block: { logs: [...] } } } }
    const blockLogs = body?.event?.data?.block?.logs || [];
    for (const log of blockLogs) {
      allLogs.push(log as Record<string, unknown>);
    }

    // ── Format 3: Direct logs array ──────────────────────────────────────
    if (Array.isArray(body?.logs)) {
      for (const log of body.logs) {
        allLogs.push(log as Record<string, unknown>);
      }
    }

    // ── Format 4: Alchemy Address Activity with logs ─────────────────────
    // Sometimes logs are nested differently
    if (body?.event?.activity) {
      for (const item of body.event.activity) {
        if (item?.log?.topics?.[0] === TIP_SENT_TOPIC) {
          allLogs.push(item.log);
        }
      }
    }

    console.log(`Found ${allLogs.length} logs to process`);

    // Process each log
    for (const log of allLogs) {
      const topics = (log.topics || (log as Record<string, unknown>).rawTopics) as string[] | undefined;
      const data   = (log.data || (log as Record<string, unknown>).rawData) as string | undefined;
      const addr   = (log.address || (log as Record<string, unknown>).account) as string | undefined;
      const txHash = (log.transactionHash || (log as Record<string, unknown>).txHash) as string | undefined;

      // Filter by TipJar address and TipSent topic
      if (addr?.toLowerCase() !== TIPJAR_ADDRESS.toLowerCase()) continue;
      if (!topics?.[0] || topics[0].toLowerCase() !== TIP_SENT_TOPIC.toLowerCase()) continue;

      console.log(`TipSent log found! tx: ${txHash}`);

      // Decode event
      let decoded;
      try {
        decoded = decodeEventLog({
          abi:    TIP_SENT_ABI,
          data:   data as `0x${string}`,
          topics: topics as [`0x${string}`, ...`0x${string}`[]],
        });
      } catch (e) {
        console.error("Decode failed:", e);
        continue;
      }

      const { from, to, amount, token, message } = decoded.args as {
        from: string; to: string; amount: bigint;
        token: string; message: string;
      };

      const amountStr = formatAmount(amount, token);
      console.log(`TipSent: ${amountStr} from ${from.slice(0,10)}...`);

      const result: Record<string, unknown> = { from, to, amount: amount.toString(), token, message, txHash };

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
            txHash:     String(txHash || ""),
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

    return NextResponse.json({ success: true, processed: results.length, results });

  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "TipJar Agent webhook active" });
}
