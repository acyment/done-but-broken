// [Phase-0 learning boundary] Zero-spend seed scout for the learning ladder: prints each
// candidate seed's drawn op composition at the chosen task_count (a pure function of the seed)
// and flags the regimes the ladder needs — rename_entity ("hard" — the M6 grind/inversion
// channel), delete_entity (the other retirement op), and rename-free drift controls.
//
//   bun run bin/e4-v3-seed-scout.ts [--tasks 3] [--from 1] [--to 300] [--all]
//
// Default prints only flagged seeds outside the exclusion set; --all prints every scanned seed.
import { join, resolve } from "node:path";
import { E4_V2_CONSTANTS_PATH, loadE4V2Constants } from "../src/e4/v2/constants";
import { e4ProceduralRestV2Provider } from "../src/e4/substrate/v2/provider";

// Every seed ever used as evidence, calibration, dry-run/test fixture, or void — reused seeds
// would flavor learning with known outcomes and contaminate any future evidence pre-registration.
export const E4_LEARNING_EXCLUDED_SEEDS = new Set([
  0, 3, 4, 22, 36, 37, 41, 42, 43, 45, 46, 49, 50, 52, 60, 62, 63, 65, 68, 75,
  // learning-ladder seeds (L1-L5 live + dry-run rehearsals, 2026-07-11) — consumed
  1, 7, 12, 13, 15, 17,
  // v3-M7 pre-seal calibration rung (2026-07-12) — consumed
  144
]);

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : null;
}

const repoRoot = resolve(import.meta.dir, "..");
const taskCount = Number(argValue("--tasks") ?? "3");
const from = Number(argValue("--from") ?? "1");
const to = Number(argValue("--to") ?? "300");
const printAll = process.argv.includes("--all");

const { constants } = await loadE4V2Constants(join(repoRoot, E4_V2_CONSTANTS_PATH));

const RETIREMENT_OPS = new Set(["rename_entity", "delete_entity"]);
const DRIFT_LABEL = "drift_opportunity";

for (let seed = from; seed <= to; seed++) {
  if (E4_LEARNING_EXCLUDED_SEEDS.has(seed)) continue;

  const generated = await e4ProceduralRestV2Provider.generate({
    substrate_config_id: constants.compatibility_boundary.substrate_config_id,
    substrate_seed: seed,
    task_count: taskCount,
    op_mix: { weights: constants.op_mix.weights }
  });

  const ops = generated.tasks.map((task) => task.op_kind);
  const labels = generated.tasks.map((task) => task.opportunity_labels);
  const driftCount = labels.filter((entry) => entry.includes(DRIFT_LABEL as never)).length;
  const hasRename = ops.includes("rename_entity");
  const hasDelete = ops.includes("delete_entity");
  const hasRetirement = ops.some((op) => RETIREMENT_OPS.has(op));

  const flags: string[] = [];
  if (hasRename) flags.push("HARD:rename_entity");
  if (hasDelete && !hasRename) flags.push("HARD:delete_entity");
  if (!hasRetirement && driftCount >= 1) flags.push("CONTROL:rename-free-drift");

  if (flags.length === 0 && !printAll) continue;

  console.log(`seed ${seed}: [${ops.join(" | ")}] drift_tasks=${driftCount}${flags.length ? `  ← ${flags.join(", ")}` : ""}`);
}
