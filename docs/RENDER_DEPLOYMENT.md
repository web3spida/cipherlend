# Render Deployment Runbook

This project deploys as two Render services from `render.yaml`:

- `cipherlend-api`: Node web service running the Express API.
- `cipherlend-web`: Static site serving the Vite frontend from `dist`.

## Prerequisites

- Node.js `20.11.1` or newer.
- A Render account connected to the GitHub repository.
- A WalletConnect project ID.
- Deployed CipherLend contracts on one supported CoFHE network.
- A dedicated backend signer private key for API-managed transactions.
- A production CoFHE RPC URL for the selected chain.

Supported chain names:

- `sepolia`
- `arbSepolia`
- `baseSepolia`

## Deployment Order

1. Deploy contracts to the target network.
2. Record deployed addresses for:
   - `BORROWER_REGISTRY_ADDRESS`
   - `UNDERWRITING_ENGINE_ADDRESS`
   - `LOAN_VAULT_ADDRESS`
   - `PERMIT_REGISTRY_ADDRESS`
3. Create a Render Blueprint from `render.yaml`.
4. Fill all `sync: false` environment variables in Render.
5. Deploy `cipherlend-api`.
6. Confirm `https://<api-service>.onrender.com/health` returns `status: ok`.
7. Confirm `https://<api-service>.onrender.com/ready` returns `status: ready`.
8. Set `VITE_API_BASE_URL` on the static service to the public API URL plus `/api/v1`.
9. Deploy `cipherlend-web`.
10. Set `ALLOWED_ORIGINS` on the API service to include the final static site URL.
11. Redeploy the API after changing `ALLOWED_ORIGINS`.

## API Service Environment

| Key | Required | Example | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | yes | `production` | Set by `render.yaml`. |
| `NODE_VERSION` | yes | `20.11.1` | Set by `render.yaml`. |
| `COFHE_CHAIN_NAME` | yes | `baseSepolia` | Must match the deployed contract network. |
| `COFHE_RPC_URL` | yes | `https://sepolia.base.org` | Use a production RPC provider for main traffic. |
| `PRIVATE_KEY` | yes | Render secret | Dedicated API signer. Do not reuse admin wallets. |
| `BORROWER_REGISTRY_ADDRESS` | yes | `0x...` | Deployed contract address. |
| `UNDERWRITING_ENGINE_ADDRESS` | yes | `0x...` | Deployed contract address. |
| `LOAN_VAULT_ADDRESS` | yes | `0x...` | Deployed contract address. |
| `PERMIT_REGISTRY_ADDRESS` | yes | `0x...` | Deployed contract address. |
| `ALLOWED_ORIGINS` | yes | `https://cipherlend-web.onrender.com` | Comma-separated browser origins. |
| `JSON_BODY_LIMIT` | no | `2mb` | Defaults to `2mb`. |
| `RATE_LIMIT_WINDOW_MS` | no | `60000` | Defaults to one minute. |
| `RATE_LIMIT_MAX` | no | `120` | Defaults to 120 requests per window. |

In production, the API fails startup when required variables are missing or set to the zero address.

## Static Site Environment

| Key | Required | Example |
| --- | --- | --- |
| `VITE_API_BASE_URL` | yes | `https://cipherlend-api.onrender.com/api/v1` |
| `VITE_WALLETCONNECT_PROJECT_ID` | yes | WalletConnect project ID |
| `VITE_COFHE_CHAIN_NAME` | yes | `baseSepolia` |
| `VITE_BORROWER_REGISTRY_ADDRESS` | yes | `0x...` |
| `VITE_UNDERWRITING_ENGINE_ADDRESS` | yes | `0x...` |
| `VITE_LOAN_VAULT_ADDRESS` | yes | `0x...` |

Vite reads these variables at build time. Changing a `VITE_*` value requires redeploying the static site.

## Render Commands

API service:

```bash
npm ci && npm run build:backend
npm run start:backend
```

Static site:

```bash
npm ci && npm run build:web
```

Full local production verification:

```bash
npm run build:production
npm run start:backend
```

## Health Checks

- `/health`: process-level liveness check. Render uses this path.
- `/ready`: readiness check. Confirms required production configuration and RPC connectivity.

Use `/ready` before routing real traffic or after changing RPC/contract environment variables.

## Rollback

Render can roll back to a previous successful deploy from the service dashboard. Roll back both services together if the frontend and API contract shapes changed in the same release.

## Launch Blockers

Do not treat the deployment as production-ready until these are resolved:

- Contract addresses are deployed, verified, and configured in both API and static site services.
- API signer is funded with limited operational funds and monitored.
- `ALLOWED_ORIGINS` contains only production frontend origins.
- `/ready` returns `status: ready`.
- A transaction smoke test passes for borrower encryption, profile submission, underwriting, and loan request proof verification.
- Render services have alerting for failed deploys and service health failures.
