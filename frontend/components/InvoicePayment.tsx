import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Layout } from "./Layout";
import { Wallet, CheckCircle, AlertCircle } from "lucide-react";
import { motion } from "motion/react";

export function InvoicePayment() {
  const { id } = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null);
  const [paying, setPaying] = useState(false);

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
      <Layout showNav={false}>
        <div className="min-h-screen flex items-center justify-center">
          <p>Invoice not found</p>
        </div>
      </Layout>
    );
  }

  const handlePay = async () => {
    setPaying(true);

    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Update invoice status
    const stored = localStorage.getItem("invoices");
    if (stored) {
      const invoices = JSON.parse(stored);
      const updated = invoices.map((inv: any) =>
        inv.id === id
          ? { ...inv, status: "paid", paidAt: new Date().toISOString() }
          : inv,
      );
      localStorage.setItem("invoices", JSON.stringify(updated));
    }

    router.push(`/receipt/${id}`);
  };

  if (invoice.status === "paid") {
    return (
      <Layout showNav={false}>
        <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-8 shadow-lg text-center max-w-sm">
            <div className="w-16 h-16 bg-[#22C55E] rounded-full mx-auto mb-4 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl mb-2" style={{ fontWeight: 700 }}>
              Already Paid
            </h2>
            <p className="text-gray-600 mb-6">
              This invoice has already been paid
            </p>
            <button
              onClick={() => router.push(`/receipt/${id}`)}
              className="w-full bg-[#1B4332] text-white py-3 rounded-xl hover:opacity-90 transition-opacity"
              style={{ fontWeight: 600 }}
            >
              View Receipt
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout showNav={false}>
      <div className="min-h-screen bg-[#F9FAFB]">
        {/* Header */}
        <div className="bg-[#1B4332] px-6 py-8 text-center">
          <div className="w-16 h-16 bg-[#F4C430] rounded-full mx-auto mb-4 flex items-center justify-center">
            <Wallet className="w-8 h-8 text-[#1B4332]" />
          </div>
          <h1 className="text-white text-xl" style={{ fontWeight: 700 }}>
            Payment Request
          </h1>
          <p className="text-white/80 text-sm mt-2">via InvoicePay</p>
        </div>

        {/* Invoice Card */}
        <div className="p-6">
          <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
            {/* Invoice Header */}
            <div className="mb-6 pb-6 border-b border-gray-100">
              <p className="text-xs text-gray-500 mb-1">
                Invoice #{invoice.id.slice(-8)}
              </p>
              <h2 className="text-2xl mb-2" style={{ fontWeight: 700 }}>
                {invoice.title}
              </h2>
              <p className="text-gray-600">{invoice.description}</p>
            </div>

            {/* From/To */}
            <div className="space-y-3 mb-6 pb-6 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-500 mb-1">From</p>
                <p className="text-sm font-mono break-all">{invoice.client}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">To</p>
                <p className="text-sm font-mono break-all">
                  {localStorage.getItem("walletAddress")}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Due Date</p>
                <p className="text-sm" style={{ fontWeight: 600 }}>
                  {invoice.dueDate}
                </p>
              </div>
            </div>

            {/* Amount */}
            <div className="bg-[#1B4332]/5 rounded-xl p-6 text-center">
              <p className="text-sm text-gray-600 mb-2">Amount to Pay</p>
              <p
                className="text-5xl text-[#1B4332] mb-1"
                style={{ fontWeight: 700 }}
              >
                {invoice.amount}
              </p>
              <p className="text-xl text-gray-600">cUSD</p>
            </div>

            {invoice.recurring && (
              <div className="mt-4 p-3 bg-[#F59E0B]/10 rounded-lg text-center">
                <p
                  className="text-sm text-[#F59E0B]"
                  style={{ fontWeight: 600 }}
                >
                  🔄 This is a recurring {invoice.interval} invoice
                </p>
              </div>
            )}
          </div>

          {/* Pay Button */}
          <button
            onClick={handlePay}
            disabled={paying}
            className="w-full bg-[#1B4332] text-white py-5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 mb-4"
            style={{ fontWeight: 700, fontSize: "18px" }}
          >
            {paying ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Processing Payment...
              </div>
            ) : (
              "Pay Now with MiniPay"
            )}
          </button>

          {/* Powered By */}
          <div className="text-center py-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">Powered by</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-sm" style={{ fontWeight: 600 }}>
                Celo
              </span>
              <span className="text-gray-300">•</span>
              <span className="text-sm" style={{ fontWeight: 600 }}>
                MiniPay
              </span>
            </div>
          </div>

          {/* Security Note */}
          <div className="bg-blue-50 rounded-xl p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p style={{ fontWeight: 600 }} className="mb-1">
                Secure On-Chain Payment
              </p>
              <p className="text-xs text-blue-700">
                This payment will be recorded on the Celo blockchain and is 100%
                verifiable.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
