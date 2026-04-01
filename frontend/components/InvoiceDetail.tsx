import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Layout } from "./Layout";
import { StatusBadge } from "./StatusBadge";
import {
  ArrowLeft,
  Share2,
  XCircle,
  Receipt,
  Copy,
  Calendar,
  User,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

export default function InvoiceDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem("invoices");
    if (stored) {
      const invoices = JSON.parse(stored);
      const found = invoices.find((inv: any) => inv.id === id);
      setInvoice(found);
    }
  }, [id]);

  if (!invoice) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <p>Invoice not found</p>
        </div>
      </Layout>
    );
  }

  const shareLink = `${window.location.origin}/pay/${invoice.id}`;
  const walletAddress =
    localStorage.getItem("walletAddress") || "0x0000...0000";
  const platformFee = (invoice.amount * 0.02).toFixed(2);
  const netAmount = (invoice.amount * 0.98).toFixed(2);

  const handleShare = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success("Payment link copied!");
  };

  const handleCancel = () => {
    if (invoice.status === "paid") {
      toast.error("Cannot cancel a paid invoice");
      return;
    }

    if (confirm("Are you sure you want to cancel this invoice?")) {
      const stored = localStorage.getItem("invoices");
      if (stored) {
        const invoices = JSON.parse(stored);
        const filtered = invoices.filter((inv: any) => inv.id !== id);
        localStorage.setItem("invoices", JSON.stringify(filtered));
        toast.success("Invoice cancelled");
        router.push("/home");
      }
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-[#F9FAFB]">
        {/* Header */}
        <div className="bg-[#1B4332] px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="text-white">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-white text-xl" style={{ fontWeight: 700 }}>
              Invoice Details
            </h1>
          </div>
          <StatusBadge status={invoice.status} />
        </div>

        {/* Invoice Details */}
        <div className="p-6 space-y-6">
          {/* Main Info Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-xs text-gray-500 mb-1">Invoice ID</p>
                <p className="text-sm font-mono" style={{ fontWeight: 600 }}>
                  #{invoice.id.slice(-8)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-1">Created</p>
                <p className="text-sm" style={{ fontWeight: 600 }}>
                  {invoice.date}
                </p>
              </div>
            </div>

            <h2 className="text-2xl mb-2" style={{ fontWeight: 700 }}>
              {invoice.title}
            </h2>
            <p className="text-gray-600 mb-6">{invoice.description}</p>

            {/* Amount Breakdown */}
            <div className="bg-[#F9FAFB] rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-600">Invoice Amount</span>
                <span className="text-xl" style={{ fontWeight: 700 }}>
                  {invoice.amount} cUSD
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                <span>Platform Fee (2%)</span>
                <span>-{platformFee} cUSD</span>
              </div>
              <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
                <span className="text-[#1B4332]" style={{ fontWeight: 600 }}>
                  You Receive
                </span>
                <span
                  className="text-2xl text-[#1B4332]"
                  style={{ fontWeight: 700 }}
                >
                  {netAmount} cUSD
                </span>
              </div>
            </div>

            {/* Wallet Details */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Wallet className="w-5 h-5 text-gray-400 mt-1" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">From (You)</p>
                  <p
                    className="text-sm font-mono break-all"
                    style={{ fontWeight: 600 }}
                  >
                    {walletAddress}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-400 mt-1" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">To (Client)</p>
                  <p
                    className="text-sm font-mono break-all"
                    style={{ fontWeight: 600 }}
                  >
                    {invoice.client}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-1" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Due Date</p>
                  <p className="text-sm" style={{ fontWeight: 600 }}>
                    {invoice.dueDate}
                  </p>
                </div>
              </div>
            </div>

            {invoice.recurring && (
              <div className="mt-4 p-3 bg-[#F59E0B]/10 rounded-lg">
                <p
                  className="text-sm text-[#F59E0B]"
                  style={{ fontWeight: 600 }}
                >
                  🔄 Recurring {invoice.interval}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleShare}
              className="w-full bg-[#1B4332] text-white py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              style={{ fontWeight: 600 }}
            >
              <Share2 className="w-5 h-5" />
              Share Payment Link
            </button>

            {invoice.status === "paid" && (
              <button
                onClick={() => router.push(`/receipt/${invoice.id}`)}
                className="w-full bg-[#22C55E] text-white py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                style={{ fontWeight: 600 }}
              >
                <Receipt className="w-5 h-5" />
                View Receipt
              </button>
            )}

            {invoice.status !== "paid" && (
              <button
                onClick={handleCancel}
                className="w-full bg-white border-2 border-[#EF4444] text-[#EF4444] py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
                style={{ fontWeight: 600 }}
              >
                <XCircle className="w-5 h-5" />
                Cancel Invoice
              </button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
