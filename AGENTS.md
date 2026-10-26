# Oracles Agent Guide

Guidance for coding agents working in the **oracles** Scaffold-HBAR template.

## Documentation

Search Hedera documentation with the `SearchHedera` tool on the `hedera-docs` MCP server before writing Hedera-specific code.

## Overview

Multi-provider price oracle dApp on Hedera: Chainlink, Supra, and Pyth adapters normalize feeds into one `IPriceOracle` interface; an `OracleConsumer` demo converts amounts with `priceE18`. Next.js dashboard reads deployed adapters/consumer.

## Solidity Framework

**Foundry-only** monorepo (no Hardhat contracts package):

- **`packages/foundry`** — adapters, consumer, Forge scripts, tests, ABI generation
- **`packages/nextjs`** — oracle dashboard UI

Init submodules after clone: `git submodule update --init --recursive`.

## Architecture

```text
Provider feed → Multi-pair provider adapter → OracleConsumer demo
```

### Critical invariants

- Consumers depend only on `IPriceOracle`, never provider SDKs directly.
- All adapters return **18-decimal** `priceE18` and share the same revert vocabulary.
- Pair maps are **constructor-only** — adding a pair means redeploy + `setOracle`.
- Chainlink / Supra = push reads; Pyth = pull (Hermes update + fee, then read).
- Supra quotes on Hedera are **USDT** (not USD) — use `PairLib.pairKey("HBAR", "USDT")` etc.
- Deployments land in `packages/foundry/deployments/<chainId>.json` → generated `packages/nextjs/contracts/deployedContracts.ts` (do not hand-edit).

### Contract names

| Contract | Role |
| -------- | ---- |
| `ChainlinkPriceOracleAdapter` | Multi-pair Chainlink (`FeedConfig`) |
| `SupraPriceOracleAdapter` | Multi-pair Supra push (`PairConfig`) |
| `PythPriceOracleAdapter` | Multi-pair Pyth pull (`PriceConfig` + `updatePrice`) |
| `OracleConsumer` | Demo consumer with `setOracle` / conversion helpers |
| `IPriceOracle` | Shared `latestPrice(pairKey) → PriceData` |

## Key Paths

| Path | Purpose |
| ---- | ------- |
| `packages/foundry/contracts/oracle/interfaces/IPriceOracle.sol` | Shared interface |
| `packages/foundry/contracts/oracle/adapters/ChainlinkPriceOracleAdapter.sol` | Chainlink adapter |
| `packages/foundry/contracts/oracle/adapters/SupraPriceOracleAdapter.sol` | Supra adapter |
| `packages/foundry/contracts/oracle/adapters/PythPriceOracleAdapter.sol` | Pyth adapter |
| `packages/foundry/contracts/oracle/OracleConsumer.sol` | Demo consumer |
| `packages/foundry/contracts/oracle/lib/{PairLib,ProviderLib,AssetConversionLib}.sol` | Keys + conversion |
| `packages/foundry/script/HelperConfig.s.sol` | Network feed / pair / price IDs |
| `packages/foundry/script/DeployChainlinkOracle.s.sol` | Deploy Chainlink adapter |
| `packages/foundry/script/DeploySupraOracle.s.sol` | Deploy Supra adapter |
| `packages/foundry/script/DeployPythOracle.s.sol` | Deploy Pyth adapter |
| `packages/foundry/script/DeployOracleConsumer.s.sol` | Deploy consumer |
| `packages/foundry/script/SetConsumerOracle.s.sol` | Point consumer at another adapter |
| `packages/foundry/script/Read{Chainlink,Supra,Pyth}Oracle.s.sol` | Read helpers |
| `packages/foundry/deployments/<chainId>.json` | Deployment export |
| `packages/nextjs/services/oracle/constants.ts` | Frontend pair lists |
| `packages/nextjs/contracts/deployedContracts.ts` | Generated ABIs/addresses |

## Addresses & Config

**Chain IDs:** mainnet `295`, testnet `296`. Source of truth: `HelperConfig.s.sol` (`CodeConstants` + `NetworkConfig`). Re-check provider docs before mainnet.

### Chainlink Data Feeds (`FeedConfig`: `pairKey → feed`)

| Pair | Mainnet (`295`) | Testnet (`296`) |
| ---- | --------------- | --------------- |
| HBAR/USD | `0xAF685FB45C12b92b5054ccb9313e135525F9b5d5` | `0x59bC155EB6c6C415fE43255aF66EcF0523c92B4a` |
| BTC/USD | `0xaD01E27668658Cc8c1Ce6Ed31503D75F31eEf480` | `0x058fE79CB5775d4b167920Ca6036B824805A9ABd` |
| ETH/USD | `0xd2D2CB0AEb29472C3008E291355757AD6225019e` | `0xb9d461e0b962aF219866aDfA7DD19C52bB9871b9` |

### Supra Push Oracle (`PairConfig`: `pairKey → supraPairId`)

