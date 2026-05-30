const explorerByChain: Record<string, string> = {
  sepolia: "https://sepolia.etherscan.io",
  arbsepolia: "https://sepolia.arbiscan.io",
  arbitrumsepolia: "https://sepolia.arbiscan.io",
  basesepolia: "https://sepolia.basescan.org",
};

export const getExplorerBaseUrl = () => {
  const chainName = (process.env.COFHE_CHAIN_NAME ?? "").toLowerCase().replace(/[\s_-]/g, "");
  return explorerByChain[chainName] ?? "";
};

export const getExplorerTxUrl = (txHash: string | null | undefined) => {
  const baseUrl = getExplorerBaseUrl();
  if (!baseUrl || !txHash) return null;
  return `${baseUrl}/tx/${txHash}`;
};

export const getExplorerAddressUrl = (address: string | null | undefined) => {
  const baseUrl = getExplorerBaseUrl();
  if (!baseUrl || !address) return null;
  return `${baseUrl}/address/${address}`;
};
