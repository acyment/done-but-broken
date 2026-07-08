// E4 sequence orchestrator (architecture §2.2 E4SequenceRunner; IMPLEMENTATION-PLAN.md M4):
// sequence-per-arm over one shared substrate draw, pairing + allowlist parity validation, manifest
// assembly (written to disk after every task close — the crash-durability that makes ADR-005
// resume possible), and --resume (restore last complete snapshot, hash-verified, partial task to
// aborted/, resume_events recorded).
//
// Replay-validity note (M4 boundary): `substrate_regeneration_ok` is computed live (the generated
// T0 files byte-compared against the sequence-start snapshot); `per_task_replay_ok` /
// `chain_replay_valid` stay conservatively empty/false until the M5 inspector recomputes them from
// retained turn records — headline claims may rest only on sequences the inspector validates.
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { buildE4ArmPolicies, validateE4RuntimeArmParity, type E4ArmPolicy, type E4ArmRuntime } from "./arm-policy";
import type { E4SealedConstants } from "./constants";
import { validateE4RunManifest, type E4RunManifest, type E4TaskRecord } from "./manifest";
import { runE4Task, type E4SequenceSpendLedger } from "./runner";
import {
  captureE4Snapshot,
  e4SnapshotDir,
  hashE4Snapshot,
  restoreE4Snapshot,
  E4SnapshotError,
  E4SnapshotHashMismatchError
} from "./snapshot";
import type { E4ExecutorConfig } from "./oracle-executor";
import { generateCumulativeTests, type E4HttpTest } from "./substrate/testgen";
import type { E4GenerateResult, E4SubstrateConfig, E4SubstrateProvider } from "./substrate/provider";
import { E4TurnProtocolError, type E4AgentProviderFactory } from "./turns";
import type { E4ArmId, E4ResumeEvent, E4RunClassification, E4TokenUsage } from "./types";

const ARM_ORDER: readonly E4ArmId[] = ["e4_arm_0", "e4_arm_m", "e4_arm_h"];

export type E4RunInput = {
  runRoot: string;
  constants: E4SealedConstants;
  constantsHash: string;
  substrate: E4SubstrateProvider;
  config: E4SubstrateConfig;
  pairing_label: string;
  run_classification: E4RunClassification;
  model: { preset: string; model_id: string; route_id: string };
  providerFactory: E4AgentProviderFactory;
  resume?: boolean;
  // Test seams only: sealed executor timeouts / retry sleeps are the real-run defaults.
  executor_config?: E4ExecutorConfig;
  retry_sleep?: (ms: number) => Promise<void>;
};

export type E4RunResult = {
  manifests: Partial<Record<E4ArmId, E4RunManifest>>;
};

export class E4OrchestratorError extends Error {
  constructor(message: string) {
    super(`[e4-orchestrator] ${message}`);
    this.name = "E4OrchestratorError";
  }
}

function requireSealedForRuns(constants: E4SealedConstants): void {
  if (
    constants.budgets === null ||
    constants.feedback === null ||
    constants.snapshot === null ||
    constants.executor === null ||
    constants.protocol_text === null ||
    typeof constants.protocol_text.arm_m_standing_instruction !== "string"
  ) {
    throw new E4OrchestratorError(
      "constants draft is pre-M4: budgets, feedback, snapshot, executor, and the full protocol_text block must be sealed before any run"
    );
  }
}

// One arm's declared runtime parameters (§2.3): built from ONE substrate draw + ONE budgets object,
// then still validated — the validator is the guarantee, construction is merely the mechanism.
export function buildE4ArmRuntimes(input: {
  policies: Record<E4ArmId, E4ArmPolicy>;
  generated: E4GenerateResult;
  constants: E4SealedConstants;
  pairing_label: string;
}): E4ArmRuntime[] {
  const taskText = JSON.stringify(input.generated.tasks.map((task) => task.nl_request));

  return ARM_ORDER.map((arm) => {
    const policy = input.policies[arm];

    return {
      arm,
      pairing_label: input.pairing_label,
      task_text: taskText,
      budgets: input.constants.budgets!,
      retry_policy: input.constants.feedback!.retry_policy,
      standing_instruction: policy.standing_instruction,
      gate_channel: policy.gate_enabled
        ? { gate_enabled: true, acceptance_oracle_enabled: policy.feedback.acceptance_oracle }
        : null
    };
  });
}

