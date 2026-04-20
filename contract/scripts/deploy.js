const { ethers, upgrades, network } = require("hardhat");

// ── Token addresses per network ───────────────────────────────────────────────
const TOKENS = {
  celo: [
    "0x765DE816845861e75A25fCA122bb6898B8B1282a", // cUSD
    "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", // cEUR
    "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", // USDT
    "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", // USDC
  ],
  celoSepolia: [
    "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1", // cUSD testnet
  ],
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = network.name;

  console.log("─────────────────────────────────────────");
  console.log("  Deploying Decimoon");
  console.log("─────────────────────────────────────────");
  console.log("Network  :", networkName);
  console.log("Deployer :", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance  :", ethers.formatEther(balance), "CELO");
  console.log("─────────────────────────────────────────");

  if (balance === 0n) {
    throw new Error(
      "Deployer has no balance. Fund your wallet before deploying.\n" +
      "Testnet faucet: https://faucet.celo.org/celo-sepolia"
    );
  }

  // ── Config ──────────────────────────────────────────────────────────────────
  // Change feeRecipient to your treasury wallet before mainnet deploy
  const initialOwner  = deployer.address;
  const feeRecipient  = deployer.address;
  const initialTokens = TOKENS[networkName];

  if (!initialTokens) {
    throw new Error(`No token config for network: ${networkName}`);
  }

  console.log("Initial owner  :", initialOwner);
  console.log("Fee recipient  :", feeRecipient);
  console.log("Tokens         :", initialTokens.length, "whitelisted");
  console.log("─────────────────────────────────────────");
  console.log("Deploying...");

  const Decimoon = await ethers.getContractFactory("Decimoon");

  // Deploys:
  //   1. Decimoon implementation contract
  //   2. ERC1967Proxy
  //   3. Calls initialize(initialOwner, feeRecipient, initialTokens) via proxy
  const proxy = await upgrades.deployProxy(
    Decimoon,
    [initialOwner, feeRecipient, initialTokens],
    {
      initializer: "initialize",
      kind: "uups",
    }
  );

  await proxy.waitForDeployment();

  const proxyAddress = await proxy.getAddress();
  const implAddress  = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("\n Deployed successfully!");
  console.log("─────────────────────────────────────────");
  console.log("Proxy address (use in frontend)  :", proxyAddress);
  console.log("Implementation (verify only)     :", implAddress);
  console.log("─────────────────────────────────────────");
  console.log("\n Next steps:");
  console.log("1. Save your proxy address — it never changes across upgrades");
  console.log("2. Add to your frontend .env.local:");
  console.log(`   NEXT_PUBLIC_CONTRACT_ADDRESS=${proxyAddress}`);
  console.log("\n3. Verify implementation on Celoscan:");
  console.log(`   pnpm hardhat verify --network ${networkName} ${implAddress}`);

  if (networkName === "celoSepolia") {
    console.log("\n  You deployed to TESTNET.");
    console.log("   When ready for mainnet run:");
    console.log("   pnpm hardhat run scripts/deploy.js --network celo");
  }

  // Save addresses to file for reference
  const fs = require("fs");
  const deployData = {
    network: networkName,
    proxyAddress,
    implAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    `deployments-${networkName}.json`,
    JSON.stringify(deployData, null, 2)
  );
  console.log(`\n Addresses saved to deployments-${networkName}.json`);
}

main().catch((error) => {
  console.error("\n Deployment failed:", error.message);
  process.exit(1);
});