import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * InvoicePay Ignition Deployment Module
 *
 * Usage:
 *   npx hardhat ignition deploy ignition/modules/InvoicePay.ts --network alfajores
 *
 * Required env vars in .env:
 *   PRIVATE_KEY=0x...
 *   FEE_RECIPIENT=0x...
 */

// cUSD on Celo Alfajores testnet
const CUSD_ALFAJORES = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1";

// cUSD on Celo Mainnet
// const CUSD_MAINNET = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

const FEE_RECIPIENT = process.env.FEE_RECIPIENT ?? "";

if (!FEE_RECIPIENT) {
  throw new Error("Missing FEE_RECIPIENT in .env");
}

const Decimoon1Module = buildModule("Decimoon1Module", (m) => {
  const stablecoin    = m.getParameter("stablecoin", CUSD_ALFAJORES);
  const feeRecipient  = m.getParameter("feeRecipient", FEE_RECIPIENT);

  const decimoon1 = m.contract("Decimoon1", [stablecoin, feeRecipient]);

  return { decimoon1 };
});

export default Decimoon1Module;