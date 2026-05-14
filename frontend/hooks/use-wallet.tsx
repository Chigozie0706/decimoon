"use client";

import { useEffect, useState } from "react";
import { useConnect, useConnection, usePublicClient } from "wagmi";
import { injected } from "wagmi/connectors";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { formatUnits, getContract } from "viem";
import { celo, celoSepolia } from "wagmi/chains";
import { erc20Abi } from "viem";
import { sdk } from "@farcaster/miniapp-sdk";

const IS_TESTNET = false;

// USDT on Celo Mainnet
const USDT_MAINNET = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" as const;

// Optional testnet fallback (replace with actual if needed)
const USDT_SEPOLIA = "0xdE9e4C3ce781b4bA68120d6261cbad65ce0aB00b" as const;

const USDT_ADDRESS = IS_TESTNET ? USDT_SEPOLIA : USDT_MAINNET;
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

    // MiniPay detection
    if (eth?.isMiniPay) {
      setIsMiniPay(true);
      setIsDetecting(false);
      connect({ connector: injected({ target: "metaMask" }) });
      return;
    }

    // Farcaster detection
    async function initFarcaster() {
      try {
        const context = await sdk.context;

        if (context?.user) {
          setIsFarcaster(true);
          connect({ connector: farcasterMiniApp() });
          sdk.actions.ready();
        }
      } catch {
        if (eth) {
          connect({ connector: injected() });
        }
      } finally {
        setIsDetecting(false);
      }
    }

    initFarcaster();
  }, [connect]);

  // Fetch USDT Balance
  async function getUSDTBalance(userAddress: `0x${string}`) {
    if (!publicClient) return "0";

    const contract = getContract({
      abi: erc20Abi,
      address: USDT_ADDRESS,
      client: publicClient,
    });

    // Get token decimals dynamically
    const [balance, decimals] = await Promise.all([
      contract.read.balanceOf([userAddress]),
      contract.read.decimals(),
    ]);

    return formatUnits(balance, decimals);
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
    getUSDTBalance,
  };
}
