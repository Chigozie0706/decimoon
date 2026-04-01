"use client";

import { useRouter } from "next/navigation";
import { Layout } from "./Layout";
import { StatusBadge } from "./StatusBadge";
import { Plus, TrendingUp, DollarSign, FileText, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { useMiniPay } from "@/hooks/useMiniPay";

interface Invoice {
  id: string;
  title: string;
  client: string;
  amount: number;
  status: "paid" | "unpaid" | "overdue";
  date: string;
}

export default function Home() {
  const router = useRouter();
  const { address, isConnected } = useMiniPay();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [usdmBalance, setUsdmBalance] = useState("0.00");
  const { getUSDmBalance } = useMiniPay();

  // Load invoices — will be replaced with on-chain fetch once contract is ready
  useEffect(() => {
    const stored = localStorage.getItem("invoices");
    if (stored) {
      setInvoices(JSON.parse(stored));
    }
  }, []);

  // Fetch live USDm balance from chain
  useEffect(() => {
    if (!address) return;
    getUSDmBalance(address).then(setUsdmBalance).catch(console.error);
  }, [address]);

  const totalEarnedThisMonth = invoices
    .filter(
      (inv) =>
        inv.status === "paid" &&
        new Date(inv.date).getMonth() === new Date().getMonth(),
    )
    .reduce((sum, inv) => sum + inv.amount, 0);

  const totalEarnedAllTime = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + inv.amount, 0);

  const unpaidCount = invoices.filter((inv) => inv.status === "unpaid").length;
  const paidCount = invoices.filter((inv) => inv.status === "paid").length;
  const overdueCount = invoices.filter(
    (inv) => inv.status === "overdue",
  ).length;

  const unpaidAmount = invoices
    .filter((inv) => inv.status === "unpaid")
    .reduce((sum, inv) => sum + inv.amount, 0);
  const paidAmount = totalEarnedAllTime;
  const overdueAmount = invoices
    .filter((inv) => inv.status === "overdue")
    .reduce((sum, inv) => sum + inv.amount, 0);

  const recentInvoices = invoices.slice(0, 5);

  // Format address for display
  const displayAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "Not connected";

  const avatarLetters = address ? address.substring(2, 4).toUpperCase() : "??";

  return (
    <Layout>
      {/* Header */}
      <div className="bg-[#1B4332] px-6 pt-12 pb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 bg-[#F4C430] rounded-full flex items-center justify-center text-[#1B4332]"
              style={{ fontWeight: 700 }}
            >
              {avatarLetters}
            </div>
            <div>
              <p className="text-white/80 text-xs">Wallet Address</p>
              <p className="text-white" style={{ fontWeight: 600 }}>
                {displayAddress}
              </p>
            </div>
          </div>
        </div>

        {/* Earnings */}
        <div className="bg-[#1B4332]/50 rounded-2xl p-6 border border-white/10">
          <p className="text-white/80 text-sm mb-1">USDm Balance</p>
          <h2 className="text-white text-4xl mb-2" style={{ fontWeight: 700 }}>
            {parseFloat(usdmBalance).toFixed(2)}{" "}
            <span className="text-2xl">USDm</span>
          </h2>
          <p className="text-white/60 text-xs mb-4">Live on-chain balance</p>
          <div className="flex items-center gap-2 text-[#F4C430] text-sm">
            <TrendingUp className="w-4 h-4" />
            <span>All time earned: {totalEarnedAllTime.toFixed(2)} cUSD</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-6 py-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => router.push("/create-invoice")}
            className="bg-[#1B4332] text-white py-6 rounded-xl flex flex-col items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Plus className="w-6 h-6" />
            <span style={{ fontWeight: 600 }}>Create Invoice</span>
          </button>
          <button
            onClick={() => router.push("/invoices")}
            className="bg-white border-2 border-[#1B4332] text-[#1B4332] py-6 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
          >
            <FileText className="w-6 h-6" />
            <span style={{ fontWeight: 600 }}>View All</span>
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-[#F59E0B]" />
              <p className="text-xs text-gray-600">Unpaid</p>
            </div>
            <p className="text-xl mb-1" style={{ fontWeight: 700 }}>
              {unpaidCount}
            </p>
            <p className="text-xs text-gray-500">
              {unpaidAmount.toFixed(0)} cUSD
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-[#22C55E]" />
              <p className="text-xs text-gray-600">Paid</p>
            </div>
            <p className="text-xl mb-1" style={{ fontWeight: 700 }}>
              {paidCount}
            </p>
            <p className="text-xs text-gray-500">
              {paidAmount.toFixed(0)} cUSD
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-[#EF4444]" />
              <p className="text-xs text-gray-600">Overdue</p>
            </div>
            <p className="text-xl mb-1" style={{ fontWeight: 700 }}>
              {overdueCount}
            </p>
            <p className="text-xs text-gray-500">
              {overdueAmount.toFixed(0)} cUSD
            </p>
          </div>
        </div>

        {/* Recent Invoices */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#111827]" style={{ fontWeight: 700 }}>
              Recent Invoices
            </h3>
            <button
              onClick={() => router.push("/invoices")}
              className="text-[#1B4332] text-sm"
            >
              See all
            </button>
          </div>

          {recentInvoices.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No invoices yet</p>
              <p className="text-sm mt-1">
                Create your first invoice to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentInvoices.map((invoice) => (
                <button
                  key={invoice.id}
                  onClick={() => router.push(`/invoice-detail/${invoice.id}`)}
                  className="w-full bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-left"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[#111827]" style={{ fontWeight: 600 }}>
                      {invoice.title}
                    </h4>
                    <StatusBadge status={invoice.status} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">{invoice.client}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {invoice.date}
                      </p>
                    </div>
                    <p
                      className="text-xl text-[#1B4332]"
                      style={{ fontWeight: 700 }}
                    >
                      {invoice.amount} cUSD
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
