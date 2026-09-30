import * as fs from "fs";
import * as path from "path";

/**
 * Verifies a deployed contract on Sourcify (API v2) — the Hedera-supported verifier.
 *
 * Why this exists: @nomicfoundation/hardhat-verify 2.x (the newest line compatible with
 * Hardhat 2) talks to the Sourcify API v1, which Sourcify has removed server-side.
 * v2 support only exists in hardhat-verify 3.x, which requires Hardhat 3.
 * Until the template migrates to Hardhat 3, this script submits the solc standard-json
 * from artifacts/build-info directly to https://sourcify.dev/server/v2.
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

const fail = (msg: string): never => {
  console.error(`❌ ${msg}`);
  process.exit(1);
};

async function main() {
  const [contractName, networkArg, addressArg] = process.argv.slice(2);
  const network = NETWORKS[networkArg ?? ""];
  if (!contractName || !network) {
    fail(`Usage: yarn verify:contract -- <ContractName> <testnet|mainnet> [0xAddress]`);
  }

  const address =
    addressArg ??
    (() => {
      const deploymentFile = path.join("deployments", network.deploymentsDir, `${contractName}.json`);
      if (!fs.existsSync(deploymentFile)) fail(`No address passed and ${deploymentFile} not found`);
      return (JSON.parse(fs.readFileSync(deploymentFile, "utf8")) as { address: string }).address;
    })();

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
    fail(`No build-info contains ${contractName}. Run \`yarn compile\` first.`);
  }

  console.log(`Verifying ${contractName} at ${address} on chain ${network.chainId} via Sourcify v2...`);

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
        return;
      }
      if (job.error?.customCode === "already_verified") {
        const existing = (await (await fetch(`${SOURCIFY_API}/contract/${network.chainId}/${address}`)).json()) as {
          match?: string | null;
          runtimeMatch?: string | null;
        };
        console.log(`✅ already verified on Sourcify (${existing.match ?? existing.runtimeMatch ?? "match"})`);
        console.log(`   HashScan: ${network.hashscan}/contract/${address}`);
        return;
      }
      console.log(`  no match for ${sourcePath}, trying next candidate if any`);
      break;
    }
  }

  fail(`Sourcify could not match ${contractName} at ${address}. Wrong address or stale artifacts?`);
}

main().catch(e => fail(e instanceof Error ? e.message : String(e)));
