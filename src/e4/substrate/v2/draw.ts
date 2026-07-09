// v2 seeded sequence draw (E4V2 design §5.6): identical drawing semantics to the v1 draw
// (src/e4/substrate/draw.ts, untouched — it hardcodes the v1 op registry, so v2 carries its own
// copy over E4_OPS_V2). Same category ordering, same fallback rule, same structural
// >=1 behavior_preserving guarantee.
import { cloneIr, createUidMinter, type E4SchemaIR } from "../ir";
import { createSequenceState, type E4ChangeOpKind, type E4RenameLineageEntry } from "../ops";
import { E4_OPS_V2 } from "./ops";
import type { E4OpMixPolicy, E4DrawnTask, E4RenameLineageMapEntry } from "../draw";
import type { E4Prng } from "../prng";
import type { E4OpportunityLabel } from "../../types";

export type { E4OpMixPolicy, E4DrawnTask, E4RenameLineageMapEntry } from "../draw";

const OPS_BY_CATEGORY: Record<E4OpportunityLabel, E4ChangeOpKind[]> = {
  drift_opportunity: [
    "rename_entity",
    "rename_field",
    "retype_field",
    "delete_field",
    "delete_entity",
    "modify_endpoint",
    "modify_convention"
  ],
  additive: ["add_entity", "add_field", "add_endpoint", "add_validation_rule", "add_relationship"],
  behavior_preserving: ["noop_maintenance"]
};

const ALL_OPS_ORDERED: E4ChangeOpKind[] = [
  ...OPS_BY_CATEGORY.drift_opportunity,
  ...OPS_BY_CATEGORY.additive,
  ...OPS_BY_CATEGORY.behavior_preserving
];

function pickCategory(opMix: E4OpMixPolicy, prng: E4Prng): E4OpportunityLabel {
  const entries: Array<[E4OpportunityLabel, number]> = [
    ["drift_opportunity", opMix.weights.drift_opportunity],
    ["additive", opMix.weights.additive],
    ["behavior_preserving", opMix.weights.behavior_preserving]
  ];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);

  if (!(total > 0)) {
    throw new RangeError("op_mix weights must sum to a positive number");
  }

  let roll = prng.next() * total;

  for (const [label, weight] of entries) {
    if (roll < weight) {
      return label;
    }
    roll -= weight;
  }

  return entries[entries.length - 1][0]; // floating-point edge case
}

function pickEligibleOpKind(
  ir: E4SchemaIR,
  state: ReturnType<typeof createSequenceState>,
  category: E4OpportunityLabel,
  prng: E4Prng
): E4ChangeOpKind {
  const preferred = OPS_BY_CATEGORY[category].filter((kind) => E4_OPS_V2[kind].isEligible(ir, state));

  if (preferred.length > 0) {
    return prng.pick(preferred);
  }

  const eligible = ALL_OPS_ORDERED.filter((kind) => E4_OPS_V2[kind].isEligible(ir, state));

  return prng.pick(eligible);
}

export function drawE4V2TaskSequence(input: {
  baselineIr: E4SchemaIR;
  taskCount: number;
  opMix: E4OpMixPolicy;
  prng: E4Prng;
}): E4DrawnTask[] {
  const state = createSequenceState();
  const minter = createUidMinter();
  let currentIr = cloneIr(input.baselineIr);
  const tasks: E4DrawnTask[] = [];

  for (let taskIndex = 1; taskIndex <= input.taskCount; taskIndex += 1) {
    const category = pickCategory(input.opMix, input.prng);
    const opKind = pickEligibleOpKind(currentIr, state, category, input.prng);
    const result = E4_OPS_V2[opKind].apply(currentIr, minter, input.prng, state);

    tasks.push({
      task_index: taskIndex,
      op_kind: opKind,
      opportunity_labels: [result.opportunity_label],
      ground_truth_ir: result.ir,
      touched_item_uids: result.touched_item_uids,
      rename_lineage: result.rename_lineage,
      render_context: result.render_context
    });
    currentIr = result.ir;
  }

  return ensureBehaviorPreservingStep(tasks, input.baselineIr, minter);
}

function ensureBehaviorPreservingStep(
  tasks: E4DrawnTask[],
  baselineIr: E4SchemaIR,
  minter: ReturnType<typeof createUidMinter>
): E4DrawnTask[] {
  if (tasks.length === 0 || tasks.some((task) => task.opportunity_labels.includes("behavior_preserving"))) {
    return tasks;
  }

  const lastIndex = tasks.length - 1;
  const priorIr = lastIndex > 0 ? tasks[lastIndex - 1].ground_truth_ir : baselineIr;
  const forced = E4_OPS_V2.noop_maintenance.apply(priorIr, minter, createNoopPrngStub(), createSequenceState());

  const replaced = [...tasks];
  replaced[lastIndex] = {
    task_index: tasks[lastIndex].task_index,
    op_kind: "noop_maintenance",
    opportunity_labels: ["behavior_preserving"],
    ground_truth_ir: forced.ir,
    touched_item_uids: [],
    rename_lineage: [],
    render_context: {}
  };

  return replaced;
}

function createNoopPrngStub(): E4Prng {
  const unused = (): never => {
    throw new Error("noop_maintenance must never consult the PRNG");
  };

  return { next: unused, nextInt: unused, pick: unused, shuffle: unused };
}

export function flattenRenameLineageV2(tasks: E4DrawnTask[]): E4RenameLineageMapEntry[] {
  return tasks.flatMap((task) => task.rename_lineage.map((entry) => ({ ...entry, task_index: task.task_index })));
}

export type { E4RenameLineageEntry };