| | Mainnet (`295`) | Testnet (`296`) |
| - | --------------- | --------------- |
| Push oracle | `0xD02cc7a670047b6b012556A88e275c685d25e0c9` | `0x6Cd59830AAD978446e6cc7f6cc173aF7656Fb917` |

| Pair | Pair ID |
| ---- | ------- |
| BTC/USDT | `0` |
| ETH/USDT | `1` |
| HBAR/USDT | `75` |

### Pyth (`PriceConfig`: `pairKey → priceId`)

| | Mainnet / Testnet |
| - | ----------------- |
| Pyth contract | `0xA2aa501b19aff244D90cc15a4Cf739D2725B5729` |

| Pair | Price ID |
| ---- | -------- |
| HBAR/USD | `0x3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd` |
| BTC/USD | `0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43` |
| ETH/USD | `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace` |

### `HelperConfig` shape

```solidity
struct ChainlinkConfig { address hbarUsdFeed; address btcUsdFeed; address ethUsdFeed; }
struct SupraConfig {
    address pushOracle;
    uint256 hbarUsdtPairId; uint256 btcUsdtPairId; uint256 ethUsdtPairId;
}
struct PythConfig {
    address pyth;
    bytes32 hbarUsdPriceId; bytes32 btcUsdPriceId; bytes32 ethUsdPriceId;
}
struct NetworkConfig {
    ChainlinkConfig chainlink; SupraConfig supra; PythConfig pyth;
}
```

Unsupported `chainId` → `HelperConfig__InvalidChainId`.

### Deploy config example (Chainlink)

```solidity
FeedConfig[] memory configs = new FeedConfig[](3);
configs[0] = FeedConfig({ pairKey: PairLib.pairKey("HBAR", "USD"), feed: hbarUsdFeed });
configs[1] = FeedConfig({ pairKey: PairLib.pairKey("BTC", "USD"), feed: btcUsdFeed });
configs[2] = FeedConfig({ pairKey: PairLib.pairKey("ETH", "USD"), feed: ethUsdFeed });

new ChainlinkPriceOracleAdapter(configs, /* maxStaleness */ 365 days);
```

Deploy scripts use `MAX_STALENESS = 365 days` for Chainlink/Supra and `1 hours` for Pyth. Pyth reads/updates may need a non-zero Hedera value (template uses `10_000_000_000` tinybar where required).

### Env vars

**`packages/foundry/.env`** (from `.env.example`):

| Var | Purpose |
| --- | ------- |
| `HEDERA_RPC_URL` | Default `https://testnet.hashio.io/api` |
| `ALCHEMY_API_KEY` | Optional / other networks |
| `LOCALHOST_KEYSTORE_ACCOUNT` | Default `scaffold-hbar-default` |

**Script overrides:** `ORACLE_ADAPTER_NAME` (default `ChainlinkPriceOracleAdapter`), `ORACLE_ADAPTER_ADDRESS`, `ORACLE_CONSUMER_NAME` (default `OracleConsumer`).

**`packages/nextjs/.env`:** `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`, optional Hedera RPC URLs.

RPCs in `foundry.toml`: `hedera_testnet`, `hedera_mainnet`.

## Commands

```bash
yarn install && git submodule update --init --recursive
yarn foundry:account:generate   # or :import
yarn foundry:compile && yarn foundry:test

# Fork tests
yarn foundry:test:chainlink:testnet   # also :supra: / :pyth: ; :mainnet variants

# Deploy adapters
yarn foundry:deploy:chainlink:testnet # also :supra: / :pyth: ; :mainnet

# Consumer
ORACLE_ADAPTER_NAME=ChainlinkPriceOracleAdapter yarn foundry:deploy:consumer:testnet
yarn foundry:set-oracle:testnet

# Read
yarn foundry:read:chainlink:testnet   # also :supra: / :pyth:

# Verify (example)
yarn foundry:verify:testnet <addr> \
  contracts/oracle/adapters/ChainlinkPriceOracleAdapter.sol:ChainlinkPriceOracleAdapter

# Frontend
yarn next:dev
yarn next:build
```

Make (from `packages/foundry`): `make deploy-and-generate-abis DEPLOY_SCRIPT=script/DeployChainlinkOracle.s.sol RPC_URL=hedera_testnet …`; Pyth read may use `make run-script SCRIPT=script/ReadPythOracle.s.sol …`.

### Suggested order

1. Account generate/import + fund on testnet
2. Deploy one adapter (`yarn foundry:deploy:chainlink:testnet` etc.)
3. Deploy consumer pointing at that adapter
4. Optional: deploy another adapter + `yarn foundry:set-oracle:testnet`
5. `yarn next:dev` — dashboard against `deployedContracts.ts`

### Adding a pair

1. Add feed / pair ID / price ID to `HelperConfig.s.sol` for the target network
2. Extend the relevant `Deploy*Oracle.s.sol` config array
3. Redeploy adapter + `setOracle` on the consumer
