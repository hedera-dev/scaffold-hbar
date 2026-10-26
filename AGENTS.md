# x402 Pay-Per-Use Agent Guide

Guidance for coding agents working in the **x402 pay-per-use** Scaffold-HBAR template.

## Documentation

Search Hedera documentation with the `SearchHedera` tool on the `hedera-docs` MCP server before writing Hedera-specific code.

## Overview

Sellers upload files to private **MinIO** storage and register access terms on-chain with `FileRegistry`. Buyers pay native **HBAR** (tinybars) via HashPack; a self-hosted **x402 Hedera facilitator** verifies and settles each payment on testnet before the resource server issues a short-lived presigned download URL.

## Solidity Framework

**Hardhat-only** monorepo (no Foundry package):

- **`packages/hardhat`** — `FileRegistry.sol`, deploy scripts, tests
- **`packages/nextjs`** — Next.js resource server (`/api/files/*`), marketplace UI, x402 client (HashPack)
- **`facilitator/`** — self-hosted x402 Hedera facilitator (verify / settle)
- **`docker-compose.yml`** — MinIO + facilitator for local dev

Payments settle on Hedera **testnet** via native HBAR transfers. MinIO and the facilitator run locally. Do **not** forbid Docker for this template.

## Architecture

### x402 flow

1. Upload → presigned MinIO PUT + native `FileRegistry.registerFile` via HashPack (`ContractExecuteTransaction`)
2. Marketplace listing → on-chain `getFileCount` + `getFiles` (not `eth_getLogs` — Hedera RPC 7-day log window)
3. Public download → `200` + short-lived presigned GET URL
4. Private download → `402` → HashPack partial sign (`TransferTransaction`) → facilitator `/settle` → `200` + presigned URL

```text
Buyer → GET /api/files/:id/download
          ├─ public / free → presigned URL
          └─ private → 402 PAYMENT-REQUIRED
                → client signs HBAR transfer (HashPack)
                → retry with PAYMENT-SIGNATURE
                → resource server verify + settle via facilitator
                → PAYMENT-RESPONSE + short-lived download URL
```

### Critical invariants

- The Next.js app **never** holds `FACILITATOR_PRIVATE_KEY`.
- Prices and x402 amounts are **tinybars** (1 HBAR = 1e8); asset id is `PAYMENT_ASSET` / `HBAR_ASSET` = `"0.0.0"`.
- `payToAccountId` is a Hedera account id string (e.g. `0.0.1234`), not an EVM address.
- Private downloads require a fresh payment every time (no allow-list / season pass).
- Delisted files behave as not found for downloads and marketplace listing.
- Bytes stay in a **private** bucket; on-chain stores only `objectKey` + `contentHash`.

### HashPack / wallet integration

- Reown AppKit uses **only** the `hedera` namespace (`HederaAdapter` in `appKitHedera.ts`) — no `eip155` wagmi signing path for this template’s upload/payment flows.
- Registry writes: `writeContractViaNativeProvider` → `hedera_signAndExecuteTransaction`
- x402 payments: `createHederaProviderSigner` → `hedera_signTransaction` (partial sign; facilitator co-signs as fee payer)
- Deploy stores both `address` (EVM `0x…`) and `hederaContractId` (`0.0.x`) in `deployedContracts.ts`. Native contract executes must use the Hedera id — `ContractId.fromSolidityAddress` is wrong for JSON-RPC-deployed contracts.

### Frontend hooks (this template)

- `useRegistryFileListing` — marketplace file list via `getFiles` pagination
- `writeContractViaNativeProvider` — upload / owner actions (not `useScaffoldWriteContract`)
- `useScaffoldReadContract` — NOT ~~useScaffoldContractRead~~
- `useScaffoldWriteContract` — available from scaffold-hbar but **not used** by the x402 marketplace UI
- `useScaffoldEventHistory` — avoid on Hedera testnet/mainnet (7-day `eth_getLogs` limit); use `getFiles` or an indexer instead

After `yarn hardhat:deploy`, ABIs and addresses land in `packages/nextjs/contracts/deployedContracts.ts` — do not hand-edit (regenerated on deploy).

## Key Paths

| Path | Purpose |
| ---- | ------- |
| `packages/hardhat/contracts/FileRegistry.sol` | On-chain access terms |
| `packages/nextjs/app/api/files/upload/route.ts` | Presigned PUT + upload prep |
| `packages/nextjs/app/api/files/[id]/download/route.ts` | Public/private download + x402 gate |
| `packages/nextjs/app/api/files/[id]/route.ts` | File metadata API |
| `packages/nextjs/app/api/files/route.ts` | Listing API |
| `packages/nextjs/services/x402/server.ts` | `x402ResourceServer` + `ExactHederaScheme` |
| `packages/nextjs/services/x402/client.ts` | Browser x402 client |
| `packages/nextjs/services/x402/walletSigner.ts` | HashPack partial-sign signer |
| `packages/nextjs/services/storage/client.ts` | MinIO/S3 presigned URLs |
| `packages/nextjs/services/registry/server.ts` | Server-side `FileRegistry` reads |
| `packages/nextjs/services/web3/hederaContractWrite.ts` | Native contract writes |
| `packages/nextjs/utils/scaffold-hbar/hederaContractId.ts` | Hedera contract id resolution |
| `packages/nextjs/hooks/scaffold-hbar/useRegistryFileListing.ts` | Marketplace listing hook |
| `packages/nextjs/utils/x402.ts` | Tinybar helpers |
| `packages/nextjs/app/files/` | Marketplace UI |
| `facilitator/` | Self-hosted verify/settle service |
| `docker-compose.yml` | `minio`, `minio-init`, `facilitator` |

