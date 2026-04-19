# CipherLend

CipherLend is a privacy-first institutional credit protocol built on Fhenix.  
It combines encrypted underwriting, role-based data access, on-chain loan servicing, and a multi-portal frontend experience for borrowers, lenders, and auditors.

## Vision

Traditional on-chain credit markets force borrowers to expose sensitive financial data. CipherLend uses Fully Homomorphic Encryption (FHE) so credit decisions can be computed on encrypted financial inputs while only minimal, policy-approved outputs are revealed.

## Current Implementation (Wave 1)

### 1) Smart Contract Layer (Implemented)

#### BorrowerRegistry
- Stores borrower financial profiles as encrypted values (`euint32`).
- Supports initial profile submission and profile versioned updates.
- Exposes metadata safely (sector, timestamp, version).
- Provides permission-gated revenue bucketing for controlled disclosure.

#### UnderwritingEngine
- Runs encrypted underwriting based on weighted score signals:
  - DSCR
  - Runway
  - Leverage
  - Receivables quality
- Maps aggregate encrypted score into risk bands.
- Computes encrypted credit terms (max loan size, interest bps, LTV bps).
- Exposes restricted views:
  - Lender risk band view
  - Borrower loan terms view
  - Auditor compliance view with selective non-raw outputs
- Stores proof hash and score timestamp for traceability.

#### LoanVault
- Accepts borrower loan requests gated by fresh underwriting results.
- Supports lender funding via native value transfer.
- Supports repayment lifecycle, overdue marking, and covenant checks.
- Re-runs underwriting for covenant breach detection.
- Tracks pending loans for lender marketplace discovery.

#### PermitRegistry
- Implements grant/revoke/verify flow for borrower-issued permits.
- Supports typed permit modes: lender, auditor, full.
- Maintains grantor/grantee permit views.

### 2) Backend API Layer (Implemented but not fully functional for now)

Express backend with route groups:
- `profile`: submit encrypted borrower profile on-chain.
- `underwriting`: run underwriting and retrieve permissioned terms.
- `loans`: list available pending loans, fund loans, make repayments.
- `audit`: verify permit and fetch audit-compliant sealed underwriting view.
- `permits`: grant and list permits.

The backend contract clients are wired through Ethers and Fhenix-related utilities, with environment-driven contract addresses.

### 3) Frontend Layer (Implemented)

React + Vite interface with separate role experiences:
- **Borrower Portal**: profile entry, encryption UX, score visualization, active-loan dashboard UX.
- **Lender Portal**: marketplace exploration, risk-filtering UX, funding modal UX, portfolio view UX.
- **Auditor Portal**: permit-based audit verification UX and proof panel UX.
- **Landing + navigation + footer flows** for role-based entry and protocol explanation.

Note: current portal actions are primarily product/demo UX flows and are not yet fully wired end-to-end to backend APIs in all screens.

### 4) Tooling and Deployment (Implemented)

- Hardhat configuration for local + Fhenix Helium network.
- Contract deployment script to deploy and wire core contracts.
- End-to-end contract test suite covering major lifecycle and permission scenarios.
- Netlify frontend deployment config:
  - build command: `npm run build`
  - publish directory: `dist`
  - SPA redirect fallback to `index.html`

## Tech Stack

- **Blockchain**: Solidity, Hardhat, Ethers v6
- **Privacy/FHE**: Fhenix contracts + client stack, CoFHE SDK
- **Backend**: Node.js, Express, TypeScript
- **Frontend**: React, Vite, React Router, Tailwind utilities, Motion
- **Infra**: Netlify (frontend), configurable RPC/deployment targets

## CoFHE SDK Migration Notes

CipherLend backend FHE utilities are aligned with the `@cofhe/sdk` builder-pattern API.

- Deprecated flow: `FHE.decrypt()` is no longer used.
- View decryption (off-chain UI): use `decryptForView` with permit context.
- Transaction decryption (on-chain publish): use `decryptForTx` to receive `{ ctHash, decryptedValue, signature }`, then call `FHE.publishDecryptResult(...)` in the contract flow.
- Encryption uses `encryptInputs([...]).execute()` with explicit input types.
- CoFHE client setup follows explicit config/client/connect sequencing with viem-compatible clients.

## Project Structure

```text
.
├── contracts/                # Solidity protocol contracts
├── test/                     # Hardhat test suite
├── scripts/                  # Deployment scripts
├── backend/                  # Express API server
│   └── src/
│       ├── lib/              # Chain/Fhenix client + contract wrappers
│       └── routes/           # API route groups
├── src/                      # React frontend
│   ├── components/
│   └── pages/
├── hardhat.config.cjs
├── netlify.toml
└── package.json
```

## Local Development

### Prerequisites
- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

### Run Frontend

```bash
npm run dev
```

### Run Backend

```bash
npm run dev:backend
```

### Run Both Frontend + Backend

```bash
npm run dev:full
```

### Compile Contracts

```bash
npm run compile
```

### Test Contracts

```bash
npm run test
```

### Quality Checks

```bash
npm run lint
npm run typecheck
```

## Environment Configuration

Backend and deployment flows rely on environment variables such as:
- `FHENIX_RPC_URL`
- `PRIVATE_KEY`
- `COFHE_CHAIN_NAME` (`sepolia` | `arbSepolia` | `baseSepolia` | `hardhat` | `localcofhe`)
- `BORROWER_REGISTRY_ADDRESS`
- `UNDERWRITING_ENGINE_ADDRESS`
- `LOAN_VAULT_ADDRESS`
- `PERMIT_REGISTRY_ADDRESS`

Create a local `.env` with the values for your target chain/account before running backend and deployment flows.

## Deployment

### Frontend (Netlify)
- `netlify.toml` is configured for static Vite output in `dist`.
- SPA routing is handled with redirect fallback to `/index.html`.

### Contracts (Fhenix Helium)

```bash
npm run deploy:helium
```

## Product Roadmap

### Wave 2 (Next Major Delivery)

Focus: move from polished prototype to integrated production-alpha flows.

Planned outcomes:
- End-to-end frontend ↔ backend ↔ contract integration for all borrower, lender, and auditor actions.
- Real permit generation/signing UX and session-scoped permission handling.
- Transaction state management with optimistic UI, retry paths, and error surfacing.
- Borrower dashboards backed by live on-chain + API data.
- Lender marketplace filters backed by real pending-loan query data.
- Auditor report export pipeline with deterministic proof metadata packaging.
- Improved API hardening:
  - request validation
  - structured error taxonomy
  - environment health and contract connectivity checks
- Initial observability:
  - request logs
  - critical path metrics
  - failure alerts

### Wave 3 (Scale and Institutional Readiness)

Focus: governance, risk automation, and ecosystem-grade operability.

Planned outcomes:
- Advanced underwriting model iterations with configurable policy modules.
- Dynamic covenant framework with richer trigger sets and policy-based remediation.
- Portfolio-level risk analytics for lenders.
- Multi-wallet / role-account support for institutional teams.
- Formalized auditor workflow:
  - attestation lifecycle
  - signed audit artifacts
  - historical compliance trail
- Expanded security posture:
  - external audits
  - invariant/property testing expansion
  - incident response runbooks
- Decentralization and control-plane maturity:
  - upgrade governance strategy
  - parameter governance
  - staged admin minimization
- Multi-environment deployment strategy with release channels and migration tooling.

## Status Snapshot

- Wave 1: Completed and test-covered at contract level; frontend UX is feature-rich; backend API surface is implemented.
- Wave 2: Planned integration and reliability wave.
- Wave 3: Planned scale, governance, and institutional maturity wave.
