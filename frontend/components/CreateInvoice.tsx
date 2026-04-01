"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Layout } from "./Layout";
import { ArrowLeft, Calendar, Eye } from "lucide-react";
import { motion } from "motion/react";

export default function CreateInvoice() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    clientWallet: "",
    amount: "",
    dueDate: "",
    recurring: false,
    interval: "monthly",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Create invoice
    const invoice = {
      id: Date.now().toString(),
      title: formData.title,
      description: formData.description,
      client: formData.clientWallet,
      amount: parseFloat(formData.amount),
      dueDate: formData.dueDate,
      status: "unpaid" as const,
      date: new Date().toLocaleDateString(),
      recurring: formData.recurring,
      interval: formData.interval,
      createdAt: new Date().toISOString(),
    };

    // Save to localStorage
    const stored = localStorage.getItem("invoices");
    const invoices = stored ? JSON.parse(stored) : [];
    invoices.unshift(invoice);
    localStorage.setItem("invoices", JSON.stringify(invoices));

    router.push(`/invoice-created/${invoice.id}`);
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
              Amount (cUSD)
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

          {/* Buttons */}
          <div className="space-y-3 pt-4">
            <button
              type="submit"
              className="w-full bg-[#1B4332] text-white py-4 rounded-xl hover:opacity-90 transition-opacity"
              style={{ fontWeight: 600 }}
            >
              Create Invoice
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
