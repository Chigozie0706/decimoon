const { ethers, upgrades, network } = require("hardhat");
const fs = require("fs");

// ── Config ────────────────────────────────────────────────────────────────────
// Set these before running upgrade
const NEW_CONTRACT_NAME = "DecimoonV2"; // change per upgrade

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = network.name;

  // Load proxy address from deployment file
  const deployFile = `deployments-${networkName}.json`;
  if (!fs.existsSync(deployFile)) {
    throw new Error(
      `No deployment file found for ${networkName}.\n` +
        `Run deploy.js first: pnpm hardhat run scripts/deploy.js --network ${networkName}`,
    );
  }

  const { proxyAddress } = JSON.parse(fs.readFileSync(deployFile, "utf8"));

  console.log("─────────────────────────────────────────");
  console.log("  Upgrading to", NEW_CONTRACT_NAME);
  console.log("─────────────────────────────────────────");
  console.log("Network  :", networkName);
  console.log("Deployer :", deployer.address);
  console.log("Proxy    :", proxyAddress);
  console.log("─────────────────────────────────────────");
  console.log("Validating storage layout...");

  const NewImpl = await ethers.getContractFactory(NEW_CONTRACT_NAME);

  // Validates storage layout before upgrading —
  // throws if you accidentally broke the layout
  const upgraded = await upgrades.upgradeProxy(proxyAddress, NewImpl, {
    kind: "uups",
  });

  await upgraded.waitForDeployment();

  const newImplAddress = await upgrades.erc1967.getImplementationAddress(
    proxyAddress,
  );

  console.log("\n Upgrade successful!");
  console.log("─────────────────────────────────────────");
  console.log("Proxy address (unchanged) :", proxyAddress);
  console.log("New implementation        :", newImplAddress);
  console.log("─────────────────────────────────────────");

  // Update deployment file
  const deployData = JSON.parse(fs.readFileSync(deployFile, "utf8"));
  deployData.implAddress = newImplAddress;
  deployData.upgradedAt = new Date().toISOString();
  deployData.upgradedTo = NEW_CONTRACT_NAME;
  fs.writeFileSync(deployFile, JSON.stringify(deployData, null, 2));

  console.log("\n Next steps:");
  console.log("Verify new implementation:");
  console.log(
    `   pnpm hardhat verify --network ${networkName} ${newImplAddress}`,
  );
}

main().catch((error) => {
  console.error("\n Upgrade failed:", error.message);
  process.exit(1);
});
