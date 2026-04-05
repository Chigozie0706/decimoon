"use client";

import { useParams, useRouter } from "next/navigation";
import { Layout } from "./Layout";
import { StatusBadge } from "./StatusBadge";
import {
  ArrowLeft,
  Share2,
  XCircle,
  Receipt,
  Calendar,
  User,
  Wallet,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useReadContract, useWaitForTransactionReceipt } from "wagmi";
import { useConnectorClient } from "wagmi";
import { walletActions, formatUnits, parseUnits } from "viem";
import { celoSepolia } from "wagmi/chains";
import { useWallet } from "@/hooks/use-wallet";
import { useState } from "react";

const CONTRACT_ADDRESS =
  "0xDfb4FD0a6A526a2d1fE3c0dA77Be29ac20EE7967" as `0x${string}`;
const CHAIN = celoSepolia;

// USDm — pay gas in USDm, no CELO needed
const USDM_SEPOLIA = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1" as const;
const USDM_MAINNET = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const;
const FEE_CURRENCY = CHAIN.id === celoSepolia.id ? USDM_SEPOLIA : USDM_MAINNET;

const STATUS_MAP: Record<number, "unpaid" | "paid" | "overdue"> = {
  0: "unpaid",
  1: "paid",
  2: "overdue",
  3: "overdue",
};

const INTERVAL_MAP: Record<number, string> = {
  0: "weekly",
  1: "biweekly",
  2: "monthly",
};

