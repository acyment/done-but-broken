// M6.5 budget-ratification report (IMPLEMENTATION-PLAN.md M6.5, [R2: R2-4]): extracts the observed
// per-task appetite from a calibration manifest and compares it against the provisional sealed
// budgets. The freeze rule is the plan's: if the observed appetite fits, the provisional values
// freeze unchanged; if not, they are adjusted ONCE and frozen. This tool reports and recommends —
// the constants edit is a separate, recorded act.
//
//   bun run bin/e4-budget-report.ts <path-to-calibration-manifest.json>
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadE4Constants } from "../src/e4/constants";
import { validateE4RunManifest } from "../src/e4/manifest";

const repoRoot = resolve(import.meta.dir, "..");

function tokensTotal(tokens: { fresh_input_tokens: number; cached_input_tokens: number; output_tokens: number }): number {
  return tokens.fresh_input_tokens + tokens.cached_input_tokens + tokens.output_tokens;
}

async function main(): Promise<number> {
  const manifestPath = process.argv[2];

  if (!manifestPath) {
    console.error("usage: bun run bin/e4-budget-report.ts <calibration-manifest.json>");
    return 2;
  }

  const manifest = validateE4RunManifest(JSON.parse(await readFile(manifestPath, "utf8")));
  const { constants } = await loadE4Constants(join(repoRoot, "docs", "protocols", "e4-sealed-constants-v0.json"));
  const budgets = constants.budgets!;

  if (manifest.run_classification !== "calibration") {
    console.error(`refusing: ${manifest.run_id} is ${manifest.run_classification}, not a calibration run`);
    return 2;
  }

  console.log(`calibration run: ${manifest.run_id} (${manifest.model.model_id}, seed ${manifest.substrate_seed})`);
  console.log(
    `provisional budgets: turns_per_task=${budgets.turns_per_task} verifications_per_task=${budgets.verifications_per_task} token_budget=${budgets.token_budget} spend_cap_usd=${budgets.spend_cap_usd}`
  );

  let maxTurns = 0;
  let maxTokens = 0;
  let maxSmoke = 0;

  for (const task of manifest.tasks) {
    const tokens = tokensTotal(task.usage.tokens);
    maxTurns = Math.max(maxTurns, task.usage.turns);
    maxTokens = Math.max(maxTokens, tokens);
    maxSmoke = Math.max(maxSmoke, task.smoke_feedback_runs);
    console.log(
      `task ${task.task_index}: ${task.termination} phase=${task.phase_at_termination} turns=${task.usage.turns} ` +
        `smoke=${task.smoke_feedback_runs} tokens=${tokens} (spec-phase ${tokensTotal(task.usage.by_phase.spec.tokens)}, ` +
        `impl ${tokensTotal(task.usage.by_phase.implementation.tokens)}) oracle=${task.oracle.cumulative_pass}/${task.oracle.cumulative_total} ` +
        `gate={cust:${task.gate_events?.custody_failures ?? "-"},red:${task.gate_events?.red_check ?? "-"},ref:${task.gate_events?.refused_done_over_red ?? "-"}} ` +
        `spend=${task.usage.spend_usd.toFixed(6)}`
    );
  }

  const sequenceSpend = manifest.usage_totals.spend_usd;
  const anyWall = manifest.tasks.some(
    (task) =>
      (task.termination === "budget_exhausted" || task.termination === "spend_cap_reached") &&
      task.oracle.cumulative_pass < task.oracle.cumulative_total
  );

  console.log(
    `observed appetite: max turns/task=${maxTurns} max tokens/task=${maxTokens} max smoke/task=${maxSmoke} sequence spend=${sequenceSpend.toFixed(6)}`
  );

  const turnsOk = maxTurns <= budgets.turns_per_task;
  const tokensOk = maxTokens <= budgets.token_budget;
  const smokeOk = maxSmoke <= budgets.verifications_per_task;
  const spendOk = sequenceSpend <= budgets.spend_cap_usd;

  console.log(
    `fit: turns=${turnsOk} tokens=${tokensOk} verifications=${smokeOk} spend=${spendOk} budget_walls_observed=${anyWall}`
  );

  if (turnsOk && tokensOk && smokeOk && spendOk && !anyWall) {
    console.log("recommendation: FREEZE UNCHANGED — the observed appetite fits the provisional budgets with headroom.");
  } else {
    console.log(
      "recommendation: ADJUST ONCE and freeze — proposed values (~1.5x observed max, rounded up): " +
        `turns_per_task=${Math.max(budgets.turns_per_task, Math.ceil(maxTurns * 1.5))} ` +
        `verifications_per_task=${Math.max(budgets.verifications_per_task, Math.ceil(maxSmoke * 1.5))} ` +
        `token_budget=${Math.max(budgets.token_budget, Math.ceil((maxTokens * 1.5) / 10000) * 10000)} ` +
        `spend_cap_usd=${Math.max(budgets.spend_cap_usd, Math.ceil(sequenceSpend * 3))}`
    );
  }

  return 0;
}

process.exit(await main());
