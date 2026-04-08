"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Layout } from "../components/Layout";
import { StatusBadge } from "./StatusBadge";
import { Search, FileText } from "lucide-react";
import { useReadContract, useReadContracts } from "wagmi";
import { useWallet } from "@/hooks/use-wallet";
import { formatUnits } from "viem";
import { Abi } from "viem";
import {
  CONTRACT_ADDRESS,
  ABI,
  CHAIN,
  STATUS_MAP,
  INTERVAL_DISPLAY,
} from "@/lib/contract";

interface Invoice {
  id: string;
  title: string;
  client: string;
  creator: string;
  amount: number;
  status: "paid" | "unpaid" | "overdue" | "cancelled";
  dueDate: string;
  date: string;
  recurring: boolean;
  interval?: string;
}

function useInvoices(ids: bigint[]): {
  invoices: Invoice[];
  isLoading: boolean;
} {
  const { data: invoiceResults, isLoading } = useReadContracts({
    contracts: ids.map((id) => ({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: "getInvoice" as const,
      args: [id] as const,
      chainId: CHAIN.id,
    })),
    query: { enabled: ids.length > 0 },
  });

  const invoices: Invoice[] = (invoiceResults ?? [])
    .filter((r) => r.status === "success" && !!r.result)
    .map((r) => {
      const inv = r.result as {
        id: bigint;
        title: string;
        client: `0x${string}`;
        creator: `0x${string}`;
        amount: bigint;
        status: number;
        dueDate: bigint;
        createdAt: bigint;
        isRecurring: boolean;
        interval: number;
      };
      return {
        id: inv.id.toString(),
        title: inv.title,
        client: inv.client,
        creator: inv.creator,
        amount: parseFloat(formatUnits(inv.amount, 18)),
        status: STATUS_MAP[inv.status] ?? "unpaid",
        dueDate: new Date(Number(inv.dueDate) * 1000).toLocaleDateString(),
        date: new Date(Number(inv.createdAt) * 1000).toLocaleDateString(),
        recurring: inv.isRecurring,
        interval: INTERVAL_DISPLAY[inv.interval],
      };
    })
    .reverse();

  return { invoices, isLoading };
}

export default function AllInvoices() {
  const router = useRouter();
  const { address } = useWallet();
  const [tab, setTab] = useState<"sent" | "received">("sent");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<
    "all" | "paid" | "unpaid" | "overdue" | "cancelled" | "recurring"
  >("all");

  const { data: creatorIds, isLoading: isLoadingCreatorIds } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "getCreatorInvoices",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
    chainId: CHAIN.id,
  });

  const { data: clientIds, isLoading: isLoadingClientIds } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "getClientInvoices",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
    chainId: CHAIN.id,
  });

  const sentIds = (creatorIds as bigint[] | undefined) ?? [];
  const receivedIds = (clientIds as bigint[] | undefined) ?? [];

  const { invoices: sentInvoices, isLoading: isLoadingSent } =
    useInvoices(sentIds);
  const { invoices: receivedInvoices, isLoading: isLoadingReceived } =
    useInvoices(receivedIds);

  const isLoading =
    isLoadingCreatorIds ||
    isLoadingClientIds ||
    isLoadingSent ||
    isLoadingReceived;

  const activeInvoices = tab === "sent" ? sentInvoices : receivedInvoices;

  const sentFilters = [
    "all",
    "paid",
    "unpaid",
    "overdue",
    "cancelled",
    "recurring",
  ] as const;

  const filteredInvoices = activeInvoices.filter((invoice) => {
    if (tab === "sent" && filter !== "all") {
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

  const sortedInvoices =
    tab === "received"
      ? [...filteredInvoices].sort((a, b) => {
          const order = { overdue: 0, unpaid: 1, paid: 2, cancelled: 3 };
          return (order[a.status] ?? 4) - (order[b.status] ?? 4);
        })
      : filteredInvoices;

  const unpaidReceivedCount = receivedInvoices.filter(
    (i) => i.status === "unpaid" || i.status === "overdue",
  ).length;

  return (
    <Layout>
      <div className="min-h-screen bg-[#F9FAFB]">
        <div className="bg-[#1B4332] px-6 py-6">
          <h1 className="text-white text-2xl mb-4" style={{ fontWeight: 700 }}>
            Invoices
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

        {/* Tabs */}
        <div className="bg-white px-6 pt-4 border-b border-gray-200">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => {
                setTab("sent");
                setFilter("all");
              }}
              className={`flex-1 py-2 rounded-xl text-sm transition-colors ${
                tab === "sent"
                  ? "bg-[#1B4332] text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
              style={{ fontWeight: 600 }}
            >
              Sent{" "}
              {sentInvoices.length > 0 && (
                <span className="ml-1 text-xs opacity-70">
                  ({sentInvoices.length})
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setTab("received");
                setFilter("all");
              }}
              className={`flex-1 py-2 rounded-xl text-sm transition-colors ${
                tab === "received"
                  ? "bg-[#1B4332] text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
              style={{ fontWeight: 600 }}
            >
              Received{" "}
              {unpaidReceivedCount > 0 && (
                <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {unpaidReceivedCount}
                </span>
              )}
            </button>
          </div>

          {/* Filters — sent tab only */}
          {tab === "sent" && (
            <div className="flex gap-2 overflow-x-auto pb-4">
              {sentFilters.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors capitalize ${
                    filter === f
                      ? "bg-[#1B4332] text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                  style={{ fontWeight: 600 }}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-6">
          {/* Loading */}
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
                Open this app in MiniPay or Farcaster
              </p>
            </div>
          )}

          {/* Empty */}
          {!isLoading && address && sortedInvoices.length === 0 && (
            <div className="text-center py-16">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3
                className="text-xl mb-2 text-gray-600"
                style={{ fontWeight: 700 }}
              >
                {tab === "sent" ? "No invoices sent yet" : "No invoices to pay"}
              </h3>
              <p className="text-gray-500 mb-6">
                {tab === "sent"
                  ? "Create your first invoice to get started"
                  : "You're all caught up!"}
              </p>
              {tab === "sent" && (
                <button
                  onClick={() => router.push("/create-invoice")}
                  className="bg-[#1B4332] text-white px-6 py-3 rounded-xl hover:opacity-90"
                  style={{ fontWeight: 600 }}
                >
                  Create Invoice
                </button>
              )}
            </div>
          )}

          {/* List */}
          {!isLoading && sortedInvoices.length > 0 && (
            <div className="space-y-3">
              {sortedInvoices.map((invoice) => (
                <button
                  key={invoice.id}
                  onClick={() => router.push(`/invoice-detail/${invoice.id}`)}
                  className="w-full bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-left"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h4
                        className="text-lg mb-1 truncate"
                        style={{ fontWeight: 700 }}
                      >
                        {invoice.title}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {tab === "sent" ? "To: " : "From: "}
                        {tab === "sent"
                          ? `${invoice.client.slice(0, 6)}...${invoice.client.slice(-4)}`
                          : `${invoice.creator.slice(0, 6)}...${invoice.creator.slice(-4)}`}
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
                    <div className="text-right">
                      <p
                        className="text-xl text-[#1B4332]"
                        style={{ fontWeight: 700 }}
                      >
                        {invoice.amount.toFixed(2)}{" "}
                        <span className="text-sm">USDm</span>
                      </p>
                      {tab === "received" &&
                        (invoice.status === "unpaid" ||
                          invoice.status === "overdue") && (
                          <span className="text-xs text-white bg-[#1B4332] px-2 py-0.5 rounded-full">
                            Tap to pay
                          </span>
                        )}
                    </div>
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
