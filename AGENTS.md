# Agent instructions

Briefing for coding agents in this app (Cursor, Claude Code, Codex). Claude Code loads it through `CLAUDE.md`.

This is a **Hedera-native Next.js demo** (Proof Wall). There is **no Solidity workspace** — interactions use HCS (topics/messages), HTS (badge tokens), and Mirror Node APIs via wallet-signed transactions and server routes.

Use the package manager this project was created with (`packageManager` in the root `package.json`). Examples use `yarn`.

## Documentation

Search Hedera documentation with the `SearchHedera` tool on the `hedera-docs` MCP server before writing Hedera-specific code.

## Commands

```bash
yarn next:dev           # http://localhost:3000
yarn next:build
yarn next:check-types
yarn lint               # same as yarn next:lint
yarn format
```

Copy `packages/nextjs/.env.example` → `packages/nextjs/.env`. Required: `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`. After admin setup: `NEXT_PUBLIC_PROOF_WALL_TOPIC_ID`, optionally `NEXT_PUBLIC_PROOF_WALL_BADGE_TOKEN_ID`.

## App overview

| Route | Purpose |
|---|---|
| `/` | Proof Wall — submit proofs, browse HCS feed for the active topic |
| `/my-proofs` | Proofs filtered by connected account; badge display |
| `/admin` | Create HCS topic and HTS badge token (wallet-signed) |

Config: `packages/nextjs/config/proofWallConfig.ts` (topic ID, badge token ID, Mirror Node / HashScan URLs from env).

## Layout

```
packages/nextjs/
  app/                    App Router pages and API routes
    api/hedera/           Mirror Node proxies, operator helpers, airdrop, badge check
  components/             ProofWall, SubmitProofForm, TopicSelector, BadgeDisplay, …
  hooks/
    useHederaSigner.ts    Wallet + Hedera account identity
    useSubmitProof.ts     HCS TopicMessageSubmitTransaction via native tx hook
    useTopicMessages.ts   Poll Mirror Node for topic messages
    useCreateTopic.ts     Admin: create HCS topic
    useCreateToken.ts     Admin: create HTS badge token
    useBadgeTokens.ts     Badge balance / eligibility
    scaffold-hbar/        Shared Scaffold-HBAR hooks (useTargetNetwork, …)
  services/               hederaClient, mirrorNode, badgeService
  utils/scaffold-hbar/    Hedera tx helpers, identity, topic/token resolution
  scaffold.config.ts      Target networks (testnet, mainnet), RPC, WalletConnect
  contracts/              deployedContracts.ts (empty — no Solidity workspace)
```

## Hedera integration patterns

**Wallet + identity:** `useHederaSigner` wraps connection state and `requireProvider()` for mutations. Account IDs use `0.0.xxxxx` form; helpers in `utils/scaffold-hbar/identity.ts` normalize EVM ↔ native identity.

**Submit proof:** `useSubmitProof` builds a JSON payload `{ text, author, timestamp }`, submits via `@hiero-ledger/sdk` `TopicMessageSubmitTransaction`, and sends through `useNativeTransaction` from `@scaffold-hbar-ui/hooks`.

**Read feed:** `useTopicMessages` fetches from `/api/hedera/topic-messages` (Mirror Node). Home page polls every 15s; passes `onNewMessage` after submit for optimistic refresh.

**Admin create topic/token:** Client hooks call API routes or native transactions; after submit, `resolveTopicIdFromTransactionId` / `resolveTokenIdFromTransactionId` poll Mirror Node until IDs are indexed (may take 10–20s).

## UI

Use `@scaffold-hbar-ui/components` for web3 UI (`Address`, `HederaAddressInput`, `Balance`, `HbarInput`, `HederaPortalFaucet`, etc.).

Use DaisyUI classes for layout and controls:

```tsx
<button className="btn btn-primary">Connect</button>
<div className="card bg-base-100 shadow-xl">...</div>
```

Import app code with the `~~` alias:

```tsx
import { useTargetNetwork } from "~~/hooks/scaffold-hbar";
```

## Networks

`packages/nextjs/scaffold.config.ts` — `hederaTestnet` and `hedera` mainnet. RPC overrides via `NEXT_PUBLIC_HEDERA_*_RPC_URL`. Default polling interval: 10s.

## Code style

| Style | Use for |
|---|---|
| `UpperCamelCase` | types, components, enums |
| `lowerCamelCase` | functions, variables, hooks |
| `CONSTANT_CASE` | constants |

Prefer `type` over `interface`. Comments only when they add non-obvious context.
