import { OdisUtils } from "@celo/identity";
import { OdisContextName } from "@celo/identity/lib/odis/query";
import { createWalletClient, createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { NextResponse } from "next/server";
import type { AuthSigner } from "@celo/identity/lib/odis/query";

const FEDERATED_ATTESTATIONS_ADDRESS =
  "0x0aD5b1d0C25ecF6266Dd951403723B2687d6d41" as const;

const FA_ABI = [
  {
    name: "lookupAttestations",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "identifier", type: "bytes32" },
      { name: "trustedIssuers", type: "address[]" },
    ],
    outputs: [
      { name: "countsPerIssuer", type: "uint256[]" },
      { name: "accounts", type: "address[]" },
      { name: "signers", type: "address[]" },
      { name: "issuedOns", type: "uint64[]" },
      { name: "publishedOns", type: "uint64[]" },
    ],
  },
] as const;

export async function POST(req: Request) {
  const { input } = await req.json();

  if (!input || typeof input !== "string") {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const trimmed = input.trim();

  // ── Farcaster username (@handle) ────────────────────────────
  if (trimmed.startsWith("@")) {
    const username = trimmed.slice(1);
    try {
      const res = await fetch(
        `https://api.neynar.com/v2/farcaster/user/search?q=${encodeURIComponent(username)}&limit=1`,
        {
          headers: {
            accept: "application/json",
            api_key: process.env.NEYNAR_API_KEY!,
          },
        },
      );

      if (!res.ok) {
        return NextResponse.json(
          { error: "Neynar API error" },
          { status: 502 },
        );
      }

      const data = await res.json();
      const address =
        data?.result?.users?.[0]?.verified_addresses?.eth_addresses?.[0];

      if (!address) {
        return NextResponse.json(
          { error: "Farcaster user not found or has no verified address" },
          { status: 404 },
        );
      }

      return NextResponse.json({ address });
    } catch (err) {
      console.error("Farcaster lookup error:", err);
      return NextResponse.json(
        { error: "Failed to resolve Farcaster username" },
        { status: 500 },
      );
    }
  }

  // ── Phone number ─────────────────────────────────────────────
  const isPhone = /^\+?[\d\s\-()]{7,15}$/.test(trimmed);
  if (isPhone) {
    try {
      const privateKey = process.env.ISSUER_PRIVATE_KEY as `0x${string}`;

      if (!privateKey) {
        return NextResponse.json(
          { error: "Server misconfiguration: missing issuer key" },
          { status: 500 },
        );
      }

      const account = privateKeyToAccount(privateKey);
      const issuerAddress = account.address;

      const authSigner = {
        authenticationMethod:
          OdisUtils.Query.AuthenticationMethod.ENCRYPTION_KEY,
        rawKey: privateKey,
      } as unknown as AuthSigner;

      const serviceContext = OdisUtils.Query.getServiceContext(
        OdisContextName.MAINNET,
      );

      const { obfuscatedIdentifier } =
        await OdisUtils.Identifier.getObfuscatedIdentifier(
          trimmed,
          OdisUtils.Identifier.IdentifierPrefix.PHONE_NUMBER,
          issuerAddress,
          authSigner,
          serviceContext,
        );

      const publicClient = createPublicClient({
        chain: celo,
        transport: http(),
      });

      const result = await publicClient.readContract({
        address: FEDERATED_ATTESTATIONS_ADDRESS,
        abi: FA_ABI,
        functionName: "lookupAttestations",
        args: [obfuscatedIdentifier as `0x${string}`, [issuerAddress]],
      });

      // result is a tuple — accounts is index 1
      const accounts = (result as any)[1] as string[];
      const address = accounts?.[0];

      if (!address) {
        return NextResponse.json(
          { error: "No MiniPay wallet found for this phone number" },
          { status: 404 },
        );
      }

      return NextResponse.json({ address });
    } catch (err: any) {
      console.error("Phone lookup error:", err);
      return NextResponse.json(
        { error: err?.message ?? "Failed to resolve phone number" },
        { status: 500 },
      );
    }
  }

  // ── Raw 0x address — shouldn't reach here but handle gracefully ──
  if (trimmed.startsWith("0x") && trimmed.length === 42) {
    return NextResponse.json({ address: trimmed });
  }

  return NextResponse.json(
    { error: "Input must be a @username, phone number, or 0x address" },
    { status: 400 },
  );
}
