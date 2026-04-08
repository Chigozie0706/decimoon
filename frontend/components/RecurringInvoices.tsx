import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Layout } from "./Layout";
import { StatusBadge } from "./StatusBadge";
import { Calendar, DollarSign, TrendingUp, Pause, Play } from "lucide-react";
import { toast } from "sonner";

interface RecurringInvoice {
  id: string;
  title: string;
  client: string;
  amount: number;
  interval: string;
  nextDueDate: string;
  totalCollected: number;
  active: boolean;
  recurring: boolean;
}

export default function RecurringInvoices() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<RecurringInvoice[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("invoices");
    if (stored) {
      const allInvoices = JSON.parse(stored);
      const recurringOnly = allInvoices
        .filter((inv: any) => inv.recurring)
        .map((inv: any) => ({
          ...inv,
          active: inv.status !== "overdue",
          totalCollected: inv.status === "paid" ? inv.amount : 0,
          nextDueDate: inv.dueDate,
        }));
      setInvoices(recurringOnly);
    }
  }, []);

  const toggleActive = (id: string) => {
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === id ? { ...inv, active: !inv.active } : inv,
      ),
    );
    toast.success("Invoice status updated");
  };

  const totalMonthlyRevenue = invoices
    .filter((inv) => inv.active && inv.interval === "monthly")
    .reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <Layout>
      <div className="min-h-screen bg-[#F9FAFB]">
        {/* Header */}
        <div className="bg-[#1B4332] px-6 py-6">
          <h1 className="text-white text-2xl mb-4" style={{ fontWeight: 700 }}>
            Recurring Invoices
          </h1>

          {/* Monthly Revenue Card */}
          <div className="bg-[#1B4332]/50 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-[#F4C430]" />
              <p className="text-white/80 text-sm">Estimated Monthly Revenue</p>
            </div>
            <p className="text-white text-3xl" style={{ fontWeight: 700 }}>
              {totalMonthlyRevenue.toFixed(2)}{" "}
              <span className="text-xl">USDm</span>
            </p>
          </div>
        </div>

        {/* Invoice List */}
        <div className="p-6">
          {invoices.length === 0 ? (
            <div className="text-center py-16">
              <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3
                className="text-xl mb-2 text-gray-600"
                style={{ fontWeight: 700 }}
              >
                No recurring invoices
              </h3>
              <p className="text-gray-500 mb-6">
                Create an invoice and enable recurring billing
              </p>
              <button
                onClick={() => router.push("/create")}
                className="bg-[#1B4332] text-white px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
                style={{ fontWeight: 600 }}
              >
                Create Invoice
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="bg-white rounded-xl p-5 shadow-sm"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h4 className="text-lg mb-1" style={{ fontWeight: 700 }}>
                        {invoice.title}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {invoice.client.slice(0, 10)}...
                        {invoice.client.slice(-8)}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleActive(invoice.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        invoice.active
                          ? "bg-[#22C55E]/10 text-[#22C55E] hover:bg-[#22C55E]/20"
                          : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                      }`}
                    >
                      {invoice.active ? (
                        <Play className="w-5 h-5" />
                      ) : (
                        <Pause className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-100">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <p className="text-xs text-gray-500">Amount</p>
                      </div>
                      <p
                        className="text-xl text-[#1B4332]"
                        style={{ fontWeight: 700 }}
                      >
                        {invoice.amount} USDm
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <p className="text-xs text-gray-500">Interval</p>
                      </div>
                      <p className="text-sm" style={{ fontWeight: 600 }}>
                        {invoice.interval.charAt(0).toUpperCase() +
                          invoice.interval.slice(1)}
                      </p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Next Due</p>
                      <p className="text-sm" style={{ fontWeight: 600 }}>
                        {invoice.nextDueDate}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 mb-1">
                        Total Collected
                      </p>
                      <p
                        className="text-sm text-[#22C55E]"
                        style={{ fontWeight: 600 }}
                      >
                        {invoice.totalCollected.toFixed(2)} USDm
                      </p>
                    </div>
                    {/* <div>
                      {invoice.active ? (
                        <StatusBadge status="active" />
                      ) : (
                        <StatusBadge status="paused" />
                      )}
                    </div> */}
                  </div>

                  {/* View Button */}
                  <button
                    onClick={() => router.push(`/invoice/${invoice.id}`)}
                    className="w-full mt-4 bg-gray-50 text-[#1B4332] py-2 rounded-lg hover:bg-gray-100 transition-colors text-sm"
                    style={{ fontWeight: 600 }}
                  >
                    View Details
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
