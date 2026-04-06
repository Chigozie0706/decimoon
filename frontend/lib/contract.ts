// lib/contract.ts
import contractAbi from "@/contract/abi.json";
import { celoSepolia, celo } from "wagmi/chains";

export const CONTRACT_ADDRESS =
  "0xDfb4FD0a6A526a2d1fE3c0dA77Be29ac20EE7967" as `0x${string}`;

export const CHAIN = celoSepolia; 

export const CONTRACT_ABI = contractAbi.abi;

export const USDM_TOKEN =
  CHAIN.id === celoSepolia.id
    ? ("0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1" as const)
    : ("0x765DE816845861e75A25fCA122bb6898B8B1282a" as const);

export const FEE_CURRENCY = USDM_TOKEN;

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
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const STATUS_MAP: Record<number, "unpaid" | "paid" | "overdue"> = {
  0: "unpaid",
  1: "paid",
  2: "overdue",
  3: "overdue",
};

export const INTERVAL_MAP: Record<number, string> = {
  0: "weekly",
  1: "biweekly",
  2: "monthly",
};