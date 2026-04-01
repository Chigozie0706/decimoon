"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Layout } from "./Layout";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Share2, CheckCircle, Home as HomeIcon } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

export default function InvoiceCreated() {
  const { id } = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null);
  const [copied, setCopied] = useState(false);

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
          <p>Loading...</p>
        </div>
      </Layout>
    );
  }

  const shareLink = `${window.location.origin}/pay/${invoice.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const message = `Payment request: ${invoice.title}\nAmount: ${invoice.amount} cUSD\nPay here: ${shareLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleTwitterShare = () => {
    const message = `Payment request: ${invoice.title}\nAmount: ${invoice.amount} cUSD`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(shareLink)}`,
      "_blank",
    );
  };

  return (
    <Layout showNav={false}>
      <div className="min-h-screen bg-[#F9FAFB]">
        {/* Success Animation */}
        <div className="bg-[#1B4332] px-6 pt-16 pb-12 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
          >
            <div className="w-20 h-20 bg-[#22C55E] rounded-full mx-auto mb-4 flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-white text-2xl mb-2"
            style={{ fontWeight: 700 }}
          >
            Invoice Created!
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-white/80"
          >
            Share with your client to receive payment
          </motion.p>
        </div>

        {/* Invoice Summary */}
        <div className="px-6 py-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
            <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-500 mb-1">Invoice ID</p>
                <p className="text-sm font-mono" style={{ fontWeight: 600 }}>
                  #{invoice.id.slice(-8)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-1">Due Date</p>
                <p className="text-sm" style={{ fontWeight: 600 }}>
                  {invoice.dueDate}
                </p>
              </div>
            </div>
            <h3 className="text-lg mb-2" style={{ fontWeight: 700 }}>
              {invoice.title}
            </h3>
            <p className="text-sm text-gray-600 mb-4">{invoice.description}</p>
            <div className="bg-[#1B4332]/5 rounded-xl p-4">
              <p className="text-sm text-gray-600 mb-1">Amount Due</p>
              <p
                className="text-3xl text-[#1B4332]"
                style={{ fontWeight: 700 }}
              >
                {invoice.amount} <span className="text-xl">cUSD</span>
              </p>
            </div>
            {invoice.recurring && (
              <div className="mt-4 flex items-center gap-2 text-sm text-[#F59E0B]">
                <div className="w-2 h-2 bg-[#F59E0B] rounded-full animate-pulse"></div>
                Recurring {invoice.interval}
              </div>
            )}
          </div>

          {/* QR Code */}
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6 text-center">
            <p className="text-sm text-gray-600 mb-4">Scan to Pay</p>
            <div className="inline-block p-4 bg-white rounded-xl border-4 border-[#1B4332]">
              <QRCodeSVG value={shareLink} size={200} />
            </div>
          </div>

          {/* Share Buttons */}
          <div className="space-y-3 mb-6">
            <button
              onClick={handleCopy}
              className="w-full bg-[#1B4332] text-white py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              style={{ fontWeight: 600 }}
            >
              {copied ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
              {copied ? "Copied!" : "Copy Link"}
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleWhatsAppShare}
                className="bg-[#25D366] text-white py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                style={{ fontWeight: 600 }}
              >
                <Share2 className="w-5 h-5" />
                WhatsApp
              </button>
              <button
                onClick={handleTwitterShare}
                className="bg-[#1DA1F2] text-white py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                style={{ fontWeight: 600 }}
              >
                <Share2 className="w-5 h-5" />X (Twitter)
              </button>
            </div>
          </div>

          {/* Navigation */}
          <button
            onClick={() => router.push("/home")}
            className="w-full bg-white border-2 border-gray-200 text-[#111827] py-4 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            style={{ fontWeight: 600 }}
          >
            <HomeIcon className="w-5 h-5" />
            Back to Home
          </button>
        </div>
      </div>
    </Layout>
  );
}
