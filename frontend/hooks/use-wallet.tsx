"use client";

import { useEffect, useState } from "react";
import { useConnect, useConnection, usePublicClient } from "wagmi";
import { injected } from "wagmi/connectors";
import { formatEther, getContract } from "viem";
import { celo } from "wagmi/chains";
import { erc20Abi } from "viem";
import { sdk } from "@farcaster/miniapp-sdk";

const USDM_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const;

export function useWallet() {
  const [isMiniPay, setIsMiniPay] = useState(false);
  const [isFarcaster, setIsFarcaster] = useState(false);
  const { connect } = useConnect();
  const { address, isConnected, connector, chain, status } = useConnection();
  const publicClient = usePublicClient({ chainId: celo.id });

  useEffect(() => {
    if (typeof window === "undefined") return;

    // @ts-ignore
    if (window.ethereum && (window.ethereum as any).isMiniPay) {
      setIsMiniPay(true);
      connect({ connector: injected({ target: "metaMask" }) });
    } else {
      setIsFarcaster(true);
      sdk.actions.ready(); // hide Farcaster splash screen
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
    isFarcaster,
    address,
    isConnected,
    connector,
    chain,
    status,
    getUSDmBalance,
  };
}
