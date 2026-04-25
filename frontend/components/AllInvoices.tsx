"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Layout } from "../components/Layout";
import { StatusBadge, TokenBadge, TypeBadge } from "./StatusBadge";
import { Search, FileText, RefreshCw } from "lucide-react";
import { useReadContract, useReadContracts } from "wagmi";
import { useWallet } from "@/hooks/use-wallet";
import { formatUnits } from "viem";
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
  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e": {
    symbol: "USDT",
    decimals: 6,
  },
  "0xceba9300f2b948710d2653dd7b07f33a8b32118c": { symbol: "USDC", decimals: 6 },
};

//  Maps
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

const INVOICE_TYPE_MAP: Record<number, "Standard" | "Recurring" | "Milestone"> =
  {
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

//  Types ─
type InvoiceStatus = "Unpaid" | "Paid" | "Cancelled" | "Overdue" | "Disputed";
type InvoiceType = "Standard" | "Recurring" | "Milestone";

interface Invoice {
  id: string;
  invoiceRef: string;
  metadataCID: string;
  creator: string;
  client: string;
  token: string; // symbol e.g. "cUSD"
  amount: number;
  status: InvoiceStatus;
  invoiceType: InvoiceType;
  interval: string;
  dueDate: string;
  date: string;
}

//  Hook
function useInvoices(ids: bigint[]): {
  invoices: Invoice[];
  isLoading: boolean;
} {
  const { data: results, isLoading } = useReadContracts({
    contracts: ids.map((id) => ({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: "getInvoice" as const,
      args: [id] as const,
      chainId: CHAIN.id,
    })),
    query: { enabled: ids.length > 0 },
  });

  const invoices: Invoice[] = (results ?? [])
    .filter((r) => r.status === "success" && !!r.result)
    .map((r) => {
      const inv = r.result as {
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
      };

      const tokenInfo = TOKEN_CONFIG[inv.token.toLowerCase()] ?? {
        symbol: "cUSD",
        decimals: 18,
      };

      return {
        id: inv.id.toString(),
        invoiceRef: inv.invoiceRef,
        metadataCID: inv.metadataCID,
        creator: inv.creator,
        client: inv.client,
        token: tokenInfo.symbol,
        amount: parseFloat(formatUnits(inv.amount, tokenInfo.decimals)),
        status: STATUS_MAP[inv.status] ?? "Unpaid",
        invoiceType: INVOICE_TYPE_MAP[inv.invoiceType] ?? "Standard",
        interval: INTERVAL_DISPLAY[inv.interval] ?? "",
        dueDate:
          inv.dueDate > BigInt(0)
            ? new Date(Number(inv.dueDate) * 1000).toLocaleDateString()
            : "No deadline",
        date: new Date(Number(inv.createdAt) * 1000).toLocaleDateString(),
      };
    })
    .reverse();

  return { invoices, isLoading };
}

//  Filter config
type FilterValue =
  | "all"
  | "Unpaid"
  | "Paid"
  | "Overdue"
  | "Disputed"
  | "Cancelled"
  | "Recurring"
  | "Milestone";

const SENT_FILTERS: { label: string; value: FilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Unpaid", value: "Unpaid" },
  { label: "Paid", value: "Paid" },
  { label: "Overdue", value: "Overdue" },
  { label: "Disputed", value: "Disputed" },
  { label: "Cancelled", value: "Cancelled" },
  { label: "Recurring", value: "Recurring" },
  { label: "Milestone", value: "Milestone" },
];

const RECEIVED_FILTERS: { label: string; value: FilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "Unpaid" },
  { label: "Paid", value: "Paid" },
  { label: "Overdue", value: "Overdue" },
  { label: "Disputed", value: "Disputed" },
];

