# Scaffold-HBAR

A Hedera-ready monorepo for building dApps with Next.js, Hardhat or Foundry, and Hedera networks (testnet, mainnet, local fork).

The full product guide — templates, CLI flags, npm vs Yarn, deploy, and verify — lives in [Scaffold HBAR on Hedera docs](https://docs.hedera.com/solutions/tools/scaffold-hbar/index). This README is for people landing on the repo: create a project, or clone `main` and run it.

## Create a project

```bash
npm create scaffold-hbar@latest
```

`npx create-scaffold-hbar@latest` is equivalent. The CLI fetches starter templates from this repo's `templates/*` branches.

To pass flags through `npm create`, put `--` before them: `npm create scaffold-hbar@latest my-app -- --template org/repo`. Without it, npm treats `--template` as its own setting and the CLI scaffolds its default template; npm 11 at least warns `Unknown cli config "--template"`. `npx create-scaffold-hbar@latest my-app --template org/repo` needs no `--`.

## Work from this repository

`main` is the forkable baseline. Clone-and-run uses Yarn workspaces. Apps created with the CLI can use Yarn (default) or npm; see the [docs](https://docs.hedera.com/solutions/tools/scaffold-hbar/index).

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 20.18.3
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

