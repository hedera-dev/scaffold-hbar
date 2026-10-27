# Scaffold-HBAR — Hedera Demo (Proof Wall)

Hedera-native **Next.js-only** demo: post timestamped proofs on **Hedera Consensus Service (HCS)**, browse them on a live feed, and earn **HTS badge tokens** for participation. No Solidity workspace or contract deploy required.

CLI key: `hedera-demo` (branch `templates/hedera-demo`).

```
Wallet connect → Submit HCS message (JSON proof) → Mirror Node feed
Admin (/admin) → Create topic + HTS badge token → env vars for the app
```

General Scaffold-HBAR docs: [Scaffold HBAR on Hedera](https://docs.hedera.com/solutions/tools/scaffold-hbar/index).

## What's in this template

- **Next.js only** — no `packages/hardhat` or `packages/foundry`
- **Proof Wall** at `/` — submit and browse HCS messages on a configured topic
- **My proofs** at `/my-proofs` — filter feed by connected account; badge display
- **Admin** at `/admin` — create HCS topic and HTS badge token via wallet-signed transactions
- Server routes under `packages/nextjs/app/api/hedera/` for Mirror Node and operator helpers

Create a project:

```bash
npm create scaffold-hbar@latest -- --template hedera-demo
```

## Quick start

### Prerequisites

- Node.js ≥ 22.23.4 and < 23, Git
- Yarn (this template is Yarn-only)
- [WalletConnect project ID](https://cloud.reown.com) (Reown / WalletConnect Cloud)
- Hedera testnet account — fund via [portal.hedera.com](https://portal.hedera.com/faucet)

### Install and run

```bash
yarn install

cp packages/nextjs/.env.example packages/nextjs/.env
# Set NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID (required)

yarn next:dev    # http://localhost:3000
```

1. Open **Admin** (`/admin`), connect wallet, create a topic (and optionally a badge token).
2. Copy topic ID into `NEXT_PUBLIC_PROOF_WALL_TOPIC_ID` (and badge token into `NEXT_PUBLIC_PROOF_WALL_BADGE_TOKEN_ID` if created).
3. Restart dev server, post a proof on the home page.

## Scripts

| Command | Description |
|---|---|
| `yarn next:dev` | Dev server at http://localhost:3000 |
| `yarn next:build` | Production build |
| `yarn next:check-types` | TypeScript check |
| `yarn lint` / `yarn next:lint` | ESLint |
| `yarn format` | Prettier |

## Project layout

- **packages/nextjs** — App Router UI, Hedera SDK + wallet connect, Mirror Node API routes, Proof Wall components

## Links

- [Scaffold HBAR docs](https://docs.hedera.com/solutions/tools/scaffold-hbar/index)
- [create-scaffold-hbar](https://github.com/hedera-dev/create-scaffold-hbar) — CLI
- [Hedera docs](https://docs.hedera.com/)
- [HashScan testnet](https://hashscan.io/testnet)
