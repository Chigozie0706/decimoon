"use client";

import { useParams, useRouter } from "next/navigation";
import { Layout } from "./Layout";
import { StatusBadge, TokenBadge, TypeBadge } from "./StatusBadge";
import {
  ArrowLeft,
  Share2,
  XCircle,
  Receipt,
  Calendar,
  Wallet,
  Loader2,
  AlertTriangle,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Edit3,
} from "lucide-react";
import { toast } from "sonner";
import { useReadContract, useWaitForTransactionReceipt } from "wagmi";
import { useConnectorClient } from "wagmi";
import { walletActions, formatUnits } from "viem";
import { useWallet } from "@/hooks/use-wallet";
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  CONTRACT_ADDRESS,
  ABI,
  CHAIN,
  FEE_CURRENCY,
  USDM_ABI,
} from "@/lib/contract";

//  Token config ─
const TOKEN_CONFIG: Record<string, { symbol: string; decimals: number }> = {
  "0x765de816845861e75a25fca122bb6898b8b1282a": {
    symbol: "cUSD",
    decimals: 18,
  },
  "0xd8763cba276a3738e6de85b4b3bf5fded6d6ca73": {
    symbol: "cEUR",
    decimals: 18,
  },
  "0x456a3d042c0dbd3db53d5489e98dfb038553b0d0": {
    symbol: "cKES",
    decimals: 18,
  },
  "0xceba9300f2b948710d2653dd7b07f33a8b32118c": { symbol: "USDC", decimals: 6 },
};

//  Status / Type maps ─
const STATUS_MAP: Record<number, string> = {
  0: "Unpaid",
  1: "Paid",
  2: "Cancelled",
  3: "Overdue",
  4: "Disputed",
};

const INVOICE_TYPE_MAP: Record<number, string> = {
  0: "Standard",
  1: "Recurring",
  2: "Milestone",
};

const INTERVAL_DISPLAY: Record<number, string> = {
  0: "None",
  1: "Weekly",
  2: "Biweekly",
  3: "Monthly",
};

//  On-chain Invoice type
interface OnChainInvoice {
  id: bigint;
  invoiceRef: string;
  metadataCID: string;
  creator: `0x${string}`;
  client: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
  dueDate: bigint;
  status: number;
  invoiceType: number;
  lateFeesBps: bigint;
  interval: number;
  nextDueDate: bigint;
  totalCollected: bigint;
  milestonesReleased: bigint;
  createdAt: bigint;
  paidAt: bigint;
  disputeReason: string;
}

//  IPFS Metadata type ─
interface IPFSMetadata {
  title?: string;
  notes?: string;
  tokenSymbol?: string;
  items?: {
    name: string;
    quantity: number;
    unitPrice: string;
    total: string;
  }[];
  milestones?: {
    index: number;
    description: string;
  }[];
}

