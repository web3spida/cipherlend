require("@nomicfoundation/hardhat-toolbox");
require("fhenix-hardhat-plugin");
require("fhenix-hardhat-network");
require("dotenv").config();

/** @type {import("hardhat/config").HardhatUserConfig} */
module.exports = {
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
  mocha: {
    require: ["ts-node/register/transpile-only"],
    extension: ["ts"],
    timeout: 300000,
  },
};
