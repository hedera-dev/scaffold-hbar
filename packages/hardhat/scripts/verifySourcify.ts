import * as fs from "fs";
import * as path from "path";

/**
 * Verifies a deployed contract on Sourcify (API v2) — the Hedera-supported verifier.
 *
 * Usage:
 *   yarn verify:contract -- HederaToken testnet [0xAddress]
 *   yarn verify:contract -- HederaToken mainnet [0xAddress]
 * If the address is omitted, it is read from deployments/<network>/<Contract>.json.
 */

const NETWORKS: Record<string, { chainId: number; hashscan: string; deploymentsDir: string }> = {
  testnet: { chainId: 296, hashscan: "https://hashscan.io/testnet", deploymentsDir: "hederaTestnet" },
  mainnet: { chainId: 295, hashscan: "https://hashscan.io/mainnet", deploymentsDir: "hederaMainnet" },
};

const SOURCIFY_API = "https://sourcify.dev/server/v2";

interface BuildInfo {
  input: Record<string, unknown> & { sources?: Record<string, unknown> };
  solcLongVersion: string;
  output: { contracts: Record<string, Record<string, unknown>> };
}

/** Submits the solc standard-json from artifacts/build-info to Sourcify v2 and polls the job. */
export async function verifyOnSourcify(
  contractName: string,
  address: string,
  network: { chainId: number; hashscan: string },
): Promise<boolean> {
  // Every build-info that contains the contract is a candidate (latest first).
  const buildInfoDir = path.join("artifacts", "build-info");
  const candidates = fs
    .readdirSync(buildInfoDir)
    .filter(f => f.endsWith(".json"))
    .map(f => ({ file: f, mtime: fs.statSync(path.join(buildInfoDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .map(({ file }) => {
      const info: BuildInfo = JSON.parse(fs.readFileSync(path.join(buildInfoDir, file), "utf8"));
      const sourcePath = Object.keys(info.output.contracts).find(p => contractName in info.output.contracts[p]);
      return sourcePath ? { info, sourcePath } : null;
    })
    .filter((c): c is { info: BuildInfo; sourcePath: string } => c !== null);

  if (candidates.length === 0) {
    console.error(`No build-info contains ${contractName}. Run \`yarn compile\` first.`);
    return false;
  }

  for (const { info, sourcePath } of candidates) {
    const { language, sources, settings } = info.input as {
      language?: string;
      sources?: unknown;
      settings?: unknown;
    };
    const res = await fetch(`${SOURCIFY_API}/verify/${network.chainId}/${address}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        stdJsonInput: { language, sources, settings },
        compilerVersion: info.solcLongVersion,
        contractIdentifier: `${sourcePath}:${contractName}`,
      }),
    });

    if (!res.ok) {
      console.log(`  candidate ${sourcePath} rejected (${res.status}), trying next if any`);
      continue;
    }

    const { verificationId } = (await res.json()) as { verificationId: string };
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2000));
      const job = (await (await fetch(`${SOURCIFY_API}/verify/${verificationId}`)).json()) as {
        isJobCompleted: boolean;
        contract?: { match?: string | null };
        error?: { customCode?: string };
      };
      if (!job.isJobCompleted) continue;
      if (job.contract?.match) {
        console.log(`✅ ${job.contract.match} — verified on Sourcify`);
        console.log(`   HashScan: ${network.hashscan}/contract/${address}`);
        return true;
      }
      if (job.error?.customCode === "already_verified") {
        const existing = (await (await fetch(`${SOURCIFY_API}/contract/${network.chainId}/${address}`)).json()) as {
          match?: string | null;
          runtimeMatch?: string | null;
        };
        console.log(`✅ already verified on Sourcify (${existing.match ?? existing.runtimeMatch ?? "match"})`);
        console.log(`   HashScan: ${network.hashscan}/contract/${address}`);
        return true;
      }
      console.log(`  no match for ${sourcePath}, trying next candidate if any`);
      break;
    }
  }

  console.error(`Sourcify could not match ${contractName} at ${address}. Wrong address or stale artifacts?`);
  return false;
}

async function main() {
  const [contractName, networkArg, addressArg] = process.argv.slice(2);
  const network = NETWORKS[networkArg ?? ""];
  if (!contractName || !network) {
    console.error(`Usage: yarn verify:contract -- <ContractName> <testnet|mainnet> [0xAddress]`);
    process.exit(1);
  }

  const address =
    addressArg ??
    (() => {
      const deploymentFile = path.join("deployments", network.deploymentsDir, `${contractName}.json`);
      if (!fs.existsSync(deploymentFile)) {
        console.error(`No address passed and ${deploymentFile} not found`);
        process.exit(1);
      }
      return (JSON.parse(fs.readFileSync(deploymentFile, "utf8")) as { address: string }).address;
    })();

  console.log(`Verifying ${contractName} at ${address} on chain ${network.chainId} via Sourcify v2...`);
  const ok = await verifyOnSourcify(contractName, address, network);
  if (!ok) process.exit(1);
}

if (require.main === module) {
  main().catch(e => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
