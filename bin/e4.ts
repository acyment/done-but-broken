// E4 dry-run CLI (IMPLEMENTATION-PLAN.md M6): one seeded command → sequence-per-arm runs with the
// deterministic fake agent, zero provider spend. Live-provider wiring is deliberately ABSENT until
// M6.5 (spend-gated): this binary can only run `dry_run`-classified fake runs, so no flag mistake
// can spend money or mint a calibration/pilot classification here.
//
//   bun run bin/e4.ts --run-root <dir> [--seeds 42,43] [--tasks 3] [--resume]
//                     [--crash-at <arm>:<taskIndex>]   (test seam: simulated harness crash)
//
// Layout: <run-root>/seed-<n>/ holds one 3-arm paired run (pairing_label pair-dryrun-seed-<n>);
// bin/e4-gonogo.ts and bin/e4-inspect.ts read these roots.
import { join, resolve } from "node:path";
import { loadE4Constants } from "../src/e4/constants";
import { runE4Run } from "../src/e4/run-orchestrator";
import { buildE4FakeProviderFactory } from "../src/e4/fake-provider";
import { e4ProceduralRestV1Provider, type E4SubstrateConfig } from "../src/e4/substrate/provider";
import type { E4ArmId } from "../src/e4/types";

const repoRoot = resolve(import.meta.dir, "..");
const CONSTANTS_PATH = join(repoRoot, "docs", "protocols", "e4-sealed-constants-v0.json");

function parseArgs(argv: string[]): {
  runRoot: string;
  seeds: number[];
  tasks: number;
  resume: boolean;
  crashAt: { arm: E4ArmId; task_index: number } | null;
} {
  const get = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };

  const runRoot = get("--run-root");

  if (!runRoot) {
    throw new Error("usage: bun run bin/e4.ts --run-root <dir> [--seeds 42,43] [--tasks 3] [--resume] [--crash-at arm:task]");
  }

  const crashAtRaw = get("--crash-at");
  let crashAt: { arm: E4ArmId; task_index: number } | null = null;

  if (crashAtRaw) {
    const [arm, task] = crashAtRaw.split(":");
    crashAt = { arm: arm as E4ArmId, task_index: Number(task) };
  }

  return {
    runRoot,
    seeds: (get("--seeds") ?? "42").split(",").map((seed) => Number(seed.trim())),
    tasks: Number(get("--tasks") ?? "3"),
    resume: argv.includes("--resume"),
    crashAt
  };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const { constants, hash: constantsHash } = await loadE4Constants(CONSTANTS_PATH);

  if (constants.op_mix === null || constants.compatibility_boundary.substrate_config_id === null) {
    throw new Error("sealed constants are pre-M1: op_mix / substrate_config_id missing");
  }

  for (const seed of args.seeds) {
    const config: E4SubstrateConfig = {
      substrate_config_id: constants.compatibility_boundary.substrate_config_id,
      substrate_seed: seed,
      task_count: args.tasks,
      op_mix: { weights: constants.op_mix.weights }
    };

    // The factory is scripted from the same deterministic generate() the orchestrator re-runs
    // internally — identical output by generator determinism (Feature 1).
    const generated = await e4ProceduralRestV1Provider.generate(config);

    const { manifests } = await runE4Run({
      runRoot: join(args.runRoot, `seed-${seed}`),
      constants,
      constantsHash,
      substrate: e4ProceduralRestV1Provider,
      config,
      pairing_label: `pair-dryrun-seed-${seed}`,
      run_classification: "dry_run",
      model: { preset: "fake-deterministic", model_id: "e4-fake-agent-v1", route_id: "none" },
      providerFactory: buildE4FakeProviderFactory({
        generated,
        smoke_command: constants.feedback!.smoke_command,
        ...(args.crashAt ? { crash_at: args.crashAt } : {})
      }),
      resume: args.resume
    });

    for (const arm of Object.keys(manifests).sort() as E4ArmId[]) {
      const manifest = manifests[arm]!;
      console.log(
        `seed ${seed} ${arm}: tasks=${manifest.tasks.length}/${args.tasks} ` +
          `chain_replay_valid=${manifest.replay_validity.chain_replay_valid} ` +
          `spend_usd=${manifest.usage_totals.spend_usd}`
      );
    }
  }

  return 0;
}

process.exit(await main());
