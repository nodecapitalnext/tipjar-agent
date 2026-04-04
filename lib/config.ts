export const TIPJAR_ADDRESS  = "0x6a37caE0E1A7376eEC2626b0AEF42Be6D8Cdf758" as const;
export const TIPNFT_ADDRESS  = "0x6E1eED15536be5D2b2D67490b0B89db1A6E087D9" as const;
export const ZERO_ADDRESS    = "0x0000000000000000000000000000000000000000" as const;
export const BASE_SEPOLIA_RPC = "https://sepolia.base.org";
export const TIPJAR_URL      = "https://frontend-nodec.vercel.app";

export const TIP_SENT_ABI = [{
  type: "event",
  name: "TipSent",
  inputs: [
    { name: "from",      type: "address", indexed: true  },
    { name: "to",        type: "address", indexed: true  },
    { name: "amount",    type: "uint256", indexed: false },
    { name: "token",     type: "address", indexed: false },
    { name: "message",   type: "string",  indexed: false },
    { name: "timestamp", type: "uint256", indexed: false },
  ],
}] as const;

export const NFT_ABI = [{
  type: "function",
  name: "mintThankYou",
  stateMutability: "nonpayable",
  inputs: [
    { name: "tipper",  type: "address" },
    { name: "creator", type: "address" },
    { name: "amount",  type: "uint256" },
    { name: "isEth",   type: "bool"    },
    { name: "message", type: "string"  },
  ],
  outputs: [{ type: "uint256" }],
}, {
  type: "function",
  name: "totalMinted",
  stateMutability: "view",
  inputs: [],
  outputs: [{ type: "uint256" }],
}] as const;
