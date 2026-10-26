# Agent instructions

This file is the shared briefing for coding agents in this repository (Cursor, Claude Code, Codex, and any other tool that reads `AGENTS.md`). Claude Code loads it through `CLAUDE.md`.

This file provides guidance to coding agents working in this repository.

## Project Overview

Scaffold-HBAR (`sh`) is a starter kit for building dApps on Hedera. It comes in **two flavors** based on the Solidity framework:

- **Hardhat flavor**: Uses `packages/hardhat` with hardhat-deploy plugin
- **Foundry flavor**: Uses `packages/foundry` with Forge scripts

Both flavors share the same frontend package:

- **packages/nextjs**: React frontend (Next.js App Router, not Pages Router, RainbowKit, Wagmi, Viem, TypeScript, Tailwind CSS with DaisyUI)

### Detecting Which Flavor You're Usings

Check which package exists in the repository:

- If `packages/hardhat` exists → **Hardhat flavor** (follow Hardhat instructions)
- If `packages/foundry` exists → **Foundry flavor** (follow Foundry instructions)

## Common Commands

Use explicit package-prefixed scripts for package-specific work. Keep only truly cross-workspace commands unprefixed.

```bash
# Development workflow (run each in separate terminal)
yarn hardhat:chain   # Start local Hedera-forked Hardhat node
yarn hardhat:deploy  # Deploy contracts with Hardhat
yarn foundry:chain   # Start plain Anvil from the Foundry package
yarn foundry:deploy  # Deploy contracts with Foundry
yarn next:start      # Start Next.js frontend at http://localhost:3000

# Code quality
yarn lint            # Lint all present packages
yarn format          # Format all present packages

# Building
yarn next:build      # Build frontend
yarn hardhat:compile # Compile Solidity contracts with Hardhat
yarn foundry:compile # Compile Solidity contracts with Foundry

# Contract verification
yarn hardhat:verify:testnet
yarn foundry:verify:testnet

# Account management
yarn hardhat:account:generate
yarn hardhat:account:import
yarn hardhat:account
yarn foundry:account:generate
yarn foundry:account:import
yarn foundry:account

# Deploy to live network
yarn hardhat:deploy --network <network>   # e.g., hederaTestnet, hederaMainnet
yarn foundry:deploy --network <network>   # e.g., hedera_testnet, hedera_mainnet

yarn next:vercel:yolo --prod # deploy frontend
```

## Architecture

### Smart Contract Development

#### Hardhat Flavor

- Contracts: `packages/hardhat/contracts/`
- Deployment scripts: `packages/hardhat/deploy/` (uses hardhat-deploy plugin)
- Tests: `packages/hardhat/test/`
- Config: `packages/hardhat/hardhat.config.ts`
- Deploying specific contract:
  - If the deploy script has:
    ```typescript
    // In packages/hardhat/deploy/01_deploy_my_contract.ts
    deployMyContract.tags = ["MyContract"];
    ```
 - `yarn hardhat:deploy --tags MyContract`

#### Foundry Flavor

- Contracts: `packages/foundry/contracts/`
- Deployment scripts: `packages/foundry/script/` (uses custom deployment strategy)
  - Example: `packages/foundry/script/Deploy.s.sol` and `packages/foundry/script/DeployYourContract.s.sol`
- Tests: `packages/foundry/test/`
- Config: `packages/foundry/foundry.toml`
- Deploying a specific contract:
 - Create a separate deployment script and run `yarn foundry:deploy --file DeployYourContract.s.sol`

#### Both Flavors

- After `yarn hardhat:deploy` or `yarn foundry:deploy`, ABIs are auto-generated to `packages/nextjs/contracts/deployedContracts.ts`

### Frontend Contract Interaction

**Correct interact hook names (use these):**

- `useScaffoldReadContract` - NOT ~~useScaffoldContractRead~~
- `useScaffoldWriteContract` - NOT ~~useScaffoldContractWrite~~

Contract data is read from two files in `packages/nextjs/contracts/`:

- `deployedContracts.ts`: Auto-generated from deployments
- `externalContracts.ts`: Manually added external contracts

