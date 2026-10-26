# Agent instructions

Briefing for coding agents in this app (Cursor, Claude Code, Codex). Claude Code loads it through `CLAUDE.md`.

**Foundry-only** Hedera template: **ScheduledVault** + **ScheduledVaultFactory** with pluggable **IExecutionStrategy** contracts, driven by **Hedera Schedule Service (HSS)** at `0x000000000000000000000000000000000000016B`. Example strategy: **MemejobDCAStrategy** (MemeJob DCA). Next.js UI for creating/configuring vaults.

**HSS runs on Hedera testnet/mainnet only** — not on local Anvil or Hedera forks. Local `forge test` uses mocks; real schedule execution requires live network deploy.

Use `yarn` unless this project was created with another package manager.

## Documentation

Search Hedera documentation with the `SearchHedera` tool on the `hedera-docs` MCP server before writing Hedera-specific code.

## Commands

```bash
yarn install

yarn foundry:account:generate   # or :import — fund on testnet
yarn foundry:compile
yarn foundry:test               # unit tests (mock HSS)
yarn foundry:deploy:testnet     # Deploy.s.sol → factory + example strategy
yarn foundry:deploy:mainnet
yarn foundry:verify:testnet <addr> contracts/ScheduledVaultFactory.sol:ScheduledVaultFactory

yarn next:dev                   # http://localhost:3000
yarn next:build
yarn lint
yarn format
```

Optional: `yarn foundry:chain` (Anvil), `yarn foundry:test:local`, `yarn foundry:test:testnet` (fork; no real HSS).

Deploy scripts: `script/Deploy.s.sol` (default), `DeployFactory.s.sol`, `DeployMemejobDCAStrategy.s.sol`.

## Architecture

```text
HSS → ScheduledVault.executeScheduled() → IExecutionStrategy.plan() → Action[] → targets → scheduleNextRun()
```

| Contract | Role |
|---|---|
| `ScheduledVaultFactory` | `createVault(strategy)` per user |
| `ScheduledVault` | Custody, config, HSS scheduling, execute strategy actions |
| `MemejobDCAStrategy` | Example DCA strategy (MemeJob buy/sell) |
| `IExecutionStrategy` | `validateConfig(bytes)` + `plan(bytes) → Action[]` |

Typical lifecycle: create vault → `configure(bytes, interval)` → `scheduleNextRun()` → each tick `executeScheduled()` (auto-reschedule on success).

## Key paths

| Path | Purpose |
|---|---|
| `packages/foundry/contracts/ScheduledVault.sol` | Core vault + HSS integration |
| `packages/foundry/contracts/ScheduledVaultFactory.sol` | Vault factory |
| `packages/foundry/contracts/strategies/MemejobDCAStrategy.sol` | Example strategy |
| `packages/foundry/contracts/interfaces/IExecutionStrategy.sol` | Strategy plugin API |
| `packages/foundry/script/Deploy.s.sol` | Default deploy |
| `packages/foundry/foundry.toml` | RPC: `hedera_testnet`, `hedera_mainnet` |
| `packages/foundry/deployments/<chainId>.json` | Deployment export |
| `packages/nextjs/contracts/deployedContracts.ts` | Generated ABIs/addresses (after deploy) |
| `packages/nextjs/app/page.tsx` | Memejob DCA dashboard |
| `packages/nextjs/components/CreateVaultCard.tsx`, `VaultDashboard.tsx` | Vault UI |
| `packages/nextjs/hooks/scaffold-hbar/useLatestUserVault.ts` | Resolve user's vault |

Env: `packages/foundry/.env` from `.env.example` (keystore account, RPC). `packages/nextjs/.env` — `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`, optional Hedera RPC URLs.

## Frontend

Hooks in `packages/nextjs/hooks/scaffold-hbar`. Use existing names (`useScaffoldReadContract`, `useScaffoldWriteContract`, etc.).

UI: `@scaffold-hbar-ui/components`. DaisyUI for layout. Import app code with `~~` alias.

Networks: `packages/nextjs/scaffold.config.ts` — Hedera testnet/mainnet.

## Adding a strategy

1. Implement `IExecutionStrategy` (`validateConfig` + `plan`).
2. Add tests under `packages/foundry/test/strategies/`.
3. Add deploy script or extend `Deploy.s.sol`.
4. Wire frontend if the template should expose the new strategy.

## Code style

Prefer `type` over `interface`. Match surrounding naming. Comments only for non-obvious HSS/strategy behavior.
