// v2 per-task state machine (E4V2 design §2/§6/§7; v2-M5). One call = one task on the live arm
// workspace: turn loop over the v2 turn adapter, the v2 gate in BOTH arms (custody shared;
// execution only in the executed arm), smoke feedback, and the task close in the §7 order —
// archive (harness-run, identical in both arms) → hidden oracle (EXACTLY ONCE, A9) → drift
// meter → scenario-strength (kill score, hidden) → snapshot → noticing probe.
//
// Termination taxonomy, budgets, stall rule, retry policy, redaction discipline, and usage
// attribution carry over from the v1 runner (src/e4/runner.ts, untouched).
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { E1VerificationBudget } from "../../e1-harness";
import { callE1ProviderWithRetries, isE1ProviderExhaustedError } from "../../e1-provider-runtime";
import { assertE1NoSecretsInJson, type E1RedactionSecret } from "../../e1-redaction";
import { countE1Tokens } from "../../e1-token-estimator";
import { runE4OracleExecutor, type E4ExecutorConfig, type E4ExecutorResult } from "../oracle-executor";
import { buildE4ExecutorEvidence } from "../runner";
import type { E4RenameLineageLookupEntry } from "../meter/classify";
import type { E4HttpTest } from "../substrate/testgen";
import type { E4V2GeneratedTask } from "../substrate/v2/provider";
import type { E4DriftReport, E4ExecutorEvidence, E4TaskPhase, E4TaskTermination, E4TokenUsage, E4Budgets } from "../types";
import { runE4V2KillScore, type E4V2KillScoreReport } from "./bank";
import type { E4V2ArmPolicy } from "./arm-policy";
import type { E4V2SealedConstants } from "./constants";
import { E4V2TaskGate, type E4V2GateEvents } from "./gate";
import { METER_VERSION_V2, readBoundSpecOfRecordScenarios, runE4V2DriftMeter } from "./meter";
import { previewE4V2MergedScenarios, runE4OpenSpecArchiveStep, runE4OpenSpecValidateChange } from "./openspec";
import { openSpecToFeature } from "./converter";
import { runE4V2Scenario, runE4V2ScenarioSet } from "./scenario-executor";
import {
  E4_PROVIDER_RETRY_POLICY,
  E4_STALL_NO_OP_TURN_LIMIT,
  applyE4V2Replacements,
  assertV2ConstantsRunnable,
  createE4TurnParser,
  readE4V2OpenSpecTree,
  renderE4TurnFeedback,
  renderE4V2SystemPromptParts,
  renderE4V2TaskMessage,
  type E4AgentProvider,
  type E4ChatMessage
} from "./turns";
import { readOpenSpecSpecOfRecord } from "../../e1-openspec-harness";
// v3-M3 (E4V3-PRODUCT-LOOP-PROPOSAL.md §3): the product loop enters through the OPTIONAL `v3`
// input — v2 callers never set it and their control flow is byte-path-identical.
import { extractSurfaceDump } from "../meter/extract";
import { E4V3ProductTaskGate, type E4V3ProductGateConfig, type E4V3ProductGateSummary } from "../v3/product-gate";
import { runE4AgentMutationAnalysis } from "../v3/mutation";
import { extractAskPm } from "../v3/turn-protocol";
import type { E4TaskDelta } from "../v3/task-delta";

export type E4V2SequenceSpendLedger = { spent_usd: number };

export type E4V2ArchiveOutcome = {
  attempted: boolean;
  change_name: string | null;
  archive_ok: boolean | null; // null when not attempted (no custody-passed change)
  failure_reason: string | null;
  survival_ledger: unknown | null;
};

export type E4V2TaskUsage = {
  turns: number;
  tokens: E4TokenUsage;
  wall_clock_ms: number;
  spend_usd: number;
  by_phase: Record<
    E4TaskPhase,
    {
      turns: number;
      tokens: E4TokenUsage;
      wall_clock_ms: number;
      spec_authoring_tokens: number;
      gate_protocol_interaction_tokens: number;
      oracle_feedback_tokens: number;
      pm_brief_tokens: number; // v3 additive component; always 0 in v2 runs
    }
  >;
};

