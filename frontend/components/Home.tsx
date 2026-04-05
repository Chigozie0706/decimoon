"use client";

import { useRouter } from "next/navigation";
import { Layout } from "./Layout";
import { StatusBadge } from "./StatusBadge";
import { Plus, TrendingUp, DollarSign, FileText, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { useReadContract, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { celoSepolia } from "wagmi/chains";

const CONTRACT_ADDRESS =
  "0xDfb4FD0a6A526a2d1fE3c0dA77Be29ac20EE7967" as `0x${string}`;
const CHAIN = celoSepolia;

const STATUS_MAP: Record<number, "unpaid" | "paid" | "overdue"> = {
  0: "unpaid",
  1: "paid",
  2: "overdue",
  3: "overdue",
};

const CONTRACT_ABI = [
  {
    inputs: [{ internalType: "address", name: "creator", type: "address" }],
    name: "getCreatorInvoices",
    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
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
] as const;

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
  const { address, isConnected, getUSDmBalance } = useWallet();
  const [usdmBalance, setUsdmBalance] = useState("0.00");

  // Fetch live USDm balance
  useEffect(() => {
    if (!address) return;
    getUSDmBalance(address).then(setUsdmBalance).catch(console.error);
  }, [address]);

  // Step 1: fetch creator invoice IDs
  const { data: invoiceIds } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getCreatorInvoices",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
    chainId: CHAIN.id,
  });

  const ids = (invoiceIds as bigint[] | undefined) ?? [];

  // Step 2: batch fetch all invoices — only last 5 for home screen
  const recentIds = ids.slice(-5).reverse();
  const { data: invoiceResults } = useReadContracts({
    contracts: recentIds.map((id) => ({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "getInvoice" as const,
      args: [id] as const,
      chainId: CHAIN.id,
    })),
    query: { enabled: recentIds.length > 0 },
  });

  // Step 3: fetch ALL invoices for stats (separate batch)
  const { data: allInvoiceResults } = useReadContracts({
    contracts: ids.map((id) => ({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "getInvoice" as const,
      args: [id] as const,
      chainId: CHAIN.id,
    })),
    query: { enabled: ids.length > 0 },
  });

  // Map recent invoices for display
  const recentInvoices: Invoice[] = (invoiceResults ?? [])
    .filter((r) => r.status === "success" && !!r.result)
    .map((r) => {
      const inv = r.result as {
        id: bigint;
        title: string;
        client: `0x${string}`;
        amount: bigint;
        status: number;
        createdAt: bigint;
      };
      return {
        id: inv.id.toString(),
        title: inv.title,
        client: `${inv.client.slice(0, 6)}...${inv.client.slice(-4)}`,
        amount: parseFloat(formatUnits(inv.amount, 18)),
        status: STATUS_MAP[inv.status] ?? "unpaid",
        date: new Date(Number(inv.createdAt) * 1000).toLocaleDateString(),
      };
    });

  // Map all invoices for stats
  const allInvoices: Invoice[] = (allInvoiceResults ?? [])
    .filter((r) => r.status === "success" && !!r.result)
    .map((r) => {
      const inv = r.result as {
        id: bigint;
        title: string;
        client: `0x${string}`;
        amount: bigint;
        status: number;
        createdAt: bigint;
      };
      return {
        id: inv.id.toString(),
        title: inv.title,
        client: inv.client,
        amount: parseFloat(formatUnits(inv.amount, 18)),
        status: STATUS_MAP[inv.status] ?? "unpaid",
        date: new Date(Number(inv.createdAt) * 1000).toLocaleDateString(),
      };
    });

  // Stats
  const unpaidCount = allInvoices.filter((i) => i.status === "unpaid").length;
  const paidCount = allInvoices.filter((i) => i.status === "paid").length;
  const overdueCount = allInvoices.filter((i) => i.status === "overdue").length;
  const unpaidAmount = allInvoices
    .filter((i) => i.status === "unpaid")
    .reduce((s, i) => s + i.amount, 0);
  const paidAmount = allInvoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amount, 0);
  const overdueAmount = allInvoices
    .filter((i) => i.status === "overdue")
    .reduce((s, i) => s + i.amount, 0);
  const totalEarnedAllTime = paidAmount;

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

        {/* Balance */}
        <div className="bg-[#1B4332]/50 rounded-2xl p-6 border border-white/10">
          <p className="text-white/80 text-sm mb-1">USDm Balance</p>
          <h2 className="text-white text-4xl mb-2" style={{ fontWeight: 700 }}>
            {parseFloat(usdmBalance).toFixed(2)}{" "}
            <span className="text-2xl">USDm</span>
          </h2>
          <p className="text-white/60 text-xs mb-4">Live on-chain balance</p>
          <div className="flex items-center gap-2 text-[#F4C430] text-sm">
            <TrendingUp className="w-4 h-4" />
            <span>All time earned: {totalEarnedAllTime.toFixed(2)} USDm</span>
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
              {unpaidAmount.toFixed(2)} USDm
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
              {paidAmount.toFixed(2)} USDm
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
              {overdueAmount.toFixed(2)} USDm
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
                      {invoice.amount.toFixed(2)}{" "}
                      <span className="text-sm">USDm</span>
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
