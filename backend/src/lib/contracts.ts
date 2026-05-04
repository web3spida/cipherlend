import { Contract } from "ethers";
import { getProvider, getSigner } from "./fhenix";

const borrowerRegistryAbi = [
  "function submitProfile((uint256,uint8,uint8,bytes),(uint256,uint8,uint8,bytes),(uint256,uint8,uint8,bytes),(uint256,uint8,uint8,bytes),(uint256,uint8,uint8,bytes),(uint256,uint8,uint8,bytes),uint8)",
  "function getProfileMetadata(address) view returns (uint8,uint256,uint256,bool)",
  "function getProfileHandles(address) view returns (uint256,uint256,uint256,uint256,uint256,uint256,bool)",
  "function authorizeProfileAccess(address)",
];

const underwritingAbi = [
  "function runUnderwriting(address) returns (bytes32)",
  "function getScoreHandles(address) view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,bytes32,bytes32,bool)",
  "function getScoreMetadata(address) view returns (uint256,bytes32,bytes32,bool)",
  "function verifyDecryptedTerms(address,(uint8,uint32,uint32,uint32,bytes,bytes,bytes,bytes)) view returns (uint256,bytes32,bytes32,bool)",
  "function authorizeScoreAccess(address,address)",
];

const loanVaultAbi = [
  "function getPendingLoans() view returns ((uint256 loanId,address borrower,uint256 principal,uint256 interestRateBps,uint256 ltvBps,uint8 riskBand,uint256 termMonths,bytes32 underwritingScoreId)[])",
  "function requestLoan(uint256,uint256,(uint8,uint32,uint32,uint32,bytes,bytes,bytes,bytes))",
  "function fundLoan(uint256) payable",
  "function makePayment(uint256) payable",
  "function loans(uint256) view returns (address,address,uint256,uint256,uint256,uint8,uint256,uint256,uint256,uint256,uint8,bytes32)",
  "function getLoanDetails(uint256) view returns (tuple(address borrower,address lender,uint256 principal,uint256 interestRateBps,uint256 ltvBps,uint8 riskBand,uint256 issuedAt,uint256 termMonths,uint256 nextPaymentDue,uint256 remainingBalance,uint8 status,bytes32 underwritingScoreId))",
];

const permitRegistryAbi = [
  "function grantPermit(address,uint8,uint256) returns (bytes32)",
  "function verifyPermit(bytes32,address,uint8) view returns (bool)",
  "function getPermitsForAddress(address) view returns ((bytes32 permitId,address grantor,address grantee,uint8 ptype,uint256 expiresAt,bool revoked,bool valid)[])",
];

const requireAddress = (value: string | undefined, name: string) => {
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
};

const withSigner = () => {
  const signer = getSigner();
  if (!signer) {
    throw new Error("PRIVATE_KEY must be configured");
  }
  return signer;
};

export const getBorrowerRegistry = () =>
  new Contract(
    requireAddress(process.env.BORROWER_REGISTRY_ADDRESS, "BORROWER_REGISTRY_ADDRESS"),
    borrowerRegistryAbi,
    withSigner()
  );

export const getUnderwritingEngine = () =>
  new Contract(
    requireAddress(process.env.UNDERWRITING_ENGINE_ADDRESS, "UNDERWRITING_ENGINE_ADDRESS"),
    underwritingAbi,
    withSigner()
  );

export const getLoanVault = () =>
  new Contract(
    requireAddress(process.env.LOAN_VAULT_ADDRESS, "LOAN_VAULT_ADDRESS"),
    loanVaultAbi,
    withSigner()
  );

export const getPermitRegistry = () =>
  new Contract(
    requireAddress(process.env.PERMIT_REGISTRY_ADDRESS, "PERMIT_REGISTRY_ADDRESS"),
    permitRegistryAbi,
    withSigner()
  );

export const getReadOnlyLoanVault = () =>
  new Contract(
    requireAddress(process.env.LOAN_VAULT_ADDRESS, "LOAN_VAULT_ADDRESS"),
    loanVaultAbi,
    getProvider()
  );
