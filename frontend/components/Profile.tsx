"use client";

import { useRouter } from "next/navigation";
import { Layout } from "./Layout";
import {
  LogOut,
  Wallet,
  FileText,
  DollarSign,
  Settings,
  ExternalLink,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useDisconnect } from "wagmi";
import { useMiniPay } from "@/hooks/useMiniPay";

interface Invoice {
  id: string;
  amount: number;
  status: "paid" | "unpaid" | "overdue";
}

export default function Profile() {
  const router = useRouter();
  const { address, isConnected } = useMiniPay();
  const { disconnect } = useDisconnect();
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Load invoices — will be replaced with on-chain fetch once contract is ready
  useEffect(() => {
    const stored = localStorage.getItem("invoices");
    if (stored) {
      setInvoices(JSON.parse(stored));
    }
  }, []);

  const handleDisconnect = () => {
    if (confirm("Are you sure you want to disconnect your wallet?")) {
      disconnect();
      router.push("/onboarding");
    }
  };

  const handleCopyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    alert("Wallet address copied!");
  };

  const totalInvoices = invoices.length;
  const totalEarned = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + inv.amount, 0);
  const pendingAmount = invoices
    .filter((inv) => inv.status === "unpaid")
    .reduce((sum, inv) => sum + inv.amount, 0);

  const displayAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "Not connected";

  const avatarLetters = address ? address.substring(2, 4).toUpperCase() : "??";

  const explorerUrl = address
    ? `https://explorer.celo.org/address/${address}`
    : "https://explorer.celo.org";

  return (
    <Layout>
      <div className="min-h-screen bg-[#F9FAFB]">
        {/* Header */}
        <div className="bg-[#1B4332] px-6 pt-12 pb-8">
          <div className="flex flex-col items-center text-center">
            <div
              className="w-24 h-24 bg-[#F4C430] rounded-full flex items-center justify-center text-[#1B4332] mb-4 text-3xl"
              style={{ fontWeight: 700 }}
            >
              {avatarLetters}
            </div>
            <h1 className="text-white text-xl mb-2" style={{ fontWeight: 700 }}>
              My Profile
            </h1>
            <p className="text-white/80 text-sm font-mono mb-1">
              {displayAddress}
            </p>
            <button
              onClick={handleCopyAddress}
              className="text-[#F4C430] text-sm hover:underline"
            >
              Copy Address
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="px-6 py-6">
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-xl p-4 shadow-sm text-center">
              <FileText className="w-5 h-5 text-[#1B4332] mx-auto mb-2" />
              <p className="text-2xl mb-1" style={{ fontWeight: 700 }}>
                {totalInvoices}
              </p>
              <p className="text-xs text-gray-600">Invoices</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm text-center">
              <DollarSign className="w-5 h-5 text-[#22C55E] mx-auto mb-2" />
              <p className="text-2xl mb-1" style={{ fontWeight: 700 }}>
                {totalEarned.toFixed(0)}
              </p>
              <p className="text-xs text-gray-600">Earned</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm text-center">
              <DollarSign className="w-5 h-5 text-[#F59E0B] mx-auto mb-2" />
              <p className="text-2xl mb-1" style={{ fontWeight: 700 }}>
                {pendingAmount.toFixed(0)}
              </p>
              <p className="text-xs text-gray-600">Pending</p>
            </div>
          </div>

          {/* Menu Items */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
            <button
              onClick={() => router.push("/recurring-invoice")}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-100"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1B4332]/10 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#1B4332]" />
                </div>
                <div className="text-left">
                  <p className="text-sm" style={{ fontWeight: 600 }}>
                    Recurring Invoices
                  </p>
                  <p className="text-xs text-gray-500">Manage subscriptions</p>
                </div>
              </div>
              <ExternalLink className="w-5 h-5 text-gray-400" />
            </button>

            <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1B4332]/10 rounded-lg flex items-center justify-center">
                  <Settings className="w-5 h-5 text-[#1B4332]" />
                </div>
                <div className="text-left">
                  <p className="text-sm" style={{ fontWeight: 600 }}>
                    Settings
                  </p>
                  <p className="text-xs text-gray-500">App preferences</p>
                </div>
              </div>
              <ExternalLink className="w-5 h-5 text-gray-400" />
            </button>

            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1B4332]/10 rounded-lg flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-[#1B4332]" />
                </div>
                <div className="text-left">
                  <p className="text-sm" style={{ fontWeight: 600 }}>
                    View on Explorer
                  </p>
                  <p className="text-xs text-gray-500">Celo blockchain</p>
                </div>
              </div>
              <ExternalLink className="w-5 h-5 text-gray-400" />
            </a>
          </div>

          {/* About */}
          <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
            <h3 className="text-sm mb-3" style={{ fontWeight: 700 }}>
              About InvoicePay
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Create professional invoices and get paid instantly in USDm. Every
              payment is recorded on-chain — 100% verifiable and tamper-proof.
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Version 1.0.0</span>
              <span>•</span>
              <span>Built on Celo</span>
            </div>
          </div>

          {/* Disconnect Button */}
          <button
            onClick={handleDisconnect}
            className="w-full bg-[#EF4444] text-white py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            style={{ fontWeight: 600 }}
          >
            <LogOut className="w-5 h-5" />
            Disconnect Wallet
          </button>
        </div>
      </div>
    </Layout>
  );
}
