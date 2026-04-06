"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Layout } from "./Layout";
import { QRCodeSVG } from "qrcode.react";
import {
  Copy,
  Share2,
  CheckCircle,
  Home as HomeIcon,
  Loader2,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { usePublicClient } from "wagmi";
import { celo, celoSepolia } from "wagmi/chains";
import { decodeEventLog } from "viem";
import contractAbi from "@/contract/abi.json";

const CHAIN = celo;
const CONTRACT_ADDRESS =
  "0x0f42F76C461f2F403bd797Ca8a023686dc8B4753" as `0x${string}`;

export default function InvoiceCreated() {
  const { id } = useParams();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [invoiceData, setInvoiceData] = useState<{
    title: string;
    amount: string;
    dueDate: string;
    description: string;
    recurring: boolean;
    interval: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const publicClient = usePublicClient({ chainId: CHAIN.id });

  // id here is the tx hash — extract the real invoice ID from the event log
  useEffect(() => {
    if (!publicClient || !id) return;

    const txHash = id as `0x${string}`;

    publicClient
      .waitForTransactionReceipt({ hash: txHash })
      .then((receipt) => {
        // Find the InvoiceCreated event in the logs
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: contractAbi.abi,
              data: log.data,
              topics: log.topics,
              eventName: "InvoiceCreated",
            });

            if (decoded && decoded.args) {
              const args = decoded.args as any;
              const onChainId = args.id?.toString();
              setInvoiceId(onChainId);

              // Store invoice metadata in sessionStorage so we can display it
              // (the contract data takes time to index — we have it from the form)
              const pending = sessionStorage.getItem("pendingInvoice");
              if (pending) {
                setInvoiceData(JSON.parse(pending));
                sessionStorage.removeItem("pendingInvoice");
              }
              break;
            }
          } catch {
            // log didn't match InvoiceCreated event, skip
          }
        }
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [publicClient, id]);

  const shareLink =
    typeof window !== "undefined" && invoiceId
      ? `${window.location.origin}/invoice-detail/${invoiceId}`
      : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const message = `Payment request: ${invoiceData?.title ?? ""}\nAmount: ${invoiceData?.amount ?? ""} USDm\nPay here: ${shareLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleTwitterShare = () => {
    const message = `Payment request: ${invoiceData?.title ?? ""}\nAmount: ${invoiceData?.amount ?? ""} USDm`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(shareLink)}`,
      "_blank",
    );
  };

  if (isLoading) {
    return (
      <Layout showNav={false}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-[#1B4332] mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              Confirming invoice on-chain...
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!invoiceId) {
    return (
      <Layout showNav={false}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center px-6">
            <p className="text-gray-600 mb-4" style={{ fontWeight: 600 }}>
              Invoice created but could not retrieve ID.
            </p>
            <button
              onClick={() => router.push("/invoices")}
              className="bg-[#1B4332] text-white px-6 py-3 rounded-xl"
              style={{ fontWeight: 600 }}
            >
              View All Invoices
            </button>
          </div>
        </div>
      </Layout>
    );
  }

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

        <div className="px-6 py-6">
          {/* Invoice Summary */}
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
            <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-500 mb-1">Invoice ID</p>
                <p className="text-sm font-mono" style={{ fontWeight: 600 }}>
                  #{invoiceId}
                </p>
              </div>
              {invoiceData?.dueDate && (
                <div className="text-right">
                  <p className="text-xs text-gray-500 mb-1">Due Date</p>
                  <p className="text-sm" style={{ fontWeight: 600 }}>
                    {invoiceData.dueDate}
                  </p>
                </div>
              )}
            </div>

            {invoiceData && (
              <>
                <h3 className="text-lg mb-2" style={{ fontWeight: 700 }}>
                  {invoiceData.title}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  {invoiceData.description}
                </p>
                <div className="bg-[#1B4332]/5 rounded-xl p-4">
                  <p className="text-sm text-gray-600 mb-1">Amount Due</p>
                  <p
                    className="text-3xl text-[#1B4332]"
                    style={{ fontWeight: 700 }}
                  >
                    {invoiceData.amount} <span className="text-xl">USDm</span>
                  </p>
                </div>
                {invoiceData.recurring && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-[#F59E0B]">
                    <div className="w-2 h-2 bg-[#F59E0B] rounded-full animate-pulse" />
                    Recurring {invoiceData.interval}
                  </div>
                )}
              </>
            )}
          </div>

          {/* QR Code */}
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6 text-center">
            <p className="text-sm text-gray-600 mb-4">Scan to Pay</p>
            <div className="inline-block p-4 bg-white rounded-xl border-4 border-[#1B4332]">
              <QRCodeSVG value={shareLink} size={200} />
            </div>
            <p className="text-xs text-gray-400 mt-3 font-mono break-all">
              {shareLink}
            </p>
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
