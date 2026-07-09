// E4 replay-validity inspector CLI (IMPLEMENTATION-PLAN.md M5; [R2: R2-9b]). Recomputes
// chain_replay_valid for every arm manifest under <runRoot>/manifests/ by recorded-event
// reconstruction — no provider call is ever made. Exit 0 iff every inspected sequence is
// chain-replay-valid; --write updates each manifest's replay_validity block in place.
//
//   bun run bin/e4-inspect.ts <runRoot> [--write]
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { inspectE4ArmSequence } from "../src/e4/inspect";
import { validateE4RunManifest } from "../src/e4/manifest";

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const runRoot = args.find((arg) => !arg.startsWith("--"));

  if (!runRoot) {
    console.error("usage: bun run bin/e4-inspect.ts <runRoot> [--write]");
    return 2;
  }

  let manifestFiles: string[];

  try {
    manifestFiles = (await readdir(join(runRoot, "manifests"))).filter((name) => name.endsWith(".json")).sort();
  } catch {
    console.error(`no manifests directory under ${runRoot}`);
    return 2;
  }

  if (manifestFiles.length === 0) {
    console.error(`no manifests found under ${join(runRoot, "manifests")}`);
    return 2;
  }

  let allValid = true;

  for (const file of manifestFiles) {
    const path = join(runRoot, "manifests", file);
    const manifest = validateE4RunManifest(JSON.parse(await readFile(path, "utf8")));
    const inspection = await inspectE4ArmSequence({ runRoot, manifest });

    const flags = [
      `substrate=${inspection.substrate_regeneration_ok ? "ok" : "FAIL"}`,
      `tasks=${inspection.per_task_replay_ok.filter(Boolean).length}/${inspection.per_task_replay_ok.length}`,
      `seams=${inspection.resume_seams_ok ? "ok" : "FAIL"}`,
      `snapshots=${inspection.snapshot_integrity_ok ? "ok" : "FAIL"}`,
      `artifacts=${inspection.executor_artifacts_present ? "ok" : "FAIL"}`,
      `oracle-recompute=${inspection.oracle_recomputation_ok ? "ok" : "FAIL"}`
    ].join(" ");

    console.log(
      `${manifest.arm}: chain_replay_valid=${inspection.chain_replay_valid} (${flags})`
    );

    for (const problem of inspection.problems) {
      console.log(`  - ${problem}`);
    }

    if (write) {
      manifest.replay_validity = {
        substrate_regeneration_ok: inspection.substrate_regeneration_ok,
        per_task_replay_ok: inspection.per_task_replay_ok,
        chain_replay_valid: inspection.chain_replay_valid
      };
      await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
    }

    allValid = allValid && inspection.chain_replay_valid;
  }

  return allValid ? 0 : 1;
}

process.exit(await main());
