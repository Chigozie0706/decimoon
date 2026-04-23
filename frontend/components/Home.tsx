"use client";

import { useRouter } from "next/navigation";
import { Layout } from "./Layout";
import { StatusBadge } from "./StatusBadge";
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
import { celo, celoSepolia } from "wagmi/chains";
import { motion } from "motion/react";
import contractAbi from "@/contract/abi.json";
import { Abi } from "viem";

const CONTRACT_ADDRESS =
  "0x7908AEa0861A5B949B044826a6DDaA3Ed7e88ab0" as `0x${string}`;
const CHAIN = celo;

const STATUS_MAP: Record<
  number,
  "unpaid" | "paid" | "cancelled" | "overdue" | "disputed"
> = {
  0: "unpaid",
  1: "paid",
  2: "cancelled",
  3: "overdue",
  4: "disputed",
};

const ABI = contractAbi.abi as Abi;

interface Invoice {
  id: string;
  title: string;
  client: string;
  creator: string;
  amount: number;
  status: "paid" | "unpaid" | "overdue" | "cancelled" | "disputed";
  date: string;
  dueDate: string;
}

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
      return {
        id: inv.id.toString(),
        title: inv.title,
        client: inv.client,
        creator: inv.creator,
        amount: parseFloat(formatUnits(inv.amount, 18)),
        status: STATUS_MAP[inv.status as number] ?? "unpaid",
        date: new Date(Number(inv.createdAt) * 1000).toLocaleDateString(),
        dueDate: new Date(Number(inv.dueDate) * 1000).toLocaleDateString(),
      };
    })
    .reverse();
}

