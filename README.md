# Scaffold-HBAR — Blank starter

Minimal Hedera dApp baseline: Next.js, Hardhat or Foundry, and Hedera networks (testnet, mainnet, local fork). No opinionated product UI — you add the app on top.

CLI key: `blank` (branch `templates/blank-template`).

The full product guide — CLI flags, npm vs Yarn, deploy, and verify — lives in [Scaffold HBAR on Hedera docs](https://docs.hedera.com/solutions/tools/scaffold-hbar/index). This README is what is specific to **this** template.

## What's in this template

- Next.js App Router with wallet connect, **Debug Contracts**, and a local block explorer
- Sample HTS contracts (`HederaToken`, `HtsTokenCreator`) so Debug Contracts has something to call
- Hardhat and Foundry packages (the CLI can drop one)
- Hashio RPC + Mirror Node config for Hedera testnet and mainnet
- Package manager: Yarn (recommended) or npm — see `template.json`

Create a project from this template:

```bash
npm create scaffold-hbar@latest -- --template blank
```

`npx create-scaffold-hbar@latest --template blank` is equivalent. The CLI also asks for frontend, Solidity framework, network, and package manager.

## Work from this repository

This branch uses Yarn workspaces, so clone-and-run needs Yarn. Apps created with the CLI can use Yarn (default) or npm; see the [docs](https://docs.hedera.com/solutions/tools/scaffold-hbar/index).

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 22.23.4 and < 23
- [Git](https://git-scm.com/) with `user.name` and `user.email` configured
- [Yarn](https://yarnpkg.com/) (default; required if you clone this repo) or npm if you scaffolded with the CLI. For Yarn, install via Corepack:
  ```bash
  corepack enable && corepack prepare yarn@stable --activate
  ```
- **If using Foundry:** [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`, `anvil`)

### Quick start

```bash
yarn install

# Terminal 1: local Hedera-forked node
yarn hardhat:chain

# Terminal 2: deploy to that node (8545)
yarn hardhat:deploy --network localhost

# Terminal 3: Next.js app
yarn next:start
```

Open [http://localhost:3000](http://localhost:3000) and use the **Debug Contracts** page.

Frontend only (no local chain):

```bash
yarn install
yarn next:dev
```

`yarn hardhat:deploy` without `--network localhost` targets the in-process `hardhat` network, not the long-running fork. Local Hardhat and Foundry workflows are in [`packages/hardhat/README.md`](packages/hardhat/README.md) and [`packages/foundry/README.md`](packages/foundry/README.md). Deploy and verify on testnet/mainnet: [Hedera docs](https://docs.hedera.com/solutions/tools/scaffold-hbar/index#deploying-to-testnet).

## Project layout

- **packages/hardhat** — Hardhat config, contracts, `deploy/` scripts, tests
- **packages/foundry** — Forge config, contracts, `script/` deploy scripts, tests
- **packages/nextjs** — Next.js app, RainbowKit, wagmi, scaffold config

Network and RPC URLs are in `packages/hardhat/hardhat.config.ts` and `packages/foundry/foundry.toml` respectively.

## Links

- [Scaffold HBAR docs](https://docs.hedera.com/solutions/tools/scaffold-hbar/index)
- [create-scaffold-hbar](https://github.com/hedera-dev/create-scaffold-hbar) — CLI
- [Hedera Portal faucet](https://portal.hedera.com/faucet)
- [HashScan](https://hashscan.io/)