const CONTRACT_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "id", type: "uint256" }],
    name: "getInvoice",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "id", type: "uint256" },
          { internalType: "address", name: "creator", type: "address" },
          { internalType: "address", name: "client", type: "address" },
          { internalType: "string", name: "title", type: "string" },
          { internalType: "string", name: "description", type: "string" },
          { internalType: "uint256", name: "amount", type: "uint256" },
          { internalType: "uint256", name: "dueDate", type: "uint256" },
          { internalType: "uint8", name: "status", type: "uint8" },
          { internalType: "bool", name: "isRecurring", type: "bool" },
          { internalType: "uint8", name: "interval", type: "uint8" },
          { internalType: "uint256", name: "nextDueDate", type: "uint256" },
          { internalType: "uint256", name: "totalCollected", type: "uint256" },
          { internalType: "uint256", name: "createdAt", type: "uint256" },
          { internalType: "uint256", name: "paidAt", type: "uint256" },
        ],
        internalType: "struct Decimoon1.Invoice",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "id", type: "uint256" }],
    name: "payInvoice",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "id", type: "uint256" }],
    name: "cancelInvoice",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export default function InvoiceDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { address } = useWallet();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invoiceId = BigInt(id as string);

  // Fetch invoice from contract
  const {
    data: rawInvoice,
    isLoading,
    refetch,
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getInvoice",
    args: [invoiceId],
    chainId: CHAIN.id,
  });

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
    onReplaced: () => refetch(),
  });

  // Refetch after tx confirms
  const { isLoading: isWaiting } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Get wallet client for transactions
  const { data: connectorClient } = useConnectorClient({ chainId: CHAIN.id });
  const walletClient = connectorClient?.extend(walletActions);

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-[#1B4332] mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Loading invoice...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!rawInvoice) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600" style={{ fontWeight: 600 }}>
              Invoice not found
            </p>
            <button
              onClick={() => router.back()}
              className="mt-4 text-[#1B4332] text-sm underline"
            >
              Go back
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const inv = rawInvoice as {
    id: bigint;
    creator: `0x${string}`;
    client: `0x${string}`;
    title: string;
    description: string;
    amount: bigint;
    dueDate: bigint;
    status: number;
    isRecurring: boolean;
    interval: number;
    createdAt: bigint;
    paidAt: bigint;
  };

  const status = STATUS_MAP[inv.status] ?? "unpaid";
  const amount = parseFloat(formatUnits(inv.amount, 18));
  const platformFee = (amount * 0.02).toFixed(2);
  const netAmount = (amount * 0.98).toFixed(2);
  const dueDate = new Date(Number(inv.dueDate) * 1000).toLocaleDateString();
  const createdAt = new Date(Number(inv.createdAt) * 1000).toLocaleDateString();

  // Determine viewer role
  const isCreator = address?.toLowerCase() === inv.creator.toLowerCase();
  const isClient = address?.toLowerCase() === inv.client.toLowerCase();
  const isSubmitting = isPending || isConfirming;

  const handleShare = () => {
    if (typeof window === "undefined") return;
    const link = `${window.location.origin}/invoice-detail/${inv.id.toString()}`;
    navigator.clipboard.writeText(link);
    toast.success("Invoice link copied!");
  };

  const handlePay = async () => {
    if (!walletClient || !address) {
      toast.error("Wallet not ready");
      return;
    }

    setError(null);
    setIsPending(true);
    try {
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "payInvoice",
        args: [invoiceId],
        feeCurrency: FEE_CURRENCY,
        chain: CHAIN,
        account: address,
      });
      setTxHash(hash);
      toast.success("Payment submitted! Confirming...");
      // Refetch after confirmation
      setTimeout(() => refetch(), 3000);
    } catch (err: any) {
      console.error(err);
      const msg = err?.shortMessage ?? err?.message ?? "Payment failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsPending(false);
    }
  };

  const handleCancel = async () => {
    if (!walletClient || !address) {
      toast.error("Wallet not ready");
      return;
    }

    if (!confirm("Are you sure you want to cancel this invoice?")) return;

    setError(null);
    setIsPending(true);
    try {
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "cancelInvoice",
        args: [invoiceId],
        feeCurrency: FEE_CURRENCY,
        chain: CHAIN,
        account: address,
      });
      setTxHash(hash);
      toast.success("Invoice cancelled");
      setTimeout(() => router.push("/invoices"), 3000);
    } catch (err: any) {
      console.error(err);
      const msg = err?.shortMessage ?? err?.message ?? "Cancellation failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-[#F9FAFB]">
        {/* Header */}
        <div className="bg-[#1B4332] px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="text-white">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-white text-xl" style={{ fontWeight: 700 }}>
              Invoice Details
            </h1>
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="p-6 space-y-6">
          {/* Main Info Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-xs text-gray-500 mb-1">Invoice ID</p>
                <p className="text-sm font-mono" style={{ fontWeight: 600 }}>
                  #{inv.id.toString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-1">Created</p>
                <p className="text-sm" style={{ fontWeight: 600 }}>
                  {createdAt}
                </p>
              </div>
            </div>

            <h2 className="text-2xl mb-2" style={{ fontWeight: 700 }}>
              {inv.title}
            </h2>
            <p className="text-gray-600 mb-6">{inv.description}</p>

            {/* Amount Breakdown */}
            <div className="bg-[#F9FAFB] rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-600">Invoice Amount</span>
                <span className="text-xl" style={{ fontWeight: 700 }}>
                  {amount.toFixed(2)} USDm
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                <span>Platform Fee (2%)</span>
                <span>-{platformFee} USDm</span>
              </div>
              <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
                <span className="text-[#1B4332]" style={{ fontWeight: 600 }}>
                  {isClient ? "You Pay" : "You Receive"}
                </span>
                <span
                  className="text-2xl text-[#1B4332]"
                  style={{ fontWeight: 700 }}
                >
                  {isClient ? amount.toFixed(2) : netAmount} USDm
                </span>
              </div>
            </div>

            {/* Wallet Details */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Wallet className="w-5 h-5 text-gray-400 mt-1" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">From (Creator)</p>
                  <p
                    className="text-sm font-mono break-all"
                    style={{ fontWeight: 600 }}
                  >
                    {inv.creator}
                    {isCreator && (
                      <span className="ml-2 text-xs text-[#1B4332] bg-[#1B4332]/10 px-1.5 py-0.5 rounded-full">
                        You
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-400 mt-1" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">To (Client)</p>
                  <p
                    className="text-sm font-mono break-all"
                    style={{ fontWeight: 600 }}
                  >
                    {inv.client}
                    {isClient && (
                      <span className="ml-2 text-xs text-[#1B4332] bg-[#1B4332]/10 px-1.5 py-0.5 rounded-full">
                        You
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-1" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Due Date</p>
                  <p className="text-sm" style={{ fontWeight: 600 }}>
                    {dueDate}
                  </p>
                </div>
              </div>
            </div>

            {inv.isRecurring && (
              <div className="mt-4 p-3 bg-[#F59E0B]/10 rounded-lg">
                <p
                  className="text-sm text-[#F59E0B]"
                  style={{ fontWeight: 600 }}
                >
                  🔄 Recurring {INTERVAL_MAP[inv.interval]}
                </p>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Confirming banner */}
          {isConfirming && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-center gap-2 text-yellow-700 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Confirming on-chain...
            </div>
          )}

          {/* Action Buttons — differ by role */}
          <div className="space-y-3">
            {/* CREATOR actions */}
            {isCreator && (
              <>
                <button
                  onClick={handleShare}
                  className="w-full bg-[#1B4332] text-white py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                  style={{ fontWeight: 600 }}
                >
                  <Share2 className="w-5 h-5" />
                  Share Payment Link
                </button>

                {status === "paid" && (
                  <button
                    onClick={() => router.push(`/receipt/${inv.id.toString()}`)}
                    className="w-full bg-[#22C55E] text-white py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                    style={{ fontWeight: 600 }}
                  >
                    <Receipt className="w-5 h-5" />
                    View Receipt
                  </button>
                )}

                {status !== "paid" && (
                  <button
                    onClick={handleCancel}
                    disabled={isSubmitting}
                    className="w-full bg-white border-2 border-[#EF4444] text-[#EF4444] py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-red-50 transition-colors disabled:opacity-50"
                    style={{ fontWeight: 600 }}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <XCircle className="w-5 h-5" />
                    )}
                    {isPending
                      ? "Confirm in wallet..."
                      : isConfirming
                        ? "Cancelling..."
                        : "Cancel Invoice"}
                  </button>
                )}
              </>
            )}

            {/* CLIENT actions */}
            {isClient && (
              <>
                {status === "unpaid" || status === "overdue" ? (
                  <button
                    onClick={handlePay}
                    disabled={isSubmitting}
                    className="w-full bg-[#1B4332] text-white py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                    style={{ fontWeight: 600 }}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Wallet className="w-5 h-5" />
                    )}
                    {isPending
                      ? "Confirm in wallet..."
                      : isConfirming
                        ? "Confirming payment..."
                        : `Pay ${amount.toFixed(2)} USDm`}
                  </button>
                ) : (
                  <div className="w-full bg-[#22C55E]/10 border border-[#22C55E]/20 text-[#22C55E] py-4 rounded-xl flex items-center justify-center gap-2">
                    <Receipt className="w-5 h-5" />
                    <span style={{ fontWeight: 600 }}>Paid ✓</span>
                  </div>
                )}
              </>
            )}

            {/* Neither creator nor client — just share */}
            {!isCreator && !isClient && (
              <button
                onClick={handleShare}
                className="w-full bg-[#1B4332] text-white py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                style={{ fontWeight: 600 }}
              >
                <Share2 className="w-5 h-5" />
                Share Invoice Link
              </button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
