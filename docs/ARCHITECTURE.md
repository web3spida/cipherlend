# CipherLend Architecture

## System Context

```mermaid
flowchart LR
  Borrower["Borrower wallet"] --> Web["CipherLend React app"]
  Lender["Lender wallet"] --> Web
  Auditor["Auditor wallet"] --> Web

  Web --> API["CipherLend API"]
  Web --> Wallet["Wallet provider / RainbowKit"]
  Web --> CofheWeb["@cofhe/sdk/web"]

  API --> RPC["CoFHE RPC"]
  API --> Contracts["CipherLend contracts"]
  API --> CofheNode["@cofhe/sdk/node"]
  API --> Reineira["@reineira-os/sdk optional"]

  CofheWeb --> RPC
  Contracts --> Registry["BorrowerRegistry"]
  Contracts --> Underwriting["UnderwritingEngine"]
  Contracts --> Vault["LoanVault"]
  Contracts --> Permits["PermitRegistry"]
  Reineira --> Privara["Reineira / Privara escrow, insurance, CCTP"]
```

## Encrypted Borrower Profile Flow

```mermaid
sequenceDiagram
  participant B as Borrower Browser
  participant SDK as @cofhe/sdk/web
  participant W as Wallet
  participant R as BorrowerRegistry
  participant U as UnderwritingEngine
  participant API as CipherLend API

  B->>SDK: encryptInputs(InEuint32 values)
  SDK->>W: create/get self permit
  SDK-->>B: encrypted input structs
  B->>R: submitProfile(encrypted inputs)
  R->>R: FHE.asEuint32 + FHE.allowThis
  R->>U: allow transient profile access
  B->>API: POST /underwriting/run
  API->>U: runUnderwriting(borrower)
  U->>U: compute encrypted score and terms
  U-->>API: score metadata and handles
  API-->>B: txHash, proofHash, metadata
```

## Proof-Gated Loan Flow

```mermaid
sequenceDiagram
  participant B as Borrower
  participant SDK as CoFHE SDK
  participant U as UnderwritingEngine
  participant V as LoanVault
  participant L as Lender

  B->>U: authorizeScoreAccess(vault, borrower)
  B->>SDK: decryptForTx(term handles).withPermit(...)
  SDK-->>B: decrypted term values and proof signatures
  B->>V: requestLoan(amount, termMonths, decryptedTerms)
  V->>U: verifyDecryptedTerms(...)
  U-->>V: verified maxLoan, rate, ltv, proof metadata
  V->>V: create pending loan request
  L->>V: fundLoan(loanId)
  V->>V: move loan to active
```

## Render Deployment Topology

```mermaid
flowchart TB
  GitHub["GitHub main branch"] --> Blueprint["Render Blueprint render.yaml"]
  Blueprint --> WebSvc["cipherlend-web static service"]
  Blueprint --> ApiSvc["cipherlend-api node web service"]

  WebSvc --> Dist["Vite dist assets"]
  ApiSvc --> BackendBuild["esbuild backend/dist/server.js"]
  ApiSvc --> Health["/health"]
  ApiSvc --> Ready["/ready"]

  WebSvc --> Browser["User browser"]
  Browser --> ApiPublic["https://cipherlend-api.onrender.com/api/v1"]
  ApiPublic --> ApiSvc
  ApiSvc --> CofheRpc["CoFHE supported RPC"]
  CofheRpc --> Chain["Sepolia / Arbitrum Sepolia / Base Sepolia"]
```

## Contract Boundaries

- `BorrowerRegistry` owns encrypted borrower profile state and profile access authorization.
- `UnderwritingEngine` computes encrypted scores and terms and verifies CoFHE decrypt-for-transaction proofs.
- `LoanVault` owns loan request, funding, payment, overdue, and covenant lifecycle.
- `PermitRegistry` tracks business-level data grants. It does not replace CoFHE SDK permits.
- Reineira integration is an optional API boundary for settlement-side escrow and insurance workflows. It is disabled unless `REINEIRA_ENABLED=true`.

## Production Trust Boundaries

- Raw borrower financial values should exist only in the borrower browser session before encryption.
- The API should not accept raw borrower financial values in production flows.
- CoFHE SDK permits authorize ciphertext decryption. `PermitRegistry` only records application-level grants.
- Backend signer authority must be isolated to a dedicated operational wallet with limited funds and monitored transactions.
- Render environment variables are the deployment control plane. Never commit live RPC secrets, private keys, or deployed private addresses into the repository.
