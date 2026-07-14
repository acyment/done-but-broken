// E5 probe P1.2w — during-work truth feedback. Pre-registration:
// docs/e5/E5-P12W-DURING-WORK-PREREG-v1.md (committed before any spend). This module is
// PROBE-LAYER machinery composed through the v2 runner's OPTIONAL task-loop probe seam
// (`E4V2TaskLoopProbeHook`, [V08: 2b]) — the sealed E4 task lifecycle is otherwise byte-untouched,
// and CONTROL attaches no hook at all ("CONTROL runs the loop unmodified", prereg §2). The
// semantic-family SHOWN/HELD-OUT partition and the shown-verdict renderer are P1.1's, reused
// verbatim (prereg §2: "same code") — this module never redefines them. Classification
// calibration only; nothing here may feed an evidence run.
//
// Two delivery points per task (prereg §2), both wired through the runner seam:
//   (a) once, unconditionally, in the feedback of the turn where the spec-phase exit is
//       accepted — the exposure guarantee (every task tests the lever, independent of luck).
//   (b) appended to the feedback of every accepted verification (smoke) invocation during the
//       implementation phase.
// Each delivery runs a probe-layer oracle invocation over the CURRENT workspace state (distinct
// from the sealed at-close run) against the task's cumulative acceptance suite, renders only the
// SHOWN-half verdicts (held-out ids/details never rendered — same renderer, same absence
// guarantee as P1.1), and records the full invocation as `p12w-feedback-<task_index>-<n>.json`.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runE4OracleExecutor, type E4ExecutorConfig } from "../e4/oracle-executor";
import type { E4HttpTest } from "../e4/substrate/testgen";
import type { E4V2TaskLoopProbeContext, E4V2TaskLoopProbeHook } from "../e4/v2/runner";
import {
  computeE5P11Partition,
  e5P11PartitionStats,
  renderE5P11ShownVerdicts,
  type E5P11Partition,
  type E5P11PartitionStats
} from "./p11";

export const E5_P12W_PROBE_ID = "e5-p12w-during-work-truth-v1";

export type E5P12wDeliveryPoint = "spec_exit" | "verification";

export type E5P12wFeedbackRecord = {
  probe_id: typeof E5_P12W_PROBE_ID;
  task_index: number;
  delivery_point: E5P12wDeliveryPoint;
  sequence: number; // nth probe-layer oracle invocation this task (1-based, across both points)
  oracle_kind: string;
  stats: E5P11PartitionStats | null; // null when the oracle did not complete
  rendered_message: string | null; // exactly what the agent was shown; null when nothing was shown
};

export type E5P12wHookInput = {
  partition: E5P11Partition;
  tests: E4HttpTest[]; // the task's cumulative acceptance suite (task.acceptance_tests.cumulative)
  executor_config: E4ExecutorConfig;
  // Test seam (P1.1 precedent): the probe-phase oracle engine, defaulting to the real executor.
  oracle_runner?: typeof runE4OracleExecutor;
};

function e5P12wMessage(deliveryPoint: E5P12wDeliveryPoint, shown: string): string {
  const intro =
    deliveryPoint === "spec_exit"
      ? "Before you start implementing, here is where the current code stands against the acceptance checks you are allowed to see:"
      : "Acceptance check results against the checks you are allowed to see, as of this verification run:";

  return `${intro}\n\n${shown}`;
}

// Builds a FRESH hook per task (mirrors the provider-factory precedent) — `tests` and the
// per-task sequence counter are captured in closure, never shared across tasks.
export function createE5P12wTaskLoopHook(input: E5P12wHookInput): E4V2TaskLoopProbeHook {
  const oracleRunner = input.oracle_runner ?? runE4OracleExecutor;
  let sequence = 0;

  async function deliver(deliveryPoint: E5P12wDeliveryPoint, ctx: E4V2TaskLoopProbeContext): Promise<string | null> {
    sequence += 1;

    const result = await oracleRunner({
      workspace_dir: ctx.workspace_dir,
      tests: input.tests,
      config: input.executor_config
    });

    const stats = result.kind === "completed" ? e5P11PartitionStats(input.partition, result.verdicts) : null;
    const renderedMessage =
      result.kind === "completed" ? e5P12wMessage(deliveryPoint, renderE5P11ShownVerdicts(input.partition, result.verdicts)) : null;

    const record: E5P12wFeedbackRecord = {
      probe_id: E5_P12W_PROBE_ID,
      task_index: ctx.task_index,
      delivery_point: deliveryPoint,
      sequence,
      oracle_kind: result.kind,
      stats,
      rendered_message: renderedMessage
    };

    await mkdir(ctx.records_dir, { recursive: true });
    await writeFile(join(ctx.records_dir, `p12w-feedback-${sequence}.json`), `${JSON.stringify(record, null, 2)}\n`);

    return renderedMessage;
  }

  return {
    onSpecExitAccepted: (ctx) => deliver("spec_exit", ctx),
    onVerificationAccepted: (ctx) => deliver("verification", ctx)
  };
}

export { computeE5P11Partition };
export type { E5P11Partition };