#### Reading Contract Data

```typescript
const { data: totalCounter } = useScaffoldReadContract({
  contractName: "YourContract",
  functionName: "userGreetingCounter",
  args: ["0xd8da6bf26964af9d7eed9e03e53415d37aa96045"],
});
```

#### Writing to Contracts

```typescript
const { writeContractAsync, isPending } = useScaffoldWriteContract({
  contractName: "YourContract",
});

await writeContractAsync({
  functionName: "setGreeting",
  args: [newGreeting],
  value: parseEther("0.01"), // for payable functions
});
```

#### Reading Events

```typescript
const { data: events, isLoading } = useScaffoldEventHistory({
  contractName: "YourContract",
  eventName: "GreetingChange",
  watch: true,
  fromBlock: 31231n,
  blockData: true,
});
```

Scaffold-HBAR also provides other hooks to interact with blockchain data: `useScaffoldWatchContractEvent`, `useScaffoldEventHistory`, `useDeployedContractInfo`, `useScaffoldContract`, `useTransactor`.

**IMPORTANT: Always use hooks from `packages/nextjs/hooks/scaffold-hbar` for contract interactions (legacy path segment; project branding is Scaffold-HBAR / `sh`). Always refer to the hook names as they exist in the codebase.**

### UI Components

**Always use `@scaffold-hbar-ui/components` library for web3 UI components:**

- `Address`: Display Hedera EVM addresses with blockie avatars and explorer links
- `AddressInput`: Input field with address validation
- `Balance`: Show HBAR balance in tinybar/HBAR and fiat equivalent
- `EtherInput`: Number input for EVM value entry (kept for EVM compatibility)
- `IntegerInput`: Integer-only input with wei conversion

### Styling

**Use DaisyUI classes** for building frontend components.

```tsx
// ✅ Good - using DaisyUI classes
<button className="btn btn-primary">Connect</button>
<div className="card bg-base-100 shadow-xl">...</div>

// ❌ Avoid - raw Tailwind when DaisyUI has a component
<button className="px-4 py-2 bg-blue-500 text-white rounded">Connect</button>
```

### Configure Target Network before deploying to testnet / mainnet.

#### Hardhat

Add networks in `packages/hardhat/hardhat.config.ts` if not present.

#### Foundry

Add RPC endpoints in `packages/foundry/foundry.toml` if not present.

#### NextJs

Add networks in `packages/nextjs/scaffold.config.ts` if not present. This file also contains configuration for polling interval, API keys. Remember to decrease the polling interval for L2 chains.

## Code Style Guide

### Identifiers


| Style            | Category                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `UpperCamelCase` | class / interface / type / enum / decorator / type parameters / component functions in TSX / JSXElement type parameter |
| `lowerCamelCase` | variable / parameter / function / property / module alias                                                              |
| `CONSTANT_CASE`  | constant / enum / global variables                                                                                     |
| `snake_case`     | for hardhat deploy files and foundry script files                                                                      |


### Import Paths

Use the `~~` path alias for imports in the nextjs package:

```tsx
import { useTargetNetwork } from "~~/hooks/scaffold-hbar";
```

### Creating Pages

```tsx
import type { NextPage } from "next";

const Home: NextPage = () => {
  return <div>Home</div>;
};

export default Home;
```

### TypeScript Conventions

- Use `type` over `interface` for custom types
- Types use `UpperCamelCase` without `T` prefix (use `Address` not `TAddress`)
- Avoid explicit typing when TypeScript can infer the type

### Comments

Make comments that add information. Avoid redundant JSDoc for simple functions.

## Documentation

Search Hedera documentation with the `SearchHedera` tool on the `hedera-docs` MCP server before writing Hedera-specific code.

Use **Context7 MCP** tools to fetch up-to-date documentation for any library (Wagmi, Viem, RainbowKit, DaisyUI, Hardhat, Next.js, etc.). Context7 is configured as an MCP server and provides access to indexed documentation with code examples.

## Specialized Agents

Use these specialized agents for specific tasks:

- `**grumpy-carlos-code-reviewer`**: Use this agent for code reviews before finalizing changes

