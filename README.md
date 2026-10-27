# Scaffold-HBAR — Cross-chain DCA

Hedera schedules recurring DCA executions on-chain (Hedera Schedule Service, HIP-1215). Each cycle dispatches a cross-chain message via **Axelar GMP** to a **Uniswap v3** swap on **Ethereum Sepolia**.

CLI key: `cross-chain-dca` (branch `templates/cross-chain-dca`).

```
Hedera (DcaOrchestrator)
  └─ Schedule Service precompile (0x16b) — self-reschedule
  └─ Axelar Gateway → callContract("ethereum-sepolia", ...)
        └─ Axelar relayer network
              └─ Sepolia (DcaExecutor)
                    └─ Uniswap v3 exactInputSingle
```

> **Demo limitation — swap proceeds are not user-owned on Sepolia.** Tokens purchased by `DcaExecutor` accumulate in the contract (`address(this)`), not in the Hedera plan creator's wallet. Only the deployer (contract owner) can withdraw via `yarn hardhat:sepolia:withdraw:executor`. Intentional for this demo — production would track per-user balances.

General Scaffold-HBAR docs: [Scaffold HBAR on Hedera](https://docs.hedera.com/solutions/tools/scaffold-hbar/index). Contract layout, scripts, and env vars: [packages/hardhat/README.md](packages/hardhat/README.md).

## What's in this template

- **Hardhat-only** monorepo (Hedera + Sepolia contracts and scripts)
- Next.js DCA dashboard at `/dca` (create/cancel plans, execution log)
- One-command deploy: `yarn hardhat:deploy` (10 steps: compile, deploy both chains, wire, fund, plan, verify)

This template deploys to **live testnets only** — not a local Hardhat chain.

Create a project:

```bash
npm create scaffold-hbar@latest -- --template cross-chain-dca
```

## Prerequisites

- Node.js ≥ 22.23.4 and < 23, Git
- **Hedera testnet account** — [portal.hedera.com](https://portal.hedera.com) + faucet
- **Sepolia RPC URL** — e.g. [Alchemy](https://dashboard.alchemy.com) (`https://eth-sepolia.g.alchemy.com/v2/<KEY>`)
- **Sepolia ETH** — [sepolia-faucet.pk910.de](https://sepolia-faucet.pk910.de/) or [Alchemy Sepolia faucet](https://www.alchemy.com/faucets/ethereum-sepolia)
- **Sepolia USDC** — [faucet.circle.com](https://faucet.circle.com/)
- **Etherscan API key** — [etherscan.io/myapikey](https://etherscan.io/myapikey) (Sepolia verification)

## Quick start

```bash
yarn install

yarn hardhat:account:generate   # once for Hedera, once for Sepolia
```

Fund both accounts before deploying:

- **Hedera testnet** — [portal.hedera.com/faucet](https://portal.hedera.com/faucet)
- **Sepolia ETH** + **USDC** — faucets above

```bash
yarn hardhat:deploy
yarn next:dev                   # http://localhost:3000/dca
```

### What `yarn hardhat:deploy` does

The script prompts interactively before touching any network:

| Prompt | When |
| --- | --- |
| Sepolia RPC URL | Only if not already in `.env` |
| Hedera key password | Every run |
| Sepolia key password | Every run |
| Etherscan API key | Only if not already in `.env` |
| Confirmation | Always — shows full config before proceeding |

Then runs all 10 steps automatically:

1. Compile all contracts
2. Deploy `DcaOrchestrator` + `AxelarMessageSender` to Hedera testnet
3. Deploy `DcaExecutor` + `AxelarMessageReceiver` to Sepolia
4. Wire Hedera — set Sepolia receiver as Axelar destination
5. Wire Sepolia — set Hedera sender as expected Axelar source
6. Fund `DcaOrchestrator` with HBAR (Axelar relay gas)
7. Fund `DcaExecutor` with USDC (swap capital)
8. Create the first DCA plan
9. Verify Hedera contracts on Sourcify
10. Verify Sepolia contracts on Etherscan

After deployment, `packages/nextjs/contracts/deployedContracts.ts` is auto-generated — do not edit manually; it is overwritten on every deploy.

## Manual deployment

Use when re-running individual steps after a partial failure or customizing the sequence.

### Environment

```bash
cp packages/hardhat/.env.example packages/hardhat/.env
```

Full variable reference: [packages/hardhat/README.md#setup](packages/hardhat/README.md).

### Accounts

```bash
yarn hardhat:account:generate
yarn hardhat:account:import
yarn hardhat:account
```

### Compile and deploy

```bash
yarn hardhat:compile

yarn hardhat:hedera:deploy
yarn hardhat:sepolia:deploy
yarn hardhat:hedera:wire
yarn hardhat:sepolia:wire
```

### Fund

```bash
yarn hardhat:hedera:fund
yarn hardhat:sepolia:fund:usdc
```

### Create and manage plans

```bash
yarn hardhat:hedera:plan:create
```

| Variable | Default | Description |
| --- | --- | --- |
| `AMOUNT_PER_EXECUTION` | `1000000` | Source amount per cycle in base units (1 USDC = 1_000_000) |
| `FEE_FOR_SENDER` | `1` | HBAR forwarded per execution for Axelar relay gas |
| `INTERVAL_SECONDS` | `60` | Seconds between executions (minimum 60) |
| `TARGET_TOKEN` | Sepolia WETH | Token address to purchase on Sepolia |
| `MAX_EXECUTIONS` | `3` | `0` = unlimited |

```bash
yarn hardhat:hedera:plan:latest
yarn hardhat:hedera:plan:cancel      # set CANCEL_PLAN_ID in .env first
yarn hardhat:hedera:plan:reschedule
yarn hardhat:sepolia:balance:check
```

### Verify and withdraw

```bash
yarn hardhat:hedera:verify
yarn hardhat:sepolia:verify

yarn hardhat:hedera:withdraw:orchestrator
yarn hardhat:hedera:withdraw:sender
yarn hardhat:sepolia:withdraw:executor
yarn hardhat:sepolia:withdraw:receiver
```

## Test

```bash
yarn hardhat:hedera:test    # Hedera unit tests — no live RPC
yarn hardhat:sepolia:test   # Sepolia unit tests — no live RPC
```

## Frontend

Navigate to [http://localhost:3000/dca](http://localhost:3000/dca). Connect wallet to **Hedera testnet** (chain 296) to create/cancel plans. The execution log loads both chains read-only without a wallet.

### Create plan

Form submits a new DCA plan to `DcaOrchestrator`. Requires Hedera testnet wallet.

| Field | Default | Description |
| --- | --- | --- |
| Amount per execution (USDC) | 1 | USDC swapped each cycle |
| Relay fee per execution (HBAR) | 1 | HBAR for Axelar relay gas |
| Interval (seconds) | 3600 | Minimum 60 s |
| Max executions | 0 | `0` = unlimited |
| Target token (Sepolia) | Sepolia WETH | Purchased via Uniswap v3 |

### Active plans

Live table from `DcaOrchestrator` — no wallet required.

| Column | Description |
| --- | --- |
| ID | Plan ID |
| Amount | USDC per execution |
| Interval | Hours or seconds |
| Executions | `count / max` (∞ when unlimited) |
| Status | `active`, `completed`, or `cancelled` |
| Action | Cancel (plan owner, active plans only) |

### Execution log

Last ~10k blocks from both chains with live updates (~5 h Hedera, ~33 h Sepolia at typical block times).

**Hedera — `DcaOrchestrator.ExecutionTriggered`**

| Column | Description |
| --- | --- |
| Block | Hedera block number |
| Plan ID | Triggered plan |
| Execution # | Cumulative count for that plan |

**Sepolia — `DcaExecutor.SwapExecuted`**

| Column | Description |
| --- | --- |
| Block | Sepolia block number |
| Plan ID | Matching Hedera plan ID |
| Amount In | USDC to Uniswap v3 |
| Amount Out | Tokens received |
| Token Out | Target token address |

## Project layout

```
packages/hardhat/
  contracts/hedera/    DcaOrchestrator, AxelarMessageSender
  contracts/sepolia/   DcaExecutor, AxelarMessageReceiver
  scripts/             deployAll.ts, hedera/*, sepolia/*
packages/nextjs/
  app/dca/             DCA dashboard UI
  contracts/           deployedContracts.ts (generated)
```

## Links

- [packages/hardhat/README.md](packages/hardhat/README.md) — contracts, scripts, env vars
- [Scaffold HBAR docs](https://docs.hedera.com/solutions/tools/scaffold-hbar/index)
- [create-scaffold-hbar](https://github.com/hedera-dev/create-scaffold-hbar) — CLI
- [Hedera Documentation](https://docs.hedera.com/)
- [Axelar Documentation](https://docs.axelar.dev/)
- [Hashscan testnet](https://hashscan.io/testnet)

## License

Open source under the [MIT License](https://opensource.org/licenses/MIT).
