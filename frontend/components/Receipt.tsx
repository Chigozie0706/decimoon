"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Layout } from "./Layout";
import {
  CheckCircle,
  Share2,
  Home as HomeIcon,
  ExternalLink,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { motion } from "motion/react";
import confetti from "canvas-confetti";
import { useReadContract } from "wagmi";
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
  "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e": { symbol: "USDT", decimals: 6 },
  "0xceba9300f2b948710d2653dd7b07f33a8b32118c": { symbol: "USDC", decimals: 6 },
};

const INVOICE_TYPE_MAP: Record<number, string> = {
  0: "Standard",
  1: "Recurring",
  2: "Milestone",
};

interface OnChainInvoice {
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
  totalCollected: bigint;
  milestonesReleased: bigint;
  createdAt: bigint;
  paidAt: bigint;
  disputeReason: string;
}

interface IPFSMetadata {
  title?: string;
  notes?: string;
}

export function Receipt() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const txHash = searchParams.get("tx"); // real tx hash passed from InvoiceDetail

  const [metadata, setMetadata] = useState<IPFSMetadata | null>(null);
  const [confettiFired, setConfettiFired] = useState(false);

  const invoiceId = BigInt(id as string);

  //  Read invoice from chain
  const { data: rawInvoice, isLoading } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "getInvoice",
    args: [invoiceId],
    chainId: CHAIN.id,
  });

  const inv = rawInvoice as OnChainInvoice | undefined;

  //  Fetch IPFS metadata
  useEffect(() => {
    if (!inv?.metadataCID) return;
    const gateway =
      process.env.NEXT_PUBLIC_PINATA_GATEWAY ?? "https://gateway.pinata.cloud";
    fetch(`${gateway}/ipfs/${inv.metadataCID}`)
      .then((r) => r.json())
      .then((data) => setMetadata(data))
      .catch(() => setMetadata(null));
  }, [inv?.metadataCID]);

  //  Confetti — once
  useEffect(() => {
    if (confettiFired) return;
    setConfettiFired(true);
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
  }, []);

  //  Share handler
  const handleShare = () => {
    if (typeof window === "undefined") return;
    const title = metadata?.title ?? inv?.invoiceRef ?? "Invoice";
    const token = inv
      ? (TOKEN_CONFIG[inv.token.toLowerCase()]?.symbol ?? "tokens")
      : "tokens";
    const amount = inv
      ? parseFloat(
          formatUnits(
            inv.totalCollected,
            TOKEN_CONFIG[inv.token.toLowerCase()]?.decimals ?? 18,
          ),
        )
      : 0;
    const msg = txHash
      ? ` Payment received!\n\n${title}\n${amount.toFixed(2)} ${token}\n\nTx: ${txHash.slice(0, 10)}...${txHash.slice(-6)}`
      : ` Payment received for ${title}`;
    navigator.clipboard.writeText(msg);
  };

  //  Loading
  if (isLoading) {
    return (
      <Layout showNav={false}>
        <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-[#1B4332] mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Loading receipt...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!inv) {
    return (
      <Layout showNav={false}>
        <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
          <div className="text-center px-6">
            <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-semibold">Receipt not found</p>
            <button
              onClick={() => router.push("/home")}
              className="mt-4 text-[#1B4332] text-sm underline"
            >
              Go home
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  //  Parse data
  const tokenInfo = TOKEN_CONFIG[inv.token.toLowerCase()] ?? {
    symbol: "cUSD",
    decimals: 18,
  };
  const invoiceType = INVOICE_TYPE_MAP[inv.invoiceType] ?? "Standard";
  const isMilestone = inv.invoiceType === 2;

  // Creator always receives the full invoiced amount — platform fee is paid by client on top
  const principalAmount = parseFloat(
    formatUnits(inv.amount, tokenInfo.decimals),
  );
  const totalCollected = parseFloat(
    formatUnits(inv.totalCollected, tokenInfo.decimals),
  );

  // For milestone: show totalCollected (sum of released phases)
  // For standard/recurring: show principal (what creator received)
  const displayAmount = isMilestone ? totalCollected : principalAmount;

  const paidAt =
    inv.paidAt > BigInt(0)
      ? new Date(Number(inv.paidAt) * 1000).toLocaleString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : new Date().toLocaleString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

  const isOpenInvoice =
    inv.client === "0x0000000000000000000000000000000000000000";
  const celoExplorerLink = txHash
    ? `https://explorer.celo.org/mainnet/tx/${txHash}`
    : null;

  //  Render
  return (
    <Layout showNav={false}>
      <div className="min-h-screen bg-[#F9FAFB]">
        {/* Success header */}
        <div className="bg-[#22C55E] px-6 pt-16 pb-12 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
          >
            <div className="w-24 h-24 bg-white rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg">
              <CheckCircle className="w-14 h-14 text-[#22C55E]" />
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-white text-3xl font-bold mb-2"
          >
            Payment Confirmed!
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-white/90 text-xl font-semibold"
          >
            {displayAmount.toFixed(2)} {tokenInfo.symbol} received
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-white/60 text-sm mt-1"
          >
            {isMilestone
              ? `${Number(inv.milestonesReleased)} of ${Number(inv.milestonesReleased)} milestone${Number(inv.milestonesReleased) !== 1 ? "s" : ""} released`
              : invoiceType}
          </motion.p>
        </div>

        <div className="p-6 space-y-4">
          {/* Receipt card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl shadow-sm overflow-hidden"
          >
            {/* Title */}
            <div className="px-5 py-4 border-b border-gray-100 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                Payment Receipt
              </p>
              <h2 className="text-lg font-bold text-gray-800">
                {metadata?.title ?? inv.invoiceRef}
              </h2>
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                {inv.invoiceRef}
              </p>
            </div>

            {/* Details rows */}
            <div className="px-5 py-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Date Paid</span>
                <span className="font-semibold text-gray-800 text-right max-w-[180px]">
                  {paidAt}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">From (Client)</span>
                <span className="font-mono text-gray-700 text-xs">
                  {isOpenInvoice
                    ? "Open invoice"
                    : `${inv.client.slice(0, 6)}...${inv.client.slice(-4)}`}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">To (Creator)</span>
                <span className="font-mono text-gray-700 text-xs">
                  {inv.creator.slice(0, 6)}...{inv.creator.slice(-4)}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Type</span>
                <span className="font-semibold text-gray-800">
                  {invoiceType}
                </span>
              </div>

              {/* Amount breakdown */}
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Invoice amount</span>
                  <span className="font-semibold text-gray-800">
                    {principalAmount.toFixed(2)} {tokenInfo.symbol}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Platform fee (2%)</span>
                  <span className="text-gray-400">
                    +{(principalAmount * 0.02).toFixed(2)} {tokenInfo.symbol}{" "}
                    (paid by client)
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <span className="text-[#1B4332] font-bold">You received</span>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-[#1B4332]">
                      {displayAmount.toFixed(2)}
                    </span>
                    <span className="text-sm font-semibold text-[#1B4332] ml-1">
                      {tokenInfo.symbol}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-gray-400 text-right">
                  Full invoice amount — no deductions ✓
                </p>
              </div>
            </div>

            {/* Tx hash */}
            {txHash ? (
              <div className="mx-5 mb-5 bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Transaction Hash</p>
                <p className="text-xs font-mono text-gray-600 break-all mb-3">
                  {txHash}
                </p>
                {celoExplorerLink && (
                  <a
                    href={celoExplorerLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-[#1B4332] font-semibold hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View on Celo Explorer
                  </a>
                )}
              </div>
            ) : (
              <div className="mx-5 mb-5 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <p className="text-xs text-amber-600">
                  Transaction hash unavailable — check Celo Explorer with your
                  wallet address to verify.
                </p>
              </div>
            )}
          </motion.div>

          {/* Action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="space-y-3"
          >
            <button
              onClick={handleShare}
              className="w-full bg-[#1B4332] text-white py-4 rounded-xl flex items-center justify-center gap-2 font-semibold hover:opacity-90 transition-opacity"
            >
              <Share2 className="w-5 h-5" />
              Share Receipt
            </button>

            {celoExplorerLink && (
              <a
                href={celoExplorerLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-white border border-gray-200 text-gray-700 py-4 rounded-xl flex items-center justify-center gap-2 font-semibold hover:bg-gray-50 transition-colors"
              >
                <ExternalLink className="w-5 h-5" />
                View on Celo Explorer
              </a>
            )}

            <button
              onClick={() => router.push("/home")}
              className="w-full bg-white border border-gray-200 text-gray-700 py-4 rounded-xl flex items-center justify-center gap-2 font-semibold hover:bg-gray-50 transition-colors"
            >
              <HomeIcon className="w-5 h-5" />
              Back to Home
            </button>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
