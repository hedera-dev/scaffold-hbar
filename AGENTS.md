# Cross-Chain DCA Agent Guide

Guidance for coding agents working in the **cross-chain-dca** Scaffold-HBAR template.

## Documentation

Search Hedera documentation with the `SearchHedera` tool on the `hedera-docs` MCP server before writing Hedera-specific code.

## Overview

Hedera schedules recurring DCA executions via **HSS**, sends each cycle over **Axelar GMP** to Sepolia, where a **Uniswap v3** swap runs (demo: USDC → WETH). Proceeds stay in `DcaExecutor` (owner withdraw only).

## Solidity Framework

**Hardhat-only** monorepo (no Foundry package):

- **`packages/hardhat`** — Hedera + Sepolia contracts, deploy/wire/fund scripts, tests
- **`packages/nextjs`** — DCA UI at `/dca`

## Architecture

```text
Hedera                                      Sepolia
─────────────────────────────────────────   ─────────────────────────────────
DcaOrchestrator ──IBridgeSender.send──►     AxelarMessageReceiver (_execute)
     │ HSS 0x16b                                    │ IDcaHandler
AxelarMessageSender                         DcaExecutor (Uniswap v3 swap)
```

### Critical invariants

- Gas paid on Hedera **before** `gateway.callContract`.
- Axelar chain names are strings (`hedera`, `ethereum-sepolia`) — not `296` / `11155111`.
- Wire peers **after** both sides deploy (`setDestinationAddress` / `setExpectedSourceAddress`).
- Payload encode/decode must match on both sides.
- Orchestrator funded with HBAR (relay gas); executor funded with USDC (swap capital).
- Demo: swap recipient is `DcaExecutor` itself — not the plan owner.

## Key Paths

| Path | Purpose |
| ---- | ------- |
| `packages/hardhat/contracts/hedera/DcaOrchestrator.sol` | HSS-scheduled DCA plans + bridge dispatch |
| `packages/hardhat/contracts/hedera/AxelarMessageSender.sol` | Hedera GMP sender (`IBridgeSender`) |
| `packages/hardhat/contracts/hedera/interfaces/IBridgeSender.sol` | Bridge abstraction |
| `packages/hardhat/contracts/hedera/interfaces/IHederaScheduleService.sol` | HSS (`0x16b`) |
| `packages/hardhat/contracts/sepolia/AxelarMessageReceiver.sol` | `AxelarExecutable` + allowlist |
| `packages/hardhat/contracts/sepolia/DcaExecutor.sol` | Uniswap v3 `exactInputSingle` |
| `packages/hardhat/contracts/sepolia/interfaces/IDcaHandler.sol` | Destination handler iface |
| `packages/hardhat/scripts/deployAll.ts` | Full 10-step orchestrator |
| `packages/hardhat/scripts/hedera/*.ts` | Deploy / wire / fund / plan / verify |
| `packages/hardhat/scripts/sepolia/*.ts` | Deploy / wire / fund USDC / verify |
| `packages/hardhat/config/deployed-addresses.json` | Local deploy state (gitignored) |
| `packages/nextjs/contracts/deployedContracts.ts` | Generated for frontend |
| `packages/nextjs/app/dca/` | Marketplace UI |

## Interfaces & Payload

### `IBridgeSender` (Hedera)

```solidity
function send(
    uint256 planId,
    uint256 amountPerExecution,
    address targetToken,
    uint256 minAmountOut
) external payable;
```

### `IDcaHandler` (Sepolia)

```solidity
function handleDcaExecution(
    uint256 planId,
    uint256 amountIn,
    address tokenOut,
    uint256 minAmountOut
) external;
```

### GMP payload

```solidity
bytes memory payload = abi.encode(planId, amountPerExecution, targetToken, minAmountOut);
// receiver:
(uint256 planId, uint256 amountIn, address tokenOut, uint256 minAmountOut) =
    abi.decode(payload, (uint256, uint256, address, uint256));
```

## Addresses & Config

