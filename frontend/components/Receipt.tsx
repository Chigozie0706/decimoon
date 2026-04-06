"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Layout } from "./Layout";
import {
  CheckCircle,
  Download,
  Share2,
  Home as HomeIcon,
  ExternalLink,
} from "lucide-react";
import { motion } from "motion/react";
import confetti from "canvas-confetti";

export function Receipt() {
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

    // Trigger confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  }, [id]);

  if (!invoice) {
    return (
      <Layout showNav={false}>
        <div className="min-h-screen flex items-center justify-center">
          <p>Receipt not found</p>
        </div>
      </Layout>
    );
  }

  const txHash = `0x${Math.random().toString(16).slice(2, 66)}`;
  const platformFee = (invoice.amount * 0.02).toFixed(2);
  const celoExplorerLink = `https://explorer.celo.org/mainnet/tx/${txHash}`;

  const handleDownload = () => {
    alert("PDF download functionality would be implemented here");
  };

  const handleShare = () => {
    const message = `Payment received!\n\nInvoice: ${invoice.title}\nAmount: ${invoice.amount} USDm\nTx: ${txHash.slice(0, 10)}...`;
    navigator.clipboard.writeText(message);
    alert("Receipt details copied to clipboard!");
  };

  return (
    <Layout showNav={false}>
      <div className="min-h-screen bg-[#F9FAFB]">
        {/* Success Header */}
        <div className="bg-[#22C55E] px-6 pt-16 pb-12 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
          >
            <div className="w-24 h-24 bg-white rounded-full mx-auto mb-4 flex items-center justify-center">
              <CheckCircle className="w-16 h-16 text-[#22C55E]" />
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-white text-3xl mb-2"
            style={{ fontWeight: 700 }}
          >
            Payment Successful!
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-white/90 text-lg"
          >
            {invoice.amount} USDm received
          </motion.p>
        </div>

        {/* Receipt Details */}
        <div className="p-6">
          <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
            <div className="text-center mb-6 pb-6 border-b border-gray-100">
              <p className="text-xs text-gray-500 mb-2">PAYMENT RECEIPT</p>
              <h2 className="text-xl mb-2" style={{ fontWeight: 700 }}>
                {invoice.title}
              </h2>
              <p className="text-sm text-gray-600">{invoice.description}</p>
            </div>

            {/* Transaction Details */}
            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-start">
                <span className="text-sm text-gray-600">Invoice ID</span>
                <span className="text-sm font-mono" style={{ fontWeight: 600 }}>
                  #{invoice.id.slice(-8)}
                </span>
              </div>

              <div className="flex justify-between items-start">
                <span className="text-sm text-gray-600">Date Paid</span>
                <span className="text-sm" style={{ fontWeight: 600 }}>
                  {new Date(invoice.paidAt || Date.now()).toLocaleDateString(
                    "en-US",
                    {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )}
                </span>
              </div>

              <div className="flex justify-between items-start">
                <span className="text-sm text-gray-600">From</span>
                <span
                  className="text-sm font-mono break-all text-right max-w-[200px]"
                  style={{ fontWeight: 600 }}
                >
                  {invoice.client}
                </span>
              </div>

              <div className="flex justify-between items-start">
                <span className="text-sm text-gray-600">To</span>
                <span
                  className="text-sm font-mono break-all text-right max-w-[200px]"
                  style={{ fontWeight: 600 }}
                >
                  {localStorage.getItem("walletAddress")}
                </span>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Amount</span>
                  <span className="text-lg" style={{ fontWeight: 700 }}>
                    {invoice.amount} USDm
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">
                    Platform Fee (2%)
                  </span>
                  <span className="text-sm text-gray-600">
                    -{platformFee} USDm
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <span className="text-[#22C55E]" style={{ fontWeight: 600 }}>
                    Net Received
                  </span>
                  <span
                    className="text-2xl text-[#22C55E]"
                    style={{ fontWeight: 700 }}
                  >
                    {(invoice.amount * 0.98).toFixed(2)} USDm
                  </span>
                </div>
              </div>
            </div>

            {/* Transaction Hash */}
            <div className="bg-[#F9FAFB] rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-2">Transaction Hash</p>
              <p className="text-xs font-mono break-all mb-3">{txHash}</p>
              <a
                href={celoExplorerLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-[#1B4332] hover:underline"
                style={{ fontWeight: 600 }}
              >
                <ExternalLink className="w-4 h-4" />
                View on Celo Explorer
              </a>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleDownload}
              className="w-full bg-[#1B4332] text-white py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              style={{ fontWeight: 600 }}
            >
              <Download className="w-5 h-5" />
              Download PDF
            </button>

            <button
              onClick={handleShare}
              className="w-full bg-white border-2 border-[#1B4332] text-[#1B4332] py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
              style={{ fontWeight: 600 }}
            >
              <Share2 className="w-5 h-5" />
              Share Receipt
            </button>

            <button
              onClick={() => router.push("/home")}
              className="w-full bg-white border-2 border-gray-200 text-[#111827] py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
              style={{ fontWeight: 600 }}
            >
              <HomeIcon className="w-5 h-5" />
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
