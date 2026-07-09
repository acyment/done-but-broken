// E4 replay-validity inspector (IMPLEMENTATION-PLAN.md M5; ADR-005 chain property; [R2: R2-9b]).
// Recomputes `replay_validity` the way `inspectE1Bundle` replays E1 bundles: RECORDED-EVENT
// reconstruction, never model re-execution — no provider call is ever made here. Each task's
// snapshot-k hash is rebuilt from snapshot k−1 plus the retained turn records alone: the raw
// assistant output is re-parsed with the sealed E4 grammar and the RECORDED applied-path decisions
// are re-applied (the gate's write policy is not re-simulated — the record of what was applied is
// the event log, and re-deriving policy would make replay hostage to policy code drift).
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import { hashDirectory, hashText } from "../snapshot";
import type { E4RunManifest, E4TaskRecord } from "./manifest";
import { e4SnapshotDir, hashE4Snapshot } from "./snapshot";
import { e4ProceduralRestV1Provider, type E4GenerateResult, type E4SubstrateProvider } from "./substrate/provider";
import { createE4TurnParser } from "./turns";
import type { E4ArmId } from "./types";

export type E4ArmInspection = {
  arm: E4ArmId;
  substrate_regeneration_ok: boolean;
  per_task_replay_ok: boolean[];
  resume_seams_ok: boolean;
  // Reported alongside the chain property, not part of it: chain validity is about the RECORD
  // being self-consistent; these two are about the retained artifacts still matching it.
  snapshot_integrity_ok: boolean;
  executor_artifacts_present: boolean;
  oracle_recomputation_ok: boolean;
  chain_replay_valid: boolean;
  problems: string[];
};

type TurnRecordLine = {
  turn: number;
  raw_output: string;
  applied_paths: string[];
};

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readTurnRecords(recordsDir: string): Promise<TurnRecordLine[]> {
  let raw: string;

  try {
    raw = await readFile(join(recordsDir, "turns.jsonl"), "utf8");
  } catch {
    // A task can legitimately record zero turns (e.g. spend_cap_reached before the first turn).
    return [];
  }

  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as TurnRecordLine);
}

// Compare the regenerated T0 files against the sequence-start snapshot on disk: identical file
// SETS and identical bytes (extra or missing files both fail).
async function verifySubstrateRegeneration(
  snapshotDir: string,
  files: Record<string, string>,
  problems: string[]
): Promise<boolean> {
  let onDisk: { files: Record<string, string> };

  try {
    onDisk = await hashDirectory(snapshotDir);
  } catch {
    problems.push(`sequence-start snapshot missing or unreadable: ${snapshotDir}`);
    return false;
  }

  const expectedPaths = Object.keys(files).sort();
  const actualPaths = Object.keys(onDisk.files).sort();

  if (JSON.stringify(expectedPaths) !== JSON.stringify(actualPaths)) {
    problems.push(
      `substrate regeneration file-set mismatch: generated ${expectedPaths.length} files, snapshot has ${actualPaths.length}`
    );
    return false;
  }

  for (const path of expectedPaths) {
    if (hashText(files[path]) !== onDisk.files[path]) {
      problems.push(`substrate regeneration byte mismatch at ${path}`);
      return false;
    }
  }

  return true;
}

