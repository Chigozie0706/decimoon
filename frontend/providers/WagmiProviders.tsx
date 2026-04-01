"use client";

import { createConfig, http, WagmiProvider } from "wagmi";
import { celo, celoSepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import React from "react";

export const config = createConfig({
  chains: [celoSepolia],
  transports: {
    [celoSepolia.id]: http(),
  },
  connectors: [farcasterMiniApp()],
});

const queryClient = new QueryClient();

export default function Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
