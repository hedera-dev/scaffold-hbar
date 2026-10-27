# Scaffold-HBAR — Bridge starter

Testnet-first bridge learning kit: connect **Ethereum Sepolia** and **Hedera Testnet** with a Next.js UI and Foundry scripts for Axelar ITS, Chainlink CCIP, and LayerZero OFT.

CLI key: `bridge` (branch `templates/bridge`).

> **Educational disclaimer:** example contracts, scripts, and UI flows for learning. Not audited, not production-ready. Use testnets and small amounts only — review, redesign, and audit before any production bridge.

General Scaffold-HBAR docs: [Scaffold HBAR on Hedera](https://docs.hedera.com/solutions/tools/scaffold-hbar/index). Deep package guides: [packages/foundry/README.md](packages/foundry/README.md), [packages/nextjs/README.md](packages/nextjs/README.md).

## What's in this template

- Next.js bridge UI for Axelar, CCIP, and LayerZero (`/`)
- Foundry contracts and provider runbooks under `packages/foundry/script/{axelar,ccip,layerzero}/`
- Config sync from Foundry deploy state → `packages/nextjs/services/bridge/config/*.json`
- Foundry-only monorepo (no Hardhat package)

Create a project:

```bash
npm create scaffold-hbar@latest -- --template bridge
```

## Start here

Tutorial path: clone → deploy **one** provider → sync frontend config → test the UI.

### 1. Prerequisites

- Node.js ≥ 22.23.4 and < 23, Git
- Yarn (default; required if you clone this repo) or npm if you scaffolded with the CLI
- Foundry (`forge`, `cast`, `anvil`)

### 2. Install

```bash
yarn install
git submodule update --init --recursive
```

`yarn install` copies `packages/foundry/.env.example` → `packages/foundry/.env` if missing.

### 3. Configure testnet access

Edit `packages/foundry/.env`:

```bash
ACCOUNT=your_foundry_keystore_alias
SEPOLIA_RPC_URL=https://...
HEDERA_TESTNET_RPC_URL=https://testnet.hashio.io/api
```

For the frontend, copy `packages/nextjs/.env.example` → `packages/nextjs/.env` to override browser RPC URLs or enable LayerZero automatic relay from the UI. Relay requires a server-only funded testnet key:

```bash
LAYERZERO_RELAY_PRIVATE_KEY=0x...
```

Fund the same deployer EOA on both chains:

- **Sepolia ETH** — deployments and sends
- **Hedera testnet HBAR** — deployments, HTS creation, approvals, sends

```bash
yarn foundry:account:generate
# or yarn foundry:account:import
```

Fund via [Hedera Portal faucet](https://portal.hedera.com/faucet) and any Sepolia ETH faucet.

### 4. Pick one bridge provider

From `packages/foundry`:

```bash
cd packages/foundry
make axelar-help      # or ccip-help / layerzero-help
```

| Provider | What it demonstrates | Runbook |
| --- | --- | --- |
| Axelar | ITS: native Hedera HTS token + remote Sepolia token via Interchain Token Service | [script/axelar/README.md](packages/foundry/script/axelar/README.md) |
| CCIP | Chainlink cross-chain burn-and-mint | [script/ccip/README.md](packages/foundry/script/ccip/README.md) |
| LayerZero | LayerZero V2 OFT with Hedera HTS connector | [script/layerzero/README.md](packages/foundry/script/layerzero/README.md) |

Each helper records addresses under `packages/foundry/deployments/bridge/` (local generated state, gitignored).

### 5. Sync frontend bridge config

After deploy + configure:

```bash
make bridge-sync-next PROVIDER=axelar
# or PROVIDER=ccip, PROVIDER=layerzero, PROVIDER=all
```

Updates `packages/nextjs/services/bridge/config/*.json`.

### 6. Test the UI

```bash
cd ../..
yarn next:dev
```

Open [http://localhost:3000](http://localhost:3000), connect the **same funded EOA**, choose provider and direction, approve when prompted, send a small test amount.

LayerZero uses educational simple workers. The UI auto-relays when `LAYERZERO_RELAY_PRIVATE_KEY` is set; otherwise it shows the manual `make layerzero-relay ...` command from `packages/foundry`.

Full UI checklist: [packages/nextjs/README.md](packages/nextjs/README.md).

## Common commands

| Command | Purpose |
| --- | --- |
| `yarn foundry:account:generate` / `:import` | Foundry keystore |
| `yarn foundry:compile` | Compile contracts |
| `yarn foundry:test` | Run Foundry tests |
| `yarn foundry:verify:testnet 0xAddr contracts/My.sol:MyContract` | Sourcify verify (HashScan) |
| `yarn next:dev` / `yarn next:build` | Bridge UI |
| `yarn next:check-types` | Type-check frontend |
| `yarn lint` / `yarn format` | Lint and format |

Provider deploy/transfer commands run from `packages/foundry` via `make axelar-*`, `make ccip-*`, `make layerzero-*`.

## Project layout

```
packages/foundry/
  contracts/           bridge provider contracts
  script/axelar|ccip|layerzero/   provider runbooks + scripts
  deployments/bridge/  local deploy state (gitignored)
packages/nextjs/
  app/                 bridge UI at /
  services/bridge/config/   synced JSON configs
```

## Links

- [Foundry package guide](packages/foundry/README.md)
- [Next.js frontend guide](packages/nextjs/README.md)
- [Scaffold HBAR docs](https://docs.hedera.com/solutions/tools/scaffold-hbar/index)
- [create-scaffold-hbar](https://github.com/hedera-dev/create-scaffold-hbar) — CLI
- [Hedera Documentation](https://docs.hedera.com/)
- [Hedera Token Service](https://docs.hedera.com/hedera/core-concepts/hedera-token-service-hts)
- [Hedera Portal faucet](https://portal.hedera.com/faucet)
- [HashScan](https://hashscan.io/)

## License

Open source under the [MIT License](https://opensource.org/licenses/MIT).
