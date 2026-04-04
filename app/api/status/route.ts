import { NextResponse } from "next/server";
import { publicClient } from "@/lib/chain";
import { TIPJAR_ADDRESS, TIPNFT_ADDRESS } from "@/lib/config";

export async function GET() {
  const block = await publicClient.getBlockNumber();
  return NextResponse.json({
    status:       "running",
    network:      "Base Sepolia",
    block:        block.toString(),
    tipjar:       TIPJAR_ADDRESS,
    tipnft:       TIPNFT_ADDRESS,
    farcaster:    !!process.env.NEYNAR_API_KEY,
    timestamp:    new Date().toISOString(),
  });
}
