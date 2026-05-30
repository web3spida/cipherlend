const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const required = [
  "COFHE_CHAIN_NAME",
  "COFHE_RPC_URL",
  "PRIVATE_KEY",
  "BORROWER_REGISTRY_ADDRESS",
  "UNDERWRITING_ENGINE_ADDRESS",
  "LOAN_VAULT_ADDRESS",
  "PERMIT_REGISTRY_ADDRESS",
  "ALLOWED_ORIGINS",
  "VITE_API_BASE_URL",
  "VITE_WALLETCONNECT_PROJECT_ID",
  "VITE_COFHE_CHAIN_NAME",
  "VITE_BORROWER_REGISTRY_ADDRESS",
  "VITE_UNDERWRITING_ENGINE_ADDRESS",
  "VITE_LOAN_VAULT_ADDRESS",
] as const;

const missing = required.filter((key) => {
  const value = process.env[key];
  return !value || value === ZERO_ADDRESS;
});

if (missing.length > 0) {
  console.error(`Missing production environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const allowedChains = new Set(["sepolia", "arbSepolia", "baseSepolia"]);
if (!allowedChains.has(process.env.COFHE_CHAIN_NAME!)) {
  console.error("COFHE_CHAIN_NAME must be one of: sepolia, arbSepolia, baseSepolia");
  process.exit(1);
}

console.log("Production environment validation passed.");