//  Component
export default function InvoiceDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { address } = useWallet();

  //  State
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<
    "idle" | "approving" | "paying" | "cancelling" | "disputing"
  >("idle");
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>();
  const [payHash, setPayHash] = useState<`0x${string}` | undefined>();
  const [cancelHash, setCancelHash] = useState<`0x${string}` | undefined>();
  const [disputeHash, setDisputeHash] = useState<`0x${string}` | undefined>();
  const [metadata, setMetadata] = useState<IPFSMetadata | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [showDisputeInput, setShowDisputeInput] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");

  const invoiceId = BigInt(id as string);

  //  Contract reads
  const {
    data: rawInvoice,
    isLoading,
    refetch,
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "getInvoice",
    args: [invoiceId],
    chainId: CHAIN.id,
  });

  // Get exact client total (includes platform fee + any late fee)
  const { data: clientTotal } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "getClientTotal",
    args: [invoiceId],
    chainId: CHAIN.id,
    query: { enabled: !!rawInvoice },
  });

  // Get full fee breakdown for display
  const { data: feeBreakdown } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "calculateTotalDue",
    args: [invoiceId],
    chainId: CHAIN.id,
    query: { enabled: !!rawInvoice },
  });

  const { data: connectorClient } = useConnectorClient({ chainId: CHAIN.id });
  const walletClient = connectorClient?.extend(walletActions);

  //  Transaction watchers
  const { isSuccess: isApproved } = useWaitForTransactionReceipt({
    hash: approveHash,
  });
  const { isLoading: isConfirmingPay, isSuccess: isPaid } =
    useWaitForTransactionReceipt({ hash: payHash });
  const { isLoading: isConfirmingCancel, isSuccess: isCancelled } =
    useWaitForTransactionReceipt({ hash: cancelHash });
  const { isLoading: isConfirmingDispute, isSuccess: isDisputed } =
    useWaitForTransactionReceipt({ hash: disputeHash });

  //  Effects ─

  // Approval confirmed → send payment
  useEffect(() => {
    if (!isApproved || step !== "approving" || !walletClient || !address)
      return;
    setStep("paying");
    toast.info("Step 2/2: Sending payment...");

    walletClient
      .writeContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "payInvoice",
        args: [invoiceId],
        feeCurrency: FEE_CURRENCY,
        chain: CHAIN,
        account: address,
      })
      .then((hash) => {
        setPayHash(hash);
        toast.success("Payment submitted! Confirming...");
      })
      .catch((err: any) => {
        const msg = err?.shortMessage ?? err?.message ?? "Payment failed";
        setError(msg);
        toast.error(msg);
        setStep("idle");
        setIsPending(false);
      });
  }, [isApproved]);

  // Payment confirmed
  useEffect(() => {
    if (!isPaid) return;
    toast.success("Payment confirmed! ✓");
    setStep("idle");
    setIsPending(false);
    refetch();
  }, [isPaid]);

  // Cancel confirmed
  useEffect(() => {
    if (!isCancelled) return;
    toast.success("Invoice cancelled");
    setIsPending(false);
    setStep("idle");
    refetch();
  }, [isCancelled]);

  // Dispute confirmed
  useEffect(() => {
    if (!isDisputed) return;
    toast.success("Dispute raised successfully");
    setIsPending(false);
    setStep("idle");
    setShowDisputeInput(false);
    refetch();
  }, [isDisputed]);

  // Fetch IPFS metadata
  useEffect(() => {
    const inv = rawInvoice as OnChainInvoice | undefined;
    if (!inv?.metadataCID) return;
    setMetaLoading(true);
    const gateway =
      process.env.NEXT_PUBLIC_PINATA_GATEWAY ?? "https://gateway.pinata.cloud";
    fetch(`${gateway}/ipfs/${inv.metadataCID}`)
      .then((r) => r.json())
      .then((data) => setMetadata(data))
      .catch(() => setMetadata(null))
      .finally(() => setMetaLoading(false));
  }, [(rawInvoice as any)?.metadataCID]);

  //  Loading / not found states
  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
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
        <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
          <div className="text-center px-6">
            <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-semibold">Invoice not found</p>
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

  //  Parse on-chain data ─
  const inv = rawInvoice as OnChainInvoice;

  const tokenKey = inv.token.toLowerCase();
  const tokenInfo = TOKEN_CONFIG[tokenKey] ?? { symbol: "cUSD", decimals: 18 };
  const status = STATUS_MAP[inv.status] ?? "Unpaid";
  const invoiceType = INVOICE_TYPE_MAP[inv.invoiceType] ?? "Standard";

  const amount = parseFloat(formatUnits(inv.amount, tokenInfo.decimals));
  const platformFee = amount * 0.02;
  const clientPays = amount + platformFee; // creator gets full amount

  // Late fee from contract breakdown
  const breakdown = feeBreakdown as any;
  const lateFee = breakdown
    ? parseFloat(formatUnits(breakdown[1] as bigint, tokenInfo.decimals))
    : 0;
  const daysLate = breakdown ? Number(breakdown[2]) : 0;

  // Exact approval amount from contract
  const approvalAmount = clientTotal as bigint | undefined;

  const dueDate =
    inv.dueDate > BigInt(0)
      ? new Date(Number(inv.dueDate) * 1000).toLocaleDateString()
      : "No deadline";
  const createdAt = new Date(Number(inv.createdAt) * 1000).toLocaleDateString();
  const paidAt =
    inv.paidAt > BigInt(0)
      ? new Date(Number(inv.paidAt) * 1000).toLocaleDateString()
      : null;
  const nextDueDate =
    inv.nextDueDate > BigInt(0)
      ? new Date(Number(inv.nextDueDate) * 1000).toLocaleDateString()
      : null;
  const totalCollected = parseFloat(
    formatUnits(inv.totalCollected, tokenInfo.decimals),
  );

  const isCreator = address?.toLowerCase() === inv.creator.toLowerCase();
  const isClient = address?.toLowerCase() === inv.client.toLowerCase();
  const isOpenInvoice =
    inv.client === "0x0000000000000000000000000000000000000000";
  const isSubmitting =
    isPending || isConfirmingPay || isConfirmingCancel || isConfirmingDispute;
  const canPay = status === "Unpaid" || status === "Overdue";
  const canCancel = isCreator && (status === "Unpaid" || status === "Overdue");
  const canDispute =
    (isCreator || isClient) &&
    status !== "Paid" &&
    status !== "Cancelled" &&
    status !== "Disputed";

  //  Handlers
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
    if (!approvalAmount) {
      toast.error("Could not calculate payment amount");
      return;
    }

    setError(null);
    setIsPending(true);
    setStep("approving");

    try {
      toast.info("Step 1/2: Approving token spend...");
      const hash = await walletClient.writeContract({
        address: inv.token,
        abi: USDM_ABI,
        functionName: "approve",
        args: [CONTRACT_ADDRESS, approvalAmount],
        feeCurrency: FEE_CURRENCY,
        chain: CHAIN,
        account: address,
      });
      setApproveHash(hash);
      toast.info("Waiting for approval confirmation...");
    } catch (err: any) {
      const msg = err?.shortMessage ?? err?.message ?? "Approval failed";
      setError(msg);
      toast.error(msg);
      setStep("idle");
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
    setStep("cancelling");

    try {
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "cancelInvoice",
        args: [invoiceId],
        feeCurrency: FEE_CURRENCY,
        chain: CHAIN,
        account: address,
      });
      setCancelHash(hash);
      toast.info("Cancelling invoice...");
    } catch (err: any) {
      const msg = err?.shortMessage ?? err?.message ?? "Cancellation failed";
      setError(msg);
      toast.error(msg);
      setStep("idle");
      setIsPending(false);
    }
  };

  const handleDispute = async () => {
    if (!walletClient || !address) {
      toast.error("Wallet not ready");
      return;
    }
    if (!disputeReason.trim()) {
      toast.error("Please provide a reason for the dispute");
      return;
    }

    setError(null);
    setIsPending(true);
    setStep("disputing");

    try {
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "disputeInvoice",
        args: [invoiceId, disputeReason.trim()],
        feeCurrency: FEE_CURRENCY,
        chain: CHAIN,
        account: address,
      });
      setDisputeHash(hash);
      toast.info("Raising dispute...");
    } catch (err: any) {
      const msg = err?.shortMessage ?? err?.message ?? "Dispute failed";
      setError(msg);
      toast.error(msg);
      setStep("idle");
      setIsPending(false);
    }
  };

  //  Render
  return (
    <Layout>
      <div className="min-h-screen bg-[#F9FAFB]">
        {/*  Header ─ */}
        <div className="bg-[#1B4332] px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="text-white">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-white text-xl font-bold">Invoice Details</h1>
              <p className="text-white/60 text-xs font-mono">
                {inv.invoiceRef}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TypeBadge type={invoiceType} />
            {/* <StatusBadge status={status} /> */}
          </div>
        </div>

        <div className="p-6 space-y-4 pb-10">
          {/*  Open invoice banner  */}
          {isOpenInvoice && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-amber-700 text-sm">
                Public invoice — anyone can pay this
              </p>
            </div>
          )}

          {/*  Overdue warning  */}
          {status === "Overdue" && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-red-700 text-sm">
                {daysLate > 0
                  ? `${daysLate} day${daysLate > 1 ? "s" : ""} overdue — late fee applies`
                  : "This invoice is overdue"}
              </p>
            </motion.div>
          )}

          {/*  Disputed banner  */}
          {status === "Disputed" && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0" />
                <p className="text-orange-700 text-sm font-semibold">
                  Disputed
                </p>
              </div>
              {inv.disputeReason && (
                <p className="text-orange-600 text-xs ml-6">
                  "{inv.disputeReason}"
                </p>
              )}
            </div>
          )}

          {/*  Main invoice card  */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Title + meta */}
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-start justify-between mb-1">
                <h2 className="text-xl font-bold text-gray-800 flex-1 pr-2">
                  {metaLoading ? (
                    <span className="text-gray-300">Loading...</span>
                  ) : (
                    (metadata?.title ?? inv.invoiceRef)
                  )}
                </h2>
                <TokenBadge token={tokenInfo.symbol} />
              </div>
              <p className="text-xs text-gray-400 font-mono">
                {inv.invoiceRef}
              </p>
            </div>

            {/* Wallets */}
            <div className="px-5 py-4 space-y-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#1B4332]/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-4 h-4 text-[#1B4332]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">From (Creator)</p>
                  <p className="text-sm font-mono text-gray-700 truncate">
                    {inv.creator.slice(0, 6)}...{inv.creator.slice(-4)}
                    {isCreator && (
                      <span className="ml-2 text-xs text-[#1B4332] bg-[#1B4332]/10 px-1.5 py-0.5 rounded-full">
                        You
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">
                    To (Client){isOpenInvoice ? " — Public" : ""}
                  </p>
                  <p className="text-sm font-mono text-gray-700 truncate">
                    {isOpenInvoice
                      ? "Anyone can pay"
                      : `${inv.client.slice(0, 6)}...${inv.client.slice(-4)}`}
                    {isClient && (
                      <span className="ml-2 text-xs text-[#1B4332] bg-[#1B4332]/10 px-1.5 py-0.5 rounded-full">
                        You
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="px-5 py-4 grid grid-cols-2 gap-4 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Created
                </p>
                <p className="text-sm font-semibold text-gray-700">
                  {createdAt}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Due Date
                </p>
                <p
                  className={`text-sm font-semibold ${status === "Overdue" ? "text-red-600" : "text-gray-700"}`}
                >
                  {dueDate}
                </p>
              </div>
              {paidAt && (
                <div>
                  <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Paid
                  </p>
                  <p className="text-sm font-semibold text-green-600">
                    {paidAt}
                  </p>
                </div>
              )}
              {nextDueDate && invoiceType === "Recurring" && (
                <div>
                  <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Next Due
                  </p>
                  <p className="text-sm font-semibold text-blue-600">
                    {nextDueDate}
                  </p>
                </div>
              )}
            </div>

            {/* Recurring info */}
            {invoiceType === "Recurring" && (
              <div className="px-5 py-3 bg-blue-50 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-blue-700 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    <span className="font-semibold">
                      Recurring {INTERVAL_DISPLAY[inv.interval]}
                    </span>
                  </p>
                  <p className="text-xs text-blue-600">
                    Collected: {totalCollected.toFixed(2)} {tokenInfo.symbol}
                  </p>
                </div>
              </div>
            )}

            {/* Line items from IPFS */}
            {metadata?.items && metadata.items.length > 0 && (
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">
                  Line Items
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b border-gray-100">
                      <th className="text-left pb-2">Description</th>
                      <th className="text-right pb-2">Qty</th>
                      <th className="text-right pb-2">Price</th>
                      <th className="text-right pb-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metadata.items.map((item, i) => (
                      <tr
                        key={i}
                        className={`${i % 2 === 1 ? "bg-gray-50" : ""}`}
                      >
                        <td className="py-2 text-gray-700">{item.name}</td>
                        <td className="text-right text-gray-600">
                          {item.quantity}
                        </td>
                        <td className="text-right text-gray-600">
                          {item.unitPrice}
                        </td>
                        <td className="text-right font-medium text-gray-800">
                          {item.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Milestone phases from IPFS */}
            {invoiceType === "Milestone" && metadata?.milestones && (
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">
                  Milestone Phases
                </p>
                <div className="space-y-2">
                  {metadata.milestones.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 py-2">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          i < Number(inv.milestonesReleased)
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {i < Number(inv.milestonesReleased) ? "✓" : i + 1}
                      </div>
                      <p className="text-sm text-gray-700 flex-1">
                        {m.description}
                      </p>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          i < Number(inv.milestonesReleased)
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {i < Number(inv.milestonesReleased)
                          ? "Released"
                          : "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>
                      {Number(inv.milestonesReleased)} of{" "}
                      {metadata.milestones.length} released
                    </span>
                    <span>
                      {totalCollected.toFixed(2)} {tokenInfo.symbol} collected
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1B4332] rounded-full transition-all"
                      style={{
                        width: `${(Number(inv.milestonesReleased) / metadata.milestones.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {metadata?.notes && (
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">
                  Notes / Terms
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {metadata.notes}
                </p>
              </div>
            )}

            {/* Fee breakdown */}
            <div className="px-5 py-4">
              <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">
                {isCreator ? "What you receive" : "Payment Breakdown"}
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Invoice amount</span>
                  <span>
                    {amount.toFixed(2)} {tokenInfo.symbol}
                  </span>
                </div>
                {lateFee > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Late fee ({daysLate} days)</span>
                    <span>
                      +{lateFee.toFixed(2)} {tokenInfo.symbol}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-gray-400">
                  <span>Platform fee (2%) — paid by client</span>
                  <span>
                    +{platformFee.toFixed(2)} {tokenInfo.symbol}
                  </span>
                </div>
                <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-gray-900">
                  {isCreator ? (
                    <>
                      <span className="text-[#1B4332]">You receive ✓</span>
                      <span className="text-[#1B4332] text-lg">
                        {(amount + lateFee).toFixed(2)} {tokenInfo.symbol}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>Total due</span>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {approvalAmount
                            ? parseFloat(
                                formatUnits(approvalAmount, tokenInfo.decimals),
                              ).toFixed(2)
                            : clientPays.toFixed(2)}
                        </span>
                        <TokenBadge token={tokenInfo.symbol} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/*  Error  */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
              {error}
            </div>
          )}

          {/*  Step banners  */}
          {step === "approving" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2 text-amber-700 text-sm">
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              Step 1/2: Waiting for token approval...
            </div>
          )}
          {step === "paying" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2 text-amber-700 text-sm">
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              Step 2/2: Confirming payment on-chain...
            </div>
          )}

          {/*  Dispute input ─ */}
          {showDisputeInput && (
            <div className="bg-white rounded-xl border border-orange-200 p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">
                Reason for dispute
              </p>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Describe the issue with this invoice..."
                rows={3}
                className="w-full px-3 py-2 text-sm bg-gray-50 rounded-lg border border-gray-200 focus:border-orange-400 focus:outline-none resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowDisputeInput(false);
                    setDisputeReason("");
                  }}
                  className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDispute}
                  disabled={isSubmitting || !disputeReason.trim()}
                  className="flex-1 py-2 text-sm font-semibold text-white bg-orange-500 rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {isConfirmingDispute ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    "Submit Dispute"
                  )}
                </button>
              </div>
            </div>
          )}

          {/*  Action Buttons  */}
          <div className="space-y-3">
            {/* CLIENT — Pay button */}
            {(isClient || isOpenInvoice) && canPay && (
              <button
                onClick={handlePay}
                disabled={isSubmitting || !approvalAmount}
                className="w-full bg-[#1B4332] text-white py-4 rounded-xl flex items-center justify-center gap-2 font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Wallet className="w-5 h-5" />
                )}
                {step === "approving"
                  ? "Step 1/2: Approving..."
                  : step === "paying"
                    ? "Step 2/2: Confirming..."
                    : `Pay ${
                        approvalAmount
                          ? parseFloat(
                              formatUnits(approvalAmount, tokenInfo.decimals),
                            ).toFixed(2)
                          : clientPays.toFixed(2)
                      } ${tokenInfo.symbol}`}
              </button>
            )}

            {/* CREATOR — Share */}
            {isCreator && (
              <button
                onClick={handleShare}
                className="w-full bg-[#1B4332] text-white py-4 rounded-xl flex items-center justify-center gap-2 font-semibold hover:opacity-90 transition-opacity"
              >
                <Share2 className="w-5 h-5" />
                Share Payment Link
              </button>
            )}

            {/* Receipt */}
            {status === "Paid" && (
              <button
                onClick={() => router.push(`/receipt/${inv.id.toString()}`)}
                className="w-full bg-green-500 text-white py-4 rounded-xl flex items-center justify-center gap-2 font-semibold hover:opacity-90 transition-opacity"
              >
                <Receipt className="w-5 h-5" />
                View Receipt
              </button>
            )}

            {/* Secondary actions row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Cancel */}
              {canCancel && (
                <button
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className="py-3 text-sm font-semibold text-red-500 border border-red-200 rounded-xl flex items-center justify-center gap-2 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {isConfirmingCancel ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  {isConfirmingCancel ? "Cancelling..." : "Cancel"}
                </button>
              )}

              {/* Dispute */}
              {canDispute && !showDisputeInput && (
                <button
                  onClick={() => setShowDisputeInput(true)}
                  disabled={isSubmitting}
                  className="py-3 text-sm font-semibold text-orange-500 border border-orange-200 rounded-xl flex items-center justify-center gap-2 hover:bg-orange-50 transition-colors disabled:opacity-50"
                >
                  <AlertCircle className="w-4 h-4" />
                  Dispute
                </button>
              )}

              {/* Share (non-creator) */}
              {!isCreator && (
                <button
                  onClick={handleShare}
                  className="py-3 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              )}
            </div>

            {/* Cancelled / Paid states */}
            {status === "Cancelled" && (
              <div className="w-full bg-gray-100 border border-gray-200 text-gray-500 py-4 rounded-xl flex items-center justify-center gap-2">
                <XCircle className="w-5 h-5" />
                <span className="font-semibold">Invoice Cancelled</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
