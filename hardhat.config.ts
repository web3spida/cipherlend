import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "fhenix-hardhat-plugin";
import "fhenix-hardhat-network";
import * as dotenv from "dotenv";

dotenv.config();

const config: any = {
  solidity: {
    version: "0.8.24",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      fhenix: {
        enabled: true,
      },
    },
    fhenixHelium: {
      url: process.env.FHENIX_RPC_URL || "https://api.helium.fhenix.zone",
      chainId: 8008135,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    baseSepolia: {
      url:
        process.env.BASE_SEPOLIA_RPC_URL ||
        process.env.BASE_SEPOLIA_FLASHBLOCKS_RPC_URL ||
        "https://sepolia.base.org",
      chainId: 84532,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      baseSepolia: process.env.BASESCAN_API_KEY || "",
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

export default config;
