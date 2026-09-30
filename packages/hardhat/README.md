# Hardhat package (Hedera)

Hardhat config, contracts, deploy scripts, tests, and Sourcify verification for this monorepo.

## Local development

From the repo root, use the explicit `hardhat:*` scripts for this package. Inside `packages/hardhat`, use the unprefixed package-local scripts.

1. **Start the local chain** (terminal 1, from repo root):
   ```bash
   yarn hardhat:chain
   ```
   This starts `hardhat node` with **Hedera testnet forking** (`HEDERA_FORKING=true` and `@hashgraph/system-contracts-forking`). JSON-RPC is served at **http://127.0.0.1:8545**.

2. **Deploy to the running fork** (terminal 2):
   ```bash
   yarn hardhat:deploy --network localhost
   ```
   Use **`localhost`** so Hardhat connects to the long-running node on port 8545.

   **`yarn hardhat:deploy` without `--network localhost`** uses the default network `hardhat`, which is the **in-process ephemeral** Hardhat network—**not** the same process as `yarn hardhat:chain`. For deploys against the forked node you started in step 1, always pass **`--network localhost`** while that node is running.

3. **Run contract tests** (from repo root):
   ```bash
   yarn hardhat:test          # Uses MockHTS (fast, offline, recommended)
   yarn hardhat:test:forking  # Uses real HTS emulation (requires network)
   ```

## Testing

### Test Modes

| Command | Network | Description |
|---------|---------|-------------|
| `yarn hardhat:test` | Local Hardhat | Fast, offline testing (~3s) |
| `yarn hardhat:test:forking` | Forked Hedera testnet | Test against real Hedera state (requires network) |

Both modes use `MockHTS` for HTS operations because `@hashgraph/system-contracts-forking` v0.1.2 has a bug that breaks NFT minting (requires `amount > 0` even for NFTs which should use `amount = 0`).

### When to Use Each Mode

- **`yarn hardhat:test`** - Default for development, CI/CD, and offline work
- **`yarn hardhat:test:forking`** - When you need to test against real Hedera blockchain state (existing tokens, balances, etc.)

### How It Works

The `SubscriptionNFT` contract accepts a configurable HTS address:
- **Production:** Pass `address(0)` to use the real HTS precompile at `0x167`
- **Testing:** Pass a `MockHTS` contract address

```solidity
// Production deployment (uses real HTS)
new SubscriptionNFT(owner, address(0));

// Test deployment (uses mock)
new SubscriptionNFT(owner, mockHTSAddress);
```

## Deploy and verify on Hedera testnet/mainnet

You need a deployer account with HBAR on the target network. Without funds, deploy and verify will fail with "Sender account not found".

1. **Generate or import an account** (from the repo root):
   ```bash
   yarn hardhat:account:generate
   ```
   or
   ```bash
   yarn hardhat:account:import
   ```
   The encrypted key is stored in `packages/hardhat/.env`.

2. **Fund the account on testnet:**  
   Use the [Hedera Portal faucet](https://portal.hedera.com/faucet) to receive testnet HBAR.

3. **Deploy to Hedera testnet** (from repo root):
   ```bash
   yarn hardhat:deploy --network hederaTestnet
   ```
   or
   ```bash
   yarn hardhat:deploy --network hedera_testnet
   ```
   You will be prompted to enter the password to decrypt your deployer key.

4. **Verify on Sourcify** (shows as verified on HashScan). Submits the solc standard-json from `artifacts/build-info` directly to the Sourcify API v2:
   ```bash
   yarn hardhat:verify -- SubscriptionNFT testnet                          # address from deployments/hederaTestnet/
   yarn hardhat:verify -- SubscriptionNFT testnet 0xSubscriptionNFTAddress # explicit address
   ```
   Use `mainnet` instead of `testnet` for chain 295. Verified contracts are visible on [HashScan](https://hashscan.io) and the broader Sourcify ecosystem.

## Layout

- `contracts/` — Solidity sources
- `docs/` — contract behavior notes (see `docs/contract-behavior.md`)
- `deploy/` — hardhat-deploy scripts (e.g. `03_deploy_subscription_nft.ts`)
- `scripts/` — generateAccount, importAccount, generateTsAbis, etc.
- `test/` — contract tests
- `hardhat.config.ts` — networks (`hardhat`, `localhost` for RPC at 127.0.0.1:8545, `hederaTestnet`, `hederaMainnet`)

Network and RPC URLs are in `hardhat.config.ts`. Deployer key is read from `.env` (encrypted) and decrypted at deploy time for live networks.
