// Generates oracle-package/cases.json and task-package/feedback-assets/cases/cpNN.json from
// the sealed scenario definitions. Every expected value is computed from the reference
// implementation, never hand-written, so the reference passes by construction.
//
// Run: bun tasks/e1-billing-v2/oracle-package/generate-cases.ts

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { evaluate } from "../reference/src/billing";
import { SCENARIOS } from "./scenarios";

const here = import.meta.dir;
const oracleCases = [];
const visibleByCheckpoint = new Map<string, Array<Record<string, unknown>>>();

for (const scenario of SCENARIOS) {
  const expected = evaluate(scenario.events as never, scenario.query as never);

  oracleCases.push({
    check_id: scenario.check_id,
    commitment_id: scenario.commitment_id,
    checkpoint_introduced: scenario.checkpoint,
    entry_module: "src/billing.ts",
    export: "evaluate",
    args: [scenario.events, scenario.query],
    expected,
    held_out: !scenario.visible
  });

  if (scenario.visible) {
    const list = visibleByCheckpoint.get(scenario.checkpoint) ?? [];
    list.push({ check_id: scenario.check_id, args: [scenario.events, scenario.query], expected });
    visibleByCheckpoint.set(scenario.checkpoint, list);
  }
}

await writeFile(join(here, "cases.json"), `${JSON.stringify(oracleCases, null, 2)}\n`);

const feedbackCasesDir = join(here, "..", "task-package", "feedback-assets", "cases");
await mkdir(feedbackCasesDir, { recursive: true });

for (let index = 1; index <= 18; index += 1) {
  const checkpoint = String(index);
  const fileName = `cp${String(index).padStart(2, "0")}.json`;
  await writeFile(
    join(feedbackCasesDir, fileName),
    `${JSON.stringify(visibleByCheckpoint.get(checkpoint) ?? [], null, 2)}\n`
  );
}

const heldOut = oracleCases.filter((c) => c.held_out).length;
console.log(`cases=${oracleCases.length} held_out=${heldOut} (${((heldOut / oracleCases.length) * 100).toFixed(1)}%)`);

for (let index = 1; index <= 18; index += 1) {
  const checkpoint = String(index);
  const total = oracleCases.filter((c) => c.checkpoint_introduced === checkpoint).length;
  const held = oracleCases.filter((c) => c.checkpoint_introduced === checkpoint && c.held_out).length;
  console.log(`cp${checkpoint}: total=${total} held_out=${held}`);
}
