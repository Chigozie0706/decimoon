"use client";

import { useEffect, useState } from "react";
import { useConnect, useAccount, usePublicClient } from "wagmi";
import { injected } from "wagmi/connectors";
import { formatEther, getContract } from "viem";
import { celo } from "wagmi/chains";
// import { stableTokenABI } from "@celo/abis";
import { erc20Abi } from "viem";

// USDm on Celo mainnet
const USDM_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const;

export function useMiniPay() {
  const [isMiniPay, setIsMiniPay] = useState(false);
  const { connect } = useConnect();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: celo.id });

  useEffect(() => {
    if (typeof window === "undefined") return;

    // @ts-ignore
    if (window.ethereum && (window.ethereum as any).isMiniPay) {
      setIsMiniPay(true);
      // Auto-connect — MiniPay injects the wallet, no user action needed
      connect({ connector: injected({ target: "metaMask" }) });
    }
  }, [connect]);

  async function getUSDmBalance(userAddress: `0x${string}`) {
    if (!publicClient) return "0";

    const contract = getContract({
      abi: erc20Abi,
      address: USDM_ADDRESS,
      client: publicClient,
    });

    const balance = await contract.read.balanceOf([userAddress]);
    return formatEther(balance);
  }

  return {
    isMiniPay,
    address,
    isConnected,
    getUSDmBalance,
  };
}
