const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const REQUIRED_PRODUCTION_ENV = [
  "COFHE_CHAIN_NAME",
  "COFHE_RPC_URL",
  "PRIVATE_KEY",
  "BORROWER_REGISTRY_ADDRESS",
  "UNDERWRITING_ENGINE_ADDRESS",
  "LOAN_VAULT_ADDRESS",
  "PERMIT_REGISTRY_ADDRESS",
  "ALLOWED_ORIGINS",
] as const;

export const isProduction = () => process.env.NODE_ENV === "production";

export const parseCsvEnv = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const getMissingProductionEnv = () =>
  REQUIRED_PRODUCTION_ENV.filter((key) => {
    const value = process.env[key];
    return !value || value === ZERO_ADDRESS;
  });

export const assertProductionEnv = () => {
  if (!isProduction()) return;

  const missing = getMissingProductionEnv();
  if (missing.length > 0) {
    throw new Error(`Missing production environment variables: ${missing.join(", ")}`);
  }
};

export const getAllowedOrigins = () => {
  const configured = parseCsvEnv(process.env.ALLOWED_ORIGINS);
  if (configured.length > 0) return configured;

  return ["http://localhost:3000", "http://127.0.0.1:3000"];
};

export const requestTimeout = async <T>(operation: Promise<T>, timeoutMs: number, label: string) => {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};
