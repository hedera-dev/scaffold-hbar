# Bridge Agent Guide

Guidance for coding agents working in the **bridge** Scaffold-HBAR template.

## Documentation

Search Hedera documentation with the `SearchHedera` tool on the `hedera-docs` MCP server before writing Hedera-specific code.

## Overview

Testnet-first **Sepolia ↔ Hedera Testnet** bridge learning kit. Pick one provider path (LayerZero OFT+HTS, Axelar ITS, or CCIP CCT), deploy via Foundry make runbooks, sync addresses into Next.js, exercise the UI. **Unaudited / educational — not for mainnet funds.**

## Solidity Framework

**Foundry-only** monorepo (no Hardhat contracts package) **+ git submodules**:

- **`packages/foundry`** — contracts, provider scripts (`script/{layerzero,axelar,ccip}`), Makefile, bridge sync
- **`packages/nextjs`** — bridge UI + `services/bridge/config/*.json`

```bash
yarn install && git submodule update --init --recursive
```

Key libs under `packages/foundry/lib/`: `LayerZero-v2`, `forge-std`, `openzeppelin-contracts`, `hedera-forking`, Axelar/CCIP deps, etc.

## Architecture (LayerZero path)

```text
MyOFT (Sepolia)  ←setPeer→  MyHTSConnectorOFT (Hedera)
       │ send / quoteSend          │ _debit burn / _credit mint (HTS 0x167)
       └──────── Endpoint V2 + ULN + (Simple or Labs) workers ────────┘
```

### Critical invariants

- Use LayerZero **EIDs** (`40161` / `40285`), not EVM chain IDs, in peers and `SendParam`.
- Wire **both** directions: peer + send/receive ULN + executor/ULN config + enforced options.
- Hedera side is **HTS connector** (`HTSConnector` / `MyHTSConnectorOFT`), not a plain ERC-20 OFT.
- Tutorial wires **SimpleDVNMock / SimpleExecutorMock** — packets are not auto-delivered by LZ Labs; relay manually or via UI key.
- Hedera → Sepolia: `quoteSend` via cast + scale fee `* 1e10` before `send` (forge fee sim unreliable).
- Associate Hedera account with `htsTokenAddress()` before Sepolia → Hedera receives.

### Contract names (LayerZero)

| Contract | Path | Role |
| -------- | ---- | ---- |
| `MyOFT` | `contracts/layerzero/MyOFT.sol` | Sepolia ERC-20 OFT (+ optional premint) |
| `MyHTSConnectorOFT` | `contracts/layerzero/hts/MyHTSConnectorOFT.sol` | Hedera concrete OFT |
| `HTSConnector` | `contracts/layerzero/hts/HTSConnector.sol` | Create HTS; burn on send / mint on receive |
| `SimpleDVNMock` / `SimpleExecutorMock` | `contracts/layerzero/` | Educational workers |

Sibling providers also live under `contracts/` (CCIP HTS pool, Axelar ITS helpers) — use their `make *-help` targets.

## Key Paths

| Path | Purpose |
| ---- | ------- |
| `packages/foundry/script/layerzero/HelperConfig.s.sol` | EIDs + Endpoint/ULN/DVN/executor |
| `packages/foundry/script/layerzero/` | Deploy / wire / send / relay scripts |
| `packages/foundry/Makefile` + `bridge-layerzero.sh` | `layerzero-*` / `bridge-sync-next` |
| `packages/foundry/deployments/bridge/layerzero.json` | Deploy state (gitignored) |
| `packages/nextjs/services/bridge/config/layerzero.json` | Synced frontend config |
| `packages/nextjs/app/` (bridge UI) | Send / relay UX |
| `packages/nextjs/app/api/bridge/layerzero/relay` | Educational auto-relay API |

## Addresses & Config

