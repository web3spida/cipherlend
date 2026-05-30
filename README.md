# CipherLend

CipherLend is a privacy-preserving institutional credit prototype built with CoFHE. Borrowers encrypt financial inputs in the browser, contracts compute encrypted underwriting signals, and loan requests are gated by CoFHE decrypt-for-transaction proofs instead of direct plaintext reveals.

## Production Shape

- Frontend: React, Vite, RainbowKit, wagmi, `@cofhe/sdk/web`.
- API: Express, TypeScript, Ethers v6, `@cofhe/sdk/node`.
- Contracts: Solidity, Hardhat, `@fhenixprotocol/cofhe-contracts`.
- Deployment: Render Blueprint with a static frontend service and Node API service.

## Core Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Render Deployment Runbook](docs/RENDER_DEPLOYMENT.md)
- [Production Readiness Checklist](docs/PRODUCTION_READINESS.md)
- [Dependency Security Triage](docs/SECURITY_AUDIT_TRIAGE.md)
- [CoFHE / Reineira Alignment Update](COFHE_REINEIRA_ALIGNMENT_UPDATE.md)

## Local Requirements

- Node.js `22.17.0` or newer
- npm `10` or newer
- A `.env` file based on `.env.example`

## Install

```bash
npm install
```

## Development

Frontend:

```bash
npm run dev
```

Backend:

```bash
npm run dev:backend
```

Contract compile and tests:

```bash
npm run compile
npm run test
```

Typecheck:

```bash
npm run typecheck
```

## Production Build

Build frontend:

```bash
npm run build:web
```

Build backend:

```bash
npm run build:backend
```

Full production verification:

```bash
npm run build:production
```

Start compiled API:

```bash
npm run start:backend
```

## API Health

```text
GET /health
GET /ready
```

`/health` is a process liveness check. `/ready` verifies production configuration and RPC connectivity.

## Render Deployment

The repository includes `render.yaml`.

Deploy order:

1. Deploy contracts to Sepolia, Arbitrum Sepolia, or Base Sepolia.
2. Set API service environment variables in Render.
3. Deploy `cipherlend-api`.
4. Confirm `/health` and `/ready`.
5. Set static site `VITE_*` environment variables.
6. Deploy `cipherlend-web`.
7. Add the final web origin to API `ALLOWED_ORIGINS`.

See [docs/RENDER_DEPLOYMENT.md](docs/RENDER_DEPLOYMENT.md) for the full runbook.

## Supported CoFHE Networks

- `sepolia`
- `arbSepolia`
- `baseSepolia`
- `hardhat` / `localcofhe` for local development

## Important Production Caveats

- Do not reuse admin wallets as the API signer.
- Do not deploy with zero contract addresses.
- Do not expose raw borrower financial values to the API in production flows.
- Reineira / Privara has an optional SDK-backed API boundary for status, balances, and plain escrow creation. Full protocol settlement rollout still requires deployed Reineira addresses, resolver design, and live operator validation.
- Current dependency audit findings require a separate security triage before handling real funds.
