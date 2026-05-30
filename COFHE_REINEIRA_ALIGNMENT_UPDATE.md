# CoFHE and Reineira Alignment Update

Date: 2026-05-04

Updated: 2026-05-30

## Completed

- Upgraded the CoFHE dependency set to `@cofhe/sdk@0.5.2`, `@cofhe/react@0.5.2`, `@fhenixprotocol/cofhe-contracts@0.1.3`, and `@cofhe/hardhat-plugin@0.5.2`.
- Removed the older Fhenix packages: `@fhenixprotocol/contracts`, `fhenix-hardhat-plugin`, and `fhenix-hardhat-network`.
- Updated Hardhat configuration to use the current CoFHE plugin and supported networks: Sepolia, Arbitrum Sepolia, Base Sepolia, and local mock CoFHE.
- Replaced Solidity imports with `@fhenixprotocol/cofhe-contracts/FHE.sol`.
- Changed borrower profile submission to accept `InEuint32` encrypted input structs and convert them with `FHE.asEuint32(input)`.
- Added explicit encrypted-state allowances with `FHE.allowThis`, `FHE.allow`, and transient cross-contract access for registry-to-underwriting reads.
- Removed direct on-chain `FHE.decrypt(...)` reveal paths from underwriting and vault flows.
- Replaced direct plaintext reads with ciphertext handle exposure, borrower/contract authorization functions, and `FHE.verifyDecryptResultSafe` proof verification for loan terms.
- Reworked `LoanVault.requestLoan` to accept verified decrypted underwriting terms instead of calling a direct score reveal path.
- Kept `PermitRegistry` as an application/business grant registry and separated it from CoFHE SDK permit responsibilities.
- Added browser-side CoFHE encryption through `@cofhe/sdk/web`, `@cofhe/sdk/adapters`, wagmi wallet clients, and SDK permit creation.
- Replaced borrower simulated encryption/submission timers with SDK encryption progress, wallet-owned transaction submission, backend underwriting execution, retryable errors, and transaction state.
- Replaced lender marketplace and portfolio static arrays with backend API calls and loading, error, and empty states.
- Replaced auditor mocked verification with `/api/v1/audit/verify`, application permit validation, and returned ciphertext/proof metadata.
- Updated `.env.example` with `COFHE_CHAIN_NAME`, `COFHE_RPC_URL`, supported testnet RPC examples, Vite contract address variables, and optional Reineira configuration.
- Added Vite worker ESM output and manual wallet/CoFHE/vendor chunk splitting so heavy SDK and wallet code is no longer folded into one default bundle.

## Documentation Alignment

The implementation was checked against the current Fhenix CoFHE documentation:

- `@cofhe/sdk` is the documented client SDK for encrypting inputs, managing permits, and decrypting outputs.
- `@cofhe/sdk/web` is the browser entrypoint for browser storage, TFHE WASM, and web workers.
- `InEuint32` and related typed encrypted input structs are the documented contract input path.
- `FHE.allowThis`, `FHE.allow`, and `FHE.allowPublic` are the documented ACL path for future encrypted reads and decrypt authorization.
- The newer decryption flow moves away from direct `FHE.decrypt(...)` and uses off-chain SDK decryptions with `publishDecryptResult` or `verifyDecryptResult` when plaintext must be used on-chain.
- Current supported CoFHE testnets are Sepolia, Arbitrum Sepolia, and Base Sepolia.

## Reineira / Privara Status

Reineira / Privara now has an optional SDK-backed API boundary. Full settlement remains gated by deployed Reineira protocol configuration, resolver contracts, and operator validation.

Current gaps:

- `@reineira-os/sdk` is installed.
- API routes exist for Reineira status, balances, and plain escrow creation.
- Full encrypted escrow integration is not enabled by default.
- No condition or gate resolver contracts are implemented.
- No insurance pool or policy contracts are implemented.
- No Reineira operator flow, CCTP flow, or Arbitrum Sepolia settlement adapter exists.

Recommended mapping:

- Map `LoanVault` loan lifecycle and collateral movement to Reineira encrypted escrow flows.
- Map underwriting results and covenant checks to Reineira condition or gate resolvers.
- Map lender downside protection to Reineira insurance policy and pool primitives.
- Extend the current SDK boundary once escrow, resolver, and policy boundaries are designed and testable.

## Unfinished Product Work

- Portfolio data now reads `LoanVault` borrower/lender loan id arrays. A subgraph-style service is still recommended for analytics and long-range history.
- Audit PDF export is implemented through `/api/v1/audit/report`.
- Explorer link helpers are wired for supported testnets where transaction hashes and addresses are returned.
- Full transaction retry orchestration is partially present in the UI but still needs reusable shared components.
- SDK decrypt-for-view UI for private borrower/lender/auditor displays is not fully built yet.
- Contract deployment addresses are still environment placeholders.
- Full Reineira / Privara encrypted escrow, resolver, insurance, operator, CCTP, and settlement flows require configured external protocol services and remain future work.

## Verification

Commands to run after this update:

```bash
npm install
npm run typecheck
npm run compile
npm run test
npm run build
```

Latest local results:

- `npm install`: passed; reported peer dependency warnings around React 19 compatibility and `67` audit findings in the current dependency graph.
- `npm run typecheck`: passed.
- `npm run compile`: passed; Hardhat reported nothing left to compile after the migration artifacts were generated.
- `npm run test`: passed; `11` tests passing across registry, underwriting, loan vault, and permit flows.
- `npm run build:production`: passed; Vite produced production assets successfully with non-blocking third-party annotation and chunk-size warnings, and the backend bundle built successfully.
- `npm audit fix`: completed non-forced remediation and reduced audit findings to `69` total with `4` remaining high findings documented in `docs/SECURITY_AUDIT_TRIAGE.md`.

## Known Build Notes

- Vite may still report large third-party chunks because wallet SDKs, CoFHE SDK, TFHE WASM, and RainbowKit dependencies are inherently large.
- Manual chunk splitting has been added for CoFHE and wallet code, and CoFHE SDK imports now load lazily during borrower encryption. Further production optimization should lazy-load route groups and wallet modal paths after a real bundle budget is set.
- Latest build still reports large chunks for wallet code, CoFHE code, MetaMask SDK code, and the TFHE WASM asset.
- Rollup may emit third-party `/*#__PURE__*/` annotation warnings from wallet dependencies. These are non-blocking dependency packaging warnings, not application compile errors.
