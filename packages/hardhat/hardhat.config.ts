import * as dotenv from "dotenv";
dotenv.config();

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import generateTsAbis from "./scripts/generateTsAbis";

// Hedera — key injected at runtime by runHardhatDeployWithPK.ts
const hederaRpcUrl = process.env.HEDERA_RPC_URL || "https://testnet.hashio.io/api";
const hederaPrivateKey =
  process.env.__RUNTIME_HEDERA_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// Sepolia — key injected at runtime by runHardhatDeployWithPK.ts
const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL || "";
const sepoliaPrivateKey = process.env.__RUNTIME_ETH_PRIVATE_KEY || "";
const etherscanApiKey = process.env.ETHERSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.24",
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
  networks: {
    hederaTestnet: {
      url: hederaRpcUrl,
      accounts: hederaPrivateKey ? [hederaPrivateKey] : [],
      chainId: 296,
      gas: 4_000_000,
      gasPrice: 1_200_000_000_000,
    },
    hederaMainnet: {
      url: "https://mainnet.hashio.io/api",
      accounts: hederaPrivateKey ? [hederaPrivateKey] : [],
      chainId: 295,
    },
    ethereumSepolia: {
      url: sepoliaRpcUrl,
      accounts: sepoliaPrivateKey ? [sepoliaPrivateKey] : [],
      chainId: 11155111,
    },
  },
  // Hedera verification: `yarn hedera:verify` (scripts/hedera/verify.ts) talks directly to the
  // Sourcify API v2 — hardhat-verify's Hedera path is dead since Sourcify removed API v1.
  // Sepolia uses Etherscan — requires customChains so hardhat-verify maps the
  // custom network name "ethereumSepolia" to the correct Etherscan API endpoint.
  etherscan: {
    apiKey: etherscanApiKey,
    customChains: [
      {
        network: "ethereumSepolia",
        chainId: 11155111,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=11155111",
          browserURL: "https://sepolia.etherscan.io",
        },
      },
    ],
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

// Extend the deploy task to also generate TypeScript ABIs after deployment.
task("deploy").setAction(async (args, hre, runSuper) => {
  await runSuper(args);
  await generateTsAbis(hre);
});

export default config;
