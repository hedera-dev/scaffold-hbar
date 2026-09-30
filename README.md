# SubRent — Subscription NFT Marketplace

Hedera HTS subscription marketplace: tokenize subscriptions (gym, WiFi, streaming, etc.) as NFTs, **rent** unused periods via escrow, or **sell/bid** on a secondary market. Hardhat contracts + Next.js App Router UI.

CLI key: `tokenize-subscriptions` (branch `templates/tokenize-subscriptions`).

General Scaffold-HBAR setup: [Scaffold HBAR on Hedera](https://docs.hedera.com/solutions/tools/scaffold-hbar/index). Deep contract behavior: [packages/hardhat/docs/contract-behavior.md](packages/hardhat/docs/contract-behavior.md).

## Disclaimer

This template—including **contracts, frontend, and tooling**—is **experimental** and **not audited**. Do not use it in production without proper security review and your own due diligence.

## How It Works

### Rental Marketplace

1. **Tokenize** — Mint your subscription as an NFT with provider, tier, and validity dates
2. **List** — Create availability windows for periods you won't use; set a daily price
3. **Rent** — Others book your listed periods, paying HBAR into escrow
4. **Earn** — Claim payouts after booking periods start (marketplace takes 5% fee)

The NFT stays with the owner throughout. Booking creates an on-chain **access-right record** — `userOf(serialNumber)` returns who currently has rental rights.

### Sales Marketplace

1. **List for Sale** — Create a fixed-price listing or start an English auction (3-day duration)
2. **Buy/Bid** — Others can buy immediately or place bids on auctions
3. **Transfer** — NFT ownership transfers to the buyer; seller receives payment minus fees
4. **Provider Royalty** — 5% of sale price goes to the original service provider

**Fee structure on sales:** 5% provider royalty + 5% marketplace fee + 90% to seller.

## Architecture

```
┌─────────────────────┐     ┌──────────────────────────┐     ┌───────────────────────────────┐
│  SubscriptionNFT    │     │  SubscriptionMarketplace │     │  SubscriptionSalesMarketplace │
│  ─────────────────  │     │  ──────────────────────  │     │  ───────────────────────────  │
│  • createCollection │◄────│  • createAvailability    │     │  • createFixedPriceListing    │
│  • mintSubscription │     │  • book (escrow HBAR)    │◄────│  • createAuction              │
│  • getSubscription  │     │  • userOf (rental check) │     │  • buy / bid                  │
│  • currentOwner     │     │  • claimBookingPayout    │     │  • settleAuction              │
│  • providerAddress  │     │  • hasActiveFutureBookings│     │  • 5% provider royalty        │
└─────────────────────┘     └──────────────────────────┘     └───────────────────────────────┘
         │                              │                                    │
         └──────────┬───────────────────┴────────────────────────────────────┘
                    ▼
           ┌────────────────┐
           │  HTS Precompile │
           │    (0x167)      │
           └────────────────┘
```

## Prerequisites

- Node.js ≥ 20.18.3, Git
- Yarn (default; required if you clone this repo) or npm if you scaffolded with the CLI
- Hedera-compatible wallet — [MetaMask](https://metamask.io/) or [HashPack](https://www.hashpack.app/)
- [WalletConnect project ID](https://cloud.reown.com) in `packages/nextjs/.env`

## Quick Start

### 1. Install

```bash
yarn install
cp packages/hardhat/.env.example packages/hardhat/.env
cp packages/nextjs/.env.example packages/nextjs/.env
```

### 2. Deployer account

```bash
yarn hardhat:account:generate
yarn hardhat:account
```

Fund the deployer via [Hedera Portal Faucet](https://portal.hedera.com/faucet) (~50 HBAR for deploy + collection creation).

### 3. Deploy to Hedera testnet

```bash
yarn hardhat:compile
yarn hardhat:test               # local MockHTS unit tests

yarn hardhat:deploy --network hederaTestnet
```

Deploys `SubscriptionNFT`, `SubscriptionMarketplace`, and `SubscriptionSalesMarketplace`. Addresses are saved to `packages/nextjs/contracts/deployedContracts.ts`.

### 4. Initialize the NFT collection

Required before minting any NFTs:

```bash
cd packages/hardhat
npx ts-node scripts/createCollection.ts
cd ../..
```

Calls `createCollection()` and pays ~40 HBAR for HTS token creation fees.

### 5. Start the frontend

```bash
yarn next:start
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Connect wallet

**MetaMask — Hedera Testnet**

| Field | Value |
| --- | --- |
| Network Name | Hedera Testnet |
| RPC URL | `https://testnet.hashio.io/api` |
| Chain ID | `296` |
| Currency Symbol | HBAR |
| Explorer | `https://hashscan.io/testnet` |

Fund the wallet via the [faucet](https://portal.hedera.com/faucet).

**HashPack** — create/import a testnet account and fund via the same faucet.

### 7. Use the marketplace

With wallet connected:

1. **Mint** (`/mint`) — Create a subscription NFT
2. **My Subscriptions** (`/my-subscriptions`) — View NFTs; create rental or sale listings
3. **Rentals** (`/marketplace`) — Browse and book rental listings
4. **Sales** (`/sales`) — Browse, buy, or bid on subscriptions for sale
5. **My Bookings** (`/my-bookings`) — View rentals and claim payouts

## Optional: end-to-end script

After deploy + collection creation:

```bash
cd packages/hardhat
npx ts-node scripts/testFullFlow.ts
```

Demonstrates minting ("Gym A - Premium", 90-day validity), listing availability (14-day window, 1 HBAR/day), booking 3 days, and verifying `userOf()` returns the renter.

## Hedera value handling

Hedera's EVM quirk with `msg.value`:

| Context | Unit | 1 HBAR equals |
| --- | --- | --- |
| JSON-RPC (sending tx) | wei | 10^18 |
| Contract `msg.value` | tinybars | 10^8 |
| Conversion | 1 tinybar = 10^10 wei | |

Store prices in contracts as **tinybars** (8 decimals):

```javascript
// Storing 1 HBAR price
const pricePerDay = ethers.parseUnits("1", 8);  // 100000000 tinybars

// Sending 3 HBAR payment via JSON-RPC
const costTinybars = pricePerDay * 3n;
const costWei = costTinybars * BigInt(10 ** 10);
await contract.book(..., { value: costWei });
```

## Contract functions

### SubscriptionNFT

| Function | Description |
| --- | --- |
| `createCollection(name, symbol, memo)` | Owner creates HTS NFT collection (once, requires HBAR) |
| `mintSubscription(providerAddress, provider, tier, start, end)` | Mint subscription NFT with royalty recipient |
| `getSubscription(serialNumber)` | Get subscription metadata |
| `getProviderAddress(serialNumber)` | Get royalty recipient address |
| `currentOwner(serialNumber)` | Get current NFT owner via HTS |
| `isExpired(serialNumber)` | Check if subscription has expired |

### SubscriptionMarketplace (rentals)

| Function | Description |
| --- | --- |
| `createAvailability(serial, start, end, pricePerDay)` | List rental window (owner only) |
| `book(availabilityId, startDate, days)` | Book and pay (escrows HBAR) |
| `userOf(serialNumber)` | Returns active renter or zero address |
| `cancelBooking(bookingId)` | Cancel before start for full refund |
| `claimBookingPayout(bookingId)` | Owner claims payment after start |
| `hasActiveFutureBookings(serialNumber)` | Check if serial has future bookings (view) |

### SubscriptionSalesMarketplace (sales)

| Function | Description |
| --- | --- |
| `createFixedPriceListing(serial, price)` | List NFT for immediate sale |
| `createAuction(serial, reservePrice)` | Start 3-day English auction |
| `buy(listingId)` | Buy fixed-price listing |
| `bid(listingId)` | Place bid on auction (payable) |
| `settleAuction(listingId)` | Settle ended auction |
| `cancelListing(listingId)` | Cancel listing (no bids for auction) |
| `getMinimumBid(listingId)` | Get minimum required bid for auction |

## Testing

```bash
yarn hardhat:test               # local unit tests (MockHTS)
yarn hardhat:test:forking       # optional forked tests against testnet
```

## Development commands

```bash
yarn next:dev                   # hot reload
yarn next:build
yarn hardhat:compile
yarn hardhat:verify -- SubscriptionNFT testnet
yarn lint
yarn format
```

## Project structure

```
packages/hardhat/
  contracts/     SubscriptionNFT, SubscriptionMarketplace, SubscriptionSalesMarketplace
  deploy/        hardhat-deploy scripts (03–05)
  scripts/       createCollection.ts, testFullFlow.ts
  tasks/         sales:* Hardhat tasks
  test/          unit tests with MockHTS
packages/nextjs/
  app/           mint, marketplace, sales, my-subscriptions, my-bookings, debug
  components/    marketplace/
  hooks/         marketplace/, sales/, scaffold-hbar/
  utils/hedera/  tinybar/wei helpers, date parsing
  contracts/     deployedContracts.ts (generated)
```

## Troubleshooting

### "INVALID_FULL_PREFIX_SIGNATURE_FOR_PRECOMPILE" (Error 326)

Use `delegatableContractId` (not `contractId`) for HTS authorization. Ensure `autoRenewAccount` is set to `address(this)`.

### "IncorrectPayment" on booking

Prices must be in **tinybars** (8 decimals); JSON-RPC payments in **wei** (18 decimals). See value handling above.

### "HtsCreateFailed(9)" on createCollection

Insufficient HBAR for token creation — send at least 40 HBAR with the transaction.

### CORS errors with hashio.io RPC

Set `NEXT_PUBLIC_HEDERA_TESTNET_RPC_URL` in `packages/nextjs/.env` to a CORS-enabled endpoint (e.g. [Arkhia](https://arkhia.io/)), or rely on wallet-connected operations (wallets handle RPC internally).

### Deployer shows EVM address, not Hedera account ID

`yarn hardhat:account:generate` shows `0x…` format. Both EVM and `0.0.xxxxx` formats work with the [faucet](https://portal.hedera.com/faucet).

## Links

- [Hedera Documentation](https://docs.hedera.com/)
- [Hashscan Explorer](https://hashscan.io/testnet)
- [HTS Precompile Reference](https://docs.hedera.com/hedera/core-concepts/smart-contracts/hedera-token-service-hts-precompiled-contract)
- [Hedera Portal Faucet](https://portal.hedera.com/faucet)