async function replayTask(input: {
  runRoot: string;
  arm: E4ArmId;
  record: E4TaskRecord;
  scratchDir: string;
  problems: string[];
}): Promise<boolean> {
  const { runRoot, arm, record, scratchDir, problems } = input;
  const baseSnapshot = e4SnapshotDir(runRoot, arm, record.task_index - 1);
  const reconstruction = join(scratchDir, `task-${record.task_index}`);
  const parser = createE4TurnParser();

  await rm(reconstruction, { recursive: true, force: true });
  await mkdir(dirname(reconstruction), { recursive: true });

  try {
    await cp(baseSnapshot, reconstruction, { recursive: true });
  } catch {
    problems.push(`task ${record.task_index}: base snapshot ${baseSnapshot} missing`);
    return false;
  }

  const turns = await readTurnRecords(join(runRoot, "records", arm, `task-${record.task_index}`));

  for (const turn of turns) {
    const parsed = parser.parse(turn.raw_output);
    const contentByPath = new Map(parsed.replacements.map((replacement) => [replacement.path, replacement.content]));

    for (const path of turn.applied_paths) {
      const content = contentByPath.get(path);

      if (content === undefined) {
        problems.push(
          `task ${record.task_index} turn ${turn.turn}: recorded applied path ${path} is not derivable from the recorded raw output`
        );
        return false;
      }

      const normalized = normalize(path);

      if (normalized.startsWith("..") || normalized.startsWith(sep) || normalized.startsWith("/")) {
        problems.push(`task ${record.task_index} turn ${turn.turn}: recorded applied path escapes the workspace: ${path}`);
        return false;
      }

      const absolute = join(reconstruction, normalized);
      await mkdir(dirname(absolute), { recursive: true });
      await writeFile(absolute, content);
    }
  }

  const reconstructedHash = (await hashDirectory(reconstruction)).hash;

  if (reconstructedHash !== record.snapshot.hash) {
    problems.push(
      `task ${record.task_index}: reconstructed hash ${reconstructedHash} != recorded snapshot hash ${record.snapshot.hash}`
    );
    return false;
  }

  return true;
}

async function readTask0Hash(runRoot: string, arm: E4ArmId, problems: string[]): Promise<string | null> {
  try {
    const sidecar = JSON.parse(
      await readFile(`${e4SnapshotDir(runRoot, arm, 0)}.hash.json`, "utf8")
    ) as { hash: string };

    return sidecar.hash;
  } catch {
    problems.push("sequence-start snapshot hash sidecar missing");
    return null;
  }
}

function verifyResumeSeams(manifest: E4RunManifest, task0Hash: string | null, problems: string[]): boolean {
  let ok = true;

  for (const event of manifest.resume_events) {
    const expected =
      event.restored_snapshot_task_index === 0
        ? task0Hash
        : manifest.tasks.find((task) => task.task_index === event.restored_snapshot_task_index)?.snapshot.hash ?? null;

    if (expected === null || event.restored_snapshot_hash !== expected) {
      problems.push(
        `resume seam at task ${event.resumed_at_task_index}: restored hash does not match the recorded snapshot ${event.restored_snapshot_task_index} anchor`
      );
      ok = false;
    }

    if (event.resumed_at_task_index !== event.restored_snapshot_task_index + 1) {
      problems.push(
        `resume seam at task ${event.resumed_at_task_index}: resumed index is not restored index + 1`
      );
      ok = false;
    }
  }

  return ok;
}

async function verifySnapshotIntegrity(
  runRoot: string,
  manifest: E4RunManifest,
  task0Hash: string | null,
  problems: string[]
): Promise<boolean> {
  let ok = true;

  if (task0Hash !== null) {
    const actual = await hashE4Snapshot(e4SnapshotDir(runRoot, manifest.arm, 0)).catch(() => null);

    if (actual !== task0Hash) {
      problems.push("sequence-start snapshot no longer matches its recorded hash");
      ok = false;
    }
  }

  for (const record of manifest.tasks) {
    const actual = await hashE4Snapshot(e4SnapshotDir(runRoot, manifest.arm, record.task_index)).catch(() => null);

    if (actual !== record.snapshot.hash) {
      problems.push(`snapshot ${record.task_index} on disk no longer matches its recorded hash`);
      ok = false;
    }
  }

  return ok;
}

