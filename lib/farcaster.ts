import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";
import { TIPJAR_URL, ZERO_ADDRESS } from "./config";
import { formatAmount } from "./nft";

let _client: NeynarAPIClient | null = null;

function getClient(): NeynarAPIClient {
  if (!_client) {
    const apiKey = process.env.NEYNAR_API_KEY!;
    _client = new NeynarAPIClient(new Configuration({ apiKey }));
  }
  return _client;
}

export async function castTip(params: {
  from:       string;
  to:         string;
  amount:     bigint;
  token:      string;
  message:    string;
  txHash:     string;
  nftTokenId?: bigint;
}): Promise<string> {
  const signerUuid = process.env.NEYNAR_SIGNER_UUID!;
  const amountStr  = formatAmount(params.amount, params.token);
  const from       = `${params.from.slice(0, 6)}...${params.from.slice(-4)}`;
  const to         = `${params.to.slice(0, 6)}...${params.to.slice(-4)}`;
  const nftPart    = params.nftTokenId ? `\n🎨 Thank You NFT #${params.nftTokenId} minted!` : "";
  const msgPart    = params.message ? `\n💬 "${params.message}"` : "";

  const text = [
    `⚡ New tip on TipJar!`,
    ``,
    `💸 ${amountStr}`,
    `👤 From: ${from}`,
    `🎯 To: ${to}`,
    msgPart,
    nftPart,
    ``,
    `🔗 ${TIPJAR_URL}`,
    `#Base #TipJar #BuildOnBase`,
  ].filter(Boolean).join("\n");

  const res = await getClient().publishCast({
    signerUuid,
    text,
    embeds: [{ url: TIPJAR_URL }],
  });

  return res.cast.hash;
}
