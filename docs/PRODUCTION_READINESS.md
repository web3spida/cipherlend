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
- Vite build output configured for static hosting.
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
- `npm run build:backend`: passed and produced `backend/dist/server.js`.
- Compiled backend smoke test: passed for `GET /health`.
- `npm run build:production`: passed, including typecheck, Hardhat compile, Vite frontend build, and backend bundle build.
- `npm run test`: passed with `11` contract tests.
- `npm install`: completed with the existing React peer warning pattern and `84` npm audit findings.

## Current Known Limitations

- Reineira / Privara escrow, resolver, insurance, operator, CCTP, and settlement flows are documented but not implemented.
- Lender portfolio data still needs an event indexer or subgraph-style service.
- Auditor PDF export is not implemented.
- Browser decrypt-for-view experiences are not complete for all roles.
- Bundle size warnings remain for wallet SDK, CoFHE SDK, MetaMask SDK, and TFHE WASM assets.
- Render static site environment variables are build-time values; changes require redeployment.
