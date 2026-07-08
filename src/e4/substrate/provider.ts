// E4SubstrateProvider implementation (architecture §2.1/§4; IMPLEMENTATION-PLAN.md M1). Wires
// baseline IR → seeded draw → NL render → programmatic test generation → T0 workspace, and emits
// the [R2: R2-1] rename-lineage map + [R2: R2-10] difficulty diagnostics alongside the
// architecture-specified generate() output.
import { buildBaselineIr, type E4SchemaIR } from "./ir";
import { buildE4WorkspaceFiles } from "./scaffold";
import { createE4Prng } from "./prng";
import { drawE4TaskSequence, flattenRenameLineage, type E4OpMixPolicy, type E4RenameLineageMapEntry, type E4DrawnTask } from "./draw";
import { renderTaskText, type E4RenderedTask } from "./render";
import { generateCumulativeTests, generateDeltaTests, type E4HttpTest } from "./testgen";
import type { E4ChangeOpKind } from "./ops";
import type { E4OpportunityLabel } from "../types";

export const SUBSTRATE_KIND = "procedural-rest-v1" as const;
export const SUBSTRATE_VERSION = "procedural-rest-v1.0";

export type E4SubstrateConfig = {
  substrate_config_id: string;
  substrate_seed: number;
  task_count: number;
  op_mix: E4OpMixPolicy;
};

export type E4GeneratedTask = {
  task_index: number;
  nl_request: string;
  opportunity_labels: E4OpportunityLabel[];
  ground_truth_ir: E4SchemaIR;
  acceptance_tests: { delta: E4HttpTest[]; cumulative: E4HttpTest[] };
};

export type E4DifficultyDiagnostics = {
  op_type_shares: Partial<Record<E4ChangeOpKind, number>>;
  average_ir_items_touched_per_op: number;
  nl_opacity: { verbatim_count: number; paraphrased_count: number; verbatim_ratio: number };
};

export type E4GenerateResult = {
  initial_workspace: Record<string, string>;
  initial_ir: E4SchemaIR;
  tasks: E4GeneratedTask[];
  rename_lineage_map: E4RenameLineageMapEntry[];
  difficulty_diagnostics: E4DifficultyDiagnostics;
};

export interface E4SubstrateProvider {
  readonly substrate_kind: typeof SUBSTRATE_KIND;
  readonly substrate_version: string;
  generate(config: E4SubstrateConfig): Promise<E4GenerateResult>;
}

function parseConventionsBullets(markdown: string): Array<{ id: string; statement: string }> {
  return [...markdown.matchAll(/^- `([^`]+)`: (.+)$/gm)].map((match) => ({ id: match[1], statement: match[2].trim() }));
}

// The generator's own in-sync self-check (M1 acceptance criterion — the real drift meter is M2's
// job): independently re-parses the emitted spec artifacts and compares them against the same
// ground-truth IR, so a bug in scaffold.ts's spec-rendering would fail this even though both sides
// ultimately derive from one IR object.
export function assertT0InSync(ir: E4SchemaIR, workspace: Record<string, string>): void {
  const openapi = JSON.parse(workspace["specs/openapi.json"]) as { paths: Record<string, Record<string, unknown>> };
  const specOperationKeys = new Set<string>();

  for (const [path, methods] of Object.entries(openapi.paths)) {
    for (const method of Object.keys(methods)) {
      specOperationKeys.add(`${method.toUpperCase()} ${path}`);
    }
  }

  const truthOperationKeys = new Set(ir.endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`));

  if (specOperationKeys.size !== truthOperationKeys.size || [...truthOperationKeys].some((key) => !specOperationKeys.has(key))) {
    throw new Error("T0 self-check failed: specs/openapi.json does not match the ground-truth endpoints");
  }

  const specConventions = new Map(parseConventionsBullets(workspace["specs/CONVENTIONS.md"]).map((bullet) => [bullet.id, bullet.statement]));

  if (specConventions.size !== ir.conventions.length) {
    throw new Error("T0 self-check failed: specs/CONVENTIONS.md convention count does not match ground truth");
  }

  for (const convention of ir.conventions) {
    if (specConventions.get(convention.convention_id) !== convention.statement) {
      throw new Error(`T0 self-check failed: convention ${convention.convention_id} does not match ground truth`);
    }
  }
}

function computeDifficultyDiagnostics(drawnTasks: E4DrawnTask[], rendered: E4RenderedTask[]): E4DifficultyDiagnostics {
  const total = drawnTasks.length;
  const counts: Partial<Record<E4ChangeOpKind, number>> = {};

  for (const task of drawnTasks) {
    counts[task.op_kind] = (counts[task.op_kind] ?? 0) + 1;
  }

  const opTypeShares = Object.fromEntries(
    Object.entries(counts).map(([kind, count]) => [kind, total > 0 ? count / total : 0])
  ) as Partial<Record<E4ChangeOpKind, number>>;

  const totalTouched = drawnTasks.reduce((sum, task) => sum + task.touched_item_uids.length, 0);
  const verbatimCount = rendered.filter((entry) => entry.names_item_verbatim).length;

  return {
    op_type_shares: opTypeShares,
    average_ir_items_touched_per_op: total > 0 ? totalTouched / total : 0,
    nl_opacity: {
      verbatim_count: verbatimCount,
      paraphrased_count: total - verbatimCount,
      verbatim_ratio: total > 0 ? verbatimCount / total : 0
    }
  };
}

export const e4ProceduralRestV1Provider: E4SubstrateProvider = {
  substrate_kind: SUBSTRATE_KIND,
  substrate_version: SUBSTRATE_VERSION,

  async generate(config: E4SubstrateConfig): Promise<E4GenerateResult> {
    const baselineIr = buildBaselineIr();
    const initialWorkspace = buildE4WorkspaceFiles(baselineIr);

    assertT0InSync(baselineIr, initialWorkspace);

    const prng = createE4Prng(config.substrate_seed);
    const drawnTasks = drawE4TaskSequence({ baselineIr, taskCount: config.task_count, opMix: config.op_mix, prng });

    const rendered: E4RenderedTask[] = [];
    const tasks: E4GeneratedTask[] = drawnTasks.map((drawn) => {
      const renderedTask = renderTaskText({ opKind: drawn.op_kind, renderContext: drawn.render_context }, prng);
      rendered.push(renderedTask);

      return {
        task_index: drawn.task_index,
        nl_request: renderedTask.text,
        opportunity_labels: drawn.opportunity_labels,
        ground_truth_ir: drawn.ground_truth_ir,
        acceptance_tests: {
          delta: generateDeltaTests(drawn.ground_truth_ir, drawn.touched_item_uids),
          cumulative: generateCumulativeTests(drawn.ground_truth_ir)
        }
      };
    });

    return {
      initial_workspace: initialWorkspace,
      initial_ir: baselineIr,
      tasks,
      rename_lineage_map: flattenRenameLineage(drawnTasks),
      difficulty_diagnostics: computeDifficultyDiagnostics(drawnTasks, rendered)
    };
  }
};