// Feature 5 "executor artifacts retained + verdicts recomputable": every listed artifact exists,
// and the hidden-oracle verdicts alone reproduce the record's oracle counts (delta counts are
// recomputed against the regenerated task's delta test ids — from retained + regenerated data
// only, never a re-run).
async function verifyExecutorArtifacts(input: {
  runRoot: string;
  manifest: E4RunManifest;
  generated: E4GenerateResult;
  problems: string[];
}): Promise<{ present: boolean; oracleOk: boolean }> {
  const { runRoot, manifest, generated, problems } = input;
  let present = true;
  let oracleOk = true;

  for (const record of manifest.tasks) {
    for (const artifact of record.executor_artifacts) {
      if (!(await pathExists(join(runRoot, artifact)))) {
        problems.push(`task ${record.task_index}: listed executor artifact missing: ${artifact}`);
        present = false;
      }
    }

    const oracleArtifact = record.executor_artifacts.find((artifact) => artifact.endsWith("hidden-oracle.json"));

    if (oracleArtifact === undefined) {
      if (record.status === "complete") {
        problems.push(`task ${record.task_index}: complete record has no hidden-oracle artifact`);
        oracleOk = false;
      }

      continue;
    }

    let parsed: { result: { kind: string; verdicts?: Array<{ test_id: string; passed: boolean }>; pass_count?: number; total?: number } };

    try {
      parsed = JSON.parse(await readFile(join(runRoot, oracleArtifact), "utf8"));
    } catch {
      problems.push(`task ${record.task_index}: hidden-oracle artifact unreadable`);
      oracleOk = false;
      continue;
    }

    if (parsed.result.kind === "completed") {
      const verdicts = parsed.result.verdicts ?? [];
      const cumulativePass = verdicts.filter((verdict) => verdict.passed).length;
      const task = generated.tasks[record.task_index - 1];
      const deltaIds = new Set(task?.acceptance_tests.delta.map((test) => test.test_id) ?? []);
      const deltaPass = verdicts.filter((verdict) => deltaIds.has(verdict.test_id) && verdict.passed).length;

      if (
        cumulativePass !== record.oracle.cumulative_pass ||
        verdicts.length !== record.oracle.cumulative_total ||
        deltaPass !== record.oracle.delta_pass
      ) {
        problems.push(
          `task ${record.task_index}: retained oracle verdicts do not reproduce the recorded oracle counts`
        );
        oracleOk = false;
      }
    } else if (record.oracle.cumulative_pass !== 0) {
      problems.push(
        `task ${record.task_index}: oracle run was ${parsed.result.kind} but the record claims cumulative_pass > 0`
      );
      oracleOk = false;
    }
  }

  return { present, oracleOk };
}

export async function inspectE4ArmSequence(input: {
  runRoot: string;
  manifest: E4RunManifest;
  generated?: E4GenerateResult;
  substrate?: E4SubstrateProvider;
}): Promise<E4ArmInspection> {
  const { runRoot, manifest } = input;
  const problems: string[] = [];
  const substrate = input.substrate ?? e4ProceduralRestV1Provider;

  const generated =
    input.generated ??
    (await substrate.generate({
      substrate_config_id: manifest.compatibility_boundary.substrate_config_id,
      substrate_seed: manifest.substrate_seed,
      task_count: manifest.substrate_config.task_count,
      op_mix: manifest.substrate_config.op_mix
    }));

  const substrateRegenerationOk = await verifySubstrateRegeneration(
    e4SnapshotDir(runRoot, manifest.arm, 0),
    generated.initial_workspace,
    problems
  );

  const scratchDir = join(runRoot, "inspect-scratch", manifest.arm);
  const perTaskReplayOk: boolean[] = [];

  try {
    for (const record of [...manifest.tasks].sort((a, b) => a.task_index - b.task_index)) {
      perTaskReplayOk.push(await replayTask({ runRoot, arm: manifest.arm, record, scratchDir, problems }));
    }
  } finally {
    await rm(scratchDir, { recursive: true, force: true });
  }

  const task0Hash = await readTask0Hash(runRoot, manifest.arm, problems);
  const resumeSeamsOk = verifyResumeSeams(manifest, task0Hash, problems);
  const snapshotIntegrityOk = await verifySnapshotIntegrity(runRoot, manifest, task0Hash, problems);
  const artifacts = await verifyExecutorArtifacts({ runRoot, manifest, generated, problems });

  return {
    arm: manifest.arm,
    substrate_regeneration_ok: substrateRegenerationOk,
    per_task_replay_ok: perTaskReplayOk,
    resume_seams_ok: resumeSeamsOk,
    snapshot_integrity_ok: snapshotIntegrityOk,
    executor_artifacts_present: artifacts.present,
    oracle_recomputation_ok: artifacts.oracleOk,
    chain_replay_valid:
      substrateRegenerationOk && perTaskReplayOk.every((ok) => ok) && resumeSeamsOk,
    problems
  };
}
