"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Layout } from "./Layout";
import { ArrowLeft, Plus, Trash2, Calendar, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useWaitForTransactionReceipt, useConnectorClient } from "wagmi";
import { walletActions, parseUnits, encodeFunctionData } from "viem";
import { celo } from "wagmi/chains";
import { useWallet } from "@/hooks/use-wallet";
import contractAbi from "../contract/abi.json";
import { prepareAndUploadMetadata } from "@/lib/decimoon-ipfs";

// Contract config
const CONTRACT_ADDRESS =
  "0x0f42F76C461f2F403bd797Ca8a023686dc8B4753" as `0x${string}`;
const CHAIN = celo;

// Supported tokens
const TOKENS = {
  cUSD: {
    address: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as `0x${string}`,
    decimals: 18,
    symbol: "cUSD",
    color: "bg-green-100 text-green-800",
  },
  cEUR: {
    address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73" as `0x${string}`,
    decimals: 18,
    symbol: "cEUR",
    color: "bg-blue-100 text-blue-800",
  },
  cKES: {
    address: "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0" as `0x${string}`,
    decimals: 18,
    symbol: "cKES",
    color: "bg-amber-100 text-amber-800",
  },
  USDC: {
    address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" as `0x${string}`,
    decimals: 6,
    symbol: "USDC",
    color: "bg-blue-50 text-blue-600",
  },
} as const;

type TokenKey = keyof typeof TOKENS;
type InvoiceType = "Standard" | "Recurring" | "Milestone";
type Interval = "weekly" | "biweekly" | "monthly";

// Interval enum matches contract: None=0, Weekly=1, Biweekly=2, Monthly=3
const INTERVAL_MAP: Record<Interval, number> = {
  weekly: 1,
  biweekly: 2,
  monthly: 3,
};

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: string;
}

interface MilestoneItem {
  description: string;
  amount: string;
}