export type E4V2TaskRunResult = {
  termination: E4TaskTermination;
  phase_at_termination: E4TaskPhase;
  status: "complete" | "aborted";
  classification_rationale: string | null;
  gate_events: E4V2GateEvents;
  oracle: { delta_pass: number; delta_total: number; cumulative_pass: number; cumulative_total: number };
  false_confidence: { event: boolean; enforcement_outcome: "accepted" | "refused" | null };
  smoke_feedback_runs: number;
  smoke_readiness_failures: number;
  archive: E4V2ArchiveOutcome;
  drift: E4DriftReport;
  kill_score: E4V2KillScoreReport;
  scenario_census: { spec_of_record_scenarios: number; unbindable_scenarios: number };
  noticing_probe_answer: string;
  spec_touch: { touched: boolean; paths: string[] };
  usage: E4V2TaskUsage;
  probe_usage: { tokens: E4TokenUsage; spend_usd: number } | null;
  snapshot: { hash: string; path: string };
  executor_artifacts: string[];
  // v3 additive fields (E4V3-PRODUCT-LOOP-PROPOSAL.md §3); null in every v2 run.
  pm_brief: { requested: boolean; first_turn: number | null } | null;
  product_gate: E4V3ProductGateSummary | null;
};

export type E4V2RunTaskInput = {
  repoRoot: string;
  arm: E4V2ArmPolicy;
  task: E4V2GeneratedTask;
  workspace_dir: string;
  records_dir: string;
  provider: E4AgentProvider;
  budgets: E4Budgets;
  spend_ledger: E4V2SequenceSpendLedger;
  constants: E4V2SealedConstants;
  rename_lineage: E4RenameLineageLookupEntry[];
  executor_config: E4ExecutorConfig;
  captureSnapshot: () => Promise<{ hash: string; path: string }>;
  secrets?: E1RedactionSecret[];
  retry_sleep?: (ms: number) => Promise<void>;
  // A9 test seam: the hidden-oracle engine, defaulting to the real executor. Tests inject a
  // counting wrapper to assert the oracle runs exactly once per task close.
  oracle_runner?: typeof runE4OracleExecutor;
  // v3-M3: present only in v3 runs (profile e4-openspec-workflow-v2). The PM brief is a pure
  // function of the drawn task, computed by the orchestrator; base_extra (the ASK_PM protocol
  // text) is arm-identical by construction; channel_extra and product are the product arm's
  // declared policy delta.
  v3?: {
    pm_brief_text: string;
    base_extra: string;
    channel_extra: string | null;
    product: { delta: E4TaskDelta; config: E4V3ProductGateConfig } | null;
  };
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

function emptyDriftReport(): E4DriftReport {
  const kinds = ["endpoint", "entity", "field", "validation_rule", "convention"] as const;
  const counts = Object.fromEntries(
    kinds.map((kind) => [kind, { contradiction: 0, coverage_gap: 0, stale_claim: 0 }])
  ) as E4DriftReport["counts"];

  return {
    meter_version: METER_VERSION_V2,
    discrepancies: [],
    spec_unparseable: false,
    extraction_failed: true,
    registry_bypass: [],
    counts
  };
}

export async function runE4V2Task(input: E4V2RunTaskInput): Promise<E4V2TaskRunResult> {
  assertV2ConstantsRunnable(input.constants);

  const smokeCommand = input.constants.feedback.smoke_command;
  const parser = createE4TurnParser();
  const verificationBudget = new E1VerificationBudget(input.budgets.verifications_per_task);
  await mkdir(input.records_dir, { recursive: true });

  const secrets = input.secrets ?? [];
  const writeRecordFile = async (name: string, payload: string): Promise<void> => {
    assertE1NoSecretsInJson(payload, secrets);
    await writeFile(join(input.records_dir, name), payload);
  };
  const appendRecordLine = async (name: string, line: string): Promise<void> => {
    assertE1NoSecretsInJson(line, secrets);
    await appendFile(join(input.records_dir, name), line);
  };

  const taskStart = Date.now();
  const usageByPhase: Record<E4TaskPhase, { turns: number; tokens: E4TokenUsage; wall_clock_ms: number }> = {
    spec: { turns: 0, tokens: zeroTokens(), wall_clock_ms: 0 },
    implementation: { turns: 0, tokens: zeroTokens(), wall_clock_ms: 0 }
  };
  const componentTokens: Record<E4TaskPhase, { spec_authoring: number; gate_protocol: number; oracle_feedback: number }> = {
    spec: { spec_authoring: 0, gate_protocol: 0, oracle_feedback: 0 },
    implementation: { spec_authoring: 0, gate_protocol: 0, oracle_feedback: 0 }
  };
  const taskTokens = zeroTokens();
  let taskSpendUsd = 0;
  let smokeFeedbackRuns = 0;
  let smokeReadinessFailures = 0;
  const specTouchPaths: string[] = [];
  const executorArtifacts: string[] = [];
  let gateRunCounter = 0;
  let mutationRunCounter = 0;
  let askPmRequested = false;
  let askPmFirstTurn: number | null = null;
  const pmBriefTokens: Record<E4TaskPhase, number> = { spec: 0, implementation: 0 };

  const gateInput = {
    arm_mode: input.arm.arm_mode,
    opportunity_labels: input.task.opportunity_labels,
    task_start_openspec: await readE4V2OpenSpecTree(input.workspace_dir),
    validateChange: async (changeName: string) => {
      const result = await runE4OpenSpecValidateChange({
        repoRoot: input.repoRoot,
        workspacePath: input.workspace_dir,
        changeName
      });
      return { ok: result.exit_code === 0, detail: result.normalized_stdout.split("\n").slice(-3).join(" ") };
    },
    previewMergedScenarios: (changeName: string | null) =>
      previewE4V2MergedScenarios({ repoRoot: input.repoRoot, workspacePath: input.workspace_dir, changeName }),
    runScenarios: async (scenarios: Parameters<typeof runE4V2ScenarioSet>[0]["scenarios"]) => {
      const verdicts = await runE4V2ScenarioSet({
        workspace_dir: input.workspace_dir,
        scenarios,
        config: input.executor_config,
        concurrency: 4
      });
      gateRunCounter += 1;
      const artifact = `gate-scenarios-${gateRunCounter}.json`;
      await writeRecordFile(artifact, `${JSON.stringify({ verdicts }, null, 2)}\n`);
      executorArtifacts.push(artifact);
      return verdicts;
    }
  };

  const gate: E4V2TaskGate | E4V3ProductTaskGate = input.v3?.product
    ? new E4V3ProductTaskGate({
        ...gateInput,
        delta: input.v3.product.delta,
        briefDelivered: () => askPmRequested,
        extractDump: () => extractSurfaceDump(input.workspace_dir),
        runMutationAnalysis: async (scenarios) => {
          mutationRunCounter += 1;
          const report = await runE4AgentMutationAnalysis({
            workspaceDir: input.workspace_dir,
            scenarios,
            config: input.executor_config,
            scratchRoot: join(input.records_dir, "mutation", `attempt-${mutationRunCounter}`),
            concurrency: 4
          });
          const artifact = `mutation-${mutationRunCounter}.json`;
          await writeRecordFile(artifact, `${JSON.stringify(report, null, 2)}\n`);
          executorArtifacts.push(artifact);
          return report;
        },
        productConfig: input.v3.product.config
      })
    : new E4V2TaskGate(gateInput);

  const currentPhase = (): E4TaskPhase => (gate.phase() === "closed" ? "implementation" : gate.phase());

  const promptParts = renderE4V2SystemPromptParts({ constants: input.constants, arm: input.arm });
  const promptBase = input.v3 ? `${promptParts.base}\n\n${input.v3.base_extra}` : promptParts.base;
  const promptChannel = [promptParts.channel, input.v3?.channel_extra ?? null]
    .filter((part): part is string => part !== null)
    .join("\n\n");
  const systemPrompt = promptChannel.length === 0 ? promptBase : `${promptBase}\n\n${promptChannel}`;
  const taskMessage = await renderE4V2TaskMessage({ nl_request: input.task.nl_request, workspaceDir: input.workspace_dir });
  const messages: E4ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: taskMessage }
  ];
  await writeRecordFile("initial-messages.json", `${JSON.stringify({ messages }, null, 2)}\n`);

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

    const prePass = input.v3 ? extractAskPm(turnResult.text) : { text: turnResult.text, ask_pm: false };
    const parsed = parser.parse(prePass.text);
    const effectiveNoOp = parsed.no_op && !prePass.ask_pm;

    if (effectiveNoOp) {
      consecutiveNoOps += 1;
    } else {
      consecutiveNoOps = 0;
    }

    let pmBriefFeedback: string | null = null;

    if (prePass.ask_pm && input.v3) {
      askPmRequested = true;
      askPmFirstTurn ??= turn;
      pmBriefFeedback = input.v3.pm_brief_text;
      pmBriefTokens[phaseAtTurnStart] += countE1Tokens(input.v3.pm_brief_text);
    }

    const applyResult = await applyE4V2Replacements({
      workspaceDir: input.workspace_dir,
      replacements: parsed.replacements,
      gate
    });

    for (const appliedReplacement of applyResult.applied) {
      if (appliedReplacement.path === "openspec" || appliedReplacement.path.startsWith("openspec/")) {
        specTouchPaths.push(appliedReplacement.path);
        componentTokens[phaseAtTurnStart].spec_authoring += countE1Tokens(appliedReplacement.content);
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
        const smokeResult = await runE4V2Scenario({
          workspace_dir: input.workspace_dir,
          scenario: { title: "smoke", steps: [] },
          config: input.executor_config
        });
        smokeFeedbackRuns += 1;

        const smokeArtifact = `smoke-${smokeFeedbackRuns}.json`;
        await writeRecordFile(smokeArtifact, `${JSON.stringify({ result: smokeResult }, null, 2)}\n`);
        executorArtifacts.push(smokeArtifact);

        if (smokeResult.kind === "executor_error") {
          terminateExecutorError(smokeResult.classification_rationale);
        } else {
          gate.recordSmokeInvocation();

          if (smokeResult.kind === "completed") {
            verificationFeedback = "smoke: the server started and answered the readiness probe (ok).";
          } else {
            smokeReadinessFailures += 1;
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
      if (gate.phase() === "spec") {
        const exit = await gate.attemptSpecExit(await readE4V2OpenSpecTree(input.workspace_dir));

        if (exit.outcome === "executor_error") {
          terminateExecutorError(exit.classification_rationale);
        } else if (exit.outcome === "custody_failed") {
          gateFeedback = exit.feedback;
          componentTokens[phaseAtTurnStart].gate_protocol += countE1Tokens(exit.feedback);
        } else {
          const transitionLine = `workflow: custody passed (${exit.custody_via}); entering the implementation phase. Files under openspec/ are now frozen.`;
          let redLine: string;

          if (exit.red_check === null) {
            redLine = "no-change exit accepted; nothing to execute for this behavior-preserving task.";
          } else if (exit.red_check.mode === "prose_recorded") {
            redLine = "the change was recorded.";
          } else if (exit.red_check.novel_red !== null && exit.red_check.novel_red > 0) {
            const greenSuffix =
              exit.red_check.green_novel_titles.length > 0
                ? ` Note: ${exit.red_check.green_novel_titles.length} novel scenario(s) already pass (${exit.red_check.green_novel_titles.join(", ")}).`
                : "";
            redLine = `red check: ${exit.red_check.novel_red} of ${exit.red_check.novel_total} novel scenario(s) fail on the current implementation (expected before implementing); previously accepted scenarios ${exit.red_check.prior_green ? "still pass" : "are NOT fully green"}.${greenSuffix}`;
          } else {
            redLine = "red check skipped for this behavior-preserving task; the novel scenarios' status was recorded.";
          }

          gateFeedback = `${transitionLine} ${redLine}`;
          componentTokens[phaseAtTurnStart].gate_protocol += countE1Tokens(transitionLine);
          componentTokens[phaseAtTurnStart].oracle_feedback += countE1Tokens(redLine);
        }
      } else {
        const claim = await gate.submitDoneClaim();

        if (claim.outcome === "executor_error") {
          terminateExecutorError(claim.classification_rationale);
        } else if (claim.outcome === "accepted") {
          doneAccepted = true;
          termination = "done";
        } else {
          gateFeedback = claim.feedback;
          componentTokens[phaseAtTurnStart].oracle_feedback += countE1Tokens(claim.feedback);
        }
      }
    }

    const gateAndBrief = [gateFeedback, pmBriefFeedback].filter((part): part is string => part !== null);
    const feedback = renderE4TurnFeedback({
      confirmations: applyResult.confirmations,
      rejections: applyResult.rejected,
      violations: parsed.violations.map((violation) => ({
        code: violation.code,
        line: violation.line,
        detail: violation.detail
      })),
      verification: verificationFeedback,
      gate: gateAndBrief.length === 0 ? null : gateAndBrief.join("\n\n"),
      no_op: effectiveNoOp
    });

    usageByPhase[phaseAtTurnStart].wall_clock_ms += Date.now() - turnStarted;

    await appendRecordLine(
      "turns.jsonl",
      `${JSON.stringify({
        turn,
        phase: phaseAtTurnStart,
        raw_output: turnResult.text,
        applied_paths: applyResult.applied.map((entry) => entry.path),
        rejected: applyResult.rejected,
        verification: parsed.verification === null ? null : { command: parsed.verification.raw },
        done: parsed.done,
        ask_pm: prePass.ask_pm,
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

    messages.push({ role: "user", content: feedback.length > 0 ? feedback : "continue." });
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

  // ---- task close: archive (both arms, identical) → oracle (ONCE, A9) → meter → strength →
  // ---- snapshot → probe ----

  const acceptedChange = gate.changeName();
  let archive: E4V2ArchiveOutcome = {
    attempted: false,
    change_name: acceptedChange,
    archive_ok: null,
    failure_reason: null,
    survival_ledger: null
  };

  if (!isAborted && acceptedChange !== null) {
    const record = await runE4OpenSpecArchiveStep({
      repoRoot: input.repoRoot,
      workspacePath: input.workspace_dir,
      changeName: acceptedChange
    });
    archive = {
      attempted: true,
      change_name: acceptedChange,
      archive_ok: record.archive_ok,
      failure_reason: record.failure_reason ?? null,
      survival_ledger: record.survival_ledger
    };

    if (record.archive_ok) {
      // Refresh the derived .feature byproducts from the merged spec-of-record (§5.2 step 1 —
      // harness-derived, never hand-maintained; openspec/specs is harness-owned).
      const merged = await readOpenSpecSpecOfRecord(input.workspace_dir);

      for (const [capability, markdown] of Object.entries(merged)) {
        await writeFile(
          join(input.workspace_dir, "openspec", "specs", capability, "spec.feature"),
          openSpecToFeature(markdown, capability)
        );
      }
    }

    await writeRecordFile("archive.json", `${JSON.stringify({ record }, null, 2)}\n`);
  }

  let oracle = {
    delta_pass: 0,
    delta_total: input.task.acceptance_tests.delta.length,
    cumulative_pass: 0,
    cumulative_total: input.task.acceptance_tests.cumulative.length
  };
  let executorEvidence: E4ExecutorEvidence = { endpoints: [] };

  if (!isAborted) {
    const oracleRunner = input.oracle_runner ?? runE4OracleExecutor;
    const hiddenOracle: E4ExecutorResult = await oracleRunner({
      workspace_dir: input.workspace_dir,
      tests: input.task.acceptance_tests.cumulative,
      config: input.executor_config
    });
    await writeRecordFile("hidden-oracle.json", `${JSON.stringify({ result: hiddenOracle }, null, 2)}\n`);
    executorArtifacts.push("hidden-oracle.json");

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
        tests: input.task.acceptance_tests.cumulative as E4HttpTest[],
        verdicts: hiddenOracle.verdicts
      });
    }
  }

  const abortedAfterClose =
    termination === "provider_error" ||
    termination === "spend_cap_reached" ||
    termination === "executor_error" ||
    termination === "invalid_integrity";

  let drift: E4DriftReport;

  try {
    drift = await runE4V2DriftMeter({
      workspaceDir: input.workspace_dir,
      groundTruthIr: input.task.ground_truth_ir,
      executorEvidence,
      renameLineage: input.rename_lineage,
      executorConfig: input.executor_config
    });
  } catch {
    drift = emptyDriftReport();
  }

  await writeRecordFile("drift-report.json", `${JSON.stringify(drift, null, 2)}\n`);

  // Scenario-strength instrument (§7): the agent's cumulative (post-archive) scenario set vs
  // the adversarial bank — measured, hidden, never fed back.
  const recordScenarios = await readBoundSpecOfRecordScenarios(input.workspace_dir);
  const killScore = await runE4V2KillScore({
    groundTruthIr: input.task.ground_truth_ir,
    scenarios: recordScenarios.scenarios,
    executorConfig: input.executor_config,
    concurrency: 4
  });
  await writeRecordFile("kill-score.json", `${JSON.stringify(killScore, null, 2)}\n`);

  const snapshot = await input.captureSnapshot();

  let noticingProbeAnswer = "";
  let probeUsage: { tokens: E4TokenUsage; spend_usd: number } | null = null;

  if (!abortedAfterClose && input.constants.protocol_text.noticing_probe_prompt) {
    try {
      const { value } = await callE1ProviderWithRetries({
        maxAttempts: E4_PROVIDER_RETRY_POLICY.max_attempts,
        backoffMs: [...E4_PROVIDER_RETRY_POLICY.backoff_ms],
        operation: () =>
          input.provider.runTurn({
            messages: [...messages, { role: "user", content: input.constants.protocol_text.noticing_probe_prompt }]
          }),
        ...(input.retry_sleep ? { sleep: input.retry_sleep } : {})
      });
      noticingProbeAnswer = value.text;
      probeUsage = { tokens: value.usage, spend_usd: value.spend_usd };
      input.spend_ledger.spent_usd += value.spend_usd;
    } catch (error) {
      await writeRecordFile("probe-error.json", `${JSON.stringify({ error: String(error) }, null, 2)}\n`);
    }

    await writeRecordFile("probe.json", `${JSON.stringify({ answer: noticingProbeAnswer, usage: probeUsage }, null, 2)}\n`);
  }

  const gateEvents = gate.summary();
  const falseConfidenceEvent = termination === "done" && oracle.cumulative_pass < oracle.cumulative_total;
  const enforcementOutcome =
    input.arm.arm_mode !== "executed"
      ? null
      : doneAccepted
        ? ("accepted" as const)
        : gateEvents.refused_done_over_red > 0
          ? ("refused" as const)
          : null;

  const usage: E4V2TaskUsage = {
    turns: usageByPhase.spec.turns + usageByPhase.implementation.turns,
    tokens: taskTokens,
    wall_clock_ms: Date.now() - taskStart,
    spend_usd: taskSpendUsd,
    by_phase: {
      spec: {
        ...usageByPhase.spec,
        spec_authoring_tokens: componentTokens.spec.spec_authoring,
        gate_protocol_interaction_tokens: componentTokens.spec.gate_protocol,
        oracle_feedback_tokens: componentTokens.spec.oracle_feedback,
        pm_brief_tokens: pmBriefTokens.spec
      },
      implementation: {
        ...usageByPhase.implementation,
        spec_authoring_tokens: componentTokens.implementation.spec_authoring,
        gate_protocol_interaction_tokens: componentTokens.implementation.gate_protocol,
        oracle_feedback_tokens: componentTokens.implementation.oracle_feedback,
        pm_brief_tokens: pmBriefTokens.implementation
      }
    }
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
    smoke_readiness_failures: smokeReadinessFailures,
    archive,
    drift,
    kill_score: killScore,
    scenario_census: {
      spec_of_record_scenarios: recordScenarios.scenarios.length,
      unbindable_scenarios: recordScenarios.unbindable_count
    },
    noticing_probe_answer: noticingProbeAnswer,
    spec_touch: { touched: specTouchPaths.length > 0, paths: [...new Set(specTouchPaths)] },
    usage,
    probe_usage: probeUsage,
    snapshot,
    executor_artifacts: executorArtifacts,
    pm_brief: input.v3 ? { requested: askPmRequested, first_turn: askPmFirstTurn } : null,
    product_gate: gate instanceof E4V3ProductTaskGate ? gate.productSummary() : null
  };
}
