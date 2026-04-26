"use client";

import { useEffect } from "react";
import Provider from "@/providers/WagmiProviders";
import { Toaster } from "sonner";
import { initFarcaster } from "@/lib/farcaster";

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    initFarcaster();
  }, []);

  return (
    <Provider>
      {children}
      <Toaster position="top-center" richColors closeButton />
    </Provider>
  );
}
