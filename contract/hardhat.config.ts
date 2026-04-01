import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";
import "dotenv/config";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
    celo: {
      type: "http",
      chainType: "l1",
      url: "https://forno.celo.org",
      accounts: [configVariable("PRIVATE_KEY")],
      chainId: 42220,
    },
    alfajores: {
      type: "http",
      chainType: "l1",
      url: "https://alfajores-forno.celo-testnet.org",
      accounts: [configVariable("PRIVATE_KEY")],
      chainId: 44787,
    },
    celoSepolia: {
      type: "http",
      chainType: "l1",
      url: "https://forno.celo-sepolia.celo-testnet.org",
      accounts: [process.env.PRIVATE_KEY!],
      chainId: 11142220,
    },
  },
});
