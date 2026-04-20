import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";
import "dotenv/config";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
        settings: {
        viaIR: true,
      },
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,

        },
      },
    },
  },
  networks: {
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