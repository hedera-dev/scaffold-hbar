# Agent instructions

Briefing for coding agents in this app (Cursor, Claude Code, Codex). Claude Code loads it through `CLAUDE.md`.

**SubRent** — Hardhat + Next.js template for HTS subscription NFTs: mint subscriptions, list rental windows, book with escrow, or sell/bid on `SubscriptionSalesMarketplace`.

Use `yarn` unless this project was created with another package manager.

## Solidity package

**Hardhat only** (`packages/hardhat`):

- `SubscriptionNFT.sol` — HTS collection + mint; royalty recipient per serial
- `SubscriptionMarketplace.sol` — rental listings, bookings, escrow, `userOf(serial)`
- `SubscriptionSalesMarketplace.sol` — fixed-price listings + English auctions
- HTS precompile: `0x0000000000000000000000000000000000000167`

## Commands

```bash
yarn hardhat:compile
yarn hardhat:test              # MockHTS unit tests (local)
yarn hardhat:test:forking      # optional testnet fork tests
yarn hardhat:deploy --network hederaTestnet
yarn hardhat:verify -- SubscriptionNFT testnet [0xAddress]

yarn next:dev                  # http://localhost:3000
yarn next:build
yarn next:check-types
yarn lint
yarn format
```

After deploy, run `packages/hardhat/scripts/createCollection.ts` once to create the HTS collection (~40 HBAR fee).

## Key paths

| Path | Purpose |
| --- | --- |
| `packages/hardhat/contracts/` | Subscription NFT + marketplace contracts |
| `packages/hardhat/deploy/` | hardhat-deploy scripts (`03`–`05`) |
| `packages/hardhat/scripts/createCollection.ts` | Initialize HTS collection post-deploy |
| `packages/nextjs/contracts/deployedContracts.ts` | Generated ABIs + addresses |
| `packages/nextjs/app/mint/` | Mint subscription NFTs |
| `packages/nextjs/app/marketplace/` | Rental listings + booking |
| `packages/nextjs/app/sales/` | Sales + auctions |
| `packages/nextjs/hooks/marketplace/` | Rental hooks |
| `packages/nextjs/hooks/sales/` | Sales/auction hooks |
| `packages/nextjs/utils/hedera/` | tinybar/wei helpers, date parsing |

## Frontend contract hooks

Use hooks from `packages/nextjs/hooks/scaffold-hbar`:

- `useScaffoldReadContract` — NOT `useScaffoldContractRead`
- `useScaffoldWriteContract` — NOT `useScaffoldContractWrite`

Example:

```typescript
const { data: subscription } = useScaffoldReadContract({
  contractName: "SubscriptionNFT",
  functionName: "getSubscription",
  args: [serialNumber],
});
```

Contract data: `deployedContracts.ts` (generated) + `externalContracts.ts` (manual).

## UI

- `@scaffold-hbar-ui/components` — `Address`, `Balance`, etc.
- **DaisyUI** classes for layout (`btn`, `card`, …)
- Imports use `~~/` alias → `packages/nextjs/*`

## Hedera value quirk

- Store prices in contracts as **tinybars** (8 decimals)
- Send tx `value` in **wei** (18 decimals): multiply tinybars by `10^10`

## Networks

- Hardhat: `packages/hardhat/hardhat.config.ts` (`hederaTestnet`, `hederaMainnet`, local)
- Frontend: `packages/nextjs/scaffold.config.ts`

## Code style

- `UpperCamelCase` — types, components
- `lowerCamelCase` — functions, variables
- Hardhat deploy/script files: `snake_case` or numbered deploy files
