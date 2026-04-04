import { formatEther, formatUnits } from "viem";
import { publicClient, getWalletClient } from "./chain";
import { TIPNFT_ADDRESS, NFT_ABI, ZERO_ADDRESS } from "./config";

export async function mintThankYouNFT(
  tipper:  string,
  creator: string,
  amount:  bigint,
  token:   string,
  message: string
): Promise<{ tokenId: bigint; txHash: string }> {
  const isEth = token === ZERO_ADDRESS;
  const wallet = getWalletClient();

  const txHash = await wallet.writeContract({
    address:      TIPNFT_ADDRESS,
    abi:          NFT_ABI,
    functionName: "mintThankYou",
    args:         [tipper as `0x${string}`, creator as `0x${string}`, amount, isEth, message],
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });

  const tokenId = await publicClient.readContract({
    address:      TIPNFT_ADDRESS,
    abi:          NFT_ABI,
    functionName: "totalMinted",
  }) as bigint;

  return { tokenId, txHash };
}

export function formatAmount(amount: bigint, token: string): string {
  return token === ZERO_ADDRESS
    ? `${Number(formatEther(amount)).toFixed(4)} ETH`
    : `$${Number(formatUnits(amount, 6)).toFixed(2)} USDC`;
}