function zeroTokens(): E4TokenUsage {
  return { fresh_input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 };
}

function accumulateUsageTotals(manifest: E4RunManifest, record: E4TaskRecord, probe: { tokens: E4TokenUsage; spend_usd: number } | null): void {
  manifest.usage_totals.turns += record.usage.turns;
  manifest.usage_totals.wall_clock_ms += record.usage.wall_clock_ms;
  manifest.usage_totals.spend_usd += record.usage.spend_usd;
  manifest.usage_totals.tokens.fresh_input_tokens += record.usage.tokens.fresh_input_tokens;
  manifest.usage_totals.tokens.cached_input_tokens += record.usage.tokens.cached_input_tokens;
  manifest.usage_totals.tokens.output_tokens += record.usage.tokens.output_tokens;

  // [R1-C3] the noticing probe is a separate arm-uniform usage line: excluded from per-task
  // by_phase (and both taxes), included here so sequence totals and the spend cap stay truthful.
  if (probe !== null) {
    manifest.usage_totals.spend_usd += probe.spend_usd;
    manifest.usage_totals.tokens.fresh_input_tokens += probe.tokens.fresh_input_tokens;
    manifest.usage_totals.tokens.cached_input_tokens += probe.tokens.cached_input_tokens;
    manifest.usage_totals.tokens.output_tokens += probe.tokens.output_tokens;
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function writeWorkspaceFiles(workspaceDir: string, files: Record<string, string>): Promise<void> {
  for (const [relativePath, contents] of Object.entries(files)) {
    const absolute = join(workspaceDir, relativePath);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, contents);
  }
}

// Byte-compare the generated T0 files against the sequence-start snapshot on disk — the live half
// of the replay-validity chain (generator determinism is what makes this meaningful).
async function verifySubstrateRegeneration(snapshotDir: string, files: Record<string, string>): Promise<boolean> {
  for (const [relativePath, contents] of Object.entries(files)) {
    try {
      const onDisk = await readFile(join(snapshotDir, relativePath), "utf8");

      if (onDisk !== contents) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

function manifestPath(runRoot: string, arm: E4ArmId): string {
  return join(runRoot, "manifests", `${arm}.json`);
}

async function writeManifest(runRoot: string, manifest: E4RunManifest): Promise<void> {
  await mkdir(join(runRoot, "manifests"), { recursive: true });
  await writeFile(manifestPath(runRoot, manifest.arm), `${JSON.stringify(manifest, null, 2)}\n`);
}

function sequenceIsFinished(manifest: E4RunManifest, taskCount: number): boolean {
  const lastRecord = manifest.tasks.at(-1);

  return manifest.tasks.length >= taskCount || lastRecord?.status === "aborted";
}

export async function runE4Run(input: E4RunInput): Promise<E4RunResult> {
  requireSealedForRuns(input.constants);

  const boundary = input.constants.compatibility_boundary;

  if (boundary.substrate_config_id !== input.config.substrate_config_id) {
    throw new E4OrchestratorError(
      `substrate_config_id mismatch: constants seal ${boundary.substrate_config_id}, run config ${input.config.substrate_config_id}`
    );
  }

  if (input.substrate.substrate_version !== boundary.substrate_version) {
    throw new E4OrchestratorError(
      `substrate_version mismatch: constants seal ${boundary.substrate_version}, provider ${input.substrate.substrate_version}`
    );
  }

  const generated = await input.substrate.generate(input.config);
  const policies = buildE4ArmPolicies({
    standingInstruction: input.constants.protocol_text!.arm_m_standing_instruction
  });

  validateE4RuntimeArmParity(
    buildE4ArmRuntimes({ policies, generated, constants: input.constants, pairing_label: input.pairing_label })
  );

  const executorConfig: E4ExecutorConfig = input.executor_config ?? {
    readiness_timeout_ms: input.constants.executor!.readiness_timeout_ms,
    request_timeout_ms: input.constants.executor!.request_timeout_ms,
    readiness_poll_interval_ms: input.constants.executor!.readiness_poll_interval_ms
  };

  const manifests: Partial<Record<E4ArmId, E4RunManifest>> = {};

  for (const arm of ARM_ORDER) {
    manifests[arm] = await runArmSequence({ input, arm, generated, policy: policies[arm], executorConfig });
  }

  return { manifests };
}

async function runArmSequence(context: {
  input: E4RunInput;
  arm: E4ArmId;
  generated: E4GenerateResult;
  policy: E4ArmPolicy;
  executorConfig: E4ExecutorConfig;
}): Promise<E4RunManifest> {
  const { input, arm, generated, policy, executorConfig } = context;
  const runRoot = input.runRoot;
  const workspaceDir = join(runRoot, "workspaces", arm);
  const boundary = input.constants.compatibility_boundary;

  let manifest: E4RunManifest | null = null;
  let startTaskIndex = 1;

  if (input.resume) {
    // An arm the crashed run never reached has no manifest yet — it starts fresh; only arms with
    // recorded progress go through the ADR-005 restore path.
    manifest = await resumeArmSequence({ input, arm, generated, workspaceDir });

    if (manifest !== null) {
      startTaskIndex = manifest.tasks.length + 1;

      if (sequenceIsFinished(manifest, input.config.task_count)) {
        return manifest;
      }
    }
  }

  if (manifest === null) {
    await mkdir(workspaceDir, { recursive: true });
    await writeWorkspaceFiles(workspaceDir, generated.initial_workspace);

    // ADR-005 cadence: sequence_start snapshot (task-0) is the first replay anchor.
    const t0 = await captureE4Snapshot({ workspaceDir, runRoot, arm, taskIndex: 0 });

    manifest = {
      schema: "e4-run-manifest",
      schema_version: "e4-run-manifest-v1",
      run_id: `${input.run_classification}-${input.pairing_label}-${arm}`,
      run_classification: input.run_classification,
      compatibility_boundary: {
        constants_version: input.constants.version,
        constants_hash: input.constantsHash,
        meter_version: boundary.meter_version ?? "",
        substrate_config_id: boundary.substrate_config_id ?? "",
        substrate_kind: boundary.substrate_kind,
        substrate_version: boundary.substrate_version ?? ""
      },
      substrate_seed: input.config.substrate_seed,
      pairing_label: input.pairing_label,
      arm,
      model: input.model,
      budgets: input.constants.budgets!,
      tasks: [],
      resume_events: [],
      replay_validity: {
        substrate_regeneration_ok: await verifySubstrateRegeneration(t0.path, generated.initial_workspace),
        per_task_replay_ok: [],
        chain_replay_valid: false
      },
      usage_totals: { turns: 0, tokens: zeroTokens(), wall_clock_ms: 0, spend_usd: 0 }
    };
    await writeManifest(runRoot, manifest);
  }

  const spendLedger: E4SequenceSpendLedger = { spent_usd: manifest.usage_totals.spend_usd };

  for (let taskIndex = startTaskIndex; taskIndex <= input.config.task_count; taskIndex += 1) {
    const task = generated.tasks[taskIndex - 1];

    if (task === undefined) {
      throw new E4OrchestratorError(`substrate draw has no task at index ${taskIndex}`);
    }

    const priorCumulative: E4HttpTest[] =
      taskIndex === 1 ? generateCumulativeTests(generated.initial_ir) : generated.tasks[taskIndex - 2].acceptance_tests.cumulative;

    const recordsDir = join(runRoot, "records", arm, `task-${taskIndex}`);
    const provider = input.providerFactory({ arm, pairing_label: input.pairing_label, task_index: taskIndex });

    const result = await runE4Task({
      arm: policy,
      task,
      prior_cumulative_tests: priorCumulative,
      workspace_dir: workspaceDir,
      records_dir: recordsDir,
      provider,
      budgets: input.constants.budgets!,
      spend_ledger: spendLedger,
      constants: input.constants,
      // [R2: R2-1] only renames that have already happened can merge identities: entries from
      // future tasks are withheld from the meter at task k.
      rename_lineage: generated.rename_lineage_map.filter((entry) => entry.task_index <= taskIndex),
      executor_config: executorConfig,
      captureSnapshot: () => captureE4Snapshot({ workspaceDir, runRoot, arm, taskIndex }),
      ...(input.retry_sleep ? { retry_sleep: input.retry_sleep } : {})
    });

    const record: E4TaskRecord = {
      task_index: taskIndex,
      opportunity_labels: task.opportunity_labels,
      termination: result.termination,
      phase_at_termination: result.phase_at_termination,
      gate_events: result.gate_events,
      oracle: result.oracle,
      false_confidence: result.false_confidence,
      smoke_feedback_runs: result.smoke_feedback_runs,
      drift: result.drift,
      noticing_probe_answer: result.noticing_probe_answer,
      spec_touch: result.spec_touch,
      usage: result.usage,
      snapshot: { hash: result.snapshot.hash, path: relative(runRoot, result.snapshot.path) },
      executor_artifacts: result.executor_artifacts.map((artifact) => relative(runRoot, join(recordsDir, artifact))),
      status: result.status,
      classification_rationale: result.classification_rationale
    };

    manifest.tasks.push(record);
    accumulateUsageTotals(manifest, record, result.probe_usage);
    await writeManifest(runRoot, manifest);

    if (result.status === "aborted") {
      break;
    }
  }

  validateE4RunManifest(JSON.parse(JSON.stringify(manifest)));

  return manifest;
}

async function resumeArmSequence(context: {
  input: E4RunInput;
  arm: E4ArmId;
  generated: E4GenerateResult;
  workspaceDir: string;
}): Promise<E4RunManifest | null> {
  const { input, arm, generated, workspaceDir } = context;
  const runRoot = input.runRoot;
  const path = manifestPath(runRoot, arm);

  if (!(await pathExists(path))) {
    return null;
  }

  const manifest = validateE4RunManifest(JSON.parse(await readFile(path, "utf8")));

  if (sequenceIsFinished(manifest, input.config.task_count)) {
    return manifest;
  }

  const lastCompleteIndex = manifest.tasks.length; // task indices are 1-based; 0 = sequence start
  const snapshotDir = e4SnapshotDir(runRoot, arm, lastCompleteIndex);
  const lastRecord = manifest.tasks.at(-1);

  let expectedHash: string;

  if (lastRecord !== undefined) {
    expectedHash = lastRecord.snapshot.hash;
  } else {
    const sidecar = `${snapshotDir}.hash.json`;

    if (!(await pathExists(sidecar))) {
      throw new E4SnapshotError(`sequence-start snapshot sidecar missing for ${arm}: ${sidecar}`);
    }

    expectedHash = (JSON.parse(await readFile(sidecar, "utf8")) as { hash: string }).hash;
  }

  // Verify the anchor BEFORE any side effect: a corrupt snapshot must fail the resume with the
  // run state untouched (restoreE4Snapshot re-verifies; this early check keeps the failure clean).
  const actualHash = await hashE4Snapshot(snapshotDir);

  if (actualHash !== expectedHash) {
    throw new E4SnapshotHashMismatchError({ snapshotDir, expected: expectedHash, actual: actualHash });
  }

  // ADR-005: a mid-task crash discards the partial task — its turn records move to aborted/,
  // retained for forensics, excluded from analysis (they are not manifest records).
  const partialTaskIndex = lastCompleteIndex + 1;
  const partialRecordsDir = join(runRoot, "records", arm, `task-${partialTaskIndex}`);
  let abortedTaskIndex: number | null = null;

  if (await pathExists(partialRecordsDir)) {
    const abortedDir = join(runRoot, "aborted", arm);
    await mkdir(abortedDir, { recursive: true });
    await rename(
      partialRecordsDir,
      join(abortedDir, `task-${partialTaskIndex}-resume-${manifest.resume_events.length + 1}`)
    );
    abortedTaskIndex = partialTaskIndex;
  }

  await restoreE4Snapshot({ snapshotDir, expectedHash, workspaceDir });

  const resumeEvent: E4ResumeEvent = {
    restored_snapshot_task_index: lastCompleteIndex,
    restored_snapshot_hash: expectedHash,
    resumed_at_task_index: partialTaskIndex,
    aborted_task_index: abortedTaskIndex
  };
  manifest.resume_events.push(resumeEvent);

  // Re-run the live replay-validity half against the restored chain root: T0 regeneration must
  // still byte-match the recorded sequence-start snapshot.
  manifest.replay_validity.substrate_regeneration_ok = await verifySubstrateRegeneration(
    e4SnapshotDir(runRoot, arm, 0),
    generated.initial_workspace
  );

  await writeManifest(runRoot, manifest);

  return manifest;
}

// Re-exported so the M6 CLI and tests treat the orchestrator as the one entry point (the plan's
// single-seeded-command requirement lands there, on this function).
export { E4TurnProtocolError };
