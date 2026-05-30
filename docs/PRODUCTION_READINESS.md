# Production Readiness Checklist

## Implemented in This Repository

- Render Blueprint with separate API and static frontend services.
- Compiled backend production artifact through `esbuild`.
- Explicit backend `start:backend` command.
- Node engine pin through `package.json` and `.node-version`.
- API liveness endpoint at `/health`.
- API readiness endpoint at `/ready`.
- Production environment fail-fast validation for RPC, signer, contract addresses, and CORS origins.
- CORS allowlist configured through `ALLOWED_ORIGINS`.
- Security headers through `helmet`.
- API rate limiting through `express-rate-limit`.
- Request IDs returned through `x-request-id`.
- In-process `/metrics` endpoint for request counts, errors, and average latency.
- Vite build output configured for static hosting.
- Event-backed portfolio reads through `LoanVault.getBorrowerLoanIds` and `LoanVault.getLenderLoanIds`.
- Auditor PDF report generation.
- Optional Reineira SDK API boundary for status, balances, and plain escrow creation.
- Architecture and deployment diagrams in `docs/ARCHITECTURE.md`.

## Required Before Real Funds

- Independent smart contract audit.
- Admin key inventory and rotation plan.
- Dedicated API signer with minimum viable funds.
- RPC provider SLA and fallback strategy.
- Transaction monitoring and alerting.
- Frontend error monitoring.
- Backend structured log export from Render.
- Contract event indexing for portfolio and historical audit views.
- Incident response runbook.
- Disaster recovery runbook for contract address/environment rollback.
- Formal dependency vulnerability review. Current dependency tree includes npm audit findings from third-party packages.

## Operational Smoke Test

Run after every production deploy:

1. Open the deployed frontend.
2. Connect a wallet on the configured CoFHE chain.
3. Encrypt borrower profile inputs in the browser.
4. Submit the encrypted profile transaction.
5. Run underwriting and verify score metadata returns from the API.
6. Generate decrypt-for-transaction proofs for terms.
7. Submit a loan request with verified terms.
8. Confirm lender marketplace reads the pending loan.
9. Create an app-level audit permit.
10. Verify auditor endpoint returns proof metadata for the borrower or loan.

## Monitoring Signals

Minimum signals to monitor:

- API service health and restarts.
- `/ready` failures.
- RPC latency and RPC errors.
- Contract transaction failures by route.
- Rate-limit spikes.
- Frontend API error rate.
- Wallet connection failures.
- CoFHE encryption/decryption step failures.

## Latest Verification

Run date: 2026-05-30

- `npm run typecheck`: passed.
- `npm run compile`: passed.
- `npm run build:backend`: passed and produced `backend/dist/server.js`.
- Compiled backend smoke test: passed for `GET /health`.
- `npm run build:production`: passed, including typecheck, Hardhat compile, Vite frontend build, and backend bundle build.
- `npm run test`: passed with `11` contract tests.
- `npm audit fix`: completed non-forced remediation and reduced findings to `69` total, with `4` high findings remaining in CoFHE, Hardhat, and wallet dependency trees.

## Current Known Limitations

- Reineira / Privara full escrow, resolver, insurance, operator, CCTP, and settlement flows require configured protocol addresses, resolver contracts, and live operator validation.
- Lender portfolio data now reads on-chain loan id arrays. A subgraph-style indexer is still recommended for history, filtering, and analytics at scale.
- Browser decrypt-for-view experiences are not complete for all roles.
- Bundle size warnings remain for wallet SDK, CoFHE SDK, MetaMask SDK, and TFHE WASM assets.
- Render static site environment variables are build-time values; changes require redeployment.
