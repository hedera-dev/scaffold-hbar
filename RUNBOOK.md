# x402 Pay-Per-Use Template — Test Runbook

A step-by-step guide to verifying each part of the template. Sections are added as each
iteration lands. Run commands from the repository root unless stated otherwise.

> Status: Iterations 1–5 are implemented. See **Environment variables** and **Testnet
> caveats** for configuration reference.

## Prerequisites

| Tool | Version | Needed for |
| --- | --- | --- |
| Node.js | ≥ 22.23.4 and < 23 — see [README § Node.js version](README.md#nodejs-version) | Hardhat, Next.js, facilitator, scripts |
| Yarn | 3.2.3 (via corepack) | monorepo scripts |
| Docker + Docker Compose | recent | Iteration 2 (MinIO + facilitator) |
| A funded **ECDSA** Hedera testnet account | — | deploying contracts + running the facilitator |

Get a testnet account and HBAR from the [Hedera Portal](https://portal.hedera.com/) faucet.
Create the account as **ECDSA** (x402 on Hedera requires ECDSA keys).

---

## Iteration 1 — Smart contract (`FileRegistry`)

The registry is pure EVM (no HTS/HSS precompiles), so it compiles and tests **offline** with
no Hedera fork.

### 1.1 Compile

```bash
yarn hardhat:compile
```

Expected: `Compiled 1 Solidity file successfully` and TypeChain typings generated.

### 1.2 Run the unit tests

```bash
yarn hardhat:test
```

Expected: **22 passing**, covering registration, metadata, deterministic file ids, price /
visibility / payTo updates, access control (owner-only), empty-value reverts, not-found
reverts, and pagination edge cases. A gas report prints at the end.

### 1.3 (Optional) Deploy to Hedera testnet

This regenerates `packages/nextjs/contracts/deployedContracts.ts` with the live EVM address and native Hedera contract id.

```bash
# One-time: create or import a funded deployer key
yarn hardhat:account:generate        # or: yarn hardhat:account:import
# Fund the printed account with testnet HBAR, then:
yarn hardhat:deploy --network hederaTestnet
```

Expected:
- `deploying "FileRegistry" ... deployed at 0x...`
- `Resolved Hedera contract id: 0.0.xxxxx`
- `📝 Updated TypeScript contract definition file on ../nextjs/contracts/deployedContracts.ts`
- A `296: { FileRegistry: { address, hederaContractId, abi, ... } }` entry now exists in `deployedContracts.ts`.
- View it on HashScan: `https://hashscan.io/testnet/contract/0x...`

---

## Iteration 2 — Local infrastructure (MinIO + facilitator)

Two pieces run locally via Docker: a private **MinIO** bucket (object storage, no AWS) and the
**self-hosted x402 Hedera facilitator** (verify/settle, no third-party service).

### 2.1 Configure

```bash
cp .env.example .env
```

Edit `.env` and set the facilitator fee-payer credentials.

**Why a private key here?** Private downloads settle as native Hedera `TransferTransaction`s.
HashPack only **partially signs** — the buyer authorizes debiting their HBAR to the seller’s
`payTo` account. Something still has to (a) co-sign as **fee payer**, (b) pay the Hedera network
fee, and (c) **submit** the transaction. That is the facilitator’s job; it needs
`FACILITATOR_ACCOUNT_ID` + `FACILITATOR_PRIVATE_KEY` server-side. The Next.js app never holds
this key (it only calls `FACILITATOR_URL`). Use a **dedicated ECDSA** testnet account, funded
with HBAR — not your contract deployer or seller wallet.

```dotenv
FACILITATOR_ACCOUNT_ID=0.0.xxxxxx
FACILITATOR_PRIVATE_KEY=0x...
# MINIO_ROOT_USER / MINIO_ROOT_PASSWORD / S3_BUCKET can stay at defaults for local dev
```

### 2.2 Start the stack

```bash
yarn infra:up
```

Expected: `minio`, `minio-init`, and `facilitator` containers start. `minio-init` logs
`MinIO ready: private bucket x402-files created` then exits 0.

### 2.3 Verify MinIO

- Open the console at `http://localhost:9001` and log in with `MINIO_ROOT_USER` /
  `MINIO_ROOT_PASSWORD` (default `minioadmin` / `minioadmin`).
- Confirm the bucket (default `x402-files`) exists and its access policy is **private**
  (anonymous access disabled).

### 2.4 Verify the facilitator

```bash
curl -s localhost:4020/health
curl -s localhost:4020/supported
```

Expected `/health`:

```json
{ "status": "ok", "network": "hedera:testnet", "feePayer": "0.0.xxxxxx" }
```

Expected `/supported` (note the advertised `feePayer` and signer match your account):

```json
{
  "kinds": [{ "x402Version": 2, "scheme": "exact", "network": "hedera:testnet", "extra": { "feePayer": "0.0.xxxxxx" } }],
  "extensions": [],
  "signers": { "hedera:*": ["0.0.xxxxxx"] }
}
```

An unknown route returns HTTP `404`.

### 2.5 Logs / teardown

```bash
yarn infra:logs    # follow container logs
yarn infra:down    # stop the stack (MinIO data persists in the named volume)
```

### 2.6 (Optional) Test the facilitator without Docker

```bash
cd facilitator
cp .env.example .env   # set FACILITATOR_ACCOUNT_ID / FACILITATOR_PRIVATE_KEY
npm install
npm run check-types    # type-checks against @x402/core + @x402/hedera
npm start              # serves on :4020 — test with the curl commands in 2.4
```

---

## Iteration 3 — Server: storage helper + x402 API routes

The Next.js app is now the **x402 resource server**. It exposes two API routes:

- `POST /api/files/upload` — returns a presigned MinIO PUT URL (bytes never touch the server).
- `GET /api/files/:id/download` — reads the `FileRegistry`, serves public files for free, and
  gates private files behind a per-download HBAR payment (verify → settle → presigned GET URL).

These steps test the routes directly with `curl`. The full browser/agent payment loop lands in
Iteration 4; here we confirm uploads work and that a private file produces a well-formed `402`.

### 3.1 Prerequisites for this iteration

1. `FileRegistry` deployed and `deployedContracts.ts` populated with `address` + `hederaContractId` (Iteration 1.3), **or** set
   `FILE_REGISTRY_ADDRESS` / `FILE_REGISTRY_HEDERA_CONTRACT_ID` in `packages/nextjs/.env`.
2. The infra stack running (`yarn infra:up`) so MinIO (`:9000`) and the facilitator (`:4020`)
   are reachable.
3. Next.js env configured:

```bash
cp packages/nextjs/.env.example packages/nextjs/.env
# Defaults (localhost MinIO + facilitator, testnet RPC) work out of the box for local dev.
```

### 3.2 Start the app

```bash
yarn next:dev       # Next.js dev server on http://localhost:3000
```

### 3.3 Request an upload URL and PUT a file

```bash
# 1) Ask the server for a presigned upload URL
RESP=$(curl -s -X POST localhost:3000/api/files/upload \
  -H 'content-type: application/json' \
  -d '{"name":"hello.txt","mimeType":"text/plain"}')
echo "$RESP"
# => {"objectKey":"2026-06-05/<uuid>-hello.txt","uploadUrl":"http://localhost:9000/...","contentType":"text/plain","expiresIn":300}

# 2) Upload the bytes straight to MinIO with the returned URL
URL=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["uploadUrl"])')
echo "hello x402" > /tmp/hello.txt
curl -s -X PUT "$URL" -H 'content-type: text/plain' --data-binary @/tmp/hello.txt -o /dev/null -w '%{http_code}\n'
# => 200
```

The object now exists in the private bucket. In a real flow the browser next submits a native
Hedera `ContractExecuteTransaction` for `FileRegistry.registerFile(...)` via HashPack; use the
**Upload** page at `/files/upload` or register via Hardhat console / cast against the JSON-RPC relay.

### 3.4 Public download returns `200` + a presigned URL

For a file registered with `isPublic = true`:

```bash
curl -s "localhost:3000/api/files/<fileId>/download"
# => {"url":"http://localhost:9000/x402-files/...<signed>","file":{...,"isPublic":true}}
```

Following `url` downloads the bytes. No payment header is involved.

### 3.5 Private download returns a well-formed `402`

For a file registered with `isPublic = false` and a non-zero `priceTinybar`, calling without a
payment header returns the x402 challenge:

```bash
curl -s -i "localhost:3000/api/files/<fileId>/download"
```

Expected:
- Status `402 Payment Required`.
- A `PAYMENT-REQUIRED` response header (base64 challenge for x402 clients).
- JSON body whose `accepts[0]` advertises `scheme: "exact"`, `network: "hedera:testnet"`,
  `payTo` = the file's account id, the price in tinybars, and `extra.feePayer` from the
  facilitator.

Sanity checks:
- Unknown / malformed id → `400`.
- Unregistered id → `404`.
- Registry not deployed → `503` with a clear message.
- Facilitator down → `502`.

> Completing the payment (signing, retrying with `PAYMENT-SIGNATURE`, then receiving a
> `200` + `PAYMENT-RESPONSE` receipt and the presigned URL) is exercised end-to-end in
> Iteration 4 with the HashPack browser client and the Node agent buyer script.

## Iteration 4 — Client + UI

End-to-end upload, marketplace listing, and pay-per-download on testnet via HashPack (WalletConnect) or the Node agent script.

### Prerequisites

- Iterations 1–3 complete (registry deployed with `address` + `hederaContractId` in `deployedContracts.ts`, MinIO + facilitator running, `yarn next:dev` up).
- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` set in `packages/nextjs/.env` (reused for HashPack).
- `NEXT_PUBLIC_X402_NETWORK=hedera:testnet` matches `X402_NETWORK`.
- HashPack mobile app on the same Hedera testnet, funded with testnet HBAR.

### A — Upload and browse (browser)

1. Connect **HashPack** in the header — approve the WalletConnect session on the native **`hedera`** namespace.
2. Upload at `/files/upload` — after MinIO PUT, HashPack prompts to sign the native `registerFile` contract execute.
3. Open `/files` — the marketplace lists entries via on-chain `getFiles` (polls every 10s). New uploads appear after registration confirms.

### B — Pay with HashPack (browser)

1. Open a **private** file at `/files/<id>`.
2. Ensure HashPack is connected (same session as upload).
3. Click **Pay … HBAR & download** — HashPack prompts to partially sign the native HBAR transfer.
4. After settlement you should get a presigned download URL and a tx receipt on the page.

### C — Pay from the Node agent

```bash
RESOURCE_URL="http://localhost:3000/api/files/<fileId>/download" \
  BUYER_ACCOUNT_ID=0.0.xxxx BUYER_PRIVATE_KEY=0x... \
  yarn x402:buy
```

Expect `200` with a presigned URL and `PAYMENT-RESPONSE` settlement metadata.

## Environment variables

Three `.env` files configure local development. Copy each from its `.env.example` before
running the stack.

### Root `.env` (docker-compose / `yarn infra:up`)

| Variable | Purpose |
| --- | --- |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | MinIO credentials (default `minioadmin`) |
| `S3_BUCKET` | Private bucket name (default `x402-files`) |
| `FACILITATOR_PORT` | Host port for the facilitator (default `4020`) |
| `X402_NETWORK` | CAIP-2 network the facilitator settles on (`hedera:testnet`) |
| `FACILITATOR_ACCOUNT_ID` | ECDSA fee-payer account (`0.0.x`) advertised in `GET /supported` |
| `FACILITATOR_PRIVATE_KEY` | ECDSA key used at `POST /settle` to co-sign, pay network fees, and submit the buyer’s partially signed transfer |
| `HEDERA_NODE_URL` | Optional custom consensus node RPC |

### `packages/nextjs/.env` (resource server + browser client)

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | WalletConnect project id (HashPack via Reown AppKit) |
| `HEDERA_RPC_URL` | RPC for on-chain `FileRegistry` reads |
| `FILE_REGISTRY_ADDRESS` | Optional EVM address override when not in `deployedContracts.ts` |
| `FILE_REGISTRY_HEDERA_CONTRACT_ID` / `NEXT_PUBLIC_FILE_REGISTRY_HEDERA_CONTRACT_ID` | Optional native contract id override (`0.0.x`) for HashPack contract executes |
| `FACILITATOR_URL` | x402 facilitator base URL (default `http://localhost:4020`) |
| `X402_NETWORK` | Server-side x402 network id |
| `NEXT_PUBLIC_X402_NETWORK` | Browser x402 client network (must match `X402_NETWORK`) |
| `S3_ENDPOINT` | MinIO API URL (default `http://localhost:9000`) |
| `S3_REGION` | S3 region label (any value for MinIO) |
| `S3_BUCKET` | Bucket name (must match root `.env`) |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | MinIO credentials |
| `S3_FORCE_PATH_STYLE` | `true` for MinIO; `false` only for AWS virtual-hosted buckets |

### `facilitator/.env` (standalone facilitator, optional)

Used when running the facilitator outside Docker (`cd facilitator && npm start`). Same
`FACILITATOR_ACCOUNT_ID`, `FACILITATOR_PRIVATE_KEY`, and `X402_NETWORK` as the root `.env`.

### Optional facilitator fallback

The default is the **self-hosted** facilitator from `docker-compose.yml`. To use an external
hosted facilitator instead (e.g. Blocky402 testnet), set `FACILITATOR_URL` in
`packages/nextjs/.env` — this is not required for local development.

---

## Testnet caveats

- **ECDSA keys only** — x402 on Hedera requires ECDSA accounts. Create testnet accounts via the
  [Hedera Portal](https://portal.hedera.com/) and fund them with HBAR.
- **Buyer needs HBAR** — every private download is a fresh native HBAR transfer. No token
  association is required for HBAR (`0.0.0`).
- **Facilitator fee payer** — HashPack cannot complete x402 settlement alone. The facilitator’s
  ECDSA account co-signs each transfer, pays Hedera network fees from its HBAR balance, and
  broadcasts the transaction. Keep `FACILITATOR_PRIVATE_KEY` server-side only.
- **Testnet settlement** — MinIO and the facilitator run locally, but Hedera payments hit
  **testnet** (or mainnet if configured). The local Hedera fork is not used for x402.
- **Native HashPack signing** — registry writes use `hedera_signAndExecuteTransaction`; x402
  payments use `hedera_signTransaction` (partial sign). Both use the `hedera` WalletConnect
  namespace — not wagmi / `eip155`.
- **Marketplace listing** — `/files` reads `getFileCount` + `getFiles`, not `eth_getLogs`.
  Hedera JSON-RPC limits log queries to a **7-day** window (timestamp-based “blocks”).
- **Docker required** — `yarn infra:up` starts MinIO and the facilitator containers.
- **Node.js** — ≥ 22.23.4 and < 23 for Hardhat, Next.js, and the facilitator image
  (`node:22.23.4-alpine`). See [README § Node.js version](README.md#nodejs-version).
- **Pin `@x402/hedera`** — the package is young; expect API churn across releases.
- **No on-chain privacy** — transfer amounts, accounts, and settlement txs are public on Hedera.

---

## Iteration 5 — Packaging (`create-scaffold-hbar`)

This template is published as git branch **`templates/x402-pay-per-use`** on the scaffold-hbar
repo. The CLI downloads that branch via giget — there is no embedded copy in the CLI repo.

### 5.1 What ships in the template

| Piece | Location |
| --- | --- |
| Manifest (consumed then deleted by CLI) | `template.json` |
| Contracts (Hardhat only) | `packages/hardhat/` (`FileRegistry.sol`) |
| Resource server + UI | `packages/nextjs/` |
| Self-hosted facilitator | `facilitator/` |
| Local infra | `docker-compose.yml`, root `.env.example` |
| Docs | `README.md`, `RUNBOOK.md` |

Foundry is **not** included. `template.json` locks `solidityFramework` to `hardhat` only.

### 5.2 Publish / update the template branch

From a branch that contains the finished template (e.g. `feat/add-x402-resource-server`):

```bash
# Ensure template.json, package.json (no foundry workspace), and docs are committed.
git push origin HEAD:templates/x402-pay-per-use
```

Or merge into `templates/x402-pay-per-use` and push. The branch name must be exactly
`templates/x402-pay-per-use` so `npx create-scaffold-hbar@latest --template x402-pay-per-use`
resolves to `hedera-dev/scaffold-hbar#templates/x402-pay-per-use`.

### 5.3 Scaffold a fresh project

```bash
npx create-scaffold-hbar@latest --template x402-pay-per-use
```

Interactive mode lists the template automatically once the branch exists on GitHub (GitHub API
`templates/*` refs). The CLI prints custom **outro steps** from `template.json` (env copy,
`yarn infra:up`, Hardhat deploy, `yarn next:dev`).

### 5.4 Optional CLI polish (`create-scaffold-hbar` repo)

Not required for discovery. For a friendlier prompt label and offline fallback, add to
`src/utils/consts.ts` in the `create-hbar` package:

- `TEMPLATE_LABEL_OVERRIDES["x402-pay-per-use"] = "x402 Pay-Per-Use"`
- `TEMPLATE_CAPABILITIES_FALLBACK["x402-pay-per-use"]` with `solidityFramework: ["hardhat"]`

### 5.5 Post-scaffold smoke test

After scaffolding into a clean directory:

1. `yarn install`
2. Copy `.env` files and set facilitator + WalletConnect credentials
3. `yarn infra:up` → `curl localhost:4020/health`
4. `yarn hardhat:deploy --network hederaTestnet`
5. `yarn next:dev` → upload a file, pay with HashPack on a private listing
