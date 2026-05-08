"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Layout } from "./Layout";
import { ChevronRight, Wallet } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useWallet } from "@/hooks/use-wallet";

export default function Onboarding() {
  const router = useRouter();
  // -1 = splash screen, 0-2 = onboarding slides
  const [currentSlide, setCurrentSlide] = useState(-1);
  const { isMiniPay, isFarcaster, isConnected, isDetecting } = useWallet();

  const slides = [
    {
      emoji: "📄",
      title: "Create invoices in seconds",
      description:
        "Professional invoices for your business, no paperwork needed",
    },
    {
      emoji: "🔗",
      title: "Share via link or QR",
      description: "Send to clients on WhatsApp, Farcaster, or scan in person",
    },
    {
      emoji: "💰",
      title: "Get paid instantly. No fake alerts.",
      description:
        "Pay in cUSD, cEUR, USDT or USDC. Every payment recorded on-chain — 100% verifiable.",
    },
  ];

  const handleGetStarted = () => {
    router.push("/home");
  };

  const isInApp = isMiniPay || isFarcaster;

  if (!isInApp) {
    return (
      <Layout showNav={false}>
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#1B4332] text-white px-6 text-center">
          <h1 className="text-2xl font-bold mb-4">
            Open Decimoon in Farcaster
          </h1>

          <p className="text-white/70 text-sm mb-8 max-w-sm">
            Decimoon is a Farcaster mini app. To create and pay invoices, please
            open it inside Farcaster.
          </p>

          <a
            href="https://farcaster.xyz/miniapps/Zp22UHY2FcnO/decimoon"
            target="_blank"
            className="bg-[#F4C430] text-[#1B4332] px-6 py-3 rounded-xl font-semibold"
          >
            Open in Farcaster
          </a>
        </div>
      </Layout>
    );
  }

  //  Splash screen
  if (currentSlide === -1) {
    return (
      <Layout showNav={false}>
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#1B4332] text-white px-6">
          {/* Logo */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
            className="w-24 h-24 bg-[#F4C430] rounded-2xl flex items-center justify-center mb-6 shadow-2xl"
          >
            <Wallet className="w-12 h-12 text-[#1B4332]" />
          </motion.div>

          {/* Name */}
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="text-4xl mb-3"
            style={{ fontWeight: 700 }}
          >
            Decimoon
          </motion.h1>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="text-[#F4C430] text-center text-sm mb-12 leading-relaxed"
          >
            Create invoices. Get paid instantly. On-chain.
          </motion.p>

          {/* CTA */}
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            onClick={() => setCurrentSlide(0)}
            className="bg-[#F4C430] text-[#1B4332] px-12 py-4 rounded-xl font-semibold hover:opacity-90 transition-opacity text-base"
          >
            Get Started
          </motion.button>

          {/* Powered by */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.4 }}
            className="mt-10 text-white/40 text-xs"
          >
            Powered by Celo + MiniPay
          </motion.p>
        </div>
      </Layout>
    );
  }

  //  Onboarding slides
  return (
    <Layout showNav={false}>
      <div className="min-h-screen flex flex-col bg-[#1B4332] text-white">
        {/* Small logo top */}
        <div className="pt-12 pb-4 px-6 flex justify-center">
          <div className="w-12 h-12 bg-[#F4C430] rounded-xl flex items-center justify-center">
            <Wallet className="w-6 h-6 text-[#1B4332]" />
          </div>
        </div>

        {/* Slide content */}
        <div className="flex-1 px-6 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              {/* Emoji icon */}
              <div className="text-6xl mb-6">{slides[currentSlide].emoji}</div>

              <h2
                className="text-2xl mb-4 leading-snug"
                style={{ fontWeight: 700 }}
              >
                {slides[currentSlide].title}
              </h2>
              <p className="text-white/70 text-base leading-relaxed max-w-xs mx-auto">
                {slides[currentSlide].description}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Slide indicators */}
          <div className="flex justify-center gap-2 mt-12">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentSlide
                    ? "w-8 bg-[#F4C430]"
                    : "w-2 bg-white/30"
                }`}
              />
            ))}
          </div>

          {/* Wallet connection status inside MiniPay / Farcaster */}
          {isInApp && (
            <p className="text-center text-white/50 text-xs mt-6">
              {isConnected ? "✓ Wallet connected" : "Connecting wallet..."}
            </p>
          )}
        </div>

        {/* Bottom buttons */}
        <div className="p-6 pb-10 space-y-3">
          {currentSlide < slides.length - 1 ? (
            <button
              onClick={() => setCurrentSlide(currentSlide + 1)}
              className="w-full bg-[#F4C430] text-[#1B4332] py-4 rounded-xl flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
              style={{ fontWeight: 600 }}
            >
              Next
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleGetStarted}
              disabled={isInApp && !isConnected}
              className="w-full bg-[#F4C430] text-[#1B4332] py-4 rounded-xl flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontWeight: 600 }}
            >
              {isInApp && !isConnected ? "Connecting..." : "Get Started"}
              {(!isInApp || isConnected) && (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>
          )}

          {/* Skip button — always visible on slides */}
          <button
            onClick={handleGetStarted}
            disabled={isInApp && !isConnected}
            className="w-full py-3 text-white/40 text-sm hover:text-white/70 transition-colors disabled:cursor-not-allowed"
          >
            Skip
          </button>
        </div>
      </div>
    </Layout>
  );
}
