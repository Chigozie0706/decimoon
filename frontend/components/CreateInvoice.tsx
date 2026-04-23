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


export default function CreateInvoice() {
  const router = useRouter();
  const { address, isMiniPay, isFarcaster } = useWallet();

    //  Form state 
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("Standard");
  const [selectedToken, setSelectedToken] = useState<TokenKey>("cUSD");
  const [title, setTitle] = useState("");
  const [clientWallet, setClientWallet] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [lateFeesBps, setLateFeesBps] = useState("");
  const [notes, setNotes] = useState("");
  const [interval, setInterval] = useState<Interval>("monthly");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: "" },
  ]);
  const [milestones, setMilestones] = useState<MilestoneItem[]>([
    { description: "", amount: "" },
  ]);

  //  UI state 
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isUploadingIPFS, setIsUploadingIPFS] = useState(false);
  const [step, setStep] = useState<"form" | "uploading" | "confirming">("form");

  const { data: connectorClient } = useConnectorClient({ chainId: CHAIN.id });
  const walletClient = connectorClient?.extend(walletActions);

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const isSubmitting = isPending || isConfirming || isUploadingIPFS;


  //  Calculations 
  const lineItemTotal = lineItems.reduce((sum, item) => {
    const price = parseFloat(item.unitPrice) || 0;
    return sum + item.quantity * price;
  }, 0);

  const milestoneTotal = milestones.reduce((sum, m) => {
    return sum + (parseFloat(m.amount) || 0);
  }, 0);

  const invoiceAmount =
    invoiceType === "Milestone" ? milestoneTotal : lineItemTotal;
  const platformFee = invoiceAmount * 0.02;
  const clientTotal = invoiceAmount + platformFee;


  //  Line item helpers 
  const addLineItem = () =>
    setLineItems([
      ...lineItems,
      { description: "", quantity: 1, unitPrice: "" },
    ]);

  const removeLineItem = (i: number) =>
    setLineItems(lineItems.filter((_, idx) => idx !== i));

  const updateLineItem = (
    i: number,
    field: keyof LineItem,
    value: string | number,
  ) =>
    setLineItems(
      lineItems.map((item, idx) =>
        idx === i ? { ...item, [field]: value } : item,
      ),
    );
