import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/test$/, "");
const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("fake pilot CLI", () => {
  test("fake pilot CLI prints help without requiring a run", () => {
    const process = Bun.spawnSync({
      cmd: ["bun", "run", "bin/run-fake-pilot.ts", "--help"],
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe"
    });

    expect(process.exitCode).toBe(0);
    expect(process.stdout.toString()).toContain("Usage: bun run pilot:fake");
    expect(process.stdout.toString()).toContain("--agent");
    expect(process.stdout.toString()).toContain("openrouter-loop");
    expect(process.stdout.toString()).toContain("--fake-agent-mode");
    expect(process.stdout.toString()).toContain("--openrouter-model");
    expect(process.stdout.toString()).toContain("--run-classification");
    expect(process.stdout.toString()).toContain("--request-timeout-ms");
    expect(process.stdout.toString()).toContain("--max-output-tokens");
    expect(process.stdout.toString()).toContain("--temperature");
    expect(process.stdout.toString()).toContain("--max-model-turns");
    expect(process.stdout.toString()).toContain("--max-feedback-runs");
  });

  test("inspect-run CLI prints help without requiring a manifest", () => {
    const process = Bun.spawnSync({
      cmd: ["bun", "run", "bin/inspect-run.ts", "--help"],
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe"
    });

    expect(process.exitCode).toBe(0);
    expect(process.stdout.toString()).toContain("Usage: bun run inspect:run");
    expect(process.stdout.toString()).toContain("--run-manifest");
  });

  test("loads a task package and writes replayable run artifacts", async () => {
    const root = await mkTempRoot();
    const runId = "cli-fake-001";
    const process = Bun.spawnSync({
      cmd: [
        "bun",
        "run",
        "bin/run-fake-pilot.ts",
        "--task",
        join(repoRoot, "tasks", "sample-cart"),
        "--runs-root",
        join(root, "runs"),
        "--run-id",
        runId
      ],
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe"
    });

    expect(process.exitCode).toBe(0);

    const stdout = process.stdout.toString();
    expect(stdout).toContain(`run_id=${runId}`);
    expect(stdout).toContain("result=");
    expect(stdout).toContain("summary=");
    expect(stdout).toContain("final_delta=0");

    const runManifest = JSON.parse(await readFile(join(root, "runs", runId, "run.json"), "utf8"));
    const resultRecord = JSON.parse(await readFile(join(root, "runs", runId, "result.json"), "utf8"));
    const resultSummary = await readFile(join(root, "runs", runId, "summary.md"), "utf8");

    expect(runManifest.task_id).toBe("sample-cart");
    expect(runManifest.checkpoints).toEqual(["I01", "I02", "I03"]);
    expect(runManifest.result_record_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(runManifest.result_summary_path).toBe(join(root, "runs", runId, "summary.md"));
    expect(runManifest.result_summary_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(resultRecord.primary_metric.by_condition.context_only_spec.pass_rate).toBe(1);
    expect(resultRecord.primary_metric.by_condition.feedback_capable_spec.pass_rate).toBe(1);
    expect(resultSummary).toContain("# Run summary: cli-fake-001");
    await expectDeclaredArtifactsExist(runManifest);
  });

  test("can inspect a completed run and print provenance paths", async () => {
    const root = await mkTempRoot();
    const runId = "cli-inspect-001";

    runFakePilot({ root, runId });

    const inspect = Bun.spawnSync({
      cmd: [
        "bun",
        "run",
        "bin/inspect-run.ts",
        "--run-manifest",
        join(root, "runs", runId, "run.json")
      ],
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe"
    });

    expect(inspect.exitCode).toBe(0);

    const stdout = inspect.stdout.toString();

    expect(stdout).toContain(`run_id=${runId}`);
    expect(stdout).toContain("valid=true");
    expect(stdout).toContain("summary=");
    expect(stdout).toContain("result=");
    expect(stdout).toContain("replay_steps=6");
    expect(stdout).toContain("mismatches=0");
    expect(stdout).toContain("run_classification=calibration");
    expect(stdout).toContain("clean_primary_evidence_eligible=false");
    expect(stdout).toContain("validity_flags=none");
    expect(stdout).toContain("provider_profile_id=fake-agent-v1");
    expect(stdout).toContain("provider_timeout_phases=none");
    expect(stdout).toContain("provider_timeout_detail_count=0");
    expect(stdout).toContain("workspace_carried_forward_due_to_provider_failure_checkpoints=0");
    expect(stdout).toContain("feedback_opportunity_integrity=not_applicable");
  });

  test("inspect-run prints provider validity and feedback opportunity status", async () => {
    const root = await mkTempRoot();
    const runId = "cli-inspect-provider-status-001";

    runFakePilot({ root, runId });

    const runManifestPath = join(root, "runs", runId, "run.json");
    const runManifest = JSON.parse(await readFile(runManifestPath, "utf8"));
    const firstCheckpoint = runManifest.condition_results.context_only_spec.checkpoints[0];
    const checkpointManifestPath = join(firstCheckpoint.artifact_dir, "manifest.json");
    const checkpointManifest = JSON.parse(await readFile(checkpointManifestPath, "utf8"));

    runManifest.run_classification = "causal_pilot";
    runManifest.validity_flags = ["provider_timeout"];
    runManifest.clean_primary_evidence_eligible = false;
    runManifest.validity_details = [
      {
        flag: "provider_timeout",
        scope: "checkpoint",
        condition_id: "context_only_spec",
        checkpoint_id: firstCheckpoint.checkpoint_id,
        provider: "openrouter",
        message: "OpenRouter retry recovered after a timeout",
        retryable: true,
        provider_failure_phase: "retry_recovered_timeout",
        model_turn_number: 1,
        feedback_had_run: false,
        model_response_received: true,
        code_changed: true,
        workspace_carried_forward_due_to_provider_failure: false,
        retry_count: 1,
        elapsed_ms: 90_000
      }
    ];
    firstCheckpoint.workspace_carried_forward_due_to_provider_failure = true;
    checkpointManifest.workspace_carried_forward_due_to_provider_failure = true;

    await writeFile(runManifestPath, `${JSON.stringify(runManifest, null, 2)}\n`);
    await writeFile(checkpointManifestPath, `${JSON.stringify(checkpointManifest, null, 2)}\n`);

    const inspect = Bun.spawnSync({
      cmd: [
        "bun",
        "run",
        "bin/inspect-run.ts",
        "--run-manifest",
        runManifestPath
      ],
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe"
    });
    const stdout = inspect.stdout.toString();

    expect(inspect.exitCode).toBe(1);
    expect(stdout).toContain("run_classification=causal_pilot");
    expect(stdout).toContain("clean_primary_evidence_eligible=false");
    expect(stdout).toContain("validity_flags=provider_timeout");
    expect(stdout).toContain("provider_timeout_phases=retry_recovered_timeout");
    expect(stdout).toContain("provider_timeout_detail_count=1");
    expect(stdout).toContain("workspace_carried_forward_due_to_provider_failure_checkpoints=1");
    expect(stdout).toContain("feedback_opportunity_integrity=incomplete");
  });

  test("inspect-run exits non-zero with actionable output for invalid runs", async () => {
    const root = await mkTempRoot();
    const runId = "cli-inspect-invalid-001";

    runFakePilot({ root, runId });

    const runManifestPath = join(root, "runs", runId, "run.json");
    const runManifest = JSON.parse(await readFile(runManifestPath, "utf8"));
    runManifest.condition_results.context_only_spec.workspace_path = join(root, "missing-workspace");
    await writeFile(runManifestPath, `${JSON.stringify(runManifest, null, 2)}\n`);

    const inspect = Bun.spawnSync({
      cmd: [
        "bun",
        "run",
        "bin/inspect-run.ts",
        "--run-manifest",
        runManifestPath
      ],
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe"
    });

    const stdout = inspect.stdout.toString();

    expect(inspect.exitCode).toBe(1);
    expect(stdout).toContain(`run_id=${runId}`);
    expect(stdout).toContain("valid=false");
    expect(stdout).toContain("mismatch=context_only_spec/workspace:missing");
    expect(stdout).toContain("error=Checkpoint manifest mismatch for context_only_spec/I01");
  });

  test("inspect-run exits non-zero with schema errors for malformed run manifests", async () => {
    const root = await mkTempRoot();
    const runManifestPath = join(root, "runs", "malformed", "run.json");
    await mkdir(dirname(runManifestPath), { recursive: true });
    await writeFile(runManifestPath, "{}\n");

    const inspect = Bun.spawnSync({
      cmd: [
        "bun",
        "run",
        "bin/inspect-run.ts",
        "--run-manifest",
        runManifestPath
      ],
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe"
    });

    const stdout = inspect.stdout.toString();
    const fixture = await readFile(join(repoRoot, "test", "fixtures", "malformed-inspect-output.txt"), "utf8");

    expect(inspect.exitCode).toBe(1);
    for (const expectedLine of fixture.trim().split("\n")) {
      expect(stdout).toContain(expectedLine);
    }

    expect(inspect.stderr.toString()).not.toContain("is not iterable");
  });

  test("supports a failing fake-agent mode that produces a non-perfect summary", async () => {
    const root = await mkTempRoot();
    const runId = "cli-failing-001";

    const process = runFakePilot({
      root,
      runId,
      extraArgs: ["--fake-agent-mode", "context-i03-item-name-drift"]
    });

    expect(process.exitCode).toBe(0);
    expect(process.stdout.toString()).toContain("final_delta=0.3333");

    const resultRecord = JSON.parse(await readFile(join(root, "runs", runId, "result.json"), "utf8"));
    const resultSummary = await readFile(join(root, "runs", runId, "summary.md"), "utf8");

    expect(resultRecord.primary_metric.by_condition.context_only_spec.final_checkpoint_passed).toBe(2);
    expect(resultRecord.primary_metric.by_condition.context_only_spec.final_checkpoint_total).toBe(3);
    expect(resultRecord.primary_metric.by_condition.feedback_capable_spec.pass_rate).toBe(1);
    expect(resultSummary).toContain("| context_only_spec | 2/3 | 0.6667 | 0 |");
  });

  test("records an explicit run classification from the CLI", async () => {
    const root = await mkTempRoot();
    const runId = "cli-difficulty-probe-001";

    const process = runFakePilot({
      root,
      runId,
      extraArgs: ["--run-classification", "difficulty_probe"]
    });

    expect(process.exitCode).toBe(0);

    const runManifest = JSON.parse(await readFile(join(root, "runs", runId, "run.json"), "utf8"));

    expect(runManifest.run_classification).toBe("difficulty_probe");
  });

  test("rejects openrouter agent runs without an API key", async () => {
    const root = await mkTempRoot();
    const runId = "cli-openrouter-missing-key-001";
    const process = Bun.spawnSync({
      cmd: [
        "bun",
        "run",
        "bin/run-fake-pilot.ts",
        "--task",
        join(repoRoot, "tasks", "sample-cart"),
        "--runs-root",
        join(root, "runs"),
        "--run-id",
        runId,
        "--agent",
        "openrouter"
      ],
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...Bun.env,
        OPENROUTER_API_KEY: ""
      }
    });

    expect(process.exitCode).toBe(1);
    expect(process.stderr.toString()).toContain("OPENROUTER_API_KEY");
  });

  test("rejects openrouter loop agent runs without an API key", async () => {
    const root = await mkTempRoot();
    const runId = "cli-openrouter-loop-missing-key-001";
    const process = Bun.spawnSync({
      cmd: [
        "bun",
        "run",
        "bin/run-fake-pilot.ts",
        "--task",
        join(repoRoot, "tasks", "role-permissions-calibration"),
        "--runs-root",
        join(root, "runs"),
        "--run-id",
        runId,
        "--agent",
        "openrouter-loop"
      ],
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...Bun.env,
        OPENROUTER_API_KEY: ""
      }
    });

    expect(process.exitCode).toBe(1);
    expect(process.stderr.toString()).toContain("OPENROUTER_API_KEY");
  });
});

