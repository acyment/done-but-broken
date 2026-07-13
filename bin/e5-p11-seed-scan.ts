// E5 P1.1 seed scan — the prereg §2.4 outcome-blind mechanical rule, executable. Zero spend.
// Scans substrate seeds 200–999: structural floor (≥2 drift_opportunity, ≥1 additive, exactly
// 1 behavior_preserving over a 6-task draw under the sealed v0.7 op mix), enrichment score =
// total underdetermined facts per the sealed determinacy tagger over each task's delta with the
// task's actual rendered names_item_verbatim flag. Prints the top-3 (ties → lower seed) and
// writes the full scan to the given output path for committing with the run artifacts.
import { join, resolve } from "node:path";
import { E4_V2_CONSTANTS_PATH, loadE4V2Constants } from "../src/e4/v2/constants";
import { buildBaselineIr } from "../src/e4/substrate/ir";
import { createE4Prng } from "../src/e4/substrate/prng";
import { drawE4V2TaskSequence } from "../src/e4/substrate/v2/draw";
import { renderTaskTextV2 } from "../src/e4/substrate/v2/render";
import { computeE4TaskDelta } from "../src/e4/v3/task-delta";
import { tagE4RequestDeterminacy, underdeterminedFacts } from "../src/e4/v3/ambiguity";
import type { E4ChangeOpKind } from "../src/e4/substrate/ops";

const repoRoot = resolve(import.meta.dir, "..");
const outPath = process.argv[2] ?? join(repoRoot, "tmp", "e5-p11-seed-scan.json");
const { constants } = await loadE4V2Constants(join(repoRoot, E4_V2_CONSTANTS_PATH));

type Row = {
  seed: number;
  score: number;
  op_kinds: string[];
  drift: number;
  additive: number;
  behavior_preserving: number;
};

const rows: Row[] = [];

for (let seed = 200; seed <= 999; seed += 1) {
  const baseline = buildBaselineIr();
  // Mirrors e4ProceduralRestV2Provider.generate's PRNG consumption exactly: one draw pass,
  // then one render per task in order — the rendered names_item_verbatim flags are the ones a
  // real run would produce.
  const prng = createE4Prng(seed);

  let tasks;

  try {
    tasks = drawE4V2TaskSequence({ baselineIr: baseline, taskCount: 6, opMix: { weights: constants.op_mix.weights }, prng });
  } catch {
    continue; // undrawable sequences (e.g. exhausted pools) simply fail the floor
  }

  const labels = tasks.flatMap((task) => task.opportunity_labels);
  const drift = labels.filter((label) => label === "drift_opportunity").length;
  const additive = labels.filter((label) => label === "additive").length;
  const bp = labels.filter((label) => label === "behavior_preserving").length;

  let score = 0;
  let previousIr = baseline;
  let renderOk = true;

  for (const task of tasks) {
    let rendered;

    try {
      rendered = renderTaskTextV2({ opKind: task.op_kind, renderContext: task.render_context }, prng);
    } catch {
      renderOk = false;
      break;
    }

    const delta = computeE4TaskDelta(previousIr, task.ground_truth_ir);
    const facts = tagE4RequestDeterminacy({
      opKind: task.op_kind as E4ChangeOpKind,
      namesItemVerbatim: rendered.names_item_verbatim,
      delta
    });

    score += underdeterminedFacts(facts).length;
    previousIr = task.ground_truth_ir;
  }

  if (!renderOk || drift < 2 || additive < 1 || bp !== 1) {
    continue;
  }

  rows.push({ seed, score, op_kinds: tasks.map((task) => task.op_kind), drift, additive, behavior_preserving: bp });
}

rows.sort((a, b) => (a.score === b.score ? a.seed - b.seed : b.score - a.score));

const top3 = rows.slice(0, 3);

await Bun.write(
  outPath,
  `${JSON.stringify(
    {
      schema: "e5-p11-seed-scan-v1",
      rule: "docs/e5/E5-P11-TRUTH-VISIBLE-CLOSE-PREREG-v1.md §2.4",
      range: [200, 999],
      constants_version: constants.version,
      passed_floor: rows.length,
      top3,
      all: rows
    },
    null,
    2
  )}\n`
);

console.log(`floor-passing seeds: ${rows.length}; scan → ${outPath}`);
for (const row of top3) {
  console.log(`seed ${row.seed}: score ${row.score} ops [${row.op_kinds.join(", ")}]`);
}
