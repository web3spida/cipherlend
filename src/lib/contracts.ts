import type { Address } from 'viem';

export const borrowerRegistryAbi = [
  {
    type: 'function',
    name: 'submitProfile',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'revenue', type: 'tuple', components: encryptedUint32Components() },
      { name: 'debt', type: 'tuple', components: encryptedUint32Components() },
      { name: 'burnRate', type: 'tuple', components: encryptedUint32Components() },
      { name: 'receivables', type: 'tuple', components: encryptedUint32Components() },
      { name: 'cash', type: 'tuple', components: encryptedUint32Components() },
      { name: 'businessAge', type: 'tuple', components: encryptedUint32Components() },
      { name: 'sector', type: 'uint8' },
    ],
    outputs: [],
  },
] as const;

export const loanVaultAbi = [
  {
    type: 'function',
    name: 'fundLoan',
    stateMutability: 'payable',
    inputs: [{ name: 'loanId', type: 'uint256' }],
    outputs: [],
  },
] as const;

const zeroAddress = '0x0000000000000000000000000000000000000000' as const;

export const contractAddresses = {
  borrowerRegistry: (import.meta.env.VITE_BORROWER_REGISTRY_ADDRESS || zeroAddress) as Address,
  underwritingEngine: (import.meta.env.VITE_UNDERWRITING_ENGINE_ADDRESS || zeroAddress) as Address,
  loanVault: (import.meta.env.VITE_LOAN_VAULT_ADDRESS || zeroAddress) as Address,
};

function encryptedUint32Components() {
  return [
    { name: 'ctHash', type: 'uint256' },
    { name: 'securityZone', type: 'uint8' },
    { name: 'utype', type: 'uint8' },
    { name: 'signature', type: 'bytes' },
  ] as const;
}
