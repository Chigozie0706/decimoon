"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Layout } from "./Layout";
import { ArrowLeft, Calendar, Eye } from "lucide-react";
import { motion } from "motion/react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, decodeEventLog } from "viem";
import { celo, celoSepolia } from "wagmi/chains";
import { useMiniPay } from "@/hooks/useMiniPay";

const CONTRACT_ADDRESS = "0xYOUR_DEPLOYED_CONTRACT_ADDRESS" as `0x${string}`;
const CHAIN = celoSepolia; // switch to celo for mainnet

// Interval enum matches Decimoon1.Interval: 0=weekly, 1=biweekly, 2=monthly
const INTERVAL_MAP: Record<string, number> = {
  weekly: 0,
  biweekly: 1,
  monthly: 2,
};

const CONTRACT_ABI = [
  {
    inputs: [
      { internalType: "address", name: "client", type: "address" },
      { internalType: "string", name: "title", type: "string" },
      { internalType: "string", name: "description", type: "string" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "dueDate", type: "uint256" },
      { internalType: "bool", name: "isRecurring", type: "bool" },
      {
        internalType: "enum Decimoon1.Interval",
        name: "interval",
        type: "uint8",
      },
    ],
    name: "createInvoice",
    outputs: [{ internalType: "uint256", name: "id", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "id", type: "uint256" },
      {
        indexed: true,
        internalType: "address",
        name: "creator",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "client",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "dueDate",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "isRecurring",
        type: "bool",
      },
      {
        indexed: false,
        internalType: "enum Decimoon1.Interval",
        name: "interval",
        type: "uint8",
      },
    ],
    name: "InvoiceCreated",
    type: "event",
  },
] as const;

// ── Component ──────────────────────────────────────────────────────────────────
export default function CreateInvoice() {
  const router = useRouter();
  const { address } = useMiniPay();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    clientWallet: "",
    amount: "",
    dueDate: "",
    recurring: false,
    interval: "monthly",
  });

  const { writeContractAsync, isPending } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | null>(null);

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const isSubmitting = isPending || isConfirming;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!address) {
      setError("Wallet not connected. Please open this app in MiniPay.");
      return;
    }

    try {
      // Convert due date string to unix timestamp (seconds)
      const dueDateTimestamp = BigInt(
        Math.floor(new Date(formData.dueDate).getTime() / 1000),
      );

      // USDm has 18 decimals
      const amountInWei = parseUnits(formData.amount, 18);

      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "createInvoice",
        args: [
          formData.clientWallet as `0x${string}`,
          formData.title,
          formData.description,
          amountInWei,
          dueDateTimestamp,
          formData.recurring,
          INTERVAL_MAP[formData.interval] as 0 | 1 | 2,
        ],
        chainId: CHAIN.id,
      });

      setTxHash(hash);

      // Wait for receipt then extract on-chain invoice ID from event logs
      // and navigate to invoice-created with the on-chain ID
      router.push(`/invoice-created/${hash}`);
    } catch (err: any) {
      console.error(err);
      setError(err?.shortMessage ?? err?.message ?? "Transaction failed");
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  return (
    <Layout>
      <div className="min-h-screen bg-[#F9FAFB]">
        {/* Header */}
        <div className="bg-[#1B4332] px-6 py-6 flex items-center gap-4">
          <button onClick={() => router.back()} className="text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-white text-xl" style={{ fontWeight: 700 }}>
            Create Invoice
          </h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="text-sm text-gray-600 mb-2 block">
              Invoice Title
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Logo Design Services"
              required
              className="w-full px-4 py-3 bg-white rounded-xl border border-gray-200 focus:border-[#1B4332] focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm text-gray-600 mb-2 block">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Brief description of services or products"
              required
              rows={3}
              className="w-full px-4 py-3 bg-white rounded-xl border border-gray-200 focus:border-[#1B4332] focus:outline-none resize-none"
            />
          </div>

          {/* Client Wallet Address */}
          <div>
            <label className="text-sm text-gray-600 mb-2 block">
              Client Wallet Address
            </label>
            <input
              type="text"
              name="clientWallet"
              value={formData.clientWallet}
              onChange={handleChange}
              placeholder="0x..."
              required
              className="w-full px-4 py-3 bg-white rounded-xl border border-gray-200 focus:border-[#1B4332] focus:outline-none font-mono text-sm"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="text-sm text-gray-600 mb-2 block">
              Amount (USDm)
            </label>
            <div className="relative">
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                placeholder="0.00"
                required
                step="0.01"
                min="0"
                className="w-full px-4 py-3 bg-white rounded-xl border border-gray-200 focus:border-[#1B4332] focus:outline-none text-2xl"
                style={{ fontWeight: 700 }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              2% platform fee will be deducted per payment
            </p>
          </div>

          {/* Due Date */}
          <div>
            <label className="text-sm text-gray-600 mb-2 block">Due Date</label>
            <div className="relative">
              <input
                type="date"
                name="dueDate"
                value={formData.dueDate}
                onChange={handleChange}
                required
                min={new Date().toISOString().split("T")[0]}
                className="w-full px-4 py-3 bg-white rounded-xl border border-gray-200 focus:border-[#1B4332] focus:outline-none"
              />
              <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Recurring */}
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <label className="text-sm" style={{ fontWeight: 600 }}>
                  Recurring Invoice
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Automatically renew this invoice
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="recurring"
                  checked={formData.recurring}
                  onChange={handleChange}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1B4332]"></div>
              </label>
            </div>

            {formData.recurring && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="pt-4 border-t border-gray-200"
              >
                <label className="text-sm text-gray-600 mb-2 block">
                  Interval
                </label>
                <select
                  name="interval"
                  value={formData.interval}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-[#1B4332] focus:outline-none"
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </motion.div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Wallet not connected warning */}
          {!address && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-yellow-700 text-sm">
              Open this app inside MiniPay to create invoices on-chain.
            </div>
          )}

          {/* Buttons */}
          <div className="space-y-3 pt-4">
            <button
              type="submit"
              disabled={isSubmitting || !address}
              className="w-full bg-[#1B4332] text-white py-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontWeight: 600 }}
            >
              {isPending
                ? "Confirm in wallet..."
                : isConfirming
                  ? "Confirming on-chain..."
                  : "Create Invoice"}
            </button>
            <button
              type="button"
              className="w-full bg-white border-2 border-gray-200 text-[#111827] py-4 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              style={{ fontWeight: 600 }}
            >
              <Eye className="w-5 h-5" />
              Preview
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
