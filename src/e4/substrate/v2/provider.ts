// procedural-rest-v2 substrate provider (E4V2 design §5.5/§5.6; v2-M1). Same provider shape as
// v1 (src/e4/substrate/provider.ts, untouched): baseline IR → T0 workspace (app files + OpenSpec
// spec-of-record + README, with the §5.5 structural self-checks run on every generate) → seeded
// v2 draw → NL render (v1 phrasing pools reused — same op vocabulary) → v2 test generation →
// rename-lineage map + difficulty diagnostics.
import { buildBaselineIr, type E4SchemaIR } from "../ir";
import { createE4Prng } from "../prng";
import { renderTaskText, type E4RenderedTask } from "../render";
import type { E4ChangeOpKind } from "../ops";
import type { E4OpportunityLabel } from "../../types";
import type { E4SubstrateConfig, E4DifficultyDiagnostics } from "../provider";
import { drawE4V2TaskSequence, flattenRenameLineageV2, type E4DrawnTask, type E4RenameLineageMapEntry } from "./draw";
import { carryForwardSeedFixturesV2, type E4SeedFixtureV2 } from "./fixture";
import { generateCumulativeTestsV2, generateDeltaTestsV2, generateSeedFixtureV2, type E4HttpTest } from "./testgen";
import { SUBSTRATE_KIND_V2, SUBSTRATE_VERSION_V2 } from "./ops";
import { buildE4V2WorkspaceFiles } from "../../v2/workspace";

export { SUBSTRATE_KIND_V2, SUBSTRATE_VERSION_V2 } from "./ops";
export type { E4SubstrateConfig } from "../provider";

export type E4V2GeneratedTask = {
  task_index: number;
  op_kind: E4ChangeOpKind;
  nl_request: string;
  opportunity_labels: E4OpportunityLabel[];
  ground_truth_ir: E4SchemaIR;
  // §5.7: the seed fixture carried forward through this task's op (data-migration semantics) —
  // the ONLY seed-row state the oracle, meter, and template derivation may consult post-op.
  seed_fixture: E4SeedFixtureV2;
  acceptance_tests: { delta: E4HttpTest[]; cumulative: E4HttpTest[] };
};

export type E4V2GenerateResult = {
  initial_workspace: Record<string, string>;
  initial_ir: E4SchemaIR;
  tasks: E4V2GeneratedTask[];
  rename_lineage_map: E4RenameLineageMapEntry[];
  difficulty_diagnostics: E4DifficultyDiagnostics;
};

export interface E4V2SubstrateProvider {
  readonly substrate_kind: typeof SUBSTRATE_KIND_V2;
  readonly substrate_version: string;
  generate(config: E4SubstrateConfig): Promise<E4V2GenerateResult>;
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

export const e4ProceduralRestV2Provider: E4V2SubstrateProvider = {
  substrate_kind: SUBSTRATE_KIND_V2,
  substrate_version: SUBSTRATE_VERSION_V2,

  async generate(config: E4SubstrateConfig): Promise<E4V2GenerateResult> {
    const baselineIr = buildBaselineIr();
    // buildE4V2WorkspaceFiles runs the §5.5 structural self-checks (floors, totality, purpose
    // floor, fixture-id disjointness) on every generate — the v2 analog of v1's assertT0InSync.
    const initialWorkspace = buildE4V2WorkspaceFiles(baselineIr);

    const prng = createE4Prng(config.substrate_seed);
    const drawnTasks = drawE4V2TaskSequence({ baselineIr, taskCount: config.task_count, opMix: config.op_mix, prng });

    // §5.7: one T0 fixture, carried forward per op — never re-derived from a later IR.
    const carriedFixtures = carryForwardSeedFixturesV2(
      generateSeedFixtureV2(baselineIr),
      baselineIr,
      drawnTasks.map((drawn) => drawn.ground_truth_ir)
    );

    const rendered: E4RenderedTask[] = [];
    const tasks: E4V2GeneratedTask[] = drawnTasks.map((drawn, index) => {
      const renderedTask = renderTaskText({ opKind: drawn.op_kind, renderContext: drawn.render_context }, prng);
      rendered.push(renderedTask);
      const seedFixture = carriedFixtures[index];

      return {
        task_index: drawn.task_index,
        op_kind: drawn.op_kind,
        nl_request: renderedTask.text,
        opportunity_labels: drawn.opportunity_labels,
        ground_truth_ir: drawn.ground_truth_ir,
        seed_fixture: seedFixture,
        acceptance_tests: {
          delta: generateDeltaTestsV2(drawn.ground_truth_ir, drawn.touched_item_uids, seedFixture),
          cumulative: generateCumulativeTestsV2(drawn.ground_truth_ir, seedFixture)
        }
      };
    });

    return {
      initial_workspace: initialWorkspace,
      initial_ir: baselineIr,
      tasks,
      rename_lineage_map: flattenRenameLineageV2(drawnTasks),
      difficulty_diagnostics: computeDifficultyDiagnostics(drawnTasks, rendered)
    };
  }
};
