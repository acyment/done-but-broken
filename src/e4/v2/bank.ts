// Adversarial-implementation bank + kill score (E4V2 design §7, adjudication A1 — the primary
// scenario-strength instrument). Generated per task from the task's GOLD IR deterministically:
// each variant is a full generated workspace whose server is mutated by SEALED, anchored
// byte-level surgery on the scaffold source (the M6 registry-bypass fixture precedent: if a
// scaffold anchor drifts, the builder THROWS rather than silently testing nothing).
//
// Ecological-validity pin (A1): the bank uses gold knowledge only the harness has — it is
// MEASURED and HIDDEN, never a gate, never agent-facing feedback. Kill score = fraction of
// variants on which ≥1 of the agent's scenarios fails; recorded per task with per-variant
// verdicts. A vacuous-but-passing spec lands as high false-confidence + LOW kill score +
// coverage gap — the phenomenon measured, not prevented.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { E4SchemaIR } from "../substrate/ir";
import { buildE4V2AppFiles } from "../substrate/v2/scaffold";
import type { E4ExecutorConfig } from "../oracle-executor";
import type { E4V2Scenario } from "./scenario";
import { runE4V2ScenarioSet } from "./scenario-executor";

export const E4_V2_BANK_ID = "e4-adversarial-bank-v1";

export const E4_V2_BANK_VARIANT_IDS = [
  "validation-dropped",
  "status-swapped",
  "no-op-write",
  "seed-echo",
  "field-leak",
  "wrong-filter"
] as const;

export type E4V2BankVariantId = (typeof E4_V2_BANK_VARIANT_IDS)[number];

// One sealed mutation = a list of anchored replacements over the generated server source, each
// with its exact expected occurrence count.
type AnchoredReplacement = { anchor: string; replacement: string; occurrences: number };

const VARIANT_MUTATIONS: Record<E4V2BankVariantId, AnchoredReplacement[]> = {
  // The server stops validating request bodies entirely (create and update).
  "validation-dropped": [
    {
      anchor: "const failure = firstValidationFailure(route.entity, body);",
      replacement: "const failure = null;",
      occurrences: 2
    }
  ],
  // Create answers 200 instead of 201 (class-adjacent swap).
  "status-swapped": [
    {
      anchor: "return Response.json(body, { status: 201 });",
      replacement: "return Response.json(body, { status: 200 });",
      occurrences: 1
    }
  ],
  // Mutations do not persist: create/update never store, delete never deletes.
  "no-op-write": [
    { anchor: "      table.set(String(body.id), body);\n", replacement: "", occurrences: 1 },
    { anchor: "      table.set(params.id, body);\n", replacement: "", occurrences: 1 },
    { anchor: "      table.delete(params.id);\n", replacement: "", occurrences: 1 }
  ],
  // Create echoes the first seed row regardless of input (and stores nothing).
  "seed-echo": [
    {
      anchor: "      table.set(String(body.id), body);\n      return Response.json(body, { status: 201 });",
      replacement: "      return Response.json([...table.values()][0] ?? body, { status: 201 });",
      occurrences: 1
    }
  ],
  // Responses leak an extra internal field.
  "field-leak": [
    {
      anchor: "      return Response.json(body, { status: 201 });",
      replacement: '      return Response.json({ ...body, _internal_rev: 1 }, { status: 201 });',
      occurrences: 1
    },
    {
      anchor: "      return Response.json(row, { status: 200 });",
      replacement: '      return Response.json({ ...row, _internal_rev: 1 }, { status: 200 });',
      occurrences: 1
    }
  ],
  // The list endpoint ignores query parameters entirely.
  "wrong-filter": [
    {
      anchor:
        "      const rows = [...table.values()].filter((row) => !filterValue || row[refField!.name] === filterValue);",
      replacement: "      const rows = [...table.values()];",
      occurrences: 1
    }
  ]
};

function applyAnchoredReplacements(source: string, mutations: AnchoredReplacement[], variantId: string): string {
  let mutated = source;

  for (const mutation of mutations) {
    const occurrences = mutated.split(mutation.anchor).length - 1;

    if (occurrences !== mutation.occurrences) {
      throw new Error(
        `bank variant ${variantId}: anchor found ${occurrences} time(s), expected ${mutation.occurrences} — the scaffold source drifted; re-seal the bank`
      );
    }

    mutated = mutated.split(mutation.anchor).join(mutation.replacement);
  }

  return mutated;
}

// The variant workspace: the gold app files with the variant's sealed server mutation applied.
export function buildE4V2BankVariantFiles(ir: E4SchemaIR, variantId: E4V2BankVariantId): Record<string, string> {
  const files = buildE4V2AppFiles(ir);

  return { ...files, "server.ts": applyAnchoredReplacements(files["server.ts"], VARIANT_MUTATIONS[variantId], variantId) };
}

export type E4V2KillScoreReport = {
  bank_id: typeof E4_V2_BANK_ID;
  kill_score: number; // fraction of variants with ≥1 failing scenario
  scenarios_total: number;
  variants: Array<{
    variant_id: E4V2BankVariantId;
    killed: boolean;
    failing_scenario_titles: string[];
  }>;
};

// Executes the agent's cumulative scenario set against every bank variant (hermetic, §5.2).
// Harness-side and hidden — the report is recorded in the manifest, never fed back to the agent.
export async function runE4V2KillScore(input: {
  groundTruthIr: E4SchemaIR;
  scenarios: E4V2Scenario[];
  executorConfig: E4ExecutorConfig;
  concurrency?: number;
}): Promise<E4V2KillScoreReport> {
  const variants: E4V2KillScoreReport["variants"] = [];

  for (const variantId of E4_V2_BANK_VARIANT_IDS) {
    const dir = await mkdtemp(join(tmpdir(), `e4-v2-bank-${variantId}-`));

    try {
      for (const [path, contents] of Object.entries(buildE4V2BankVariantFiles(input.groundTruthIr, variantId))) {
        await writeFile(join(dir, path), contents);
      }

      const verdicts = await runE4V2ScenarioSet({
        workspace_dir: dir,
        scenarios: input.scenarios,
        config: input.executorConfig,
        concurrency: input.concurrency ?? 4
      });
      const failingTitles = verdicts
        .filter((verdict) => verdict.kind !== "completed" || !verdict.passed)
        .map((verdict) => verdict.title);

      variants.push({ variant_id: variantId, killed: failingTitles.length > 0, failing_scenario_titles: failingTitles });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  const killed = variants.filter((variant) => variant.killed).length;

  return {
    bank_id: E4_V2_BANK_ID,
    kill_score: E4_V2_BANK_VARIANT_IDS.length === 0 ? 0 : killed / E4_V2_BANK_VARIANT_IDS.length,
    scenarios_total: input.scenarios.length,
    variants
  };
}
