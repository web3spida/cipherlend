import type { PublicClient, WalletClient } from 'viem';

export type FinancialFormValues = {
  revenue: string;
  debt: string;
  burnRate: string;
  receivables: string;
  cash: string;
  businessAge: string;
};

export type EncryptedFinancialInputs = {
  revenue: unknown;
  debt: unknown;
  burnRate: unknown;
  receivables: unknown;
  cash: unknown;
  businessAge: unknown;
};

const loadCofheRuntime = async () => {
  const [{ Encryptable }, { createCofheClient, createCofheConfig }, { WagmiAdapter }, { chains }] =
    await Promise.all([
      import('@cofhe/sdk'),
      import('@cofhe/sdk/web'),
      import('@cofhe/sdk/adapters'),
      import('@cofhe/sdk/chains'),
    ]);

  return { Encryptable, createCofheClient, createCofheConfig, WagmiAdapter, chains };
};

const parseWholeNumber = (value: string, field: string) => {
  const normalized = value.replace(/,/g, '').trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${field} must be a whole number`);
  }
  return BigInt(normalized);
};

export const resolveCofheChain = async () => {
  const { chains } = await loadCofheRuntime();
  const supportedChainByName = {
    sepolia: chains.sepolia,
    arbitrumsepolia: chains.arbSepolia,
    arbsepolia: chains.arbSepolia,
    basesepolia: chains.baseSepolia,
    hardhat: chains.hardhat,
    localcofhe: chains.localcofhe,
  };
  const env = import.meta.env.VITE_COFHE_CHAIN_NAME ?? import.meta.env.COFHE_CHAIN_NAME ?? 'hardhat';
  const key = env.toLowerCase().replace(/[\s_-]/g, '') as keyof typeof supportedChainByName;
  return supportedChainByName[key] ?? chains.hardhat;
};

export const createBrowserCofheClient = async (walletClient: WalletClient, publicClient: PublicClient) => {
  const { createCofheClient, createCofheConfig, WagmiAdapter } = await loadCofheRuntime();
  const config = createCofheConfig({
    supportedChains: [await resolveCofheChain()],
  });
  const client = createCofheClient(config);
  const adapted = await WagmiAdapter(walletClient as any, publicClient as any);
  await client.connect(adapted.publicClient as any, adapted.walletClient as any);
  await client.permits.getOrCreateSelfPermit();
  return client;
};

export const encryptFinancialInputs = async (
  values: FinancialFormValues,
  walletClient: WalletClient,
  publicClient: PublicClient,
  onStep?: (step: string) => void
): Promise<EncryptedFinancialInputs> => {
  const { Encryptable } = await loadCofheRuntime();
  const client = await createBrowserCofheClient(walletClient, publicClient);
  const [revenue, debt, burnRate, receivables, cash, businessAge] = await client
    .encryptInputs([
      Encryptable.uint32(parseWholeNumber(values.revenue, 'Annual revenue')),
      Encryptable.uint32(parseWholeNumber(values.debt, 'Total debt')),
      Encryptable.uint32(parseWholeNumber(values.burnRate, 'Monthly burn rate')),
      Encryptable.uint32(parseWholeNumber(values.receivables, 'Accounts receivable')),
      Encryptable.uint32(parseWholeNumber(values.cash, 'Cash on hand')),
      Encryptable.uint32(parseWholeNumber(values.businessAge, 'Business age')),
    ])
    .onStep((step: unknown) => onStep?.(String(step)))
    .execute();

  return { revenue, debt, burnRate, receivables, cash, businessAge };
};
