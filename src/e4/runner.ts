// E4 per-task state machine (architecture §2.2; IMPLEMENTATION-PLAN.md M4). One call = one task on
// the live arm workspace: turn loop over the E4 turn adapter, Arm-H gate routing, smoke feedback
// (all arms), task close (hidden oracle → meter → snapshot → noticing probe — the [R2: R2-9c]
// ordering: the probe fires after the task snapshot, inside the task conversation, which is then
// discarded), and the termination taxonomy.
//
// Sequencing rules carried from the estate: done / agent_stalled / budget_exhausted are COMPLETE
// closes (the sequence continues from the workspace as-is); provider_error / spend_cap_reached /
// executor_error / invalid_integrity are ABORT classes (status "aborted", the sequence stops).
// invalid_integrity is reserved: E4 v1 has no out-of-band mutation channel (all writes flow
// through applyE4Replacements), so this runner never emits it.
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { E1VerificationBudget } from "../e1-harness";
import { callE1ProviderWithRetries, isE1ProviderExhaustedError } from "../e1-provider-runtime";
import type { E4ArmPolicy } from "./arm-policy";
import { E4ArmHTaskGate, type E4GateExecutorRunner, type E4OracleCounts } from "./gate";
import type { E4GateEvents, E4TaskUsage } from "./manifest";
import { runE4DriftMeterOnWorkspace } from "./meter/meter";
import type { E4RenameLineageLookupEntry } from "./meter/classify";
import { runE4OracleExecutor, type E4ExecutorConfig, type E4ExecutorResult } from "./oracle-executor";
import { renderEndpointItemId, type E4SchemaIR } from "./substrate/ir";
import type { E4GeneratedTask } from "./substrate/provider";
import type { E4HttpTest } from "./substrate/testgen";
import {
  applyE4Replacements,
  createE4TurnParser,
  renderE4SystemPrompt,
  renderE4TaskMessage,
  renderE4TurnFeedback,
  E4_PROVIDER_RETRY_POLICY,
  E4_STALL_NO_OP_TURN_LIMIT,
  E4TurnProtocolError,
  type E4AgentProvider,
  type E4ChatMessage
} from "./turns";
import type { E4SealedConstants } from "./constants";
import type {
  E4Budgets,
  E4DriftReport,
  E4ExecutorEvidence,
  E4TaskPhase,
  E4TaskTermination,
  E4TokenUsage
} from "./types";

export type E4SequenceSpendLedger = { spent_usd: number };

export type E4TaskRunResult = {
  termination: E4TaskTermination;
  phase_at_termination: E4TaskPhase;
  status: "complete" | "aborted";
  classification_rationale: string | null;
  gate_events: E4GateEvents | null;
  oracle: E4OracleCounts;
  false_confidence: { event: boolean; enforcement_outcome: "accepted" | "refused" | null };
  smoke_feedback_runs: number;
  drift: E4DriftReport;
  noticing_probe_answer: string;
  spec_touch: { touched: boolean; paths: string[] };
  usage: E4TaskUsage;
  // [R1-C3] probe usage is a separate arm-uniform line, excluded from usage.by_phase (and thereby
  // from both taxes); the orchestrator folds it into sequence usage_totals so money accounting
  // stays truthful.
  probe_usage: { tokens: E4TokenUsage; spend_usd: number } | null;
  snapshot: { hash: string; path: string };
  executor_artifacts: string[];
};

export type E4RunTaskInput = {
  arm: E4ArmPolicy;
  task: E4GeneratedTask;
  prior_cumulative_tests: E4HttpTest[];
  workspace_dir: string;
  records_dir: string;
  provider: E4AgentProvider;
  budgets: E4Budgets;
  spend_ledger: E4SequenceSpendLedger;
  constants: E4SealedConstants;
  rename_lineage: E4RenameLineageLookupEntry[];
  executor_config: E4ExecutorConfig;
  captureSnapshot: () => Promise<{ hash: string; path: string }>;
  // Test seam only: injects a no-op sleep into the sealed retry policy. Never a policy channel.
  retry_sleep?: (ms: number) => Promise<void>;
};

