import { ReineiraSDK, getAddresses } from "@reineira-os/sdk";

const isEnabled = () => process.env.REINEIRA_ENABLED === "true";

export const getReineiraConfigStatus = () => {
  const enabled = isEnabled();
  const missing = [];
  if (enabled && !process.env.REINEIRA_RPC_URL && !process.env.ARBITRUM_SEPOLIA_RPC_URL) {
    missing.push("REINEIRA_RPC_URL or ARBITRUM_SEPOLIA_RPC_URL");
  }
  if (enabled && !process.env.REINEIRA_PRIVATE_KEY && !process.env.PRIVATE_KEY) {
    missing.push("REINEIRA_PRIVATE_KEY or PRIVATE_KEY");
  }

  return {
    enabled,
    network: "testnet",
    coordinatorConfigured: Boolean(process.env.REINEIRA_COORDINATOR_URL),
    missing,
    addresses: getAddresses("testnet"),
  };
};

export const getReineiraSdk = () => {
  const status = getReineiraConfigStatus();
  if (!status.enabled) {
    throw new Error("Reineira integration is disabled. Set REINEIRA_ENABLED=true to use it.");
  }
  if (status.missing.length > 0) {
    throw new Error(`Missing Reineira configuration: ${status.missing.join(", ")}`);
  }

  return ReineiraSDK.create({
    network: "testnet",
    rpcUrl: process.env.REINEIRA_RPC_URL ?? process.env.ARBITRUM_SEPOLIA_RPC_URL!,
    privateKey: process.env.REINEIRA_PRIVATE_KEY ?? process.env.PRIVATE_KEY!,
    coordinatorUrl: process.env.REINEIRA_COORDINATOR_URL || undefined,
  });
};