export default function Home() {
  const router = useRouter();
  const { address, getUSDmBalance } = useWallet();
  const [usdmBalance, setUsdmBalance] = useState("0.00");

  useEffect(() => {
    if (!address) return;
    getUSDmBalance(address).then(setUsdmBalance).catch(console.error);
  }, [address]);

  // Fetch IDs
  const sentIds = useInvoiceIds(address, "getCreatorInvoices");
  const receivedIds = useInvoiceIds(address, "getClientInvoices");

  // Fetch invoices
  const sentInvoices = useInvoiceBatch(sentIds);
  const receivedInvoices = useInvoiceBatch(receivedIds);

  // Derived data
  const toPayInvoices = receivedInvoices.filter(
    (i) => i.status === "unpaid" || i.status === "overdue",
  );

  const recentSent = sentInvoices.slice(0, 5);

  const unpaidCount = sentInvoices.filter((i) => i.status === "unpaid").length;
  const paidCount = sentInvoices.filter((i) => i.status === "paid").length;
  const overdueCount = sentInvoices.filter(
    (i) => i.status === "overdue",
  ).length;

  const overdueCoun1t = sentInvoices.filter(
    (i) => i.status === "overdue",
  ).length;
  const totalOwed = sentInvoices
    .filter((i) => i.status === "unpaid" || i.status === "overdue")
    .reduce((s, i) => s + i.amount, 0);
  const totalEarned = sentInvoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amount, 0);
  const totalToPay = toPayInvoices.reduce((s, i) => s + i.amount, 0);

  const displayAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "Not connected";
  const avatarLetters = address ? address.substring(2, 4).toUpperCase() : "??";

  return (
    <Layout>
      <div className="min-h-screen bg-[#F9FAFB]">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="bg-[#1B4332] px-6 pt-12 pb-8">
          {/* Wallet row */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 bg-[#F4C430] rounded-full flex items-center justify-center text-[#1B4332] text-sm"
                style={{ fontWeight: 700 }}
              >
                {avatarLetters}
              </div>
              <div>
                <p className="text-white/60 text-xs">Wallet</p>
                <p className="text-white text-sm" style={{ fontWeight: 600 }}>
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
            <p className="text-white/60 text-xs mb-1">USDm Balance</p>
            <h2
              className="text-white text-4xl mb-1"
              style={{ fontWeight: 700 }}
            >
              {parseFloat(usdmBalance).toFixed(2)}
              <span className="text-xl ml-2">USDm</span>
            </h2>
            <p className="text-white/50 text-xs mb-4">Live on-chain balance</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[#F4C430] text-xs">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Earned: {totalEarned.toFixed(2)} USDm</span>
              </div>
              {totalOwed > 0 && (
                <div className="text-white/60 text-xs">
                  Owed to you: {totalOwed.toFixed(2)} USDm
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-6 space-y-6">
          {/* ── To Pay (urgent) ─────────────────────────────────────── */}
          {toPayInvoices.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-red-50 border border-red-200 rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-red-100/60">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span
                      className="text-red-700 text-sm"
                      style={{ fontWeight: 700 }}
                    >
                      You owe {toPayInvoices.length}{" "}
                      {toPayInvoices.length === 1 ? "invoice" : "invoices"}
                    </span>
                  </div>
                  <span
                    className="text-red-600 text-sm"
                    style={{ fontWeight: 700 }}
                  >
                    {totalToPay.toFixed(2)} USDm
                  </span>
                </div>

                {/* Invoice rows */}
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
                      <p
                        className="text-gray-800 text-sm truncate"
                        style={{ fontWeight: 600 }}
                      >
                        {invoice.title}
                      </p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        From: {invoice.creator.slice(0, 6)}...
                        {invoice.creator.slice(-4)} · Due {invoice.dueDate}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <div>
                        <p
                          className="text-red-600 text-sm text-right"
                          style={{ fontWeight: 700 }}
                        >
                          {invoice.amount.toFixed(2)}
                          <span className="text-xs ml-1">USDm</span>
                        </p>
                        <p className="text-xs text-red-400 text-right">
                          Tap to pay
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-red-400" />
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Quick Actions ────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => router.push("/create-invoice")}
              className="bg-[#1B4332] text-white py-5 rounded-xl flex flex-col items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              <div className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-sm" style={{ fontWeight: 600 }}>
                Create Invoice
              </span>
            </button>
            <button
              onClick={() => router.push("/invoices")}
              className="bg-white border-2 border-[#1B4332] text-[#1B4332] py-5 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 bg-[#1B4332]/10 rounded-full flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-sm" style={{ fontWeight: 600 }}>
                View All
              </span>
            </button>
          </div>

          {/* ── Stats ───────────────────────────────────────────────── */}
          <div>
            <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">
              Your Invoice Stats
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center mb-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-2xl mb-0.5" style={{ fontWeight: 700 }}>
                  {unpaidCount}
                </p>
                <p className="text-xs text-gray-400">Unpaid</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center mb-2">
                  <DollarSign className="w-4 h-4 text-green-500" />
                </div>
                <p className="text-2xl mb-0.5" style={{ fontWeight: 700 }}>
                  {paidCount}
                </p>
                <p className="text-xs text-gray-400">Paid</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center mb-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                </div>
                <p className="text-2xl mb-0.5" style={{ fontWeight: 700 }}>
                  {overdueCount}
                </p>
                <p className="text-xs text-gray-400">Overdue</p>
              </div>
            </div>
          </div>

          {/* ── Recent Sent ─────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Recently Sent
              </p>
              <button
                onClick={() => router.push("/invoices")}
                className="text-[#1B4332] text-xs flex items-center gap-1"
                style={{ fontWeight: 600 }}
              >
                See all <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {recentSent.length === 0 ? (
              <div className="bg-white rounded-xl p-8 shadow-sm text-center">
                <FileText className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                <p
                  className="text-gray-500 text-sm"
                  style={{ fontWeight: 600 }}
                >
                  No invoices yet
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  Create your first invoice to get started
                </p>
                <button
                  onClick={() => router.push("/create-invoice")}
                  className="mt-4 bg-[#1B4332] text-white px-5 py-2.5 rounded-xl text-sm hover:opacity-90"
                  style={{ fontWeight: 600 }}
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
                      <h4
                        className="text-gray-800 text-sm"
                        style={{ fontWeight: 600 }}
                      >
                        {invoice.title}
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
                      <p
                        className="text-lg text-[#1B4332]"
                        style={{ fontWeight: 700 }}
                      >
                        {invoice.amount.toFixed(2)}{" "}
                        <span className="text-xs">USDm</span>
                      </p>
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