Re-check [Axelar docs](https://docs.axelar.dev/resources/contract-addresses/testnet) before mainnet.

### Axelar (testnet)

| Role | Env var | Address / value |
| ---- | ------- | --------------- |
| Hedera gateway | `AXELAR_GATEWAY_HEDERA` | `0xe432150cce91c13a887f7D836923d5597adD8E31` |
| Hedera gas service | `AXELAR_GAS_SERVICE_HEDERA` | `0xbE406F0189A0B4cf3A05C286473D23791Dd44Cc6` |
| Sepolia gateway | `AXELAR_GATEWAY_SEPOLIA` | `0xe432150cce91c13a887f7D836923d5597adD8E31` |
| Dest chain name | `AXELAR_DESTINATION_CHAIN_NAME` | `ethereum-sepolia` |
| Source chain name | `AXELAR_SOURCE_CHAIN_NAME` | `hedera` |

### Uniswap v3 (Sepolia)

| Item | Env / constant | Value |
| ---- | -------------- | ----- |
| Router | `UNISWAP_ROUTER` | `0x65669fE35312947050C450Bd5d36e6361F85eC12` |
| Source token (USDC) | `USDC_ADDRESS` | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| Default target (WETH) | `TARGET_TOKEN` | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` |
| Pool fee | `POOL_FEE` | `3000` (0.3%) |
| Deadline | — | `block.timestamp + 300` |
| Recipient | — | `address(this)` on `DcaExecutor` |

No pool address hardcoded — `exactInputSingle` resolves the pool.

### HSS

- System contract: `address(0x16b)`
- Success: `RESPONSE_SUCCESS = 22`
- Schedule gas limit in orchestrator: `4_000_000`
- Recovery: `needsReschedule[planId]` + `reschedule(planId)` / `scripts/hedera/reschedulePlan.ts`

### Env vars (`packages/hardhat/.env.example`)

| Var | Purpose |
| --- | ------- |
| `HEDERA_RPC_URL` | Default `https://testnet.hashio.io/api` |
| `HEDERA_DEPLOYER_PRIVATE_KEY_ENCRYPTED` | Set by account generate/import |
| `HEDERA_CHAIN_ID` | `296` |
| `SEPOLIA_RPC_URL` | Sepolia RPC |
| `ETH_DEPLOYER_PRIVATE_KEY_ENCRYPTED` | Set by account generate/import |
| `SEPOLIA_CHAIN_ID` | `11155111` |
| `ETHERSCAN_API_KEY` | Sepolia verify |
| Axelar + Uniswap vars | See tables above |
| `ORCHESTRATOR_FUND_AMOUNT` | Default `10` HBAR |
| `FUND_USDC_AMOUNT` | Default `5` USDC |

Plan overrides (createPlan / deployAll): `AMOUNT_PER_EXECUTION`, `FEE_FOR_SENDER`, `INTERVAL_SECONDS`, `TARGET_TOKEN`, `MIN_AMOUNT_OUT`, `MAX_EXECUTIONS`, `CANCEL_PLAN_ID`.

**Next.js:** `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`, optional Hedera RPC URLs.

## Commands

```bash
yarn hardhat:account:generate   # or :import
yarn hardhat:compile

# Full 10-step deploy + wire + fund + plan + verify
yarn hardhat:deploy

# Piecemeal
yarn hardhat:hedera:deploy|wire|fund|verify
yarn hardhat:sepolia:deploy|wire|fund:usdc|balance:check|verify
yarn hardhat:hedera:plan:create|cancel|reschedule|latest
yarn hardhat:hedera:withdraw:orchestrator|sender
yarn hardhat:sepolia:withdraw:executor|receiver

# Tests
yarn hardhat:hedera:test
yarn hardhat:sepolia:test

# UI
yarn next:dev   # http://localhost:3000/dca
```

### Deploy / wire sequence (`yarn hardhat:deploy` → `scripts/deployAll.ts`)

1. Compile
2. Deploy Hedera (`AxelarMessageSender` + `DcaOrchestrator`) — `scripts/hedera/deploy.ts`
3. Deploy Sepolia (`DcaExecutor` + `AxelarMessageReceiver`) — `scripts/sepolia/deploy.ts`
4. Wire Hedera destination — `scripts/hedera/wire.ts`
5. Wire Sepolia source — `scripts/sepolia/wire.ts`
6. Fund orchestrator HBAR — `scripts/hedera/fundOrchestrator.ts`
7. Fund executor USDC — `scripts/sepolia/fundUsdc.ts`
8. Create DCA plan — `scripts/hedera/createPlan.ts`
9. Verify Hedera (Sourcify) — `scripts/hedera/verify.ts`
10. Verify Sepolia (Etherscan) — `scripts/sepolia/verify.ts`

Also regenerates `packages/nextjs/contracts/deployedContracts.ts`.