function zeroTokens(): E4TokenUsage {
  return { fresh_input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 };
}

function addTokens(into: E4TokenUsage, add: E4TokenUsage): void {
  into.fresh_input_tokens += add.fresh_input_tokens;
  into.cached_input_tokens += add.cached_input_tokens;
  into.output_tokens += add.output_tokens;
}

function totalTokens(usage: E4TokenUsage): number {
  return usage.fresh_input_tokens + usage.cached_input_tokens + usage.output_tokens;
}

async function readSpecArtifacts(workspaceDir: string): Promise<{ openapi_json: string; conventions_md: string }> {
  const [openapi_json, conventions_md] = await Promise.all([
    readFile(join(workspaceDir, "specs", "openapi.json"), "utf8"),
    readFile(join(workspaceDir, "specs", "CONVENTIONS.md"), "utf8")
  ]);

  return { openapi_json, conventions_md };
}

// Per-endpoint pass/fail for the meter's registry-bypass reconciliation rule (Gate-1 change 1):
// an endpoint counts as passing iff it has >= 1 cumulative verdict and every one of them passed —
// conservative, so a flaky/partial surface never manufactures bypass evidence.
export function buildE4ExecutorEvidence(input: {
  ir: E4SchemaIR;
  tests: E4HttpTest[];
  verdicts: Array<{ test_id: string; passed: boolean }>;
}): E4ExecutorEvidence {
  const uidByTestId = new Map(input.tests.map((test) => [test.test_id, test.source_item_uid]));
  const passesByUid = new Map<string, { total: number; passed: number }>();

  for (const verdict of input.verdicts) {
    const uid = uidByTestId.get(verdict.test_id);

    if (uid === undefined) {
      continue;
    }

    const entry = passesByUid.get(uid) ?? { total: 0, passed: 0 };
    entry.total += 1;
    entry.passed += verdict.passed ? 1 : 0;
    passesByUid.set(uid, entry);
  }

  return {
    endpoints: input.ir.endpoints.map((endpoint) => {
      const entry = passesByUid.get(endpoint.semantic_item_uid);

      return {
        item_id: renderEndpointItemId(endpoint.entity, endpoint.kind),
        passed: entry !== undefined && entry.total > 0 && entry.passed === entry.total
      };
    })
  };
}

function emptyDriftReport(meterVersion: string): E4DriftReport {
  const kinds = ["endpoint", "entity", "field", "validation_rule", "convention"] as const;
  const counts = Object.fromEntries(
    kinds.map((kind) => [kind, { contradiction: 0, coverage_gap: 0, stale_claim: 0 }])
  ) as E4DriftReport["counts"];

  return {
    meter_version: meterVersion,
    discrepancies: [],
    spec_unparseable: false,
    extraction_failed: true,
    registry_bypass: [],
    counts
  };
}

