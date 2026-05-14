"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/use-wallet";
import LandingPage from "@/components/LandingPage";

export default function Page() {
  const router = useRouter();
  const { isMiniPay, isFarcaster, isDetecting } = useWallet();

  useEffect(() => {
    if (isDetecting) return; // wait for detection to finish
    // Only redirect to onboarding if inside MiniPay or Farcaster
    if (isMiniPay || isFarcaster) {
      router.replace("/onboarding");
    }
    // Web visitors stay on the landing page — do nothing
  }, [isDetecting, isMiniPay, isFarcaster]);

  // While detecting inside app context, show nothing (avoids flash of landing page)
  if (isDetecting) return null;

  // In-app users get redirected above — this renders for web visitors only
  if (isMiniPay || isFarcaster) return null;

  return <LandingPage />;
}