## FileRegistry

On-chain source of truth for marketplace terms. Access control for downloads is **off-chain**: the resource server reads these fields and decides free vs 402.

```solidity
string public constant PAYMENT_ASSET = "0.0.0"; // native HBAR; prices in tinybars

struct FileItem {
    address owner;
    string payToAccountId;   // e.g. "0.0.1234"
    uint256 priceTinybar;
    bool isPublic;
    string objectKey;        // private bucket key — not file bytes
    bytes32 contentHash;     // SHA-256
    string name;
    string mimeType;
    bool exists;
}

function registerFile(
    string calldata objectKey,
    string calldata payToAccountId,
    uint256 priceTinybar,
    bool isPublic,
    bytes32 contentHash,
    string calldata name,
    string calldata mimeType
) external returns (bytes32 fileId);
```

Owner updates: `setPrice`, `setVisibility`, `setPayTo`, `delistFile`. Enumeration: `getFileCount` + `getFiles` (max page `MAX_PAGE_SIZE` = 50).

### Registry checklist

- [ ] Upload bytes to the **private** bucket first; store only `objectKey` + `contentHash` on-chain
- [ ] `payToAccountId` is a Hedera account id, not an EVM address
- [ ] Private downloads require a fresh payment every time
- [ ] Delisted files behave as not found

## MinIO / S3 presigned URLs

Bucket is private (`minio-init` sets anonymous access to none). Nothing is served directly from MinIO.

- Upload: short-lived presigned PUT (`UPLOAD_URL_TTL_SECONDS` = 300)
- Download: short-lived presigned GET (`DOWNLOAD_URL_TTL_SECONDS` = 60) minted only after public access or successful settle
- Path-style URLs required for MinIO (`S3_FORCE_PATH_STYLE=true`)
- Default bucket: `x402-files`

## Addresses & Config

### Docker Compose services

| Service | Role | Ports |
| ------- | ---- | ----- |
| `minio` | Private S3-compatible storage | `9000` (API), `9001` (console) |
| `minio-init` | Creates private bucket | one-shot |
| `facilitator` | x402 verify/settle (`./facilitator`) | `4020` |

### Root `.env` (see `.env.example`)

| Var | Purpose |
| --- | ------- |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | MinIO credentials |
| `S3_BUCKET` | Bucket name (must match Next.js) |
| `FACILITATOR_PORT` | Default `4020` |
| `X402_NETWORK` | `hedera:testnet` |
| `FACILITATOR_ACCOUNT_ID` / `FACILITATOR_PRIVATE_KEY` | Funded ECDSA fee-payer (facilitator only) |
| `HEDERA_NODE_URL` | Optional custom consensus endpoint |

### `packages/nextjs/.env` (see `.env.example`)

| Var | Purpose |
| --- | ------- |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | HashPack / Reown |
| `FACILITATOR_URL` | Default `http://localhost:4020` |
| `X402_NETWORK` / `NEXT_PUBLIC_X402_NETWORK` | Must match (`hedera:testnet`) |
| `HEDERA_RPC_URL` | FileRegistry reads |
| `S3_ENDPOINT` / `S3_BUCKET` / `S3_*` | MinIO client (must match root `.env`) |
| `FILE_REGISTRY_ADDRESS` | Optional override; normally from `deployedContracts.ts` |

### Tinybar / asset rules

```ts
export const HBAR_ASSET = "0.0.0";
export const TINYBAR_PER_HBAR = 100_000_000n;
```

Never use floats for HBAR amounts. Convert in the UI with helpers in `packages/nextjs/utils/x402.ts`.

## Commands

```bash
# Local infra (MinIO + facilitator) — Docker required
yarn infra:up
yarn infra:down
yarn infra:logs

# Contracts (Hardhat)
yarn hardhat:account:generate
yarn hardhat:deploy --network hederaTestnet
yarn hardhat:verify:testnet
yarn hardhat:test

# App
yarn next:dev
yarn next:build

# x402 agent buyer (Node script)
yarn x402:buy

# Quality
yarn lint
yarn format
```

### Suggested bring-up order

1. `yarn install`
2. Root `.env` — facilitator ECDSA credentials (funded)
3. `packages/nextjs/.env` — WalletConnect project id + MinIO/x402 vars
4. `yarn hardhat:deploy --network hederaTestnet` — `FileRegistry`
5. `yarn infra:up` — MinIO + facilitator; confirm `/health`
6. `yarn next:dev` — upload / pay / download
7. Optional: `yarn x402:buy` — CLI buyer

## Skill Reference

Use skill: **`x402-payments`** for HTTP 402 / facilitator patterns, tinybar rules, `x402ResourceServer` / `ExactHederaScheme` wiring, client retry loops, and operational checklists.

## Packaging

Template manifest: `template.json` (branch `templates/x402-pay-per-use`). See RUNBOOK.md § Iteration 5.
