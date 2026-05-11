"use client";

import { useRouter } from "next/navigation";
import { Layout } from "./Layout";
import { StatusBadge, TokenBadge } from "./StatusBadge";
import {
  Plus,
  TrendingUp,
  DollarSign,
  FileText,
  Clock,
  AlertCircle,
  ChevronRight,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { useReadContract, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { motion } from "motion/react";
import { CONTRACT_ADDRESS, ABI, CHAIN } from "@/lib/contract";

//  Token config
const TOKEN_CONFIG: Record<string, { symbol: string; decimals: number }> = {
  "0x765de816845861e75a25fca122bb6898b8b1282a": {
    symbol: "cUSD",
    decimals: 18,
  },
  "0xd8763cba276a3738e6de85b4b3bf5fded6d6ca73": {
    symbol: "cEUR",
    decimals: 18,
  },
  "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e": { symbol: "USDT", decimals: 6 },
  "0xceba9300f2b948710d2653dd7b07f33a8b32118c": { symbol: "USDC", decimals: 6 },
};

const STATUS_MAP: Record<
  number,
  "Unpaid" | "Paid" | "Cancelled" | "Overdue" | "Disputed"
> = {
  0: "Unpaid",
  1: "Paid",
  2: "Cancelled",
  3: "Overdue",
  4: "Disputed",
};

//  Types
interface Invoice {
  id: string;
  invoiceRef: string;
  client: string;
  creator: string;
  token: string; // symbol e.g. "cUSD"
  amount: number;
  status: "Unpaid" | "Paid" | "Cancelled" | "Overdue" | "Disputed";
  date: string;
  dueDate: string;
}

//  Hooks
function useInvoiceIds(address: `0x${string}` | undefined, fn: string) {
  const { data } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: fn,
    args: address ? [address] : undefined,
    query: { enabled: !!address },
    chainId: CHAIN.id,
  });
  return (data as bigint[] | undefined) ?? [];
}

function useInvoiceBatch(ids: bigint[]): Invoice[] {
  const { data } = useReadContracts({
    contracts: ids.map((id) => ({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: "getInvoice" as const,
      args: [id] as const,
      chainId: CHAIN.id,
    })),
    query: { enabled: ids.length > 0 },
  });

  return (data ?? [])
    .filter((r) => r.status === "success" && !!r.result)
    .map((r) => {
      const inv = r.result as any;
      const tokenInfo = TOKEN_CONFIG[inv.token.toLowerCase()] ?? {
        symbol: "cUSD",
        decimals: 18,
      };
      return {
        id: inv.id.toString(),
        invoiceRef: inv.invoiceRef,
        client: inv.client,
        creator: inv.creator,
        token: tokenInfo.symbol,
        amount: parseFloat(formatUnits(inv.amount, tokenInfo.decimals)),
        status: (STATUS_MAP[inv.status as number] ??
          "Unpaid") as Invoice["status"],
        date: new Date(Number(inv.createdAt) * 1000).toLocaleDateString(),
        dueDate:
          inv.dueDate > BigInt(0)
            ? new Date(Number(inv.dueDate) * 1000).toLocaleDateString()
            : "No deadline",
      };
    })
    .reverse();
}

