"use client";

import { useEffect } from "react";
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
    <>
      {children}
      <Toaster position="top-center" richColors closeButton />
    </>
  );
}