Source of truth: `HelperConfig.s.sol`. Re-check [LayerZero metadata](https://metadata.layerzero-api.com/v1/metadata/deployments) before mainnet.

### EIDs

| Network | Chain ID | EID |
| ------- | -------- | --- |
| Hedera testnet | `296` | `40285` |
| Ethereum Sepolia | `11155111` | `40161` |

### Hedera testnet (EID `40285`)

| Role | Address |
| ---- | ------- |
| Endpoint V2 | `0xbD672D1562Dd32C23B563C989d8140122483631d` |
| Send ULN302 | `0x1707575F7cEcdC0Ad53fde9ba9bda3Ed5d4440f4` |
| Receive ULN302 | `0xc0c34919A04d69415EF2637A3Db5D637a7126cd0` |
| Executor (LZ Labs) | `0xe514D331c54d7339108045bF4794F8d71cad110e` |
| DVN (LZ Labs) | `0xEc7Ee1f9e9060e08dF969Dc08EE72674AfD5E14D` |

### Sepolia (EID `40161`)

| Role | Address |
| ---- | ------- |
| Endpoint V2 | `0x6EDCE65403992e310A62460808c4b910D972f10f` |
| Send ULN302 | `0xcc1ae8Cf5D3904Cef3360A9532B477529b177cCE` |
| Receive ULN302 | `0xdAf00F5eE2158dD58E0d3857851c432E34A3A851` |
| Executor (LZ Labs) | `0x718B92b5CB0a5552039B593faF724D182A881eDA` |
| DVN (LZ Labs) | `0x8eebf8b423B73bFCa51a1Db4B7354AA0bFCA9193` |

HTS precompile: `0x167`. Tutorial passes deployed **simple workers** into wire; Labs addresses remain as config fallbacks.

### Hedera constants

| Constant | Default | Notes |
| -------- | ------- | ----- |
| `HEDERA_HTS_CREATE_VALUE` | `40ether` | Make/deploy path for connector create fee |
| `HEDERA_DEPLOY_GAS_LIMIT` | `15000000` | Hedera deploy txs |
| `HEDERA_TRANSFER_GAS_LIMIT` | `15000000` | Falls back to deploy limit |
| Enforced / quote `lzReceive` gas | `80_000` | WireOApp / SendOFT / UI |
| `LAYERZERO_RELAY_LZRECEIVE_GAS` | `500000` | Educational `commitAndExecute` |
| Fee scale (Hedera → EVM) | `* 1e10` | `VALUE = FEE * 1e10` after quote |
| Min amount | 90% (`* 9 / 10`) or `LAYERZERO_DEFAULT_MIN_AMOUNT_BPS=9000` | Slippage floor |
| HTS decimals | `18` | `HTSConnector` |

Hedera txs: `--legacy` + explicit gas price (HashIO / EIP-1559 quirks).

### Env vars

**`packages/foundry/.env`** (see `.env.example`): `HEDERA_TESTNET_RPC_URL`, `SEPOLIA_RPC_URL`, `ACCOUNT`, `LAYERZERO_TOKEN_NAME` / `SYMBOL`, `LAYERZERO_PREMINT_SEPOLIA`, `HEDERA_HTS_CREATE_VALUE`, gas limits/price, optional address overrides (`SEPOLIA_OFT`, `HEDERA_OFT`, `HEDERA_HTS_TOKEN`, `*_WORKERS_*`), plus Axelar/CCIP blocks.

**`packages/nextjs/.env`:** `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`, RPC URLs, **`LAYERZERO_RELAY_PRIVATE_KEY`** (server-only, testnet educational relay).

## Commands

Prefer provider make targets over generic `yarn foundry:deploy`.

```bash
cd packages/foundry
make layerzero-help

# 1) Deploy
make layerzero-deploy
# or: layerzero-deploy-sepolia → layerzero-deploy-hedera
#     → layerzero-deploy-workers-sepolia → layerzero-deploy-workers-hedera

# 2) Wire + verify
make layerzero-wire-sepolia
make layerzero-wire-hedera
make layerzero-verify-wiring

# 3) Associate HTS
make layerzero-associate-hedera [RECIPIENT=0x...]

# 4) Sync Next.js config
make bridge-sync-next PROVIDER=layerzero   # also: axelar | ccip | all

# 5) Send + educational relay
make layerzero-send-from-sepolia   # or layerzero-send-from-hedera
make layerzero-relay DIRECTION=sepolia-to-hedera TX=0x...
# DIRECTION=hedera-to-sepolia likewise

make layerzero-balances   # optional
```

Root yarn: `yarn foundry:account:generate`, `yarn foundry:compile`, `yarn foundry:test`, `yarn next:dev`.

Sibling providers: `make axelar-help`, `make ccip-help` (then `bridge-sync-next PROVIDER=…`).

### Suggested LayerZero order

1. Submodules + account + fund Sepolia & Hedera testnet
2. `make layerzero-deploy` (OFT + HTS connector + simple workers)
3. Wire both sides + `layerzero-verify-wiring`
4. Associate HTS; `bridge-sync-next PROVIDER=layerzero`
5. `yarn next:dev` — send small amounts; relay via UI key or `make layerzero-relay`

## Educational vs production relay

- Template uses **SimpleDVNMock + SimpleExecutorMock**; LZ Labs workers do not auto-deliver tutorial packets.
- Manual: `make layerzero-relay` (parse `PacketSent` → `verify` → `commitAndExecute`).
- UI auto-relay only with funded testnet `LAYERZERO_RELAY_PRIVATE_KEY`; otherwise follow make relay instructions.
- Production apps use LayerZero’s verification network — do not ship a custom relayer key as the security model.
