"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Layout } from "./Layout";
import { ArrowLeft, Plus, Trash2, Calendar, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useWaitForTransactionReceipt, useConnectorClient } from "wagmi";
import { walletActions, parseUnits, encodeFunctionData } from "viem";
import { celo } from "wagmi/chains";
import { useWallet } from "@/hooks/use-wallet";
import contractAbi from "../contract/abi.json";
import { prepareAndUploadMetadata } from "@/lib/decimoon-ipfs";

// Contract config
const CONTRACT_ADDRESS =
  "0x0f42F76C461f2F403bd797Ca8a023686dc8B4753" as `0x${string}`;
const CHAIN = celo;

// Supported tokens
const TOKENS = {
  cUSD: {
    address: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as `0x${string}`,
    decimals: 18,
    symbol: "cUSD",
    color: "bg-green-100 text-green-800",
  },
  cEUR: {
    address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73" as `0x${string}`,
    decimals: 18,
    symbol: "cEUR",
    color: "bg-blue-100 text-blue-800",
  },
  cKES: {
    address: "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0" as `0x${string}`,
    decimals: 18,
    symbol: "cKES",
    color: "bg-amber-100 text-amber-800",
  },
  USDC: {
    address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" as `0x${string}`,
    decimals: 6,
    symbol: "USDC",
    color: "bg-blue-50 text-blue-600",
  },
} as const;

type TokenKey = keyof typeof TOKENS;
type InvoiceType = "Standard" | "Recurring" | "Milestone";
type Interval = "weekly" | "biweekly" | "monthly";

// Interval enum matches contract: None=0, Weekly=1, Biweekly=2, Monthly=3
const INTERVAL_MAP: Record<Interval, number> = {
  weekly: 1,
  biweekly: 2,
  monthly: 3,
};

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: string;
}

interface MilestoneItem {
  description: string;
  amount: string;
}


