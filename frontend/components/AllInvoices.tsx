"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Layout } from "../components/Layout";
import { StatusBadge } from "./StatusBadge";
import { Search, FileText } from "lucide-react";

interface Invoice {
  id: string;
  title: string;
  client: string;
  amount: number;
  status: "paid" | "unpaid" | "overdue";
  dueDate: string;
  date: string;
  recurring?: boolean;
  interval?: string;
}

export default function AllInvoices() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<
    "all" | "paid" | "unpaid" | "overdue" | "recurring"
  >("all");

  useEffect(() => {
    const stored = localStorage.getItem("invoices");
    if (stored) {
      setInvoices(JSON.parse(stored));
    }
  }, []);

  const filteredInvoices = invoices.filter((invoice) => {
    if (filter !== "all") {
      if (filter === "recurring" && !invoice.recurring) return false;
      if (filter !== "recurring" && invoice.status !== filter) return false;
    }

    // Apply search filter
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

          {/* Search Bar */}
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
          {filteredInvoices.length === 0 ? (
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
                  onClick={() => router.push("/create")}
                  className="bg-[#1B4332] text-white px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
                  style={{ fontWeight: 600 }}
                >
                  Create Invoice
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInvoices.map((invoice) => (
                <button
                  key={invoice.id}
                  onClick={() => router.push(`/invoice/${invoice.id}`)}
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
                      {invoice.amount} <span className="text-sm">cUSD</span>
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
