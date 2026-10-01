import * as dotenv from "dotenv";
dotenv.config();

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
// Only load the Hedera forking plugin when starting the local node (yarn hardhat:chain / yarn hardhat:fork).
// Deploying to an already-running node doesn't need it and would fail with EADDRINUSE.
if (process.env.HEDERA_FORKING === "true") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- conditional plugin load
  require("@hashgraph/system-contracts-forking/plugin");
}
import "hardhat-deploy";
import "hardhat-deploy-ethers";

import "./tasks/salesTasks";
import generateTsAbis from "./scripts/generateTsAbis";

// Hedera JSON-RPC URL (testnet default). Set HEDERA_RPC_URL in .env for mainnet.
const hederaRpcUrl = process.env.HEDERA_RPC_URL || "https://testnet.hashio.io/api";

// Deployer key: run `yarn account:generate` or `yarn account:import`, or set __RUNTIME_DEPLOYER_PRIVATE_KEY at runtime.
const deployerPrivateKey =
  process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY ?? "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// Only enable forking when HEDERA_FORKING is set
const hardhatNetworkConfig: any = {};
if (process.env.HEDERA_FORKING === "true") {
  hardhatNetworkConfig.forking = {
    url: hederaRpcUrl,
    chainId: 296,
    workerPort: 10001,
  };
}

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  networks: {
    hardhat: hardhatNetworkConfig,
    hederaTestnet: {
      url: "https://testnet.hashio.io/api",
      accounts: [deployerPrivateKey],
      chainId: 296,
    },
    hederaMainnet: {
      url: "https://mainnet.hashio.io/api",
      accounts: [deployerPrivateKey],
      chainId: 295,
    },
  },
  // Contract verification: use `yarn verify:contract` (scripts/verifySourcify.ts), which talks
  // directly to the Sourcify API v2.
};

// Extend the deploy task to also generate TypeScript ABIs after deployment.
task("deploy").setAction(async (args, hre, runSuper) => {
  await runSuper(args);
  await generateTsAbis(hre);
});

export default config;
