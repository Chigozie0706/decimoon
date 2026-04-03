import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// cUSD on Celo Sepolia testnet
const USDm_SEPOLIA = "0xdE9e4C3ce781b4bA68120d6261cbad65ce0aB00b";

// cUSD on Celo Mainnet
// const CUSD_MAINNET = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

const FEE_RECIPIENT = process.env.FEE_RECIPIENT ?? "";

if (!FEE_RECIPIENT) {
  throw new Error("Missing FEE_RECIPIENT in .env");
}

const DecimoonModule = buildModule("DecimoonModule", (m) => {
  const stablecoin    = m.getParameter("stablecoin", USDm_SEPOLIA);
  const feeRecipient  = m.getParameter("feeRecipient", FEE_RECIPIENT);

  const decimoon = m.contract("Decimoon", [stablecoin, feeRecipient]);

  return { decimoon };
});

export default DecimoonModule;