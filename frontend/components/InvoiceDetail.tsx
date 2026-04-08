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
import { walletActions, formatUnits } from "viem";
import { useWallet } from "@/hooks/use-wallet";
import { useState, useEffect } from "react";
import {
  CONTRACT_ADDRESS,
  ABI,
  CHAIN,
  FEE_CURRENCY,
  USDM_TOKEN,
  USDM_ABI,
  STATUS_MAP,
  INTERVAL_DISPLAY,
} from "@/lib/contract";

export default function InvoiceDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { address } = useWallet();

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "approving" | "paying">("idle");
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>();
  const [payHash, setPayHash] = useState<`0x${string}` | undefined>();
  const [cancelHash, setCancelHash] = useState<`0x${string}` | undefined>();

  const invoiceId = BigInt(id as string);

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

  const { data: connectorClient } = useConnectorClient({ chainId: CHAIN.id });
  const walletClient = connectorClient?.extend(walletActions);

  // Watch approval tx
  const { isSuccess: isApproved } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // Watch payment tx
  const { isLoading: isConfirmingPay, isSuccess: isPaid } =
    useWaitForTransactionReceipt({ hash: payHash });

  // Watch cancel tx
  const { isLoading: isConfirmingCancel, isSuccess: isCancelled } =
    useWaitForTransactionReceipt({ hash: cancelHash });

  // When approval confirms → send payment
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
  }, [isApproved, walletClient, address, step]);

  // When payment confirms
  useEffect(() => {
    if (!isPaid) return;
    toast.success("Payment confirmed! ✓");
    setStep("idle");
    setIsPending(false);
    refetch();
  }, [isPaid]);

  // When cancel confirms
  useEffect(() => {
    if (!isCancelled) return;
    toast.success("Invoice cancelled");
    setIsPending(false);
    refetch();
  }, [isCancelled]);

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

  const isCreator = address?.toLowerCase() === inv.creator.toLowerCase();
  const isClient = address?.toLowerCase() === inv.client.toLowerCase();
  const isSubmitting = isPending || isConfirmingPay || isConfirmingCancel;

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
    setStep("approving");

    try {
      toast.info("Step 1/2: Approving USDm spend...");
      const hash = await walletClient.writeContract({
        address: USDM_TOKEN,
        abi: USDM_ABI,
        functionName: "approve",
        args: [CONTRACT_ADDRESS, inv.amount],
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
    if (!isCreator) {
      toast.error("Only the invoice creator can cancel");
      return;
    }
    if (!confirm("Are you sure you want to cancel this invoice?")) return;

    setError(null);
    setIsPending(true);
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
      setIsPending(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-[#F9FAFB]">
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
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-xs text-gray-500 mb-1">Invoice ID</p>
                <p
                  className="text-sm text-gray-600 font-mono"
                  style={{ fontWeight: 600 }}
                >
                  #{inv.id.toString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-1">Created</p>
                <p
                  className="text-sm text-gray-600"
                  style={{ fontWeight: 600 }}
                >
                  {createdAt}
                </p>
              </div>
            </div>

            <h2
              className="text-2xl text-gray-800 mb-2"
              style={{ fontWeight: 700 }}
            >
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
                  🔄 Recurring {INTERVAL_DISPLAY[inv.interval]}
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

          {/* Step banners */}
          {step === "approving" && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-center gap-2 text-yellow-700 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Step 1/2: Waiting for approval...
            </div>
          )}
          {step === "paying" && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-center gap-2 text-yellow-700 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Step 2/2: Confirming payment on-chain...
            </div>
          )}
          {isConfirmingCancel && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-center gap-2 text-yellow-700 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cancelling invoice...
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* CREATOR */}
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

                {(status === "unpaid" || status === "overdue") && (
                  <button
                    onClick={handleCancel}
                    disabled={isSubmitting}
                    className="w-full bg-white border-2 border-[#EF4444] text-[#EF4444] py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-red-50 transition-colors disabled:opacity-50"
                    style={{ fontWeight: 600 }}
                  >
                    {isConfirmingCancel ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <XCircle className="w-5 h-5" />
                    )}
                    {isConfirmingCancel ? "Cancelling..." : "Cancel Invoice"}
                  </button>
                )}

                {status === "cancelled" && (
                  <div className="w-full bg-gray-100 border border-gray-200 text-gray-500 py-4 rounded-xl flex items-center justify-center gap-2">
                    <XCircle className="w-5 h-5" />
                    <span style={{ fontWeight: 600 }}>Invoice Cancelled</span>
                  </div>
                )}
              </>
            )}

            {/* CLIENT */}
            {isClient && (
              <>
                {(status === "unpaid" || status === "overdue") && (
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
                    {step === "approving"
                      ? "Step 1/2: Approving..."
                      : step === "paying"
                        ? "Step 2/2: Confirming..."
                        : `Pay ${amount.toFixed(2)} USDm`}
                  </button>
                )}

                {status === "paid" && (
                  <div className="w-full bg-[#22C55E]/10 border border-[#22C55E]/20 text-[#22C55E] py-4 rounded-xl flex items-center justify-center gap-2">
                    <Receipt className="w-5 h-5" />
                    <span style={{ fontWeight: 600 }}>Paid ✓</span>
                  </div>
                )}

                {status === "cancelled" && (
                  <div className="w-full bg-gray-100 border border-gray-200 text-gray-500 py-4 rounded-xl flex items-center justify-center gap-2">
                    <XCircle className="w-5 h-5" />
                    <span style={{ fontWeight: 600 }}>Invoice Cancelled</span>
                  </div>
                )}
              </>
            )}

            {/* Neither */}
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
