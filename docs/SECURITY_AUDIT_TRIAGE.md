# Dependency Security Triage

Run date: 2026-05-30

## Actions Taken

- Upgraded `vite` to `8.0.14`.
- Upgraded `@vitejs/plugin-react` to `6.0.2`.
- Upgraded `express` to `5.2.1`.
- Ran `npm audit fix` without `--force`.
- Kept CoFHE packages pinned to the documented/current alignment set.

## Current Result

`npm audit fix` reduced the report to `69` findings:

- `18` low
- `47` moderate
- `4` high

## Remaining High Findings

The remaining high findings are not safely fixable with a non-breaking update in this repo state:

- `lodash`: pulled through Hardhat ignition/toolbox dependencies.
- `serialize-javascript`: pulled through Mocha and Hardhat gas reporter.
- `tmp`: pulled through `solc`.
- `undici`: pulled through Hardhat and CoFHE/Hardhat-related tooling.

`npm audit fix --force` would install breaking dependency sets such as `@nomicfoundation/hardhat-toolbox@7`, Hardhat 3-era packages, or CoFHE downgrades. That is not acceptable without a dedicated CoFHE/Hardhat migration branch because the current contract tests and plugin integration target Hardhat 2 and the CoFHE 0.5 package set.

## Production Interpretation

- The remaining high findings are concentrated in development/build tooling and blockchain SDK dependency trees.
- They still require formal review before handling real funds.
- Production API deploys should run compiled output through `npm run build:backend`; Render should not expose Vite dev server or Hardhat runtime endpoints.
- A future security sprint should test Hardhat 3 compatibility with `@cofhe/hardhat-plugin` and replace or isolate vulnerable transitive tooling when CoFHE support is available.

## Required Follow-Up

- Confirm whether `@cofhe/hardhat-plugin` supports Hardhat 3 before upgrading.
- Confirm whether RainbowKit/wagmi 3 can be adopted without breaking wallet and CoFHE web adapter flows.
- Re-run `npm audit --audit-level=high` after every dependency upgrade.
- Treat dependency audit cleanup as separate from formal smart contract audit.