//  Component
export default function Home() {
  const router = useRouter();
  const { address, getUSDmBalance } = useWallet();
  const [cUSDBalance, setCUSDBalance] = useState<string | null>(null);

  // Fetch cUSD balance on mount / address change
  useEffect(() => {
    if (!address) return;
    setCUSDBalance(null); // reset while loading
    getUSDmBalance(address)
      .then((b) => setCUSDBalance(parseFloat(b).toFixed(2)))
      .catch(() => setCUSDBalance("—"));
  }, [address]);

  const sentIds = useInvoiceIds(address, "getCreatorInvoices");
  const receivedIds = useInvoiceIds(address, "getClientInvoices");
  const sentInvoices = useInvoiceBatch(sentIds);
  const receivedInvoices = useInvoiceBatch(receivedIds);

  const toPayInvoices = receivedInvoices.filter(
    (i) => i.status === "Unpaid" || i.status === "Overdue",
  );
  const disputedReceivedInvoices = receivedInvoices.filter(
    (i) => i.status === "Disputed",
  );
  const recentSent = sentInvoices.slice(0, 5);

  const unpaidCount = sentInvoices.filter((i) => i.status === "Unpaid").length;
  const paidCount = sentInvoices.filter((i) => i.status === "Paid").length;
  const overdueCount = sentInvoices.filter(
    (i) => i.status === "Overdue",
  ).length;

  // These are cross-token totals — only meaningful as counts, not summed amounts
  // since mixing cUSD + USDC + cEUR into one number makes no sense
  const unpaidInvoices = sentInvoices.filter(
    (i) => i.status === "Unpaid" || i.status === "Overdue",
  );

  const displayAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "Not connected";
  const avatarLetters = address ? address.substring(2, 4).toUpperCase() : "??";

  return (
    <Layout>
      <div className="min-h-screen bg-[#F9FAFB]">
        {/* Header */}
        <div className="bg-[#1B4332] px-6 pt-12 pb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#F4C430] rounded-full flex items-center justify-center text-[#1B4332] text-sm font-bold">
                {avatarLetters}
              </div>
              <div>
                <p className="text-white/60 text-xs">Wallet</p>
                <p className="text-white text-sm font-semibold">
                  {displayAddress}
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push("/profile")}
              className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center"
            >
              <Wallet className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Balance card */}
          <div className="bg-white/10 rounded-2xl p-5 border border-white/10">
            <p className="text-white/60 text-xs mb-1">USDT Balance</p>
            <h2 className="text-white text-4xl font-bold mb-1">
              {cUSDBalance === null ? (
                <span className="text-white/40 text-2xl">Loading...</span>
              ) : (
                <>
                  {cUSDBalance}
                  <span className="text-xl ml-2 font-semibold">USDT</span>
                </>
              )}
            </h2>
            <p className="text-white/50 text-xs mb-4">Live on-chain balance</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[#F4C430] text-xs">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>
                  {paidCount} invoice{paidCount !== 1 ? "s" : ""} paid
                </span>
              </div>
              {unpaidInvoices.length > 0 && (
                <div className="text-white/60 text-xs">
                  {unpaidInvoices.length} awaiting payment
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-6 space-y-6">
          {/* Disputed invoices */}
          {disputedReceivedInvoices.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-orange-50 border border-orange-200 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-orange-100/60">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    <span className="text-orange-700 text-sm font-bold">
                      {disputedReceivedInvoices.length} disputed{" "}
                      {disputedReceivedInvoices.length === 1
                        ? "invoice"
                        : "invoices"}
                    </span>
                  </div>
                  <span className="text-orange-600 text-xs bg-orange-100 px-2 py-0.5 rounded-full font-medium">
                    Awaiting resolution
                  </span>
                </div>
                {disputedReceivedInvoices.map((invoice, i) => (
                  <button
                    key={invoice.id}
                    onClick={() =>
                      router.push(`/invoice-details/${invoice.id}`)
                    }
                    className={`w-full px-4 py-3 flex items-center justify-between hover:bg-orange-100/40 transition-colors text-left ${
                      i < disputedReceivedInvoices.length - 1
                        ? "border-b border-orange-100"
                        : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-800 text-sm font-mono font-semibold truncate">
                        {invoice.invoiceRef}
                      </p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        From: {invoice.creator.slice(0, 6)}...
                        {invoice.creator.slice(-4)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <div className="text-right">
                        <p className="text-orange-600 text-sm font-bold">
                          {invoice.amount.toFixed(2)}
                        </p>
                        <p className="text-xs text-orange-400">
                          {invoice.token}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-orange-400" />
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* To Pay */}
          {toPayInvoices.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
            >
              <div className="bg-red-50 border border-red-200 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-red-100/60">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-red-700 text-sm font-bold">
                      You owe {toPayInvoices.length}{" "}
                      {toPayInvoices.length === 1 ? "invoice" : "invoices"}
                    </span>
                  </div>
                  {/* Don't sum cross-token amounts — show count instead */}
                  <span className="text-red-600 text-xs bg-red-100 px-2 py-0.5 rounded-full font-medium">
                    Tap to pay
                  </span>
                </div>
                {toPayInvoices.map((invoice, i) => (
                  <button
                    key={invoice.id}
                    onClick={() =>
                      router.push(`/invoice-details/${invoice.id}`)
                    }
                    className={`w-full px-4 py-3 flex items-center justify-between hover:bg-red-100/40 transition-colors text-left ${
                      i < toPayInvoices.length - 1
                        ? "border-b border-red-100"
                        : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-800 text-sm font-mono font-semibold truncate">
                        {invoice.invoiceRef}
                      </p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        From: {invoice.creator.slice(0, 6)}...
                        {invoice.creator.slice(-4)} · Due {invoice.dueDate}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <div className="text-right">
                        <p className="text-red-600 text-sm font-bold">
                          {invoice.amount.toFixed(2)}
                        </p>
                        <TokenBadge token={invoice.token} />
                      </div>
                      <ChevronRight className="w-4 h-4 text-red-400" />
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => router.push("/create-invoice")}
              className="bg-[#1B4332] text-white py-5 rounded-xl flex flex-col items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              <div className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold">Create Invoice</span>
            </button>
            <button
              onClick={() => router.push("/invoices")}
              className="bg-white border-2 border-[#1B4332] text-[#1B4332] py-5 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 bg-[#1B4332]/10 rounded-full flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold">View All</span>
            </button>
          </div>

          {/* Stats */}
          <div>
            <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">
              Your Invoice Stats
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center mb-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-2xl font-bold mb-0.5">{unpaidCount}</p>
                <p className="text-xs text-gray-400">Unpaid</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center mb-2">
                  <DollarSign className="w-4 h-4 text-green-500" />
                </div>
                <p className="text-2xl font-bold mb-0.5">{paidCount}</p>
                <p className="text-xs text-gray-400">Paid</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center mb-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                </div>
                <p className="text-2xl font-bold mb-0.5">{overdueCount}</p>
                <p className="text-xs text-gray-400">Overdue</p>
              </div>
            </div>
          </div>

          {/* Recent Sent */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Recently Sent
              </p>
              <button
                onClick={() => router.push("/invoices")}
                className="text-[#1B4332] text-xs flex items-center gap-1 font-semibold"
              >
                See all <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {recentSent.length === 0 ? (
              <div className="bg-white rounded-xl p-8 shadow-sm text-center">
                <FileText className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                <p className="text-gray-500 text-sm font-semibold">
                  No invoices yet
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  Create your first invoice to get started
                </p>
                <button
                  onClick={() => router.push("/create-invoice")}
                  className="mt-4 bg-[#1B4332] text-white px-5 py-2.5 rounded-xl text-sm hover:opacity-90 font-semibold"
                >
                  Create Invoice
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentSent.map((invoice) => (
                  <button
                    key={invoice.id}
                    onClick={() =>
                      router.push(`/invoice-details/${invoice.id}`)
                    }
                    className="w-full bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-left"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-gray-800 text-sm font-mono font-semibold">
                        {invoice.invoiceRef}
                      </h4>
                      <StatusBadge status={invoice.status} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">
                          To: {invoice.client.slice(0, 6)}...
                          {invoice.client.slice(-4)}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {invoice.date}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-lg text-[#1B4332] font-bold">
                          {invoice.amount.toFixed(2)}
                        </p>
                        <TokenBadge token={invoice.token} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
