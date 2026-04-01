"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Layout } from "./Layout";
import { ChevronRight, Wallet } from "lucide-react";
import { motion } from "motion/react";

export default function Onboarding() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: "Create invoices in seconds",
      description:
        "Professional invoices for your business, no paperwork needed",
    },
    {
      title: "Share via link or QR",
      description: "Send to clients on WhatsApp, X, or scan in person",
    },
    {
      title: "Get paid in cUSD. No fake alerts.",
      description:
        "Every payment is recorded on-chain — 100% verifiable and tamper-proof",
    },
  ];

  const handleGetStarted = () => {
    localStorage.setItem("onboardingSeen", "true");
    router.push("/home");
  };

  return (
    <Layout showNav={false}>
      <div className="min-h-screen flex flex-col bg-[#1B4332] text-white">
        {/* Logo Section */}
        <div className="pt-16 pb-8 px-6 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5 }}
            className="w-20 h-20 bg-[#F4C430] rounded-2xl mx-auto mb-4 flex items-center justify-center"
          >
            <Wallet className="w-10 h-10 text-[#1B4332]" />
          </motion.div>
          <h1 className="text-3xl mb-2" style={{ fontWeight: 700 }}>
            InvoicePay
          </h1>
          <p className="text-[#F4C430] text-sm">
            Create invoices. Get paid instantly. On-chain.
          </p>
        </div>

        {/* Slides Section */}
        <div className="flex-1 px-6 py-8">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center"
          >
            <h2 className="text-2xl mb-4" style={{ fontWeight: 700 }}>
              {slides[currentSlide].title}
            </h2>
            <p className="text-white/80 text-base">
              {slides[currentSlide].description}
            </p>
          </motion.div>

          {/* Slide Indicators */}
          <div className="flex justify-center gap-2 mt-12">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentSlide
                    ? "w-8 bg-[#F4C430]"
                    : "w-2 bg-white/30"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Bottom Section */}
        <div className="p-6 pb-8">
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
              className="w-full bg-[#F4C430] text-[#1B4332] py-4 rounded-xl flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
              style={{ fontWeight: 600 }}
            >
              Get Started
            </button>
          )}
        </div>
      </div>
    </Layout>
  );
}
