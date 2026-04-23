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

     // Milestone helpers 
  const addMilestone = () =>
    setMilestones([...milestones, { description: "", amount: "" }]);

  const removeMilestone = (i: number) =>
    setMilestones(milestones.filter((_, idx) => idx !== i));

  const updateMilestone = (
    i: number,
    field: keyof MilestoneItem,
    value: string,
  ) =>
    setMilestones(
      milestones.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)),
    );


    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!address) {
      setError(
        isMiniPay
          ? "Wallet not connected. Please restart MiniPay."
          : isFarcaster
            ? "Wallet not connected. Please restart the Farcaster app."
            : "No wallet detected.",
      );
      return;
    }

    if (!walletClient) {
      setError("Wallet client not ready. Please try again.");
      return;
    }

    // Validate
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!clientWallet.trim()) {
      setError("Client wallet address is required.");
      return;
    }
    if (invoiceAmount <= 0) {
      setError("Invoice amount must be greater than 0.");
      return;
    }
    if (!dueDate && invoiceType !== "Milestone") {
      setError("Due date is required.");
      return;
    }

    if (invoiceType === "Milestone") {
      if (milestones.some((m) => !m.description.trim() || !m.amount)) {
        setError("All milestone phases require a description and amount.");
        return;
      }
    } else {
      if (
        lineItems.some((item) => !item.description.trim() || !item.unitPrice)
      ) {
        setError("All line items require a description and price.");
        return;
      }
    }

    setIsPending(true);

    try {
      //  Step 1: Upload metadata to IPFS 
      setStep("uploading");
      setIsUploadingIPFS(true);

      const token = TOKENS[selectedToken];

      const metadataCID = await prepareAndUploadMetadata({
        title: title.trim(),
        tokenSymbol: selectedToken,
        tokenDecimals: token.decimals,
        notes: notes.trim() || undefined,
        ...(invoiceType === "Milestone"
          ? {
              milestones: milestones.map((m, i) => ({
                index: i,
                description: m.description.trim(),
              })),
            }
          : {
              items: lineItems.map((item) => ({
                name: item.description.trim(),
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: (item.quantity * parseFloat(item.unitPrice)).toFixed(
                  token.decimals > 6 ? 6 : token.decimals,
                ),
              })),
            }),
      });

      setIsUploadingIPFS(false);
      setStep("confirming");

      //  Step 2: Build contract args 
      const dueDateTimestamp = dueDate
        ? BigInt(Math.floor(new Date(dueDate).getTime() / 1000))
        : BigInt(0);

      const lateFeesBpsValue = lateFeesBps
        ? BigInt(Math.round(parseFloat(lateFeesBps) * 100)) // e.g. 0.5% → 50 bps
        : BigInt(0);

      //  Step 3: Call contract 
      let hash: `0x${string}`;

      if (invoiceType === "Milestone") {
        const milestoneAmounts = milestones.map((m) =>
          parseUnits(m.amount, token.decimals),
        );

        hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: contractAbi.abi,
          functionName: "createMilestoneInvoice",
          args: [
            clientWallet as `0x${string}`, // client
            token.address, // token
            dueDateTimestamp, // dueDate (0 = none for milestone)
            milestoneAmounts, // milestoneAmounts[]
            metadataCID, // metadataCID
          ],
          chain: CHAIN,
          account: address,
        });
      } else {
        const amountInUnits = parseUnits(
          invoiceAmount.toFixed(token.decimals > 6 ? 6 : token.decimals),
          token.decimals,
        );

        hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: contractAbi.abi,
          functionName: "createInvoice",
          args: [
            clientWallet as `0x${string}`, // client
            token.address, // token
            amountInUnits, // amount
            dueDateTimestamp, // dueDate
            lateFeesBpsValue, // lateFeesBps
            invoiceType === "Recurring", // isRecurring
            BigInt(invoiceType === "Recurring" ? INTERVAL_MAP[interval] : 0), // interval (0 = None for Standard)
            metadataCID, // metadataCID
          ],
          chain: CHAIN,
          account: address,
        });
      }

      setTxHash(hash);
      router.push(`/invoice-created/${hash}`);
    } catch (err: any) {
      console.error(err);
      setError(err?.shortMessage ?? err?.message ?? "Transaction failed");
      setStep("form");
    } finally {
      setIsPending(false);
      setIsUploadingIPFS(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-[#F9FAFB]">
        {/* Header */}
        <div className="bg-[#1B4332] px-6 py-6 flex items-center gap-4">
          <button onClick={() => router.back()} className="text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-white text-xl font-bold">Create Invoice</h1>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 pb-32">
          {/* ── Invoice Type ─────────────────────────────────────────────── */}
          <div>
            <label className="text-sm text-gray-600 mb-2 block font-medium">
              Invoice Type
            </label>
            <div className="flex gap-2">
              {(["Standard", "Recurring", "Milestone"] as InvoiceType[]).map(
                (type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setInvoiceType(type)}
                    className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${
                      invoiceType === type
                        ? "bg-[#1B4332] text-white border-[#1B4332]"
                        : "bg-white text-gray-600 border-gray-200"
                    }`}
                  >
                    {type}
                  </button>
                ),
              )}
            </div>
          </div>
