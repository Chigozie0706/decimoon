# Decimoon — On-Chain Invoice & Payments

> Create invoices. Get paid instantly. On-chain.

Decimoon is a MiniApp for **MiniPay** and **Farcaster** that lets freelancers and small businesses create professional invoices and get paid in USDm on the Celo blockchain — no fake alerts, no banks, 100% verifiable.

---

## Features

- **Create invoices** with title, description, client wallet, amount, and due date
- **Recurring billing** — weekly, biweekly, or monthly
- **On-chain payments** in USDm (Mento Dollar)
- **Fee abstraction** — gas paid in USDm, no CELO needed
- **Role-aware UI** — creators share & cancel, clients pay
- **Live balance** — real-time USDm balance from chain
- **Sent & Received tabs** — track invoices you sent and invoices you owe
- **MiniPay + Farcaster** — works in both environments with auto wallet connection

---

## Tech Stack

| Layer          | Tech                                   |
| -------------- | -------------------------------------- |
| Framework      | Next.js 16 (App Router)                |
| Blockchain     | Celo / Celo Sepolia                    |
| Smart Contract | Solidity (Decimoon.sol)                |
| Wallet         | MiniPay (injected) + Farcaster MiniApp |
| Web3           | wagmi v3 + viem v2                     |
| Styling        | Tailwind CSS v4                        |
| UI             | Radix UI + shadcn/ui                   |
| Animations     | Framer Motion                          |

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- MiniPay app (Android/iOS) for testing on device
- [ngrok](https://ngrok.com) for local device testing

### Install

```bash
git clone https://github.com/yourusername/decimoon
cd decimoon/frontend
pnpm install
```

### Environment

Create a `.env.local` file:

```env
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id
```

### Run locally

```bash
pnpm dev
```

### Test in MiniPay

MiniPay cannot access `localhost` directly. Use ngrok to expose your local server:

```bash
ngrok http 3000
```

Then in MiniPay:

1. Open Settings → About → tap Version repeatedly to enable Developer Mode
2. Go to Developer Settings → Load Test Page
3. Paste your ngrok URL and tap Go

---

## Smart Contract

**Network:** Celo Mainnet (production)

**Contract:** `Decimoon.sol`

**Deployed address (Mainnet):** `0x0f42F76C461f2F403bd797Ca8a023686dc8B4753`

### Key functions

| Function             | Who calls it | Description                                     |
| -------------------- | ------------ | ----------------------------------------------- |
| `createInvoice`      | Creator      | Creates a new invoice on-chain                  |
| `payInvoice`         | Client       | Pays an invoice (requires USDm approval first)  |
| `cancelInvoice`      | Creator      | Cancels an unpaid invoice                       |
| `getInvoice`         | Anyone       | Fetches invoice details by ID                   |
| `getCreatorInvoices` | Creator      | Returns all invoice IDs created by address      |
| `getClientInvoices`  | Client       | Returns all invoice IDs where address is client |

### Payment flow

Client approves USDm spend → Client calls payInvoice
↓ ↓
Contract pulls USDm Creator receives 98%
from client wallet Fee recipient gets 2%

---

## Fee Abstraction

Decimoon uses Celo's native fee abstraction — users never need to hold CELO to pay gas. All transactions specify `feeCurrency: USDM_TOKEN` which routes gas fees through the USDm contract.

USDm has 18 decimals so it can be used directly as `feeCurrency` without an adapter (unlike USDC/USDT which require adapter addresses).

---

## Supported Tokens

| Token               | Mainnet         | Sepolia         |
| ------------------- | --------------- | --------------- |
| USDm (Mento Dollar) | `0x765DE816...` | `0x874069Fa...` |

---

## Deployment

```bash
pnpm build
```

Deploy to Vercel. Make sure all pages that use browser APIs have `export const dynamic = "force-dynamic"` to prevent prerender errors.

---

## License

MIT
