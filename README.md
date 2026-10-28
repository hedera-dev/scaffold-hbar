# x402 Pay-Per-Use Template (Hedera)

Pay-per-download file marketplace on Hedera using [x402](https://x402.org/): private **MinIO** storage, self-hosted **x402 facilitator**, and on-chain **FileRegistry** metadata.

CLI key: `x402-pay-per-use` (branch `templates/x402-pay-per-use`).

```bash
npx create-scaffold-hbar@latest --template x402-pay-per-use
```

General Scaffold-HBAR setup: [Scaffold HBAR on Hedera](https://docs.hedera.com/solutions/tools/scaffold-hbar/index). Step-by-step verification: [`RUNBOOK.md`](RUNBOOK.md).

## Disclaimer

This template—including **contracts, frontend, facilitator, and tooling**—is **experimental** and **not audited**. Use testnets and small amounts only.

Sellers upload files to private **MinIO** storage and register them on-chain with `FileRegistry`. Buyers pay in **HBAR** via **HashPack**; a self-hosted **x402 Hedera facilitator** verifies and settles each payment on testnet before the resource server issues a short-lived download URL.

## Prerequisites

- [Node.js](https://nodejs.org/) ≥ 22.23.4 and < 23 — see [Node.js version](#nodejs-version)
- Yarn (default; required if you clone this repo) or npm if you scaffolded with the CLI. For Yarn, install via Corepack: `corepack enable && corepack prepare yarn@stable --activate`
- [Git](https://git-scm.com/)
- [Docker](https://docs.docker.com/get-docker/) + Docker Compose (MinIO and self-hosted facilitator)
- A funded **ECDSA** Hedera testnet account for contract deploy and facilitator fee-payer duties

## Node.js version

Use Node **≥ 22.23.4 and < 23** for `yarn install`, Hardhat, the Next.js app, and the facilitator image. Node 20 has no vendor fix for the 2026-10-21 runtime advisories. Hardhat 2.22.19 only claims the 22.x line, so stay below 23.

The facilitator image is `node:22.23.4-alpine`.

## Quick start

1. Install dependencies:

```bash
yarn install
```

2. Copy environment files:

```bash
cp .env.example .env
cp packages/nextjs/.env.example packages/nextjs/.env
```

3. Configure the facilitator fee-payer in root `.env` (see [Why the facilitator needs a private key](#why-the-facilitator-needs-a-private-key)):
   `FACILITATOR_ACCOUNT_ID` and `FACILITATOR_PRIVATE_KEY`. Fund that account with testnet HBAR from the [Hedera Portal faucet](https://portal.hedera.com/faucet).

4. Set `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` in `packages/nextjs/.env` (WalletConnect / HashPack).

5. Deploy `FileRegistry` to Hedera testnet:

```bash
yarn hardhat:account:generate   # or: yarn hardhat:account:import
yarn hardhat:deploy --network hederaTestnet
```

6. Start local infra and the app:

```bash
yarn infra:up        # MinIO :9000 / :9001, facilitator :4020
yarn next:dev        # http://localhost:3000
```

7. Connect **HashPack** in the header, upload a file, set a price, then pay for a private download from the file detail page.

Step-by-step verification (curl, facilitator health checks, CLI buyer script) is in [`RUNBOOK.md`](RUNBOOK.md).

## How it works

1. **Upload** — the browser gets a presigned MinIO PUT URL from `POST /api/files/upload`, PUTs the bytes to MinIO, then registers metadata on `FileRegistry` via a native Hedera `ContractExecuteTransaction` signed in HashPack (`hedera_signAndExecuteTransaction`).
2. **List / browse** — the marketplace calls on-chain `getFileCount()` + `getFiles(offset, limit)` (view reads via JSON-RPC). It does **not** scan `FileRegistered` logs — Hedera JSON-RPC limits `eth_getLogs` to a 7-day window.
3. **Download (public)** — `GET /api/files/:id/download` returns a presigned GET URL with no payment.
4. **Download (private)** — the same route returns `402 Payment Required`; the x402 client builds a native Hedera `TransferTransaction`, your connected **HashPack** session **partially signs** it (authorizing the HBAR debit), the facilitator **co-signs as fee payer**, submits the transaction to Hedera, and the server responds with a presigned URL plus a `PAYMENT-RESPONSE` receipt.

One **HashPack** WalletConnect session (via Reown AppKit, **`hedera` namespace only**) covers both registry writes and x402 payments — no second wallet connection and no separate EVM (`eip155`) signing path.

## Why the facilitator needs a private key

Hedera x402 payments are **native transfers**, not EVM contract calls. HashPack can sign the buyer’s side of that transfer, but it cannot pay Hedera network fees or broadcast the transaction on its own in this flow.

The self-hosted facilitator holds an **ECDSA fee-payer account** (`FACILITATOR_ACCOUNT_ID` + `FACILITATOR_PRIVATE_KEY`) so it can:

1. **Advertise** which account sponsors fees (`GET /supported` → `extra.feePayer`).
2. **Verify** the buyer’s partially signed transfer matches the `402` challenge.
3. **Settle** by adding the fee-payer signature, paying the network fee from its HBAR balance, and submitting the transaction to consensus.

The buyer only authorizes moving their HBAR to the seller’s `payTo` account. The facilitator never custodies buyer funds — it can only co-sign a transfer the buyer already approved.

The Next.js app does **not** need this private key. It only calls `FACILITATOR_URL`. Keep `FACILITATOR_PRIVATE_KEY` in server-side env (root `.env` for Docker, or `facilitator/.env` when running the service standalone), never in the browser.

## Environment variables

| Location | Key variables |
| --- | --- |
| Root `.env` | `MINIO_ROOT_*`, `S3_BUCKET`, `FACILITATOR_ACCOUNT_ID`, `FACILITATOR_PRIVATE_KEY` (fee payer — see above), `X402_NETWORK` |
| `packages/nextjs/.env` | `FACILITATOR_URL`, `X402_NETWORK`, `NEXT_PUBLIC_X402_NETWORK`, `S3_*`, `HEDERA_RPC_URL`, optional `FILE_REGISTRY_ADDRESS`, optional `FILE_REGISTRY_HEDERA_CONTRACT_ID` / `NEXT_PUBLIC_FILE_REGISTRY_HEDERA_CONTRACT_ID` |
| `facilitator/.env` | Same fee-payer credentials when running the facilitator outside Docker |

Full tables: [`RUNBOOK.md` — Environment variables](RUNBOOK.md#environment-variables).

## Deploy and verify `FileRegistry`

Deployer and facilitator accounts must be **ECDSA** and funded with testnet HBAR.

```bash
yarn hardhat:deploy --network hederaTestnet
yarn hardhat:verify:testnet
```

This regenerates `packages/nextjs/contracts/deployedContracts.ts` with:

- **`address`** — EVM address (`0x…`) used for JSON-RPC reads and HashScan links
- **`hederaContractId`** — native Hedera contract id (`0.0.x`) resolved from the mirror node after deploy; required for HashPack native contract executes

Verified contracts appear on [Hashscan (testnet)](https://hashscan.io/testnet).

## Useful commands

| Command | Purpose |
| --- | --- |
| `yarn infra:up` / `yarn infra:down` | Start or stop MinIO + facilitator |
| `yarn infra:logs` | Follow Docker container logs |
| `yarn hardhat:test` | Run `FileRegistry` contract tests |
| `yarn x402:buy` | Node agent buyer script (see `RUNBOOK.md`) |
| `yarn facilitator:check-types` | Type-check the facilitator service |

## Caveats

- **HashPack only** — the demo uses Reown AppKit with HashPack on the native **`hedera`** WalletConnect namespace. MetaMask and the dev burner wallet are not supported in this template.
- **Native Hedera signing** — registry writes and x402 payments both go through HashPack’s native Hedera APIs (`hedera_signAndExecuteTransaction` / `hedera_signTransaction`), not wagmi `eth_sendTransaction`.
- **ECDSA accounts** — buyers and the facilitator fee payer must use ECDSA keys (not ED25519).
- **HBAR balance** — buyers need testnet HBAR for each private download; the facilitator account needs HBAR to sponsor network fees.
- **Testnet settlement** — MinIO and the facilitator run locally, but payments settle on Hedera **testnet** (or mainnet if you change `X402_NETWORK`). The local Hedera fork is not used for x402.
- **Hedera JSON-RPC log limits** — `eth_getLogs` is capped to a 7-day range on Hedera; the marketplace lists files via `getFiles` instead of event scanning.
- **Node.js** — ≥ 22.23.4 and < 23, including the facilitator image. See [Node.js version](#nodejs-version).
- **Docker** — required for `yarn infra:up`.
- **No on-chain privacy** — payment amounts and accounts are visible on HashScan.
- **Package churn** — pin `@x402/hedera` / `@x402/core` versions; APIs may change between releases.
- **External facilitator** — optional: point `FACILITATOR_URL` at a hosted service instead of the local Docker facilitator.

## Project layout

- **`packages/hardhat`** — `FileRegistry` contract, deploy scripts, tests
- **`packages/nextjs`** — Next.js resource server (`/api/files/*`), marketplace UI, x402 client (HashPack)
- **`facilitator/`** — self-hosted x402 Hedera facilitator (verify / settle)
- **`docker-compose.yml`** — MinIO + facilitator for local development

## Links

- [x402](https://x402.org/)
- [Hedera Documentation](https://docs.hedera.com/)
- [Hashscan](https://hashscan.io/) — block explorer
- [Hedera Portal faucet](https://portal.hedera.com/faucet)
- [create-scaffold-hbar](https://github.com/hedera-dev/create-scaffold-hbar) — CLI
