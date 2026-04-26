# Decimoon — On-Chain Invoice & Payments

> **Create invoices. Get paid instantly. On-chain.**

Decimoon is a full-stack Web3 invoicing platform built for **MiniPay** and **Farcaster**, enabling freelancers and businesses to create professional invoices and receive payments in stablecoins on the **Celo blockchain** — with zero reliance on banks or fake payment alerts.

---

## 🚀 Overview

Decimoon replaces traditional invoicing tools with a **programmable, trustless payment system** where:

- Payments are enforced on-chain
- Creators receive funds instantly
- Clients pay in stablecoins (USDm, USDC, USDT, cUSD)
- Invoice logic (fees, milestones, due dates) is automated

It combines a **UUPS-upgradeable smart contract** with a modern **Next.js MiniApp frontend**.

---

## ✨ Core Features

- 🧾 **Standard Invoices** — one-time payments with due dates & late fees
- 🔁 **Recurring Billing** — weekly, biweekly, monthly auto-renewal
- 🪜 **Milestone Payments** — split work into paid phases
- 💸 **ERC-20 Payments** — stablecoin support via whitelist
- 📦 **IPFS Metadata** — invoice details stored off-chain
- ⚖️ **Disputes** — invoices can be paused and resolved
- ⏰ **Late Fees** — automatic daily penalty calculation
- 🔐 **Upgradeable Contract** — UUPS proxy architecture
- 📱 **MiniPay + Farcaster** — seamless in-app wallet experience
- 💰 **Fee Abstraction** — gas paid in USDm (no CELO required)

---

## 🧠 Architecture

**On-chain (Smart Contract):**

- Invoice creation & tracking
- Payment settlement
- Fee & late fee calculations
- Status transitions (Unpaid → Paid → Overdue → Disputed)

**Off-chain (IPFS):**

- Invoice title & description
- Line items / milestones
- Notes & terms
- UI metadata

This hybrid approach reduces gas costs while keeping payments fully verifiable.

---

## 💰 Payment Model

- **Client pays:** invoice + platform fee + late fee
- **Creator receives:** full invoice + late fee
- **Platform earns:** fee on principal only

Late fee formula:

```text
lateFee = amount × lateFeesBps × daysLate / 10,000
```

- Late fees capped at **100% of invoice**
- Paid entirely to the creator
- Platform fee does **not** apply to late fees

---

## 🪜 Invoice Types

### Standard

- One-time payment
- Optional due date
- Optional late fees

### Recurring

- Auto-renews after payment
- Weekly / Biweekly / Monthly

### Milestone

- Payments split into phases
- Each phase released individually
- Fully on-chain tracking

---

## ⚖️ Disputes

- Creator or client can raise disputes
- Invoice is frozen while disputed
- Owner resolves disputes (V1 centralized model)

---

## 🔐 Security & Constraints

- Reentrancy protection (custom guard)
- CEI pattern (Checks → Effects → Interactions)
- Token whitelist enforcement

**Fee limits:**

- Max platform fee: **10%**
- Max late fee: **5% per day**
- Max fee change per update: **2%**

---

## 🔄 Upgradeability

Decimoon uses the **UUPS proxy pattern**, allowing seamless upgrades.

**Upgrade flow:**

1. Deploy new implementation
2. Call:

```
upgradeToAndCall(newImplementation, "")
```

⚠️ Storage layout is append-only — never reorder variables.

---

## 🖥 Frontend Experience

- Dynamic invoice builder (line items & milestones)
- Real-time fee + total preview
- Token selection
- IPFS metadata upload before transaction
- Wallet-aware UX (MiniPay / Farcaster detection)
- Sent & Received invoice tracking

---

## 📡 Smart Contract

**Network:** Celo Mainnet
**Address:** `0x7908AEa0861A5B949B044826a6DDaA3Ed7e88ab0`

### Key Functions

| Function                 | Role      | Description                          |
| ------------------------ | --------- | ------------------------------------ |
| `createInvoice`          | Creator   | Create standard or recurring invoice |
| `createMilestoneInvoice` | Creator   | Create milestone-based invoice       |
| `payInvoice`             | Client    | Pay invoice                          |
| `releaseMilestone`       | Client    | Pay milestone phase                  |
| `cancelInvoice`          | Creator   | Cancel unpaid invoice                |
| `disputeInvoice`         | Any party | Raise dispute                        |
| `resolveDispute`         | Owner     | Resolve dispute                      |

---

## ⚡ Payment Flow

1. Client approves token (e.g. USDm)
2. Client calls `payInvoice`
3. Contract transfers:
   - Creator → full amount (+ late fee)
   - Platform → fee

---

## 💸 Fee Abstraction (Celo Advantage)

Decimoon leverages **Celo’s native fee abstraction**:

- No need to hold CELO

---

## 🪙 Supported Tokens

| Token               | Mainnet         |
| ------------------- | --------------- |
| USDm (Mento Dollar) | `0x765DE816...` |
| cUSD                | Supported       |
| cEUR                | Supported       |
| USDC / USDT         | Supported       |

---

## 🧩 Tech Stack

**Smart Contract**

- Solidity ^0.8.20
- OpenZeppelin Upgradeable Contracts
- ERC-20 (SafeERC20)

**Frontend**

- Next.js (App Router)
- React
- wagmi + viem
- Farcaster MiniApp SDK
- Tailwind CSS
- Framer Motion

---

## ⚙️ Setup

```bash
git clone https://github.com/Chigozie0706/decimoon
cd decimoon/frontend
pnpm install
pnpm dev
```

---

## 📱 Testing in MiniPay

MiniPay doesn’t support localhost directly.

```bash
ngrok http 3000
```

Then:

1. Enable Developer Mode in MiniPay
2. Load your ngrok URL
3. Test the app

---

## 🚀 Deployment

```bash
pnpm build
```

Deploy on Vercel.

---

## 🔮 Roadmap

- Decentralized dispute resolution
- Invoice NFTs
- Cross-chain payments
- Mento stable routing
- Analytics dashboard
- AI invoice assistant

---

## 🧑‍💻 Author

Built by a Web3 builder focused on **real-world crypto payments, stablecoin adoption, and programmable finance**.
