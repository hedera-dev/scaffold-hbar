import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { verifyOnSourcify } from "../verifySourcify";

async function verifySourcify(name: string, address: string): Promise<void> {
  console.log(`\n=== Verifying ${name} on Sourcify ===`);
  console.log("  Address:", address);
  const chainId = hre.network.config.chainId ?? 296;
  const hashscan = chainId === 295 ? "https://hashscan.io/mainnet" : "https://hashscan.io/testnet";
  if (!(await verifyOnSourcify(name, address, { chainId, hashscan }))) {
    throw new Error(`${name} verification failed`);
  }
}

async function main() {
  const deployedPath = path.resolve(__dirname, "../../config/deployed-addresses.json");
  if (!fs.existsSync(deployedPath)) throw new Error("config/deployed-addresses.json not found — run deploy.ts first");

  const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));

  const senderAddr = deployed.hederaMessageSender;
  const orchestratorAddr = deployed.hederaOrchestrator;

  if (!senderAddr) throw new Error("hederaMessageSender not found in deployed-addresses.json");
  if (!orchestratorAddr) throw new Error("hederaOrchestrator not found in deployed-addresses.json");

  await verifySourcify("AxelarMessageSender", senderAddr);
  await verifySourcify("DcaOrchestrator", orchestratorAddr);

  console.log("\n✅ Hedera verification complete.");
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
