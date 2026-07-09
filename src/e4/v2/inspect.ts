// v2 replay-validity inspector (E4V2 design §9 v2-M5 "inspector/replay across the archive
// seam"). Recorded-event reconstruction, never model re-execution and never a provider call:
//
//   substrate_regeneration_ok — the v2 provider regenerates byte-identically from the manifest's
//     substrate_config, and the T0 workspace hashes to the recorded initial snapshot.
//   per-task replay — starting from snapshot k−1 (T0 snapshot for k=1), re-parse each retained
//     turn's raw output with the sealed grammar, re-apply exactly the RECORDED applied paths
//     (recorded decisions, never re-simulated gate policy), then — the ARCHIVE SEAM — if the
//     task's archive record says the harness archive succeeded, re-run the REAL pinned archive
//     step on the reconstructed workspace (deterministic: byte-identical spec-of-record for
//     identical inputs, characterization-pinned) and re-derive the .feature byproducts. The
//     reconstructed workspace must hash to snapshot k.
//   chain_replay_valid — the conjunction across every task, false on any mismatch.
import { cp, mkdir, mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { hashDirectory } from "../../snapshot";
import { readOpenSpecSpecOfRecord } from "../../e1-openspec-harness";
import { e4ProceduralRestV2Provider } from "../substrate/v2/provider";
import { openSpecToFeature } from "./converter";
import type { E4V2RunManifest } from "./manifest";
import { runE4OpenSpecArchiveStep } from "./openspec";
import { createE4TurnParser } from "./turns";

type TurnRecord = {
  turn: number;
  raw_output: string;
  applied_paths: string[];
};

async function readTurnRecords(recordsDir: string, taskIndex: number): Promise<TurnRecord[]> {
  const path = join(recordsDir, `task-${taskIndex}`, "turns.jsonl");

  try {
    const lines = (await readFile(path, "utf8")).split("\n").filter((line) => line.length > 0);
    return lines.map((line) => JSON.parse(line) as TurnRecord);
  } catch {
    return [];
  }
}

export type E4V2InspectResult = {
  substrate_regeneration_ok: boolean;
  per_task_replay_ok: boolean[];
  chain_replay_valid: boolean;
  mismatches: string[];
};

export async function inspectE4V2Sequence(input: {
  repoRoot: string;
  runRoot: string;
  manifest: E4V2RunManifest;
}): Promise<E4V2InspectResult> {
  const { manifest } = input;
  const mismatches: string[] = [];

  // ---- substrate regeneration ----
  const regenerated = await e4ProceduralRestV2Provider.generate({
    substrate_config_id: manifest.compatibility_boundary.substrate_config.substrate_config_id,
    substrate_seed: manifest.compatibility_boundary.substrate_config.substrate_seed,
    task_count: manifest.compatibility_boundary.substrate_config.task_count,
    op_mix: manifest.compatibility_boundary.substrate_config.op_mix as never
  });

  let substrateOk = true;
  const scratchT0 = await mkdtemp(join(tmpdir(), "e4-v2-inspect-t0-"));

  try {
    for (const [path, contents] of Object.entries(regenerated.initial_workspace)) {
      await mkdir(dirname(join(scratchT0, path)), { recursive: true });
      await writeFile(join(scratchT0, path), contents);
    }

    const { hash } = await hashDirectory(scratchT0);

    if (hash !== manifest.initial_snapshot.hash) {
      substrateOk = false;
      mismatches.push(`T0 regeneration hash ${hash} != recorded initial snapshot ${manifest.initial_snapshot.hash}`);
    }
  } finally {
    await rm(scratchT0, { recursive: true, force: true });
  }

  // ---- per-task replay over the snapshot chain, across the archive seam ----
  const parser = createE4TurnParser();
  const perTaskOk: boolean[] = [];
  const recordsDir = join(input.runRoot, "records", manifest.arm);

  for (const task of manifest.tasks) {
    const priorSnapshotPath =
      task.task_index === 1 ? manifest.initial_snapshot.path : manifest.tasks[task.task_index - 2].snapshot.path;
    const scratch = await mkdtemp(join(tmpdir(), "e4-v2-inspect-task-"));

    try {
      await cp(priorSnapshotPath, scratch, { recursive: true });

      for (const turn of await readTurnRecords(recordsDir, task.task_index)) {
        const parsed = parser.parse(turn.raw_output);
        const appliedSet = new Set(turn.applied_paths);

        for (const replacement of parsed.replacements) {
          if (!appliedSet.has(replacement.path)) {
            continue; // the runner rejected this write; replay follows the recorded decision
          }

          const absolute = join(scratch, replacement.path);
          await mkdir(dirname(absolute), { recursive: true });
          await writeFile(absolute, replacement.content);
        }
      }

      // The archive seam: recompute the harness-run archive step with the real pinned CLI.
      if (task.archive.attempted && task.archive.archive_ok && task.archive.change_name !== null) {
        const record = await runE4OpenSpecArchiveStep({
          repoRoot: input.repoRoot,
          workspacePath: scratch,
          changeName: task.archive.change_name
        });

        if (!record.archive_ok) {
          mismatches.push(`task ${task.task_index}: archive replay failed (${record.failure_reason ?? "unknown"})`);
        } else {
          const merged = await readOpenSpecSpecOfRecord(scratch);

          for (const [capability, markdown] of Object.entries(merged)) {
            await writeFile(join(scratch, "openspec", "specs", capability, "spec.feature"), openSpecToFeature(markdown, capability));
          }
        }
      }

      const { hash } = await hashDirectory(scratch);
      const ok = hash === task.snapshot.hash;

      if (!ok) {
        mismatches.push(`task ${task.task_index}: replay hash ${hash} != recorded snapshot ${task.snapshot.hash}`);
      }

      perTaskOk.push(ok);
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  }

  return {
    substrate_regeneration_ok: substrateOk,
    per_task_replay_ok: perTaskOk,
    chain_replay_valid: substrateOk && perTaskOk.length === manifest.tasks.length && perTaskOk.every(Boolean),
    mismatches
  };
}
