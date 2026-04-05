"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Layout } from "../components/Layout";
import { StatusBadge } from "./StatusBadge";
import { Search, FileText } from "lucide-react";
import { useReadContract, useReadContracts } from "wagmi";
import { useWallet } from "@/hooks/use-wallet";
import { formatUnits } from "viem";
import { celoSepolia } from "wagmi/chains";

const CONTRACT_ADDRESS =
  "0xDfb4FD0a6A526a2d1fE3c0dA77Be29ac20EE7967" as `0x${string}`;
const CHAIN = celoSepolia;

// Status enum from contract: 0=unpaid, 1=paid, 2=overdue, 3=cancelled
const STATUS_MAP: Record<number, "unpaid" | "paid" | "overdue"> = {
  0: "unpaid",
  1: "paid",
  2: "overdue",
  3: "overdue", // cancelled shown as overdue in UI
};

// Interval enum from contract: 0=weekly, 1=biweekly, 2=monthly
const INTERVAL_MAP: Record<number, string> = {
  0: "weekly",
  1: "biweekly",
  2: "monthly",
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
  dueDate: string;
  date: string;
  recurring: boolean;
  interval?: string;
}

export default function AllInvoices() {
  const router = useRouter();
  const { address } = useWallet();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<
    "all" | "paid" | "unpaid" | "overdue" | "recurring"
  >("all");

  // Step 1: fetch all invoice IDs for this creator
  const { data: invoiceIds, isLoading: isLoadingIds } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getCreatorInvoices",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
    chainId: CHAIN.id,
  });

  // Step 2: batch fetch all invoices by ID
  const ids = (invoiceIds as bigint[] | undefined) ?? [];
  const { data: invoiceResults, isLoading: isLoadingInvoices } =
    useReadContracts({
      contracts: ids.map((id) => ({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "getInvoice" as const,
        args: [id] as const,
        chainId: CHAIN.id,
      })),
      query: { enabled: ids.length > 0 },
    });

  // Step 3: map contract data to UI shape
  const invoices: Invoice[] = (invoiceResults ?? [])
    .filter((r) => r.status === "success" && r.result)
    .map((r) => {
      const inv = r.result as any;
      return {
        id: inv.id.toString(),
        title: inv.title,
        client: inv.client,
        amount: parseFloat(formatUnits(inv.amount, 18)),
        status: STATUS_MAP[inv.status as number] ?? "unpaid",
        dueDate: new Date(Number(inv.dueDate) * 1000).toLocaleDateString(),
        date: new Date(Number(inv.createdAt) * 1000).toLocaleDateString(),
        recurring: inv.isRecurring,
        interval: INTERVAL_MAP[inv.interval as number],
      };
    })
    .reverse(); // most recent first

  const isLoading = isLoadingIds || isLoadingInvoices;

  const filteredInvoices = invoices.filter((invoice) => {
    if (filter !== "all") {
      if (filter === "recurring" && !invoice.recurring) return false;
      if (filter !== "recurring" && invoice.status !== filter) return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        invoice.title.toLowerCase().includes(query) ||
        invoice.client.toLowerCase().includes(query) ||
        invoice.id.includes(query)
      );
    }
    return true;
  });

  const filters = [
    { key: "all", label: "All" },
    { key: "paid", label: "Paid" },
    { key: "unpaid", label: "Unpaid" },
    { key: "overdue", label: "Overdue" },
    { key: "recurring", label: "Recurring" },
  ] as const;

  return (
    <Layout>
      <div className="min-h-screen bg-[#F9FAFB]">
        {/* Header */}
        <div className="bg-[#1B4332] px-6 py-6">
          <h1 className="text-white text-2xl mb-4" style={{ fontWeight: 700 }}>
            All Invoices
          </h1>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search invoices..."
              className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/60 focus:outline-none focus:bg-white/20"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white px-6 py-4 border-b border-gray-200 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2 rounded-full text-sm transition-colors ${
                  filter === f.key
                    ? "bg-[#1B4332] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                style={{ fontWeight: 600 }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Invoice List */}
        <div className="p-6">
          {/* Loading state */}
          {isLoading && (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1B4332] mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Loading invoices...</p>
            </div>
          )}

          {/* Not connected */}
          {!address && !isLoading && (
            <div className="text-center py-16 text-gray-400">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg" style={{ fontWeight: 700 }}>
                Wallet not connected
              </p>
              <p className="text-sm mt-1">
                Open this app in MiniPay or Farcaster to view your invoices
              </p>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && address && filteredInvoices.length === 0 && (
            <div className="text-center py-16">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3
                className="text-xl mb-2 text-gray-600"
                style={{ fontWeight: 700 }}
              >
                {searchQuery ? "No results found" : "No invoices yet"}
              </h3>
              <p className="text-gray-500 mb-6">
                {searchQuery
                  ? "Try adjusting your search or filters"
                  : "Create your first invoice to get started"}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => router.push("/create-invoice")}
                  className="bg-[#1B4332] text-white px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
                  style={{ fontWeight: 600 }}
                >
                  Create Invoice
                </button>
              )}
            </div>
          )}

          {/* Invoice list */}
          {!isLoading && filteredInvoices.length > 0 && (
            <div className="space-y-3">
              {filteredInvoices.map((invoice) => (
                <button
                  key={invoice.id}
                  onClick={() => router.push(`/invoice-detail/${invoice.id}`)}
                  className="w-full bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-left"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-lg mb-1" style={{ fontWeight: 700 }}>
                        {invoice.title}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {invoice.client.slice(0, 10)}...
                        {invoice.client.slice(-8)}
                      </p>
                    </div>
                    <StatusBadge status={invoice.status} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>Due: {invoice.dueDate}</span>
                      {invoice.recurring && (
                        <span className="flex items-center gap-1 text-[#F59E0B]">
                          🔄 {invoice.interval}
                        </span>
                      )}
                    </div>
                    <p
                      className="text-2xl text-[#1B4332]"
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
