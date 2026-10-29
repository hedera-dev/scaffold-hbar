# Scaffold-HBAR — Oracles

Hedera oracle dApp template: **Chainlink**, **Supra**, and **Pyth** adapters normalize feeds into one `IPriceOracle` interface; an `OracleConsumer` demo converts amounts with `priceE18`. Next.js dashboard reads deployed adapters and the active consumer.

CLI key: `oracles` (branch `templates/oracles`).

```text
Provider feed → Multi-pair provider adapter → OracleConsumer demo
```

Each provider adapter normalizes upstream prices into the shared `IPriceOracle` interface. The demo consumer stores one selected adapter and can be switched to another provider after deployment.

General Scaffold-HBAR docs: [Scaffold HBAR on Hedera](https://docs.hedera.com/solutions/tools/scaffold-hbar/index). Architecture, provider limitations, env vars, and Makefile targets: [packages/foundry/README.md](packages/foundry/README.md).

## Disclaimer

This template—including **contracts, frontend, and tooling**—is **experimental** and **not audited**. Do not use it in production without proper security review and your own due diligence.

## What's in this template

- **Foundry-only** monorepo (adapters, consumer, Forge scripts, tests, ABI generation)
- Provider adapters: `ChainlinkPriceOracleAdapter`, `SupraPriceOracleAdapter`, `PythPriceOracleAdapter`
- Next.js oracle dashboard + Debug Contracts
- Deploy exports → `packages/foundry/deployments/<chainId>.json` → `packages/nextjs/contracts/deployedContracts.ts`

Create a project:

```bash
npm create scaffold-hbar@latest -- --template oracles
```

## Prerequisites

- Node.js ≥ 22.23.4 and < 23 (see `.nvmrc`), Git
- Yarn (default; required if you clone this repo) or npm if you scaffolded with the CLI
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`)
- A Hedera-created, funded account for testnet/mainnet deploys

## Quick start

### Install

```bash
yarn install
git submodule update --init --recursive
```

### Account, compile, test

```bash
yarn foundry:account:generate   # or yarn foundry:account:import
# Fund via https://portal.hedera.com/faucet

yarn foundry:compile
yarn foundry:test               # local unit tests
```

### Frontend

```bash
yarn next:dev
```

Open [http://localhost:3000](http://localhost:3000).

## Foundry oracle workflow

Run from the repo root. Pattern for each provider: **fork smoke test → deploy adapter → deploy consumer → read prices**.

### Chainlink

```bash
yarn foundry:test:chainlink:testnet
yarn foundry:deploy:chainlink:testnet
ORACLE_ADAPTER_NAME=ChainlinkPriceOracleAdapter yarn foundry:deploy:consumer:testnet
yarn foundry:read:chainlink:testnet
```

Check the deployment export:

```bash
cat packages/foundry/deployments/296.json
```

### Supra

```bash
yarn foundry:test:supra:testnet
yarn foundry:deploy:supra:testnet
ORACLE_ADAPTER_NAME=SupraPriceOracleAdapter yarn foundry:deploy:consumer:testnet
yarn foundry:read:supra:testnet
```

Switch an existing consumer to Supra:

```bash
ORACLE_ADAPTER_NAME=SupraPriceOracleAdapter yarn foundry:set-oracle:testnet
```

### Pyth

Pyth is a **pull oracle** — read scripts fetch fresh Hermes update data and may broadcast update transactions (and pay update fees) before reading on-chain.

```bash
yarn foundry:test:pyth:testnet
yarn foundry:deploy:pyth:testnet
ORACLE_ADAPTER_NAME=PythPriceOracleAdapter yarn foundry:deploy:consumer:testnet
yarn foundry:read:pyth:testnet
```

Switch an existing consumer to Pyth:

```bash
ORACLE_ADAPTER_NAME=PythPriceOracleAdapter yarn foundry:set-oracle:testnet
```

Use `:mainnet` variants of the above commands for mainnet (at your own risk).

## Frontend workflow

Foundry deploy scripts export addresses to `packages/foundry/deployments/<chainId>.json`. The ABI generator reads that file and writes `packages/nextjs/contracts/deployedContracts.ts`, which the Next.js app uses for scaffold hooks and dashboard state.

- If `deployments/296.json` lists only one adapter, the frontend should only treat **that** adapter as deployed.
- Foundry `broadcast/` files are execution history — they do **not** populate the dashboard.

```bash
yarn next:dev
yarn next:check-types
yarn next:build
```

Connect a wallet on the same network you deployed to. Use **`/debug`** for raw contract calls or the main dashboard for oracle reads.

## Verification

Hedera testnet (`296`) and mainnet (`295`) verify through [Sourcify](https://sourcify.dev/); HashScan shows verified status after a successful match.

```bash
yarn foundry:verify:testnet 0xAdapterAddress \
  contracts/oracle/adapters/ChainlinkPriceOracleAdapter.sol:ChainlinkPriceOracleAdapter

yarn foundry:verify:testnet 0xAdapterAddress \
  contracts/oracle/adapters/SupraPriceOracleAdapter.sol:SupraPriceOracleAdapter

yarn foundry:verify:testnet 0xAdapterAddress \
  contracts/oracle/adapters/PythPriceOracleAdapter.sol:PythPriceOracleAdapter
```

Use `yarn foundry:verify:mainnet` with the same contract identifier format for mainnet.

## Customization

- **Networks, feeds, pair IDs, Pyth price IDs:** `packages/foundry/script/HelperConfig.s.sol`
- **New provider adapters:** add under `packages/foundry/contracts/oracle/adapters/`, wire deploy/read scripts, update `HelperConfig`
- **Before broadcasting:** run `yarn foundry:compile` and the relevant `yarn foundry:test:<provider>:testnet` fork smoke test

See [packages/foundry/README.md](packages/foundry/README.md) for architecture diagrams, provider-specific limitations, and Makefile shortcuts.

## Scripts (root)

| Command | Description |
| --- | --- |
| `yarn foundry:compile` / `yarn foundry:test` | Build + local Forge tests |
| `yarn foundry:test:<provider>:testnet` | Provider fork smoke tests |
| `yarn foundry:deploy:<provider>:testnet` | Deploy adapter |
| `yarn foundry:deploy:consumer:testnet` | Deploy `OracleConsumer` (set `ORACLE_ADAPTER_NAME`) |
| `yarn foundry:read:<provider>:testnet` | Read prices from CLI |
| `yarn foundry:set-oracle:testnet` | Point consumer at another adapter |
| `yarn foundry:verify:testnet` / `:mainnet` | Sourcify verify (HashScan) |
| `yarn next:dev` / `yarn next:build` | Frontend dashboard |
| `yarn lint` / `yarn format` | Next.js + Foundry lint/format |

## Project layout

```
packages/foundry/
  contracts/oracle/   adapters/, OracleConsumer, IPriceOracle
  script/           deploy/read/set-oracle scripts, HelperConfig.s.sol
  deployments/      <chainId>.json exports (source of truth for frontend)
  test/             unit + fork smoke tests
packages/nextjs/
  app/              oracle dashboard, /debug
  contracts/        deployedContracts.ts (generated), externalContracts.ts
```

Network and RPC configuration: `packages/foundry/foundry.toml`.

## Links

- [Scaffold HBAR docs](https://docs.hedera.com/solutions/tools/scaffold-hbar/index)
- [Hedera Documentation](https://docs.hedera.com/)
- [create-scaffold-hbar](https://github.com/hedera-dev/create-scaffold-hbar) — CLI
- [Foundry Book](https://book.getfoundry.sh/)
- [Hedera Portal faucet](https://portal.hedera.com/faucet)
- [Hashscan](https://hashscan.io/testnet)
- [Sourcify](https://sourcify.dev/)

## License

Open source under the [MIT License](https://opensource.org/licenses/MIT). Solidity sources in `packages/foundry/contracts` use `SPDX-License-Identifier: MIT` unless a file states otherwise.
