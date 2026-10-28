# Scaffold-HBAR — Payments scheduler

Recurring on-chain execution on Hedera via **Schedule Service (HSS)**: a generic **ScheduledVault** custodies funds and runs pluggable **IExecutionStrategy** plugins on each schedule tick. Example strategy: **MemejobDCAStrategy** (MemeJob DCA buy/sell).

CLI key: `payments-scheduler` (branch `templates/payments-scheduler`).

> **HSS is testnet/mainnet only** — Schedule Service is not available on Hedera forks or local Anvil. Deploy and run schedules on live Hedera networks. Forge tests use a mock HSS locally; real schedule execution requires testnet or mainnet.

General Scaffold-HBAR docs: [Scaffold HBAR on Hedera](https://docs.hedera.com/solutions/tools/scaffold-hbar/index). Architecture, lifecycle, Makefile, and verification: [packages/foundry/README.md](packages/foundry/README.md).

## Disclaimer

This template—including **contracts, frontend, and tooling**—is **experimental** and **not audited**. Do not use it in production without proper security review and your own due diligence.

## What's in this template

- **Foundry-only** monorepo — `ScheduledVault`, `ScheduledVaultFactory`, example `MemejobDCAStrategy`
- Next.js **Memejob DCA** UI at `/` — create vault, configure DCA, deposit/withdraw, monitor schedule status
- **Debug Contracts** at `/debug` and block explorer at `/blockexplorer`
- Deploy exports → `packages/foundry/broadcast/` → `packages/nextjs/contracts/deployedContracts.ts`

Create a project:

```bash
npm create scaffold-hbar@latest -- --template payments-scheduler
```

## Prerequisites

- Node.js ≥ 22.23.4 and < 23, Git
- Yarn (default; required if you clone this repo) or npm if you scaffolded with the CLI
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`, `anvil`)
- Hedera testnet account — fund via [portal.hedera.com](https://portal.hedera.com/faucet)

After cloning, from the repo root:

```bash
yarn install
```

In `packages/foundry`, install Solidity dependencies once:

```bash
cd packages/foundry
forge install foundry-rs/forge-std gnsps/solidity-bytes-utils hashgraph/hedera-forking
cd ../..
```

## Quick start

### 1. Deployer account

```bash
yarn foundry:account:generate
yarn foundry:account
```

Fund the deployer via the [Hedera Portal Faucet](https://portal.hedera.com/faucet). Use a **Hedera-created** account for keystores (see [packages/foundry/README.md](packages/foundry/README.md)).

### 2. Compile and test

```bash
yarn foundry:compile
yarn foundry:test               # local unit tests (mock HSS)
```

Optional fork tests (no real HSS): `yarn foundry:test:testnet`, `yarn foundry:test:local` (requires `yarn foundry:chain`).

### 3. Deploy to Hedera testnet

```bash
yarn foundry:deploy:testnet
```

Deploys `ScheduledVaultFactory` and the example `MemejobDCAStrategy` via `Deploy.s.sol`. ABIs and addresses are regenerated in `packages/nextjs/contracts/deployedContracts.ts`.

Use `yarn foundry:deploy:mainnet` for mainnet (at your own risk).

### 4. Verify (optional)

```bash
yarn foundry:verify:testnet 0xYourFactory \
  contracts/ScheduledVaultFactory.sol:ScheduledVaultFactory
```

Verified contracts appear on [Hashscan](https://hashscan.io/testnet).

### 5. Frontend

```bash
yarn next:dev
```

Open [http://localhost:3000](http://localhost:3000), connect a wallet on **Hedera testnet**, and use:

- **`/`** — Memejob DCA vault UI (create vault, configure, deposit, schedule controls)
- **`/debug`** — call any deployed function without custom screens
- **`/blockexplorer`** — browse blocks and transactions

## How to use this template

### Customize contracts

- **Core contracts:** `packages/foundry/contracts/` — `ScheduledVault`, `ScheduledVaultFactory`, strategies under `contracts/strategies/` (Memejob DCA is an **example**; copy the pattern for your own `IExecutionStrategy`).
- **Deploy scripts:** `packages/foundry/script/` — `Deploy.s.sol`, or split scripts (`DeployFactory.s.sol`, `DeployMemejobDCAStrategy.s.sol`).
- **Networks:** `packages/foundry/foundry.toml` and `packages/nextjs/scaffold.config.ts`.

### Compile, test, deploy

```bash
yarn foundry:compile
yarn foundry:test
yarn foundry:deploy:testnet
```

`yarn foundry:deploy` runs ABI generation (`packages/foundry/scripts-js/generateTsAbis.js`) so the UI stays in sync with broadcast output.

### Integrate contracts in the frontend

- **Generated metadata:** `packages/nextjs/contracts/deployedContracts.ts` (after deploy)
- **Manual / external contracts:** `packages/nextjs/contracts/externalContracts.ts`
- **Hooks:** `packages/nextjs/hooks/scaffold-hbar/` — `useScaffoldReadContract`, `useScaffoldWriteContract`, `useScaffoldEventHistory`, etc.
- **Template-specific hooks:** `useCreateVault`, `useVaultData`, `useLatestUserVault` for the DCA flow

### Build product UI

- App routes: `packages/nextjs/app/` — DCA at `page.tsx` (`/`), components like `CreateVaultCard`, `DepositSection`, `ScheduleControls`, `VaultDashboard`
- **Navigation:** `packages/nextjs/components/Header.tsx` (`menuLinks`)
- **Styling:** prefer **DaisyUI** classes
- **@scaffold-hbar-ui/components** — `Address`, `Balance`, etc.

## Use cases and customization

| Use case | What the template gives you | Typical customization |
| --- | --- | --- |
| **Recurring on-chain actions** | Vault + HSS reschedule loop | Adjust vault parameters, failure handling, strategy `plan()` / config encoding |
| **DCA / scheduled swaps** | Example MemeJob strategy + DCA UI | Replace strategy with your DEX/router logic; reshape forms to your config struct |
| **Payment or allowance schedules** | Same vault abstraction | New `IExecutionStrategy` returning `Action[]` for transfers or approvals |
| **Learning / demo** | Debug page + block explorer | Strip example branding; add your own pages |

**Strategies:** Implement `IExecutionStrategy` (`validateConfig`, `plan`), deploy it, and create vaults via `ScheduledVaultFactory.createVault(strategy)`. Encode config off-chain the same way Solidity decodes it — see **Adding a new execution strategy** in [packages/foundry/README.md](packages/foundry/README.md).

## Scripts (root)

| Command | Description |
| --- | --- |
| `yarn foundry:compile` / `yarn foundry:test` | Build + Forge unit tests |
| `yarn foundry:deploy:testnet` / `:mainnet` | Deploy default `Deploy.s.sol` |
| `yarn foundry:verify:testnet` / `:mainnet` | Sourcify verify (HashScan) |
| `yarn foundry:chain` | Local Anvil (optional; HSS not supported) |
| `yarn foundry:account:generate` / `:import` | Keystore management |
| `yarn next:dev` / `yarn next:build` | Memejob DCA frontend |
| `yarn lint` / `yarn format` | Next.js + Foundry lint/format |

## Project layout

```
packages/foundry/
  contracts/     ScheduledVault, ScheduledVaultFactory, strategies/, interfaces/
  script/        Deploy.s.sol, DeployFactory.s.sol, …
  test/          ScheduledVault, factory, MemejobDCAStrategy (+ mocks)
  scripts-js/    generateTsAbis.js, keystore helpers
packages/nextjs/
  app/           / (DCA), /debug, /blockexplorer
  components/    CreateVaultCard, VaultDashboard, DepositSection, …
  hooks/         scaffold-hbar/, useCreateVault, useVaultData, …
  contracts/     deployedContracts.ts (generated), externalContracts.ts
```

## Links

- [Scaffold HBAR docs](https://docs.hedera.com/solutions/tools/scaffold-hbar/index)
- [Hedera Schedule Service](https://docs.hedera.com/hedera/core-concepts/smart-contracts/system-smart-contracts/hedera-schedule-service)
- [create-scaffold-hbar](https://github.com/hedera-dev/create-scaffold-hbar) — CLI
- [Foundry Book](https://book.getfoundry.sh/)
- [Hedera Portal faucet](https://portal.hedera.com/faucet)
- [Hashscan testnet](https://hashscan.io/testnet)

## License

Open source under the [MIT License](https://opensource.org/licenses/MIT). Solidity sources in `packages/foundry/contracts` use `SPDX-License-Identifier: MIT` unless a file states otherwise.
