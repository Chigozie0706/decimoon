"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  FileText,
  Zap,
  Shield,
  Globe,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";

const FARCASTER_URL = "https://farcaster.xyz/miniapps/Zp22UHY2FcnO/decimoon";
const MINIPAY_URL = "https://minipay.opera.com";

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#1B4332] text-white overflow-x-hidden">
      {/*  Nav  */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#F4C430] rounded-lg flex items-center justify-center">
            <span className="text-[#1B4332] font-bold text-sm">D</span>
          </div>
          <span className="font-bold text-lg">
            Deci<span className="text-[#F4C430]">moon</span>
          </span>
        </div>
        <a
          href={FARCASTER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#F4C430] text-[#1B4332] px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5"
        >
          Open App <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </nav>

      {/*  Hero  */}
      <section className="px-6 pt-16 pb-24 max-w-5xl mx-auto">
        <div className="max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-xs font-medium mb-8">
              <span className="w-1.5 h-1.5 bg-[#F4C430] rounded-full animate-pulse" />
              Live on Celo Mainnet
            </div>

            <h1 className="text-5xl sm:text-6xl font-bold leading-tight mb-6">
              Invoicing for the <span className="text-[#F4C430]">on-chain</span>{" "}
              economy
            </h1>

            <p className="text-white/70 text-lg leading-relaxed mb-10 max-w-xl">
              Create professional invoices, share a link, and get paid instantly
              in cUSD, cEUR, USDT or USDC — every payment verified on-chain. No
              fake alerts. No middlemen.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={FARCASTER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#F4C430] text-[#1B4332] px-6 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                Open in Farcaster
                <ChevronRight className="w-5 h-5" />
              </a>
              <a
                href={MINIPAY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white/10 border border-white/20 text-white px-6 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-white/20 transition-colors"
              >
                Get MiniPay
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            {/* Trust line */}
            <p className="text-white/30 text-xs mt-6 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Smart contract verified · Powered by Celo · Farcaster Mini App
            </p>
          </motion.div>
        </div>

        {/* Crescent decoration */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="absolute top-24 right-6 sm:right-24 hidden sm:block pointer-events-none"
        >
          <div className="relative w-48 h-48">
            <div className="w-48 h-48 rounded-full bg-[#F4C430]" />
            <div className="absolute top-4 left-8 w-44 h-44 rounded-full bg-[#1B4332]" />
          </div>
        </motion.div>
      </section>

      {/*  How it works  */}
      <section className="bg-[#163828] px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <p className="text-[#F4C430] text-xs font-semibold uppercase tracking-widest mb-3">
            How it works
          </p>
          <h2 className="text-3xl font-bold mb-12">Three steps to get paid</h2>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Create your invoice",
                desc: "Add line items, set a due date, choose your token. Takes less than a minute.",
                icon: <FileText className="w-6 h-6" />,
              },
              {
                step: "02",
                title: "Share the link",
                desc: "Send via WhatsApp, Farcaster cast, or copy the link. Your client opens it in any browser.",
                icon: <Globe className="w-6 h-6" />,
              },
              {
                step: "03",
                title: "Get paid instantly",
                desc: "Client approves and pays in one tap. Funds hit your wallet immediately — on-chain proof included.",
                icon: <Zap className="w-6 h-6" />,
              },
            ].map((item) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
                className="bg-[#1B4332] rounded-2xl p-6 border border-white/10"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-[#F4C430]/10 rounded-xl flex items-center justify-center text-[#F4C430]">
                    {item.icon}
                  </div>
                  <span className="text-white/20 text-3xl font-bold">
                    {item.step}
                  </span>
                </div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/*  Features  */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <p className="text-[#F4C430] text-xs font-semibold uppercase tracking-widest mb-3">
          Features
        </p>
        <h2 className="text-3xl font-bold mb-12">
          Everything you need to invoice on-chain
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          {[
            {
              title: "Standard, Recurring & Milestone invoices",
              desc: "One-time, auto-renewing, or phased — built for every billing model.",
            },
            {
              title: "Multi-token payments",
              desc: "Accept cUSD, cEUR, USDT, or USDC. Creator always receives the full invoiced amount.",
            },
            {
              title: "Late fees on-chain",
              desc: "Set a daily late fee rate. It accrues automatically — no chasing clients.",
            },
            {
              title: "Dispute protection",
              desc: "Either party can raise a dispute. Invoice is frozen until resolved.",
            },
            {
              title: "Shareable invoice links",
              desc: "Every invoice gets a public URL. Anyone can view it — payment requires a wallet.",
            },
            {
              title: "On-chain receipts",
              desc: "Every payment is permanently recorded. Verifiable on Celo Explorer.",
            },
          ].map((f) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3 }}
              className="bg-[#163828] rounded-xl p-5 border border-white/10 flex gap-4"
            >
              <CheckCircle2 className="w-5 h-5 text-[#F4C430] flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold mb-1">{f.title}</h3>
                <p className="text-white/55 text-sm leading-relaxed">
                  {f.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/*  Built on  */}
      <section className="bg-[#163828] px-6 py-16">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-8">
          <div>
            <p className="text-white/40 text-xs uppercase tracking-widest mb-3">
              Built with
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              {["Celo", "Farcaster", "IPFS", "OpenZeppelin"].map((t) => (
                <span
                  key={t}
                  className="bg-white/10 border border-white/10 text-white/70 text-sm px-4 py-2 rounded-full"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-[#F4C430]" />
            <p className="text-white/60 text-sm">
              Smart contract at{" "}
              <a
                href="https://explorer.celo.org/mainnet/address/0x7908AEa0861A5B949B044826a6DDaA3Ed7e88ab0"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#F4C430] font-mono text-xs hover:underline"
              >
                0x7908...ab0
              </a>
            </p>
          </div>
        </div>
      </section>

      {/*  CTA  */}
      <section className="px-6 py-24 text-center max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-4xl font-bold mb-4">
            Ready to get paid <span className="text-[#F4C430]">on-chain?</span>
          </h2>
          <p className="text-white/60 mb-10">
            Open Decimoon in Farcaster or MiniPay and create your first invoice
            in under a minute.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={FARCASTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#F4C430] text-[#1B4332] px-8 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              Open in Farcaster <ChevronRight className="w-5 h-5" />
            </a>
            <a
              href={MINIPAY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white/10 border border-white/20 text-white px-8 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-white/20 transition-colors"
            >
              Get MiniPay <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </motion.div>
      </section>

      {/*  Footer  */}
      <footer className="border-t border-white/10 px-6 py-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className="font-bold text-sm">
            Deci<span className="text-[#F4C430]">moon</span>
          </span>
          <p className="text-white/30 text-xs">
            © {new Date().getFullYear()} Decimoon · Built on Celo
          </p>
        </div>
      </footer>
    </div>
  );
}