export async function runE4Task(input: E4RunTaskInput): Promise<E4TaskRunResult> {
  if (input.constants.feedback === null || input.constants.budgets === null) {
    throw new E4TurnProtocolError("constants draft is pre-M4: feedback/budgets must be sealed before running tasks");
  }

  const smokeCommand = input.constants.feedback.smoke_command;
  const parser = createE4TurnParser();
  const verificationBudget = new E1VerificationBudget(input.budgets.verifications_per_task);
  await mkdir(input.records_dir, { recursive: true });

  const taskStart = Date.now();
  const usageByPhase: Record<E4TaskPhase, { turns: number; tokens: E4TokenUsage; wall_clock_ms: number }> = {
    spec: { turns: 0, tokens: zeroTokens(), wall_clock_ms: 0 },
    implementation: { turns: 0, tokens: zeroTokens(), wall_clock_ms: 0 }
  };
  const taskTokens = zeroTokens();
  let taskSpendUsd = 0;
  let smokeFeedbackRuns = 0;
  const specTouchPaths: string[] = [];

  // Gate executor plumbing: ONE engine (ADR-006) behind the gate's red/green checks, wrapped only
  // for accounting and artifact retention. `mode` is set around each gate call site.
  let gateExecutorMode: "red" | "green" = "red";
  let gateRunCounter = 0;
  const gateExecutorUsage = { red_runs: 0, green_runs: 0, wall_clock_ms: 0 };
  const executorArtifacts: string[] = [];

  const gateExecutor: E4GateExecutorRunner = async (tests) => {
    const started = Date.now();
    const result = await runE4OracleExecutor({
      workspace_dir: input.workspace_dir,
      tests,
      config: input.executor_config
    });
    gateExecutorUsage.wall_clock_ms += Date.now() - started;

    if (gateExecutorMode === "red") {
      gateExecutorUsage.red_runs += 1;
    } else {
      gateExecutorUsage.green_runs += 1;
    }

    gateRunCounter += 1;
    const artifact = `gate-run-${gateRunCounter}.json`;
    await writeFile(
      join(input.records_dir, artifact),
      `${JSON.stringify({ mode: gateExecutorMode, test_ids: tests.map((test) => test.test_id), result }, null, 2)}\n`
    );
    executorArtifacts.push(artifact);

    return result;
  };

  let gate: E4ArmHTaskGate | null = null;

  if (input.arm.gate_enabled) {
    gate = new E4ArmHTaskGate({
      opportunity_labels: input.task.opportunity_labels,
      task_start_spec: await readSpecArtifacts(input.workspace_dir),
      tests: {
        delta: input.task.acceptance_tests.delta,
        cumulative: input.task.acceptance_tests.cumulative,
        prior_cumulative: input.prior_cumulative_tests
      },
      runExecutor: gateExecutor
    });
  }

  const currentPhase = (): E4TaskPhase => {
    if (gate === null) {
      return "implementation";
    }

    const phase = gate.phase();
    return phase === "closed" ? "implementation" : phase;
  };

  const systemPrompt = renderE4SystemPrompt({ constants: input.constants, arm: input.arm });
  const taskMessage = await renderE4TaskMessage({
    nl_request: input.task.nl_request,
    workspaceDir: input.workspace_dir
  });
  const messages: E4ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: taskMessage }
  ];
  await writeFile(
    join(input.records_dir, "initial-messages.json"),
    `${JSON.stringify({ messages }, null, 2)}\n`
  );

  let termination: E4TaskTermination | null = null;
  let classificationRationale: string | null = null;
  let doneAccepted = false;
  let consecutiveNoOps = 0;

  const terminateExecutorError = (rationale: string): void => {
    termination = "executor_error";
    classificationRationale = rationale;
  };

  for (let turn = 1; turn <= input.budgets.turns_per_task; turn += 1) {
    if (input.spend_ledger.spent_usd >= input.budgets.spend_cap_usd) {
      termination = "spend_cap_reached";
      break;
    }

    const phaseAtTurnStart = currentPhase();
    const turnStarted = Date.now();

    let turnResult: { text: string; usage: E4TokenUsage; spend_usd: number };

    try {
      const { value } = await callE1ProviderWithRetries({
        maxAttempts: E4_PROVIDER_RETRY_POLICY.max_attempts,
        backoffMs: [...E4_PROVIDER_RETRY_POLICY.backoff_ms],
        operation: () => input.provider.runTurn({ messages }),
        ...(input.retry_sleep ? { sleep: input.retry_sleep } : {})
      });
      turnResult = value;
    } catch (error) {
      if (isE1ProviderExhaustedError(error)) {
        termination = "provider_error";
        break;
      }

      throw error;
    }

    messages.push({ role: "assistant", content: turnResult.text });
    usageByPhase[phaseAtTurnStart].turns += 1;
    addTokens(usageByPhase[phaseAtTurnStart].tokens, turnResult.usage);
    addTokens(taskTokens, turnResult.usage);
    taskSpendUsd += turnResult.spend_usd;
    input.spend_ledger.spent_usd += turnResult.spend_usd;

    const parsed = parser.parse(turnResult.text);

    if (parsed.no_op) {
      consecutiveNoOps += 1;
    } else {
      consecutiveNoOps = 0;
    }

    const applyResult = await applyE4Replacements({
      workspaceDir: input.workspace_dir,
      replacements: parsed.replacements,
      gate
    });

    for (const appliedReplacement of applyResult.applied) {
      if (appliedReplacement.path === "specs" || appliedReplacement.path.startsWith("specs/")) {
        specTouchPaths.push(appliedReplacement.path);
      }
    }

    let verificationFeedback: string | null = null;

    if (parsed.verification !== null) {
      const slot = verificationBudget.consume();

      if (!slot.allowed) {
        verificationFeedback = "verification refused: the per-task verification budget is exhausted.";
      } else if (parsed.verification.raw !== smokeCommand) {
        verificationFeedback = `verification refused: \`${parsed.verification.raw}\` is not a sealed E4 command; the only valid verification command is \`${smokeCommand}\`.`;
      } else {
        const smokeStarted = Date.now();
        const smokeResult = await runE4OracleExecutor({
          workspace_dir: input.workspace_dir,
          tests: [],
          config: input.executor_config
        });
        smokeFeedbackRuns += 1;
        const smokeArtifact = `smoke-${smokeFeedbackRuns}.json`;
        await writeFile(
          join(input.records_dir, smokeArtifact),
          `${JSON.stringify({ result: smokeResult, wall_clock_ms: Date.now() - smokeStarted }, null, 2)}\n`
        );
        executorArtifacts.push(smokeArtifact);

        if (smokeResult.kind === "executor_error") {
          terminateExecutorError(smokeResult.classification_rationale);
        } else {
          gate?.recordSmokeInvocation();

          if (smokeResult.kind === "completed") {
            verificationFeedback = "smoke: the server started and answered the readiness probe (ok).";
          } else {
            const stderrTail = smokeResult.server_stderr.slice(-2000);
            verificationFeedback = `smoke: the server failed to become ready — ${smokeResult.reason}${
              stderrTail.length > 0 ? `\nserver stderr (tail):\n${stderrTail}` : ""
            }`;
          }
        }
      }
    }

    let gateFeedback: string | null = null;

    if (termination === null && parsed.done) {
      if (gate !== null && gate.phase() === "spec") {
        gateExecutorMode = "red";
        const exit = await gate.attemptSpecExit(await readSpecArtifacts(input.workspace_dir));

        if (exit.outcome === "executor_error") {
          terminateExecutorError(exit.classification_rationale);
        } else if (exit.outcome === "custody_failed") {
          gateFeedback = exit.feedback;
        } else {
          const redLine =
            exit.red_check === "skipped_behavior_preserving"
              ? "no-change exit accepted; the red check was skipped for this behavior-preserving task."
              : exit.red_check === "red"
                ? `red check: ${exit.delta_failures} new-behavior check(s) are failing (expected before implementation); previously accepted behavior ${exit.prior_cumulative_green ? "still passes" : "is NOT fully green"}.`
                : "red check anomaly: every new-behavior check already passes. Proceed with the implementation phase; this has been recorded.";
          gateFeedback = `gate: custody passed (${exit.custody_via}); entering the implementation phase. Files under specs/ are now frozen. ${redLine}`;
        }
      } else if (gate !== null) {
        gateExecutorMode = "green";
        const claim = await gate.submitDoneClaim();

        if (claim.outcome === "executor_error") {
          terminateExecutorError(claim.classification_rationale);
        } else if (claim.outcome === "accepted") {
          doneAccepted = true;
          termination = "done";
        } else {
          gateFeedback = claim.feedback;
        }
      } else {
        doneAccepted = true;
        termination = "done";
      }
    }

    const feedback = renderE4TurnFeedback({
      confirmations: applyResult.confirmations,
      rejections: applyResult.rejected,
      violations: parsed.violations.map((violation) => ({
        code: violation.code,
        line: violation.line,
        detail: violation.detail
      })),
      verification: verificationFeedback,
      gate: gateFeedback,
      no_op: parsed.no_op
    });

    usageByPhase[phaseAtTurnStart].wall_clock_ms += Date.now() - turnStarted;

    await appendFile(
      join(input.records_dir, "turns.jsonl"),
      `${JSON.stringify({
        turn,
        phase: phaseAtTurnStart,
        raw_output: turnResult.text,
        applied_paths: applyResult.applied.map((entry) => entry.path),
        rejected: applyResult.rejected,
        verification: parsed.verification === null ? null : { command: parsed.verification.raw },
        done: parsed.done,
        feedback
      })}\n`
    );

    if (termination !== null) {
      break;
    }

    if (consecutiveNoOps >= E4_STALL_NO_OP_TURN_LIMIT) {
      termination = "agent_stalled";
      break;
    }

    if (totalTokens(taskTokens) >= input.budgets.token_budget) {
      termination = "budget_exhausted";
      break;
    }

    if (feedback.length > 0) {
      messages.push({ role: "user", content: feedback });
    } else {
      messages.push({ role: "user", content: "continue." });
    }
  }

  if (termination === null) {
    termination = "budget_exhausted";
  }

  const phaseAtTermination = currentPhase();
  const isAborted =
    termination === "provider_error" ||
    termination === "spend_cap_reached" ||
    termination === "executor_error" ||
    termination === "invalid_integrity";

  // ---- task close: hidden oracle (all arms) → meter → snapshot → noticing probe ([R2: R2-9c]) ----

  let oracle: E4OracleCounts = {
    delta_pass: 0,
    delta_total: input.task.acceptance_tests.delta.length,
    cumulative_pass: 0,
    cumulative_total: input.task.acceptance_tests.cumulative.length
  };
  let executorEvidence: E4ExecutorEvidence = { endpoints: [] };

  if (!isAborted) {
    const oracleStarted = Date.now();
    const hiddenOracle: E4ExecutorResult = await runE4OracleExecutor({
      workspace_dir: input.workspace_dir,
      tests: input.task.acceptance_tests.cumulative,
      config: input.executor_config
    });
    const oracleArtifact = "hidden-oracle.json";
    await writeFile(
      join(input.records_dir, oracleArtifact),
      `${JSON.stringify({ result: hiddenOracle, wall_clock_ms: Date.now() - oracleStarted }, null, 2)}\n`
    );
    executorArtifacts.push(oracleArtifact);

    if (hiddenOracle.kind === "executor_error") {
      termination = "executor_error";
      classificationRationale = hiddenOracle.classification_rationale;
    } else if (hiddenOracle.kind === "completed") {
      const deltaIds = new Set(input.task.acceptance_tests.delta.map((test) => test.test_id));
      oracle = {
        delta_pass: hiddenOracle.verdicts.filter((verdict) => deltaIds.has(verdict.test_id) && verdict.passed).length,
        delta_total: input.task.acceptance_tests.delta.length,
        cumulative_pass: hiddenOracle.pass_count,
        cumulative_total: hiddenOracle.total
      };
      executorEvidence = buildE4ExecutorEvidence({
        ir: input.task.ground_truth_ir,
        tests: input.task.acceptance_tests.cumulative,
        verdicts: hiddenOracle.verdicts
      });
    }
    // readiness_failed: agent-workspace class — oracle counts stay zero, the sequence continues.
  }

  const abortedAfterClose =
    termination === "provider_error" ||
    termination === "spend_cap_reached" ||
    termination === "executor_error" ||
    termination === "invalid_integrity";

  // The meter runs harness-side and consults no executor state beyond the evidence above, so it
  // runs for aborted tasks too (fail-closed extraction is a recorded outcome, never a crash).
  let drift: E4DriftReport;

  try {
    drift = await runE4DriftMeterOnWorkspace({
      workspaceDir: input.workspace_dir,
      groundTruthIr: input.task.ground_truth_ir,
      executorEvidence,
      renameLineage: input.rename_lineage
    });
  } catch {
    drift = emptyDriftReport(input.constants.compatibility_boundary.meter_version ?? "unknown");
  }

  await writeFile(join(input.records_dir, "drift-report.json"), `${JSON.stringify(drift, null, 2)}\n`);

  const snapshot = await input.captureSnapshot();

  let noticingProbeAnswer = "";
  let probeUsage: { tokens: E4TokenUsage; spend_usd: number } | null = null;

  if (!abortedAfterClose && input.constants.protocol_text?.noticing_probe_prompt) {
    try {
      const { value } = await callE1ProviderWithRetries({
        maxAttempts: E4_PROVIDER_RETRY_POLICY.max_attempts,
        backoffMs: [...E4_PROVIDER_RETRY_POLICY.backoff_ms],
        operation: () =>
          input.provider.runTurn({
            messages: [...messages, { role: "user", content: input.constants.protocol_text!.noticing_probe_prompt }]
          }),
        ...(input.retry_sleep ? { sleep: input.retry_sleep } : {})
      });
      noticingProbeAnswer = value.text;
      probeUsage = { tokens: value.usage, spend_usd: value.spend_usd };
      input.spend_ledger.spent_usd += value.spend_usd;
    } catch (error) {
      // The probe is a diagnostic, never load-bearing: a provider failure here leaves the answer
      // empty and is retained in the records; the task's own close stands.
      await writeFile(
        join(input.records_dir, "probe-error.json"),
        `${JSON.stringify({ error: String(error) }, null, 2)}\n`
      );
    }

    await writeFile(
      join(input.records_dir, "probe.json"),
      `${JSON.stringify({ answer: noticingProbeAnswer, usage: probeUsage }, null, 2)}\n`
    );
  }

  const gateSummary = gate?.summary() ?? null;
  const gateEvents: E4GateEvents | null =
    gateSummary === null
      ? null
      : {
          custody_failures: gateSummary.custody_failures,
          red_check: gateSummary.red_check,
          refused_done_over_red: gateSummary.refused_done_over_red
        };

  const falseConfidenceEvent = termination === "done" && oracle.cumulative_pass < oracle.cumulative_total;
  const enforcementOutcome =
    gate === null
      ? null
      : doneAccepted
        ? ("accepted" as const)
        : (gateSummary?.refused_done_over_red ?? 0) > 0
          ? ("refused" as const)
          : null;

  const usage: E4TaskUsage = {
    turns: usageByPhase.spec.turns + usageByPhase.implementation.turns,
    tokens: taskTokens,
    wall_clock_ms: Date.now() - taskStart,
    spend_usd: taskSpendUsd,
    by_phase: usageByPhase,
    gate_executor: gate === null ? null : gateExecutorUsage
  };

  return {
    termination,
    phase_at_termination: phaseAtTermination,
    status: abortedAfterClose ? "aborted" : "complete",
    classification_rationale: termination === "executor_error" ? classificationRationale : null,
    gate_events: gateEvents,
    oracle,
    false_confidence: { event: falseConfidenceEvent, enforcement_outcome: enforcementOutcome },
    smoke_feedback_runs: smokeFeedbackRuns,
    drift,
    noticing_probe_answer: noticingProbeAnswer,
    spec_touch: { touched: specTouchPaths.length > 0, paths: [...new Set(specTouchPaths)] },
    usage,
    probe_usage: probeUsage,
    snapshot,
    executor_artifacts: executorArtifacts
  };
}
