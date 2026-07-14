// E5 P1.2w seed scan — the prereg §2 outcome-blind mechanical rule, executable. Zero spend.
// Scans substrate seeds 200–999 (excluding 220/636/829, P1.1's set): under the P1.1 structural
// floor (≥2 drift_opportunity, ≥1 additive, exactly 1 behavior_preserving over a 6-task draw
// under the sealed v0.7 op mix), primary score = INTERACTION count — the number of tasks (after
// the first) whose delta touches an entity or endpoint introduced or modified by an EARLIER task
// in the same sequence, a pure function of the draw — tiebreak = underdetermined-fact density
// (P1.1's enrichment score), then ascending seed. Prints the top-3 (#1 runs, #2
// kill-confirmation, #3 VOID reserve) and writes the full scan to the given output path.
import { join, resolve } from "node:path";
import { E4_V2_CONSTANTS_PATH, loadE4V2Constants } from "../src/e4/v2/constants";
import { buildBaselineIr } from "../src/e4/substrate/ir";
import { createE4Prng } from "../src/e4/substrate/prng";
import { drawE4V2TaskSequence } from "../src/e4/substrate/v2/draw";
import { renderTaskTextV2 } from "../src/e4/substrate/v2/render";
import { computeE4TaskDelta, type E4TaskDelta } from "../src/e4/v3/task-delta";
import { tagE4RequestDeterminacy, underdeterminedFacts } from "../src/e4/v3/ambiguity";
import type { E4ChangeOpKind } from "../src/e4/substrate/ops";

const repoRoot = resolve(import.meta.dir, "..");
const outPath = process.argv[2] ?? join(repoRoot, "tmp", "e5-p12w-seed-scan.json");
const { constants } = await loadE4V2Constants(join(repoRoot, E4_V2_CONSTANTS_PATH));

const P11_SEEDS = new Set([220, 636, 829]);

// Entity/endpoint identity strings a delta TOUCHES — introduces, removes, renames, or otherwise
// modifies. Fields/rules/conventions contribute their OWNING entity's name (a field add on
// Widget touches "Widget"); conventions are excluded (not entity/endpoint-scoped, prereg §2).
function deltaEntityEndpointTouches(delta: E4TaskDelta): Set<string> {
  const touched = new Set<string>();

  for (const entity of [...delta.added_entities, ...delta.removed_entities]) {
    touched.add(entity.name);
  }
  for (const rename of delta.renamed_entities) {
    touched.add(rename.old_name);
    touched.add(rename.new_name);
  }
  for (const field of [...delta.added_fields, ...delta.removed_fields]) {
    touched.add(field.entity);
  }
  for (const rename of delta.renamed_fields) {
    touched.add(rename.entity);
  }
  for (const retype of delta.retyped_fields) {
    touched.add(retype.entity);
  }
  for (const endpoint of [...delta.added_endpoints, ...delta.removed_endpoints]) {
    touched.add(endpoint.entity);
    touched.add(endpoint.path);
  }
  for (const change of delta.changed_endpoints) {
    touched.add(change.entity);
    touched.add(change.old.path);
    touched.add(change.new.path);
  }
  for (const rule of [...delta.added_rules, ...delta.removed_rules]) {
    touched.add(rule.entity);
  }

  return touched;
}

type Row = {
  seed: number;
  interaction: number;
  enrichment: number;
  op_kinds: string[];
  drift: number;
  additive: number;
  behavior_preserving: number;
};

const rows: Row[] = [];

for (let seed = 200; seed <= 999; seed += 1) {
  if (P11_SEEDS.has(seed)) {
    continue;
  }

  const baseline = buildBaselineIr();
  // Mirrors e4ProceduralRestV2Provider.generate's PRNG consumption exactly (P1.1 precedent):
  // one draw pass, then one render per task in order.
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

  let interaction = 0;
  let enrichment = 0;
  let previousIr = baseline;
  const priorTouches = new Set<string>();
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
    const touches = deltaEntityEndpointTouches(delta);

    if ([...touches].some((subject) => priorTouches.has(subject))) {
      interaction += 1;
    }
    for (const subject of touches) {
      priorTouches.add(subject);
    }

    const facts = tagE4RequestDeterminacy({
      opKind: task.op_kind as E4ChangeOpKind,
      namesItemVerbatim: rendered.names_item_verbatim,
      delta
    });

    enrichment += underdeterminedFacts(facts).length;
    previousIr = task.ground_truth_ir;
  }

  if (!renderOk || drift < 2 || additive < 1 || bp !== 1) {
    continue;
  }

  rows.push({ seed, interaction, enrichment, op_kinds: tasks.map((task) => task.op_kind), drift, additive, behavior_preserving: bp });
}

rows.sort((a, b) =>
  a.interaction === b.interaction ? (a.enrichment === b.enrichment ? a.seed - b.seed : b.enrichment - a.enrichment) : b.interaction - a.interaction
);

const top3 = rows.slice(0, 3);

await Bun.write(
  outPath,
  `${JSON.stringify(
    {
      schema: "e5-p12w-seed-scan-v1",
      rule: "docs/e5/E5-P12W-DURING-WORK-PREREG-v1.md §2",
      range: [200, 999],
      excluded_seeds: [...P11_SEEDS].toSorted((a, b) => a - b),
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
  console.log(`seed ${row.seed}: interaction ${row.interaction} enrichment ${row.enrichment} ops [${row.op_kinds.join(", ")}]`);
}