function runFakePilot(input: { root: string; runId: string; extraArgs?: string[] }) {
  return Bun.spawnSync({
    cmd: [
      "bun",
      "run",
      "bin/run-fake-pilot.ts",
      "--task",
      join(repoRoot, "tasks", "sample-cart"),
      "--runs-root",
      join(input.root, "runs"),
      "--run-id",
      input.runId,
      ...(input.extraArgs ?? [])
    ],
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe"
  });
}

async function expectDeclaredArtifactsExist(runManifest: any) {
  expect(await pathExists(runManifest.result_record_path)).toBe(true);
  expect(await pathExists(runManifest.result_summary_path)).toBe(true);

  for (const conditionId of runManifest.conditions) {
    const condition = runManifest.condition_results[conditionId];

    expect(await pathExists(condition.workspace_path)).toBe(true);

    for (const checkpoint of condition.checkpoints) {
      expect(await pathExists(checkpoint.artifact_dir)).toBe(true);
      expect(await pathExists(join(checkpoint.artifact_dir, "manifest.json"))).toBe(true);
      expect(await pathExists(join(checkpoint.artifact_dir, "prompt-packet.json"))).toBe(true);
      expect(await pathExists(join(checkpoint.artifact_dir, "agent-result.json"))).toBe(true);
      expect(await pathExists(join(checkpoint.artifact_dir, "workspace-before.json"))).toBe(true);
      expect(await pathExists(join(checkpoint.artifact_dir, "workspace-after.json"))).toBe(true);

      if (checkpoint.hidden_oracle_result_hash) {
        expect(await pathExists(join(checkpoint.artifact_dir, "hidden-oracle-result.json"))).toBe(true);
      }

      for (const feedbackPath of Object.keys(checkpoint.expected_feedback_asset_hashes)) {
        expect(await pathExists(join(condition.workspace_path, feedbackPath))).toBe(true);
      }
    }
  }
}

async function pathExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function mkTempRoot() {
  const root = join(tmpdir(), `hit-sdd-bench-cli-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  await mkdir(root, { recursive: true });
  return root;
}