export default function CreateInvoice() {
  const router = useRouter();
  const { address, isMiniPay, isFarcaster } = useWallet();

    //  Form state 
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("Standard");
  const [selectedToken, setSelectedToken] = useState<TokenKey>("cUSD");
  const [title, setTitle] = useState("");
  const [clientWallet, setClientWallet] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [lateFeesBps, setLateFeesBps] = useState("");
  const [notes, setNotes] = useState("");
  const [interval, setInterval] = useState<Interval>("monthly");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: "" },
  ]);
  const [milestones, setMilestones] = useState<MilestoneItem[]>([
    { description: "", amount: "" },
  ]);

  //  UI state 
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isUploadingIPFS, setIsUploadingIPFS] = useState(false);
  const [step, setStep] = useState<"form" | "uploading" | "confirming">("form");

  const { data: connectorClient } = useConnectorClient({ chainId: CHAIN.id });
  const walletClient = connectorClient?.extend(walletActions);

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const isSubmitting = isPending || isConfirming || isUploadingIPFS;


  //  Calculations 
  const lineItemTotal = lineItems.reduce((sum, item) => {
    const price = parseFloat(item.unitPrice) || 0;
    return sum + item.quantity * price;
  }, 0);

  const milestoneTotal = milestones.reduce((sum, m) => {
    return sum + (parseFloat(m.amount) || 0);
  }, 0);

  const invoiceAmount =
    invoiceType === "Milestone" ? milestoneTotal : lineItemTotal;
  const platformFee = invoiceAmount * 0.02;
  const clientTotal = invoiceAmount + platformFee;


  //  Line item helpers 
  const addLineItem = () =>
    setLineItems([
      ...lineItems,
      { description: "", quantity: 1, unitPrice: "" },
    ]);

  const removeLineItem = (i: number) =>
    setLineItems(lineItems.filter((_, idx) => idx !== i));

  const updateLineItem = (
    i: number,
    field: keyof LineItem,
    value: string | number,
  ) =>
    setLineItems(
      lineItems.map((item, idx) =>
        idx === i ? { ...item, [field]: value } : item,
      ),
    );

     // Milestone helpers 
  const addMilestone = () =>
    setMilestones([...milestones, { description: "", amount: "" }]);

  const removeMilestone = (i: number) =>
    setMilestones(milestones.filter((_, idx) => idx !== i));

  const updateMilestone = (
    i: number,
    field: keyof MilestoneItem,
    value: string,
  ) =>
    setMilestones(
      milestones.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)),
    );


    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!address) {
      setError(
        isMiniPay
          ? "Wallet not connected. Please restart MiniPay."
          : isFarcaster
            ? "Wallet not connected. Please restart the Farcaster app."
            : "No wallet detected.",
      );
      return;
    }

    if (!walletClient) {
      setError("Wallet client not ready. Please try again.");
      return;
    }

    // Validate
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!clientWallet.trim()) {
      setError("Client wallet address is required.");
      return;
    }
    if (invoiceAmount <= 0) {
      setError("Invoice amount must be greater than 0.");
      return;
    }
    if (!dueDate && invoiceType !== "Milestone") {
      setError("Due date is required.");
      return;
    }

    if (invoiceType === "Milestone") {
      if (milestones.some((m) => !m.description.trim() || !m.amount)) {
        setError("All milestone phases require a description and amount.");
        return;
      }
    } else {
      if (
        lineItems.some((item) => !item.description.trim() || !item.unitPrice)
      ) {
        setError("All line items require a description and price.");
        return;
      }
    }

    setIsPending(true);

    try {
      //  Step 1: Upload metadata to IPFS 
      setStep("uploading");
      setIsUploadingIPFS(true);

      const token = TOKENS[selectedToken];

      const metadataCID = await prepareAndUploadMetadata({
        title: title.trim(),
        tokenSymbol: selectedToken,
        tokenDecimals: token.decimals,
        notes: notes.trim() || undefined,
        ...(invoiceType === "Milestone"
          ? {
              milestones: milestones.map((m, i) => ({
                index: i,
                description: m.description.trim(),
              })),
            }
          : {
              items: lineItems.map((item) => ({
                name: item.description.trim(),
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: (item.quantity * parseFloat(item.unitPrice)).toFixed(
                  token.decimals > 6 ? 6 : token.decimals,
                ),
              })),
            }),
      });

      setIsUploadingIPFS(false);
      setStep("confirming");

      //  Step 2: Build contract args 
      const dueDateTimestamp = dueDate
        ? BigInt(Math.floor(new Date(dueDate).getTime() / 1000))
        : BigInt(0);

      const lateFeesBpsValue = lateFeesBps
        ? BigInt(Math.round(parseFloat(lateFeesBps) * 100)) // e.g. 0.5% → 50 bps
        : BigInt(0);

      //  Step 3: Call contract 
      let hash: `0x${string}`;

      if (invoiceType === "Milestone") {
        const milestoneAmounts = milestones.map((m) =>
          parseUnits(m.amount, token.decimals),
        );

        hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: contractAbi.abi,
          functionName: "createMilestoneInvoice",
          args: [
            clientWallet as `0x${string}`, // client
            token.address, // token
            dueDateTimestamp, // dueDate (0 = none for milestone)
            milestoneAmounts, // milestoneAmounts[]
            metadataCID, // metadataCID
          ],
          chain: CHAIN,
          account: address,
        });
      } else {
        const amountInUnits = parseUnits(
          invoiceAmount.toFixed(token.decimals > 6 ? 6 : token.decimals),
          token.decimals,
        );

        hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: contractAbi.abi,
          functionName: "createInvoice",
          args: [
            clientWallet as `0x${string}`, // client
            token.address, // token
            amountInUnits, // amount
            dueDateTimestamp, // dueDate
            lateFeesBpsValue, // lateFeesBps
            invoiceType === "Recurring", // isRecurring
            BigInt(invoiceType === "Recurring" ? INTERVAL_MAP[interval] : 0), // interval (0 = None for Standard)
            metadataCID, // metadataCID
          ],
          chain: CHAIN,
          account: address,
        });
      }

      setTxHash(hash);
      router.push(`/invoice-created/${hash}`);
    } catch (err: any) {
      console.error(err);
      setError(err?.shortMessage ?? err?.message ?? "Transaction failed");
      setStep("form");
    } finally {
      setIsPending(false);
      setIsUploadingIPFS(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-[#F9FAFB]">
        {/* Header */}
        <div className="bg-[#1B4332] px-6 py-6 flex items-center gap-4">
          <button onClick={() => router.back()} className="text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-white text-xl font-bold">Create Invoice</h1>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 pb-32">
          {/*  Invoice Type  */}
          <div>
            <label className="text-sm text-gray-600 mb-2 block font-medium">
              Invoice Type
            </label>
            <div className="flex gap-2">
              {(["Standard", "Recurring", "Milestone"] as InvoiceType[]).map(
                (type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setInvoiceType(type)}
                    className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${
                      invoiceType === type
                        ? "bg-[#1B4332] text-white border-[#1B4332]"
                        : "bg-white text-gray-600 border-gray-200"
                    }`}
                  >
                    {type}
                  </button>
                ),
              )}
            </div>
          </div>

 {/*  Title  */}
          <div>
            <label className="text-sm text-gray-600 mb-2 block">
              Invoice Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Logo Design Services"
              required
              className="w-full px-4 py-3 bg-white text-gray-900 rounded-xl border border-gray-200 focus:border-[#1B4332] focus:outline-none"
            />
          </div>

          {/*  Client Wallet  */}
          <div>
            <label className="text-sm text-gray-600 mb-2 block">
              Client Wallet Address
            </label>
            <input
              type="text"
              value={clientWallet}
              onChange={(e) => setClientWallet(e.target.value)}
              placeholder="0x..."
              required
              className="w-full px-4 py-3 bg-white text-gray-600 rounded-xl border border-gray-200 focus:border-[#1B4332] focus:outline-none font-mono text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              Leave empty for a public invoice anyone can pay
            </p>
          </div>

          {/*  Token Selector  */}
          <div>
            <label className="text-sm text-gray-600 mb-2 block">
              Payment Token
            </label>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(TOKENS) as TokenKey[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedToken(t)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                    selectedToken === t
                      ? "bg-[#1B4332] text-white border-[#1B4332]"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/*  Line Items (Standard + Recurring)  */}
          <AnimatePresence>
            {invoiceType !== "Milestone" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label className="text-sm text-gray-600 mb-3 block">
                  Line Items
                </label>
                <div className="space-y-3">
                  {lineItems.map((item, i) => (
                    <div
                      key={i}
                      className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
                    >
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) =>
                            updateLineItem(i, "description", e.target.value)
                          }
                          className="flex-1 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm focus:border-[#1B4332] focus:outline-none"
                        />
                        {lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLineItem(i)}
                            className="p-2 text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <div className="w-20">
                          <label className="text-xs text-gray-400 mb-1 block">
                            Qty
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateLineItem(
                                i,
                                "quantity",
                                parseInt(e.target.value) || 1,
                              )
                            }
                            className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm focus:border-[#1B4332] focus:outline-none"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-gray-400 mb-1 block">
                            Unit Price ({selectedToken})
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateLineItem(i, "unitPrice", e.target.value)
                            }
                            className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm focus:border-[#1B4332] focus:outline-none"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-gray-400 mb-1 block">
                            Total
                          </label>
                          <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium text-gray-700">
                            {(
                              item.quantity * (parseFloat(item.unitPrice) || 0)
                            ).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addLineItem}
                  className="w-full mt-3 py-3 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-[#1B4332] hover:text-[#1B4332] transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/*  Milestones  */}
          <AnimatePresence>
            {invoiceType === "Milestone" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label className="text-sm text-gray-600 mb-3 block">
                  Milestone Phases
                </label>
                <div className="space-y-3">
                  {milestones.map((m, i) => (
                    <div
                      key={i}
                      className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[#1B4332] bg-[#1B4332]/10 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
                          {i + 1}
                        </span>
                        <input
                          type="text"
                          placeholder="Phase description (e.g. Design mockups)"
                          value={m.description}
                          onChange={(e) =>
                            updateMilestone(i, "description", e.target.value)
                          }
                          className="flex-1 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm focus:border-[#1B4332] focus:outline-none"
                        />
                        {milestones.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeMilestone(i)}
                            className="p-2 text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Amount</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={m.amount}
                          onChange={(e) =>
                            updateMilestone(i, "amount", e.target.value)
                          }
                          className="flex-1 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm focus:border-[#1B4332] focus:outline-none"
                        />
                        <span className="text-sm font-medium text-gray-600">
                          {selectedToken}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addMilestone}
                  className="w-full mt-3 py-3 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-[#1B4332] hover:text-[#1B4332] transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Phase
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/*  Due Date (not required for Milestone)  */}
          {invoiceType !== "Milestone" && (
            <div>
              <label className="text-sm text-gray-600 mb-2 block">
                Due Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-3 bg-white text-gray-600 rounded-xl border border-gray-200 focus:border-[#1B4332] focus:outline-none"
                />
                <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/*  Recurring Interval  */}
          <AnimatePresence>
            {invoiceType === "Recurring" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label className="text-sm text-gray-600 mb-2 block">
                  Billing Interval
                </label>
                <select
                  value={interval}
                  onChange={(e) => setInterval(e.target.value as Interval)}
                  className="w-full px-4 py-3 bg-white text-gray-600 rounded-xl border border-gray-200 focus:border-[#1B4332] focus:outline-none"
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </motion.div>
            )}
          </AnimatePresence>

          {/*  Late Fee (Standard + Recurring only)  */}
          {invoiceType !== "Milestone" && (
            <div>
              <label className="text-sm text-gray-600 mb-2 block">
                Late Fee % per day{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  placeholder="e.g. 0.5"
                  value={lateFeesBps}
                  onChange={(e) => setLateFeesBps(e.target.value)}
                  className="w-full px-4 py-3 bg-white text-gray-600 rounded-xl border border-gray-200 focus:border-[#1B4332] focus:outline-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  %/day
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Applied per day after due date. Capped at 100% of invoice
                amount. Goes fully to you.
              </p>
            </div>
          )}

          {/*  Notes / Terms  */}
          <div>
            <label className="text-sm text-gray-600 mb-2 block">
              Notes / Terms{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Payment due within 7 days. Thank you for your business."
              rows={3}
              className="w-full px-4 py-3 bg-white text-gray-600 rounded-xl border border-gray-200 focus:border-[#1B4332] focus:outline-none resize-none"
            />
          </div>

          {/*  Fee Summary  */}
          {invoiceAmount > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>
                  {invoiceType === "Milestone"
                    ? "Total milestones"
                    : "Subtotal"}
                </span>
                <span>
                  {invoiceAmount.toFixed(2)} {selectedToken}
                </span>
              </div>
              <div className="flex justify-between text-sm text-gray-400">
                <span>Platform fee (2%) — paid by client</span>
                <span>
                  +{platformFee.toFixed(2)} {selectedToken}
                </span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex justify-between font-semibold text-gray-900">
                <span>Client pays</span>
                <span>
                  {clientTotal.toFixed(2)} {selectedToken}
                </span>
              </div>
              <div className="flex justify-between text-sm font-medium text-[#1B4332]">
                <span>You receive</span>
                <span>
                  {invoiceAmount.toFixed(2)} {selectedToken} ✓
                </span>
              </div>
            </div>
          )}

          {/*  Fee note  */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <p className="text-sm text-amber-700">
              2% platform fee added on top — you always receive the full amount
              you invoice.
            </p>
          </div>

          {/*  Error  */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
              {error}
            </div>
          )}

          {/*  Wallet warning  */}
          {!address && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-yellow-700 text-sm">
              Open this app inside MiniPay or Farcaster to create invoices
              on-chain.
            </div>
          )}
