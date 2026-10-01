import hre from "hardhat";
import { verifyOnSourcify } from "./verifySourcify";

/**
 * Verify contracts deployed with hardhat-deploy on the active network.
 * Reads addresses from `deployments/<network>/` and submits to Sourcify (API v2).
 *
 * Skips stale deployment records that no longer have compiled artifacts in this repo.
 */
async function main() {
  const all = await hre.deployments.all();
  const names = Object.keys(all).sort();

  if (names.length === 0) {
    throw new Error(
      `No deployments found for "${hre.network.name}". Run \`yarn hardhat:deploy --network ${hre.network.name}\` first.`,
    );
  }

  const chainId = hre.network.config.chainId ?? 296;
  const hashscan = chainId === 295 ? "https://hashscan.io/mainnet" : "https://hashscan.io/testnet";

  let verified = 0;

  for (const name of names) {
    try {
      await hre.artifacts.readArtifactSync(name);
    } catch {
      console.log(`Skipping ${name} — no artifact in this project (stale deployment record).`);
      continue;
    }

    const { address } = all[name];
    console.log(`\nVerifying ${name} at ${address}...`);

    if (await verifyOnSourcify(name, address, { chainId, hashscan })) {
      verified++;
    }
  }

  if (verified === 0) {
    throw new Error(
      `No verifiable deployments on "${hre.network.name}". Deploy FileRegistry or remove stale records under deployments/.`,
    );
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
