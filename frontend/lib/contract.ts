import { celo, celoSepolia } from "wagmi/chains";
import { Abi } from "viem";
import contractAbi from "@/contract/abi.json";

const IS_TESTNET = false; // ← flip to true for Sepolia

export const CHAIN = IS_TESTNET ? celoSepolia : celo;
export const ABI = contractAbi.abi as Abi;

export const CONTRACT_ADDRESS =
  "0x7908AEa0861A5B949B044826a6DDaA3Ed7e88ab0" as `0x${string}`;

export const USDM_SEPOLIA =
  "0xdE9e4C3ce781b4bA68120d6261cbad65ce0aB00b" as const;
export const USDM_MAINNET =
  "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const;
export const USDM_TOKEN = IS_TESTNET ? USDM_SEPOLIA : USDM_MAINNET;
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