//  Component ─
export default function AllInvoices() {
  const router = useRouter();
  const { address } = useWallet();

  const [tab, setTab] = useState<"sent" | "received">("sent");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");

  //  Fetch IDs ─
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

  //  Derived data
  const activeInvoices = tab === "sent" ? sentInvoices : receivedInvoices;

  const unpaidReceivedCount = receivedInvoices.filter(
    (i) => i.status === "Unpaid" || i.status === "Overdue",
  ).length;

  //  Filter + search
  const filteredInvoices = activeInvoices.filter((invoice) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "Recurring" && invoice.invoiceType === "Recurring") ||
      (filter === "Milestone" && invoice.invoiceType === "Milestone") ||
      invoice.status === filter;

    const matchesSearch =
      !searchQuery ||
      invoice.invoiceRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.creator.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  // Sort received — overdue first, then unpaid, then paid, then cancelled
  const STATUS_SORT: Record<string, number> = {
    Overdue: 0,
    Unpaid: 1,
    Disputed: 2,
    Paid: 3,
    Cancelled: 4,
  };

  const sortedInvoices =
    tab === "received"
      ? [...filteredInvoices].sort(
          (a, b) => (STATUS_SORT[a.status] ?? 5) - (STATUS_SORT[b.status] ?? 5),
        )
      : filteredInvoices;

  const activeFilters = tab === "sent" ? SENT_FILTERS : RECEIVED_FILTERS;

  //  Switch tab ─
  const switchTab = (t: "sent" | "received") => {
    setTab(t);
    setFilter("all");
    setSearchQuery("");
  };

  //  Render
  return (
    <Layout>
      <div className="min-h-screen bg-[#F9FAFB]">
        {/*  Header + Search  */}
        <div className="bg-[#1B4332] px-6 py-6">
          <h1 className="text-white text-2xl font-bold mb-4">Invoices</h1>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ref, wallet..."
              className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/50 focus:outline-none focus:bg-white/20 transition-colors"
            />
          </div>
        </div>

        {/*  Tabs + Filters  */}
        <div className="bg-white px-6 pt-4 border-b border-gray-100 sticky top-0 z-10">
          {/* Sent / Received tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => switchTab("sent")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                tab === "sent"
                  ? "bg-[#1B4332] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Sent
              {sentInvoices.length > 0 && (
                <span className="ml-1 text-xs opacity-70">
                  ({sentInvoices.length})
                </span>
              )}
            </button>
            <button
              onClick={() => switchTab("received")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors relative ${
                tab === "received"
                  ? "bg-[#1B4332] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Received
              {unpaidReceivedCount > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {unpaidReceivedCount}
                </span>
              )}
            </button>
          </div>

          {/* Filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-none">
            {activeFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
                  filter === f.value
                    ? "bg-[#1B4332] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/*  Content  */}
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
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-bold text-gray-500">
                Wallet not connected
              </p>
              <p className="text-sm mt-1">
                Open this app in MiniPay or Farcaster
              </p>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && address && sortedInvoices.length === 0 && (
            <div className="text-center py-16">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-200" />
              <h3 className="text-lg font-bold text-gray-600 mb-2">
                {tab === "sent" ? "No invoices yet" : "No invoices to pay"}
              </h3>
              <p className="text-gray-400 text-sm mb-6">
                {tab === "sent"
                  ? filter !== "all"
                    ? `No ${filter.toLowerCase()} invoices found`
                    : "Create your first invoice to get started"
                  : "You're all caught up!"}
              </p>
              {tab === "sent" && filter === "all" && (
                <button
                  onClick={() => router.push("/create-invoice")}
                  className="bg-[#1B4332] text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity"
                >
                  Create Invoice
                </button>
              )}
            </div>
          )}

          {/* Invoice list */}
          {!isLoading && sortedInvoices.length > 0 && (
            <div className="space-y-3">
              {sortedInvoices.map((invoice) => (
                <button
                  key={invoice.id}
                  onClick={() => router.push(`/invoice-details/${invoice.id}`)}
                  className="w-full bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all text-left border border-transparent hover:border-[#1B4332]/20"
                >
                  {/* Row 1: ref + type + status */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-400">
                        {invoice.invoiceRef}
                      </span>
                      <TypeBadge type={invoice.invoiceType} />
                    </div>
                    <StatusBadge status={invoice.status} />
                  </div>

                  {/* Row 2: title (invoiceRef as fallback until IPFS loads on detail) */}
                  <h4 className="text-base font-bold text-gray-800 mb-1 truncate">
                    {invoice.invoiceRef}
                  </h4>

                  {/* Row 3: wallet */}
                  <p className="text-xs text-gray-400 font-mono mb-3">
                    {tab === "sent" ? "To: " : "From: "}
                    {tab === "sent"
                      ? `${invoice.client.slice(0, 6)}...${invoice.client.slice(-4)}`
                      : `${invoice.creator.slice(0, 6)}...${invoice.creator.slice(-4)}`}
                  </p>

                  {/* Row 4: amount + token + due date */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-[#1B4332]">
                        {invoice.amount.toFixed(2)}
                      </span>
                      <TokenBadge token={invoice.token} />
                    </div>
                    <div className="flex items-center gap-2">
                      {invoice.invoiceType === "Recurring" && (
                        <span className="text-xs text-blue-600 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" />
                          {invoice.interval}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        Due {invoice.dueDate}
                      </span>
                    </div>
                  </div>

                  {/* Tap to pay — received + unpaid/overdue */}
                  {tab === "received" &&
                    (invoice.status === "Unpaid" ||
                      invoice.status === "Overdue") && (
                      <div className="mt-3 flex items-center justify-between">
                        {invoice.status === "Overdue" && (
                          <span className="text-xs text-red-500 font-semibold">
                            Overdue
                          </span>
                        )}
                        <span className="ml-auto text-xs text-white bg-[#1B4332] px-3 py-1 rounded-full font-semibold">
                          Tap to pay →
                        </span>
                      </div>
                    )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
