"use client";

import { useEffect, useState } from "react";
import { useConnect, useConnection, usePublicClient } from "wagmi";
import { injected } from "wagmi/connectors";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { formatEther, getContract } from "viem";
import { celo, celoSepolia } from "wagmi/chains";
import { erc20Abi } from "viem";
import { sdk } from "@farcaster/miniapp-sdk";

const IS_TESTNET = false;
const USDM_SEPOLIA = "0xdE9e4C3ce781b4bA68120d6261cbad65ce0aB00b" as const;
const USDM_MAINNET = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const;
const USDM_ADDRESS = IS_TESTNET ? USDM_SEPOLIA : USDM_MAINNET;
const CHAIN_ID = IS_TESTNET ? celoSepolia.id : celo.id;

export function useWallet() {
  const [isMiniPay, setIsMiniPay] = useState(false);
  const [isFarcaster, setIsFarcaster] = useState(false);
  const [isDetecting, setIsDetecting] = useState(true);
  const { mutate: connect } = useConnect();
  const { address, isConnected, connector, chain, status } = useConnection();
  const publicClient = usePublicClient({ chainId: CHAIN_ID });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const eth = (window as any).ethereum;

    // 1. MiniPay — check first (sync, most reliable signal)
    if (eth?.isMiniPay) {
      setIsMiniPay(true);
      setIsDetecting(false);
      connect({ connector: injected({ target: "metaMask" }) });
      return; // stop here, no need to check Farcaster
    }

    // 2. Farcaster — async, wait for it before showing anything
    async function initFarcaster() {
      try {
        const context = await sdk.context;

        if (context?.user) {
          setIsFarcaster(true);
          // Connect with the Farcaster connector, NOT injected
          connect({ connector: farcasterMiniApp() });
          sdk.actions.ready();
        } else {
          // confirmed NOT Farcaster — safe to show web wall
          if (eth) {
            connect({ connector: injected() });
          }
        }
      } catch {
        // SDK threw — not in Farcaster context
        if (eth) {
          connect({ connector: injected() });
        }
      } finally {
        setIsDetecting(false);
      }
    }

    initFarcaster();
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
    isDetecting,
    address,
    isConnected,
    connector,
    chain,
    status,
    getUSDmBalance,
  };
}
