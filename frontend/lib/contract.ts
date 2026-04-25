import { celo, celoSepolia } from "wagmi/chains";
import { Abi } from "viem";
import contractAbi from "@/contract/abi.json";

const IS_TESTNET = false; // ← flip to true for Sepolia

export const CHAIN = IS_TESTNET ? celoSepolia : celo;
export const ABI = contractAbi.abi as Abi;

export const CONTRACT_ADDRESS =
  "0x7908AEa0861A5B949B044826a6DDaA3Ed7e88ab0" as `0x${string}`;


  // Token addresses
export const TOKEN_ADDRESSES = {
  cUSD: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as `0x${string}`,
  cEUR: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73" as `0x${string}`,
  USDT: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" as `0x${string}`,
  USDC: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" as `0x${string}`,
} as const;


// Adapter addresses for 6-decimal tokens (used as feeCurrency)
export const TOKEN_ADAPTERS: Record<string, `0x${string}`> = {
  // 6-decimal tokens need an adapter
  "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e":
    "0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72", // USDT adapter
  "0xceba9300f2b948710d2653dd7b07f33a8b32118c":
    "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B", // USDC adapter
};


export function getFeeCurrency(tokenAddress: `0x${string}`): `0x${string}` {
  const adapter = TOKEN_ADAPTERS[tokenAddress.toLowerCase()];
  return adapter ?? tokenAddress; // fallback to token address for 18-decimal tokens
}


// export const USDM_SEPOLIA =
//   "0xdE9e4C3ce781b4bA68120d6261cbad65ce0aB00b" as const;
// export const USDM_MAINNET =
//   "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const;
// export const USDM_TOKEN = IS_TESTNET ? USDM_SEPOLIA : USDM_MAINNET;
// export const FEE_CURRENCY = USDM_TOKEN;

export const USDM_ABI = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;


// enum Status { Unpaid=0, Paid=1, Cancelled=2, Overdue=3 }
export const STATUS_MAP: Record<number, "unpaid" | "paid" | "cancelled" | "overdue"> = {
  0: "unpaid",
  1: "paid",
  2: "cancelled",
  3: "overdue",
};

// enum Interval { None=0, Weekly=1, Biweekly=2, Monthly=3 }
export const INTERVAL_MAP: Record<string, number> = {
  weekly: 1,
  biweekly: 2,
  monthly: 3,
};

export const INTERVAL_DISPLAY: Record<number, string> = {
  0: "None",
  1: "Weekly",
  2: "Biweekly",
  3: "Monthly",
};