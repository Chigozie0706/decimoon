"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Layout } from "./Layout";
import { ArrowLeft, Plus, Trash2, Calendar, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useWaitForTransactionReceipt, useConnectorClient } from "wagmi";
import { walletActions, parseUnits, encodeFunctionData } from "viem";
import { celo } from "wagmi/chains";
import { useWallet } from "@/hooks/use-wallet";
import contractAbi from "../contract/abi.json";
import { prepareAndUploadMetadata } from "@/lib/decimoon-ipfs";

// Contract config
const CONTRACT_ADDRESS =
  "0x0f42F76C461f2F403bd797Ca8a023686dc8B4753" as `0x${string}`;
const CHAIN = celo;
