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
    inputs: [{ internalType: "address", name: "creator", type: "address" }],
    name: "getCreatorInvoices",
    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "client", type: "address" }],
    name: "getClientInvoices",
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
  creator: string;
  amount: number;
  status: "paid" | "unpaid" | "overdue";
  dueDate: string;
  date: string;
  recurring: boolean;
  interval?: string;
}

function useInvoices(ids: bigint[]) {
  const { data: invoiceResults, isLoading } = useReadContracts({
    contracts: ids.map((id) => ({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
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
        interval: INTERVAL_MAP[inv.interval],
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
    "all" | "paid" | "unpaid" | "overdue" | "recurring"
  >("all");

  // Sent invoices (creator)
  const { data: creatorIds, isLoading: isLoadingCreatorIds } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getCreatorInvoices",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
    chainId: CHAIN.id,
  });

  // Received invoices (client)
  const { data: clientIds, isLoading: isLoadingClientIds } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
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

  // Filters only apply to sent tab — received always shows unpaid/overdue first
  const sentFilters = [
    "all",
    "paid",
    "unpaid",
    "overdue",
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

  // Sort received: unpaid/overdue first
  const sortedInvoices =
    tab === "received"
      ? [...filteredInvoices].sort((a, b) => {
          const order = { unpaid: 0, overdue: 1, paid: 2 };
          return order[a.status] - order[b.status];
        })
      : filteredInvoices;

  return (
    <Layout>
      <div className="min-h-screen bg-[#F9FAFB]">
        {/* Header */}
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

        {/* Sent / Received tabs */}
        <div className="bg-white px-6 pt-4 border-b border-gray-200">
          <div className="flex gap-1 mb-4">
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
              Sent
              {sentInvoices.length > 0 && (
                <span className="ml-2 bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
                  {sentInvoices.length}
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
              Received
              {/* Badge for unpaid received invoices */}
              {receivedInvoices.filter(
                (i) => i.status === "unpaid" || i.status === "overdue",
              ).length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {
                    receivedInvoices.filter(
                      (i) => i.status === "unpaid" || i.status === "overdue",
                    ).length
                  }
                </span>
              )}
            </button>
          </div>

          {/* Filter pills — only show on Sent tab */}
          {tab === "sent" && (
            <div className="flex gap-2 overflow-x-auto pb-4 min-w-max">
              {sentFilters.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-full text-sm transition-colors capitalize ${
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

        {/* Invoice List */}
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
                Open this app in MiniPay or Farcaster to view your invoices
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
                  className="bg-[#1B4332] text-white px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
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
                  onClick={() => router.push(`/invoice-details/${invoice.id}`)}
                  className="w-full bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-left"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-lg mb-1" style={{ fontWeight: 700 }}>
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
                      {/* Pay button inline for received unpaid invoices */}
                      {tab === "received" && invoice.status === "unpaid" && (
                        <span className="text-xs text-white bg-[#1B4332] px-2 py-0.5 rounded-full mt-1 inline-block">
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
