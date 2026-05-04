import { JsonRpcProvider, Wallet } from "ethers";
import { Encryptable, FheTypes, type DecryptForTxResult } from "@cofhe/sdk";
import { createCofheClient, createCofheConfig } from "@cofhe/sdk/node";
import { Ethers6Adapter } from "@cofhe/sdk/adapters";
import { chains, type CofheChain } from "@cofhe/sdk/chains";
import type { Permit } from "@cofhe/sdk/permits";

const rpcUrl =
  process.env.COFHE_RPC_URL ??
  process.env.SEPOLIA_RPC_URL ??
  process.env.BASE_SEPOLIA_RPC_URL ??
  "http://127.0.0.1:8545";
const provider = new JsonRpcProvider(rpcUrl);
const signer = process.env.PRIVATE_KEY ? new Wallet(process.env.PRIVATE_KEY, provider) : undefined;

let cofheClientPromise: Promise<ReturnType<typeof createCofheClient>> | null = null;

export const getProvider = () => provider;
export const getSigner = () => signer;

const resolveSupportedChain = (): CofheChain => {
  const chainName = (process.env.COFHE_CHAIN_NAME ?? "hardhat").trim().toLowerCase();
  const byName: Record<string, CofheChain> = {
    sepolia: chains.sepolia,
    arbsepolia: chains.arbSepolia,
    arbitrumsepolia: chains.arbSepolia,
    basesepolia: chains.baseSepolia,
    hardhat: chains.hardhat,
    localcofhe: chains.localcofhe,
  };

  const selected = byName[chainName];
  if (!selected) {
    throw new Error(
      `Unsupported COFHE_CHAIN_NAME="${process.env.COFHE_CHAIN_NAME}". ` +
        "Use one of: sepolia, arbSepolia, baseSepolia, hardhat, localcofhe."
    );
  }

  return selected;
};

export const getCofheClient = async () => {
  if (cofheClientPromise) return cofheClientPromise;

  cofheClientPromise = (async () => {
    if (!signer) {
      throw new Error("PRIVATE_KEY must be configured to initialize CoFHE client");
    }

    const config = createCofheConfig({
      supportedChains: [resolveSupportedChain()],
    });
    const client = createCofheClient(config);
    const { publicClient, walletClient } = await Ethers6Adapter(provider, signer);
    await client.connect(publicClient, walletClient);
    return client;
  })();

  return cofheClientPromise;
};

export type FinancialInput = {
  revenue: string | bigint;
  debt: string | bigint;
  burnRate: string | bigint;
  receivables: string | bigint;
  cash: string | bigint;
  businessAge: number;
};

export const encryptFinancialInputs = async (input: FinancialInput) => {
  const client = await getCofheClient();
  const [revenue, debt, burnRate, receivables, cash, businessAge] = await client
    .encryptInputs([
      Encryptable.uint32(BigInt(input.revenue)),
      Encryptable.uint32(BigInt(input.debt)),
      Encryptable.uint32(BigInt(input.burnRate)),
      Encryptable.uint32(BigInt(input.receivables)),
      Encryptable.uint32(BigInt(input.cash)),
      Encryptable.uint32(BigInt(input.businessAge)),
    ])
    .execute();

  return {
    revenue,
    debt,
    burnRate,
    receivables,
    cash,
    businessAge,
  };
};

export const decryptForView = async (
  ctHash: bigint | string,
  type: FheTypes,
  permit?: Permit | string
) => {
  const client = await getCofheClient();
  const builder = client.decryptForView(ctHash, type);
  const withPermitBuilder =
    permit === undefined ? builder.withPermit() : typeof permit === "string" ? builder.withPermit(permit) : builder.withPermit(permit);
  return withPermitBuilder.execute();
};

export const decryptForTxWithPermit = async (ctHash: bigint | string, permit?: Permit | string) => {
  const client = await getCofheClient();
  const builder = client.decryptForTx(ctHash);
  const withPermitBuilder =
    permit === undefined ? builder.withPermit() : typeof permit === "string" ? builder.withPermit(permit) : builder.withPermit(permit);
  return withPermitBuilder.execute();
};

export const decryptForTxWithoutPermit = async (ctHash: bigint | string) => {
  const client = await getCofheClient();
  return client.decryptForTx(ctHash).withoutPermit().execute();
};

export const buildPublishDecryptResultArgs = (result: DecryptForTxResult) => {
  return {
    ctHash: BigInt(result.ctHash),
    decryptedValue: result.decryptedValue,
    signature: result.signature,
  };
};
