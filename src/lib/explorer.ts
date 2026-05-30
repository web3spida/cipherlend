const explorerByChain: Record<string, string> = {
  sepolia: 'https://sepolia.etherscan.io',
  arbsepolia: 'https://sepolia.arbiscan.io',
  arbitrumsepolia: 'https://sepolia.arbiscan.io',
  basesepolia: 'https://sepolia.basescan.org',
};

export const getExplorerBaseUrl = () => {
  const chainName = (import.meta.env.VITE_COFHE_CHAIN_NAME ?? '')
    .toLowerCase()
    .replace(/[\s_-]/g, '');
  return explorerByChain[chainName] ?? '';
};

export const getExplorerTxUrl = (txHash?: string | null) => {
  const baseUrl = getExplorerBaseUrl();
  return baseUrl && txHash ? `${baseUrl}/tx/${txHash}` : null;
};

export const getExplorerAddressUrl = (address?: string | null) => {
  const baseUrl = getExplorerBaseUrl();
  return baseUrl && address ? `${baseUrl}/address/${address}` : null;
};
