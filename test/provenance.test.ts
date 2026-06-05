import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadReplayPlan,
  validateCheckpointManifest,
  validateReplayPlan,
  validateRunManifest,
  verifyCheckpointArtifacts,
  verifyRunArtifacts
} from "../src/provenance";
import { renderResultSummary } from "../src/result-summary";
import { runPilot } from "../src/runner";
import { hashFile } from "../src/snapshot";
import { createFakeAgent } from "./support/fake-agent";
import { createSampleTask } from "./support/sample-task";

const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("run provenance and tamper detection", () => {
  test("checkpoint manifests verify the rendered prompt packet and feedback assets", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));

    const result = await runPilot({
      task,
      run_id: "run-provenance-001",
      runs_root: join(root, "runs"),
      agent: createFakeAgent()
    });

    const checkpoint = result.condition_results.feedback_capable_spec.checkpoints[1];
    const verification = await verifyCheckpointArtifacts({
      artifact_dir: checkpoint.artifact_dir,
      workspace_path: checkpoint.workspace_path
    });

    expect(verification.ok).toBe(true);
    expect(verification.mismatches).toEqual([]);

    const manifest = JSON.parse(await readFile(join(checkpoint.artifact_dir, "manifest.json"), "utf8"));

    expect(manifest.prompt_packet_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.expected_feedback_asset_hashes).toEqual(checkpoint.expected_feedback_asset_hashes);
    expect(manifest.expected_feedback_asset_hashes["spec/cart-total-visible.spec.ts"]).toMatch(/^[a-f0-9]{64}$/);
    expect(validateCheckpointManifest(manifest).ok).toBe(true);
  });

  test("verification reports prompt packet tampering", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));

    const result = await runPilot({
      task,
      run_id: "run-provenance-002",
      runs_root: join(root, "runs"),
      agent: createFakeAgent()
    });

    const checkpoint = result.condition_results.context_only_spec.checkpoints[0];
    await writeFile(join(checkpoint.artifact_dir, "prompt-packet.json"), "{}\n");

    const verification = await verifyCheckpointArtifacts({
      artifact_dir: checkpoint.artifact_dir,
      workspace_path: checkpoint.workspace_path
    });

    expect(verification.ok).toBe(false);
    expect(verification.mismatches.some((mismatch) => mismatch.path === "prompt-packet.json")).toBe(true);
  });

  test("verification reports feedback asset tampering", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));

    const result = await runPilot({
      task,
      run_id: "run-provenance-003",
      runs_root: join(root, "runs"),
      agent: createFakeAgent()
    });

    const checkpoint = result.condition_results.feedback_capable_spec.checkpoints[1];
    await writeFile(join(checkpoint.workspace_path, "spec", "cart-total-visible.spec.ts"), "tampered\n");

    const verification = await verifyCheckpointArtifacts({
      artifact_dir: checkpoint.artifact_dir,
      workspace_path: checkpoint.workspace_path
    });

    expect(verification.ok).toBe(false);
    expect(
      verification.mismatches.some((mismatch) => mismatch.path === "spec/cart-total-visible.spec.ts")
    ).toBe(true);
  });

  test("loads ordered replay records for every condition checkpoint", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));

    const result = await runPilot({
      task,
      run_id: "run-provenance-004",
      runs_root: join(root, "runs"),
      agent: createFakeAgent()
    });

    const replayPlan = await loadReplayPlan(result.run_manifest_path);
    const runManifest = JSON.parse(await readFile(result.run_manifest_path, "utf8"));

    expect(replayPlan.run_id).toBe("run-provenance-004");
    expect(validateRunManifest(runManifest).ok).toBe(true);
    expect(replayPlan.steps.map((step) => `${step.condition_id}:${step.checkpoint_id}`)).toEqual([
      "context_only_spec:I01",
      "context_only_spec:I02",
      "feedback_capable_spec:I01",
      "feedback_capable_spec:I02"
    ]);
    expect(replayPlan.steps[0].prompt_packet_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(replayPlan.steps[0].agent_result_hash).toMatch(/^[a-f0-9]{64}$/);
    expect((await validateReplayPlan(result.run_manifest_path)).ok).toBe(true);
  });

  test("replay-plan validation rejects an invalid checkpoint manifest", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));

    const result = await runPilot({
      task,
      run_id: "run-provenance-replay-invalid",
      runs_root: join(root, "runs"),
      agent: createFakeAgent()
    });
    const checkpoint = result.condition_results.context_only_spec.checkpoints[0];
    const checkpointManifest = JSON.parse(await readFile(join(checkpoint.artifact_dir, "manifest.json"), "utf8"));

    checkpointManifest.checkpoint_id = "I99";
    await writeFile(join(checkpoint.artifact_dir, "manifest.json"), `${JSON.stringify(checkpointManifest, null, 2)}\n`);

    const validation = await validateReplayPlan(result.run_manifest_path);

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("Checkpoint manifest mismatch for context_only_spec/I01");
  });

  test("replay-plan validation rejects checkpoint manifest hash drift from run manifest", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));

    const result = await runPilot({
      task,
      run_id: "run-provenance-replay-hash-drift",
      runs_root: join(root, "runs"),
      agent: createFakeAgent()
    });
    const checkpoint = result.condition_results.context_only_spec.checkpoints[0];
    const checkpointManifestPath = join(checkpoint.artifact_dir, "manifest.json");
    const checkpointManifest = JSON.parse(await readFile(checkpointManifestPath, "utf8"));

    checkpointManifest.prompt_packet_hash = "f".repeat(64);
    await writeFile(checkpointManifestPath, `${JSON.stringify(checkpointManifest, null, 2)}\n`);

    const validation = await validateReplayPlan(result.run_manifest_path);
    const fixture = await readFile("test/fixtures/replay-checkpoint-hash-drift-error.txt", "utf8");

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain(fixture.trim());
  });

  test("replay-plan validation rejects checkpoint manifest agent status drift from run manifest", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));

    const result = await runPilot({
      task,
      run_id: "run-provenance-replay-agent-status-drift",
      runs_root: join(root, "runs"),
      agent: createFakeAgent()
    });
    const checkpoint = result.condition_results.context_only_spec.checkpoints[0];
    const checkpointManifestPath = join(checkpoint.artifact_dir, "manifest.json");
    const checkpointManifest = JSON.parse(await readFile(checkpointManifestPath, "utf8"));

    checkpointManifest.agent_status = "failed";
    await writeFile(checkpointManifestPath, `${JSON.stringify(checkpointManifest, null, 2)}\n`);

    const validation = await validateReplayPlan(result.run_manifest_path);
    const fixture = await readFile("test/fixtures/replay-agent-status-drift-error.txt", "utf8");

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain(fixture.trim());
  });

  test("schema validation rejects malformed run and checkpoint manifests", () => {
    expect(validateRunManifest({ protocol_version: "wrong" }).ok).toBe(false);
    expect(
      validateCheckpointManifest({
        protocol_version: "two-arm-feedback-spec-v0",
        renderer_version: "semantic-spec-renderer-v0",
        condition_id: "plain_agent",
        checkpoint_id: "I01"
      }).ok
    ).toBe(false);
  });

  test("checkpoint manifest validation requires agent status and snapshot file declarations", () => {
    const validation = validateCheckpointManifest({
      protocol_version: "two-arm-feedback-spec-v0",
      renderer_version: "semantic-spec-renderer-v0",
      condition_id: "context_only_spec",
      checkpoint_id: "I01",
      artifact_dir: "/tmp/run/context_only_spec/checkpoints/I01",
      workspace_path: "/tmp/run/context_only_spec/workspace",
      prompt_packet_hash: "a".repeat(64),
      agent_result_hash: "b".repeat(64),
      expected_feedback_asset_hashes: {},
      snapshot_before_hash: "c".repeat(64),
      snapshot_after_hash: "d".repeat(64),
      agent_status: "unknown"
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("agent_status must be ok or failed");
    expect(validation.errors).toContain("snapshot_before_path must be a non-empty string");
    expect(validation.errors).toContain("snapshot_after_path must be a non-empty string");
  });

  test("checkpoint manifest validation requires hidden oracle path when hash is present", () => {
    const validation = validateCheckpointManifest({
      protocol_version: "two-arm-feedback-spec-v0",
      renderer_version: "semantic-spec-renderer-v0",
      condition_id: "context_only_spec",
      checkpoint_id: "I01",
      artifact_dir: "/tmp/run/context_only_spec/checkpoints/I01",
      workspace_path: "/tmp/run/context_only_spec/workspace",
      prompt_packet_hash: "a".repeat(64),
      agent_result_hash: "b".repeat(64),
      expected_feedback_asset_hashes: {},
      snapshot_before_path: "/tmp/run/context_only_spec/checkpoints/I01/workspace-before.json",
      snapshot_after_path: "/tmp/run/context_only_spec/checkpoints/I01/workspace-after.json",
      snapshot_before_hash: "c".repeat(64),
      snapshot_after_hash: "d".repeat(64),
      hidden_oracle_result_hash: "e".repeat(64),
      agent_status: "ok"
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("hidden_oracle_result_path must be a non-empty string when hidden_oracle_result_hash is present");
  });

  test("checkpoint manifest validation requires hidden oracle hash when path is present", () => {
    const validation = validateCheckpointManifest({
      protocol_version: "two-arm-feedback-spec-v0",
      renderer_version: "semantic-spec-renderer-v0",
      condition_id: "context_only_spec",
      checkpoint_id: "I01",
      artifact_dir: "/tmp/run/context_only_spec/checkpoints/I01",
      workspace_path: "/tmp/run/context_only_spec/workspace",
      prompt_packet_hash: "a".repeat(64),
      agent_result_hash: "b".repeat(64),
      expected_feedback_asset_hashes: {},
      snapshot_before_path: "/tmp/run/context_only_spec/checkpoints/I01/workspace-before.json",
      snapshot_after_path: "/tmp/run/context_only_spec/checkpoints/I01/workspace-after.json",
      snapshot_before_hash: "c".repeat(64),
      snapshot_after_hash: "d".repeat(64),
      hidden_oracle_result_path: "/tmp/run/context_only_spec/checkpoints/I01/hidden-oracle-result.json",
      agent_status: "ok"
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("hidden_oracle_result_hash must be a sha256 hex hash when hidden_oracle_result_path is present");
  });

  test("checkpoint manifest validation requires declared snapshot paths under artifact dir", () => {
    const validation = validateCheckpointManifest({
      protocol_version: "two-arm-feedback-spec-v0",
      renderer_version: "semantic-spec-renderer-v0",
      condition_id: "context_only_spec",
      checkpoint_id: "I01",
      artifact_dir: "/tmp/run/context_only_spec/checkpoints/I01",
      workspace_path: "/tmp/run/context_only_spec/workspace",
      prompt_packet_hash: "a".repeat(64),
      agent_result_hash: "b".repeat(64),
      expected_feedback_asset_hashes: {},
      snapshot_before_path: "/tmp/run/context_only_spec/workspace-before.json",
      snapshot_after_path: "/tmp/run/context_only_spec/workspace-after.json",
      snapshot_before_hash: "c".repeat(64),
      snapshot_after_hash: "d".repeat(64),
      agent_status: "ok"
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("snapshot_before_path must be under artifact_dir");
    expect(validation.errors).toContain("snapshot_after_path must be under artifact_dir");
  });

  test("checkpoint manifest path-containment fixture documents schema-error output", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));

    const result = await runPilot({
      task,
      run_id: "run-provenance-path-containment-fixture",
      runs_root: join(root, "runs"),
      agent: createFakeAgent()
    });
    const checkpoint = result.condition_results.context_only_spec.checkpoints[0];
    const checkpointManifestPath = join(checkpoint.artifact_dir, "manifest.json");
    const checkpointManifest = JSON.parse(await readFile(checkpointManifestPath, "utf8"));

    checkpointManifest.snapshot_before_path = join(root, "workspace-before.json");
    await writeFile(checkpointManifestPath, `${JSON.stringify(checkpointManifest, null, 2)}\n`);

    const verification = await verifyRunArtifacts(result.run_manifest_path);
    const fixture = await readFile("test/fixtures/checkpoint-path-containment-schema-error.txt", "utf8");

    expect(verification.ok).toBe(false);
    expect(
      verification.mismatches.some(
        (mismatch) =>
          `${mismatch.path}:${mismatch.expected}:${mismatch.actual}:${mismatch.reason}` === fixture.trim()
      )
    ).toBe(true);
  });

  test("checkpoint manifest validation requires hidden oracle result path under artifact dir", () => {
    const validation = validateCheckpointManifest({
      protocol_version: "two-arm-feedback-spec-v0",
      renderer_version: "semantic-spec-renderer-v0",
      condition_id: "context_only_spec",
      checkpoint_id: "I01",
      artifact_dir: "/tmp/run/context_only_spec/checkpoints/I01",
      workspace_path: "/tmp/run/context_only_spec/workspace",
      prompt_packet_hash: "a".repeat(64),
      agent_result_hash: "b".repeat(64),
      expected_feedback_asset_hashes: {},
      snapshot_before_path: "/tmp/run/context_only_spec/checkpoints/I01/workspace-before.json",
      snapshot_after_path: "/tmp/run/context_only_spec/checkpoints/I01/workspace-after.json",
      snapshot_before_hash: "c".repeat(64),
      snapshot_after_hash: "d".repeat(64),
      hidden_oracle_result_path: "/tmp/run/context_only_spec/hidden-oracle-result.json",
      hidden_oracle_result_hash: "e".repeat(64),
      agent_status: "ok"
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("hidden_oracle_result_path must be under artifact_dir");
  });

  test("checkpoint manifest validation requires distinct snapshot paths", () => {
    const snapshotPath = "/tmp/run/context_only_spec/checkpoints/I01/workspace-snapshot.json";
    const validation = validateCheckpointManifest({
      protocol_version: "two-arm-feedback-spec-v0",
      renderer_version: "semantic-spec-renderer-v0",
      condition_id: "context_only_spec",
      checkpoint_id: "I01",
      artifact_dir: "/tmp/run/context_only_spec/checkpoints/I01",
      workspace_path: "/tmp/run/context_only_spec/workspace",
      prompt_packet_hash: "a".repeat(64),
      agent_result_hash: "b".repeat(64),
      expected_feedback_asset_hashes: {},
      snapshot_before_path: snapshotPath,
      snapshot_after_path: snapshotPath,
      snapshot_before_hash: "c".repeat(64),
      snapshot_after_hash: "d".repeat(64),
      agent_status: "ok"
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("snapshot_before_path and snapshot_after_path must be distinct");
  });

  test("run manifest validation requires result and summary declarations together", () => {
    const validation = validateRunManifest({
      protocol_version: "two-arm-feedback-spec-v0",
      renderer_version: "semantic-spec-renderer-v0",
      run_id: "run-missing-summary",
      task_id: "sample-cart",
      conditions: ["context_only_spec", "feedback_capable_spec"],
      checkpoints: ["I01"],
      result_record_path: "/tmp/run/result.json",
      result_record_hash: "a".repeat(64),
      condition_results: {
        context_only_spec: {
          workspace_path: "/tmp/run/context_only_spec/workspace",
          checkpoints: []
        },
        feedback_capable_spec: {
          workspace_path: "/tmp/run/feedback_capable_spec/workspace",
          checkpoints: []
        }
      }
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("result_record_path, result_record_hash, result_summary_path, and result_summary_hash must be declared together");
  });

  test("run manifest validation requires condition checkpoint sequence to match top-level checkpoints", () => {
    const validation = validateRunManifest({
      protocol_version: "two-arm-feedback-spec-v0",
      renderer_version: "semantic-spec-renderer-v0",
      run_id: "run-sequence-mismatch",
      task_id: "sample-cart",
      conditions: ["context_only_spec", "feedback_capable_spec"],
      checkpoints: ["I01", "I02"],
      condition_results: {
        context_only_spec: {
          workspace_path: "/tmp/run/context_only_spec/workspace",
          checkpoints: [
            validRunManifestCheckpoint("I02", "/tmp/run/context_only_spec/checkpoints/I02"),
            validRunManifestCheckpoint("I01", "/tmp/run/context_only_spec/checkpoints/I01")
          ]
        },
        feedback_capable_spec: {
          workspace_path: "/tmp/run/feedback_capable_spec/workspace",
          checkpoints: [
            validRunManifestCheckpoint("I01", "/tmp/run/feedback_capable_spec/checkpoints/I01"),
            validRunManifestCheckpoint("I02", "/tmp/run/feedback_capable_spec/checkpoints/I02")
          ]
        }
      }
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("Run manifest checkpoint sequence mismatch for context_only_spec");
  });

  test("run manifest validation rejects extra condition result blocks", () => {
    const validation = validateRunManifest({
      protocol_version: "two-arm-feedback-spec-v0",
      renderer_version: "semantic-spec-renderer-v0",
      run_id: "run-extra-condition-result",
      task_id: "sample-cart",
      conditions: ["context_only_spec", "feedback_capable_spec"],
      checkpoints: ["I01"],
      condition_results: {
        context_only_spec: {
          workspace_path: "/tmp/run/context_only_spec/workspace",
          checkpoints: [validRunManifestCheckpoint("I01", "/tmp/run/context_only_spec/checkpoints/I01")]
        },
        feedback_capable_spec: {
          workspace_path: "/tmp/run/feedback_capable_spec/workspace",
          checkpoints: [validRunManifestCheckpoint("I01", "/tmp/run/feedback_capable_spec/checkpoints/I01")]
        },
        plain_agent: {
          workspace_path: "/tmp/run/plain_agent/workspace",
          checkpoints: [validRunManifestCheckpoint("I01", "/tmp/run/plain_agent/checkpoints/I01")]
        }
      }
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("condition_results includes unsupported condition plain_agent");
  });

  test("run manifest validation checks result and summary declaration field shapes", () => {
    const validation = validateRunManifest({
      protocol_version: "two-arm-feedback-spec-v0",
      renderer_version: "semantic-spec-renderer-v0",
      run_id: "run-malformed-result-summary-declarations",
      task_id: "sample-cart",
      conditions: ["context_only_spec", "feedback_capable_spec"],
      checkpoints: ["I01"],
      result_record_path: "",
      result_record_hash: "not-a-hash",
      result_summary_path: 42,
      result_summary_hash: "b".repeat(63),
      condition_results: {
        context_only_spec: {
          workspace_path: "/tmp/run/context_only_spec/workspace",
          checkpoints: []
        },
        feedback_capable_spec: {
          workspace_path: "/tmp/run/feedback_capable_spec/workspace",
          checkpoints: []
        }
      }
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("result_record_path must be a non-empty string");
    expect(validation.errors).toContain("result_record_hash must be a sha256 hex hash");
    expect(validation.errors).toContain("result_summary_path must be a non-empty string");
    expect(validation.errors).toContain("result_summary_hash must be a sha256 hex hash");
  });

  test("run manifest validation fixture documents one-sided result summary declarations", async () => {
    const validation = validateRunManifest({
      protocol_version: "two-arm-feedback-spec-v0",
      renderer_version: "semantic-spec-renderer-v0",
      run_id: "run-one-sided-result-summary",
      task_id: "sample-cart",
      conditions: ["context_only_spec", "feedback_capable_spec"],
      checkpoints: ["I01"],
      result_summary_path: "/tmp/run/summary.md",
      result_summary_hash: "b".repeat(64),
      condition_results: {
        context_only_spec: {
          workspace_path: "/tmp/run/context_only_spec/workspace",
          checkpoints: []
        },
        feedback_capable_spec: {
          workspace_path: "/tmp/run/feedback_capable_spec/workspace",
          checkpoints: []
        }
      }
    });
    const fixture = await readFile("test/fixtures/one-sided-result-summary-declaration-error.txt", "utf8");

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain(fixture.trim());
  });

  test("run manifest validation rejects malformed checkpoint entries before replay", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));

    const result = await runPilot({
      task,
      run_id: "run-provenance-malformed-checkpoint",
      runs_root: join(root, "runs"),
      agent: createFakeAgent()
    });
    const manifest = JSON.parse(await readFile(result.run_manifest_path, "utf8"));
    const checkpoint = manifest.condition_results.context_only_spec.checkpoints[0];

    checkpoint.artifact_dir = "";
    checkpoint.prompt_packet_hash = "not-a-hash";
    checkpoint.expected_feedback_asset_hashes = [];

    const validation = validateRunManifest(manifest);

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain(
      "condition_results.context_only_spec.checkpoints[0].artifact_dir must be a non-empty string"
    );
    expect(validation.errors).toContain(
      "condition_results.context_only_spec.checkpoints[0].prompt_packet_hash must be a sha256 hex hash"
    );
    expect(validation.errors).toContain(
      "condition_results.context_only_spec.checkpoints[0].expected_feedback_asset_hashes must be an object"
    );
  });

  test("run manifest validation rejects duplicate checkpoint entries per condition", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));

    const result = await runPilot({
      task,
      run_id: "run-provenance-duplicate-checkpoint",
      runs_root: join(root, "runs"),
      agent: createFakeAgent()
    });
    const manifest = JSON.parse(await readFile(result.run_manifest_path, "utf8"));

    manifest.condition_results.context_only_spec.checkpoints = [
      manifest.condition_results.context_only_spec.checkpoints[0],
      manifest.condition_results.context_only_spec.checkpoints[0]
    ];

    const validation = validateRunManifest(manifest);

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("Duplicate checkpoint entry context_only_spec/I01");
  });

  test("run artifact verification reports result record tampering", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));
    task.hidden_oracle_path = join(root, "hidden-oracle");
    await mkdir(task.hidden_oracle_path, { recursive: true });
    await writeFile(join(task.hidden_oracle_path, "oracle-note.txt"), "private\n");

    const result = await runPilot({
      task,
      run_id: "run-provenance-005",
      runs_root: join(root, "runs"),
      agent: createFakeAgent(),
      hidden_oracle: {
        async run(input) {
          return {
            status: "ok",
            checks: [
              {
                check_id: `${input.checkpoint_id}-cart-total-visible`,
                commitment_id: "cart-total-visible",
                passed: true
              }
            ]
          };
        }
      }
    });

    expect((await verifyRunArtifacts(result.run_manifest_path)).ok).toBe(true);

    await writeFile(result.result_record_path!, "{}\n");

    const verification = await verifyRunArtifacts(result.run_manifest_path);

    expect(verification.ok).toBe(false);
    expect(verification.mismatches.some((mismatch) => mismatch.path === "result.json")).toBe(true);
  });

  test("run artifact verification validates result records against result-schema-v1", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));
    task.hidden_oracle_path = join(root, "hidden-oracle");
    await mkdir(task.hidden_oracle_path, { recursive: true });
    await writeFile(join(task.hidden_oracle_path, "oracle-note.txt"), "private\n");

    const result = await runPilot({
      task,
      run_id: "run-provenance-invalid-result-schema",
      runs_root: join(root, "runs"),
      agent: createFakeAgent(),
      hidden_oracle: {
        async run(input) {
          return {
            status: "ok",
            checks: [
              {
                check_id: `${input.checkpoint_id}-cart-total-visible`,
                commitment_id: "cart-total-visible",
                passed: true
              }
            ]
          };
        }
      }
    });
    const manifest = JSON.parse(await readFile(result.run_manifest_path, "utf8"));
    const resultRecord = JSON.parse(await readFile(result.result_record_path!, "utf8"));

    resultRecord.evaluations.push({
      condition_id: "context_only_spec",
      checkpoint_id: "I99",
      checks: [
        {
          check_id: "I99-ghost-commitment",
          commitment_id: "ghost-commitment",
          passed: true
        }
      ]
    });
    await writeFile(result.result_record_path!, `${JSON.stringify(resultRecord, null, 2)}\n`);
    await writeFile(result.result_summary_path!, renderResultSummary(resultRecord));
    manifest.result_record_hash = await hashFile(result.result_record_path!);
    manifest.result_summary_hash = await hashFile(result.result_summary_path!);
    await writeFile(result.run_manifest_path, `${JSON.stringify(manifest, null, 2)}\n`);

    const verification = await verifyRunArtifacts(result.run_manifest_path);

    expect(verification.ok).toBe(false);
    expect(
      verification.mismatches.some(
        (mismatch) =>
          mismatch.path === "result.json" &&
          mismatch.expected === "valid result-schema-v1 record" &&
          mismatch.actual === "Unknown evaluation checkpoint I99 for context_only_spec" &&
          mismatch.reason === "schema_error"
      )
    ).toBe(true);
  });

  test("run artifact verification uses declared hidden oracle result paths", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));
    task.hidden_oracle_path = join(root, "hidden-oracle");
    await mkdir(task.hidden_oracle_path, { recursive: true });
    await writeFile(join(task.hidden_oracle_path, "oracle-note.txt"), "private\n");

    const result = await runPilot({
      task,
      run_id: "run-provenance-declared-hidden-oracle-path",
      runs_root: join(root, "runs"),
      agent: createFakeAgent(),
      hidden_oracle: {
        async run(input) {
          return {
            status: "ok",
            checks: [
              {
                check_id: `${input.checkpoint_id}-cart-total-visible`,
                commitment_id: "cart-total-visible",
                passed: true
              }
            ]
          };
        }
      }
    });
    const checkpoint = result.condition_results.context_only_spec.checkpoints[0];
    const checkpointManifestPath = join(checkpoint.artifact_dir, "manifest.json");
    const checkpointManifest = JSON.parse(await readFile(checkpointManifestPath, "utf8"));
    const defaultHiddenOraclePath = join(checkpoint.artifact_dir, "hidden-oracle-result.json");
    const declaredHiddenOraclePath = join(checkpoint.artifact_dir, "declared-hidden-oracle-result.json");

    await writeFile(declaredHiddenOraclePath, await readFile(defaultHiddenOraclePath, "utf8"));
    await rm(defaultHiddenOraclePath);
    checkpointManifest.hidden_oracle_result_path = declaredHiddenOraclePath;
    await writeFile(checkpointManifestPath, `${JSON.stringify(checkpointManifest, null, 2)}\n`);

    const verification = await verifyRunArtifacts(result.run_manifest_path);

    expect(verification.ok).toBe(true);
    expect(verification.mismatches).toEqual([]);
  });

  test("run artifact verification uses declared workspace snapshot paths", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));

    const result = await runPilot({
      task,
      run_id: "run-provenance-declared-snapshot-paths",
      runs_root: join(root, "runs"),
      agent: createFakeAgent()
    });
    const checkpoint = result.condition_results.context_only_spec.checkpoints[0];
    const checkpointManifestPath = join(checkpoint.artifact_dir, "manifest.json");
    const checkpointManifest = JSON.parse(await readFile(checkpointManifestPath, "utf8"));
    const defaultBeforePath = join(checkpoint.artifact_dir, "workspace-before.json");
    const defaultAfterPath = join(checkpoint.artifact_dir, "workspace-after.json");
    const declaredBeforePath = join(checkpoint.artifact_dir, "declared-workspace-before.json");
    const declaredAfterPath = join(checkpoint.artifact_dir, "declared-workspace-after.json");

    await writeFile(declaredBeforePath, await readFile(defaultBeforePath, "utf8"));
    await writeFile(declaredAfterPath, await readFile(defaultAfterPath, "utf8"));
    await rm(defaultBeforePath);
    await rm(defaultAfterPath);
    checkpointManifest.snapshot_before_path = declaredBeforePath;
    checkpointManifest.snapshot_after_path = declaredAfterPath;
    await writeFile(checkpointManifestPath, `${JSON.stringify(checkpointManifest, null, 2)}\n`);

    const verification = await verifyRunArtifacts(result.run_manifest_path);

    expect(verification.ok).toBe(true);
    expect(verification.mismatches).toEqual([]);
  });

  test("run artifact verification fixture documents missing declared hidden oracle result paths", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));
    task.hidden_oracle_path = join(root, "hidden-oracle");
    await mkdir(task.hidden_oracle_path, { recursive: true });
    await writeFile(join(task.hidden_oracle_path, "oracle-note.txt"), "private\n");

    const result = await runPilot({
      task,
      run_id: "run-provenance-missing-declared-hidden-oracle",
      runs_root: join(root, "runs"),
      agent: createFakeAgent(),
      hidden_oracle: {
        async run(input) {
          return {
            status: "ok",
            checks: [
              {
                check_id: `${input.checkpoint_id}-cart-total-visible`,
                commitment_id: "cart-total-visible",
                passed: true
              }
            ]
          };
        }
      }
    });
    const checkpoint = result.condition_results.context_only_spec.checkpoints[0];
    const checkpointManifestPath = join(checkpoint.artifact_dir, "manifest.json");
    const checkpointManifest = JSON.parse(await readFile(checkpointManifestPath, "utf8"));
    const defaultHiddenOraclePath = join(checkpoint.artifact_dir, "hidden-oracle-result.json");
    const missingHiddenOraclePath = join(checkpoint.artifact_dir, "missing-hidden-oracle-result.json");

    await rm(defaultHiddenOraclePath);
    checkpointManifest.hidden_oracle_result_path = missingHiddenOraclePath;
    await writeFile(checkpointManifestPath, `${JSON.stringify(checkpointManifest, null, 2)}\n`);

    const verification = await verifyRunArtifacts(result.run_manifest_path);
    const fixture = await readFile("test/fixtures/missing-declared-hidden-oracle-result-mismatch.txt", "utf8");

    expect(verification.ok).toBe(false);
    expect(
      verification.mismatches.some(
        (mismatch) => `${mismatch.path}:${mismatch.expected}:${mismatch.reason}` === fixture.trim()
      )
    ).toBe(true);
  });

  test("run artifact verification reports missing declared artifact paths", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));

    const result = await runPilot({
      task,
      run_id: "run-provenance-006",
      runs_root: join(root, "runs"),
      agent: createFakeAgent()
    });
    const manifest = JSON.parse(await readFile(result.run_manifest_path, "utf8"));
    manifest.condition_results.context_only_spec.workspace_path = join(root, "missing-workspace");
    await writeFile(result.run_manifest_path, `${JSON.stringify(manifest, null, 2)}\n`);

    const verification = await verifyRunArtifacts(result.run_manifest_path);

    expect(verification.ok).toBe(false);
    expect(
      verification.mismatches.some(
        (mismatch) => mismatch.path === "context_only_spec/workspace" && mismatch.reason === "missing"
      )
    ).toBe(true);
  });

  test("run artifact verification reports task package hash mismatches", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));
    task.package_provenance = {
      task_package_path: root,
      task_package_hash: "f".repeat(64),
      canonical_spec_hash: "e".repeat(64)
    };
    await writeFile(join(root, "canonical-spec.json"), JSON.stringify(task.canonical_spec, null, 2));
    await writeFile(
      join(root, "task.json"),
      JSON.stringify(
        {
          task_id: task.task_id,
          checkpoints: task.checkpoints,
          template_workspace: "template",
          canonical_spec: "canonical-spec.json",
          hidden_oracle_path: "hidden-oracle"
        },
        null,
        2
      )
    );

    const result = await runPilot({
      task,
      run_id: "run-provenance-007",
      runs_root: join(root, "runs"),
      agent: createFakeAgent()
    });

    const verification = await verifyRunArtifacts(result.run_manifest_path);

    expect(verification.ok).toBe(false);
    expect(
      verification.mismatches.some(
        (mismatch) => mismatch.path === "task_package" && mismatch.reason === "hash_mismatch"
      )
    ).toBe(true);
    expect(
      verification.mismatches.some(
        (mismatch) => mismatch.path === "canonical_spec" && mismatch.reason === "hash_mismatch"
      )
    ).toBe(true);
  });

  test("run artifact verification reports summaries that do not match result records", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));
    task.hidden_oracle_path = join(root, "hidden-oracle");
    await mkdir(task.hidden_oracle_path, { recursive: true });
    await writeFile(join(task.hidden_oracle_path, "oracle-note.txt"), "private\n");

    const result = await runPilot({
      task,
      run_id: "run-provenance-008",
      runs_root: join(root, "runs"),
      agent: createFakeAgent(),
      hidden_oracle: {
        async run(input) {
          return {
            status: "ok",
            checks: [
              {
                check_id: `${input.checkpoint_id}-cart-total-visible`,
                commitment_id: "cart-total-visible",
                passed: true
              }
            ]
          };
        }
      }
    });
    await writeFile(result.result_summary_path!, "# Tampered summary\n");

    const manifest = JSON.parse(await readFile(result.run_manifest_path, "utf8"));
    manifest.result_summary_hash = await hashFile(result.result_summary_path!);
    await writeFile(result.run_manifest_path, `${JSON.stringify(manifest, null, 2)}\n`);

    const verification = await verifyRunArtifacts(result.run_manifest_path);

    expect(verification.ok).toBe(false);
    expect(
      verification.mismatches.some(
        (mismatch) => mismatch.path === "summary.md" && mismatch.reason === "hash_mismatch"
      )
    ).toBe(true);
  });

  test("run artifact verification reports result metadata that diverges from run manifest", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));
    task.hidden_oracle_path = join(root, "hidden-oracle");
    await mkdir(task.hidden_oracle_path, { recursive: true });
    await writeFile(join(task.hidden_oracle_path, "oracle-note.txt"), "private\n");

    const result = await runPilot({
      task,
      run_id: "run-provenance-result-metadata",
      runs_root: join(root, "runs"),
      agent: createFakeAgent(),
      hidden_oracle: {
        async run(input) {
          return {
            status: "ok",
            checks: [
              {
                check_id: `${input.checkpoint_id}-cart-total-visible`,
                commitment_id: "cart-total-visible",
                passed: true
              }
            ]
          };
        }
      }
    });
    const manifest = JSON.parse(await readFile(result.run_manifest_path, "utf8"));
    const resultRecord = JSON.parse(await readFile(result.result_record_path!, "utf8"));

    resultRecord.run_id = "different-run-id";
    await writeFile(result.result_record_path!, `${JSON.stringify(resultRecord, null, 2)}\n`);
    await writeFile(result.result_summary_path!, renderResultSummary(resultRecord));
    manifest.result_record_hash = await hashFile(result.result_record_path!);
    manifest.result_summary_hash = await hashFile(result.result_summary_path!);
    await writeFile(result.run_manifest_path, `${JSON.stringify(manifest, null, 2)}\n`);

    const verification = await verifyRunArtifacts(result.run_manifest_path);
    const fixture = await readFile("test/fixtures/result-metadata-drift-mismatch.txt", "utf8");

    expect(verification.ok).toBe(false);
    expect(
      verification.mismatches.some(
        (mismatch) =>
          `${mismatch.path}:${mismatch.expected}:${mismatch.actual}` === fixture.trim()
      )
    ).toBe(true);
  });

  test("checkpoint artifact verification reports agent status metadata drift", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));

    const result = await runPilot({
      task,
      run_id: "run-provenance-agent-status",
      runs_root: join(root, "runs"),
      agent: createFakeAgent()
    });
    const checkpoint = result.condition_results.context_only_spec.checkpoints[0];
    const agentResultPath = join(checkpoint.artifact_dir, "agent-result.json");
    const checkpointManifestPath = join(checkpoint.artifact_dir, "manifest.json");
    const checkpointManifest = JSON.parse(await readFile(checkpointManifestPath, "utf8"));

    await writeFile(agentResultPath, `${JSON.stringify({ status: "failed" }, null, 2)}\n`);
    checkpointManifest.agent_result_hash = await hashFile(agentResultPath);
    await writeFile(checkpointManifestPath, `${JSON.stringify(checkpointManifest, null, 2)}\n`);

    const verification = await verifyCheckpointArtifacts({
      artifact_dir: checkpoint.artifact_dir,
      workspace_path: checkpoint.workspace_path
    });
    const fixture = await readFile("test/fixtures/agent-status-drift-mismatch.txt", "utf8");

    expect(verification.ok).toBe(false);
    expect(
      verification.mismatches.some(
        (mismatch) =>
          `${mismatch.path}:${mismatch.expected}:${mismatch.actual}` === fixture.trim()
      )
    ).toBe(true);
  });

  test("checkpoint artifact verification reports malformed agent-result metadata", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));

    const result = await runPilot({
      task,
      run_id: "run-provenance-agent-schema",
      runs_root: join(root, "runs"),
      agent: createFakeAgent()
    });
    const checkpoint = result.condition_results.context_only_spec.checkpoints[0];
    const agentResultPath = join(checkpoint.artifact_dir, "agent-result.json");
    const checkpointManifestPath = join(checkpoint.artifact_dir, "manifest.json");
    const checkpointManifest = JSON.parse(await readFile(checkpointManifestPath, "utf8"));

    await writeFile(
      agentResultPath,
      `${JSON.stringify(
        {
          status: "unknown",
          notes: 42,
          adapter_id: "",
          transcript: [{ detail: 42 }],
          model_turns: "3",
          feedback_runs: -1,
          feedback_available: "yes",
          feedback_command: 42,
          feedback_summaries: ["visible", 42],
          final_file_writes: ["src/file.ts", 42],
          feedback_assets_modified: "false"
        },
        null,
        2
      )}\n`
    );
    checkpointManifest.agent_result_hash = await hashFile(agentResultPath);
    await writeFile(checkpointManifestPath, `${JSON.stringify(checkpointManifest, null, 2)}\n`);

    const verification = await verifyCheckpointArtifacts({
      artifact_dir: checkpoint.artifact_dir,
      workspace_path: checkpoint.workspace_path
    });

    expect(verification.ok).toBe(false);
    expect(
      verification.mismatches.some(
        (mismatch) =>
          mismatch.path === "agent-result.json/status" &&
          mismatch.expected === "ok|failed" &&
          mismatch.actual === "unknown"
      )
    ).toBe(true);
    expect(
      verification.mismatches.some(
        (mismatch) =>
          mismatch.path === "agent-result.json/adapter_id" &&
          mismatch.expected === "non-empty string when provided"
      )
    ).toBe(true);
    expect(
      verification.mismatches.some(
        (mismatch) =>
          mismatch.path === "agent-result.json/notes" &&
          mismatch.expected === "string when provided" &&
          mismatch.actual === "42"
      )
    ).toBe(true);
    expect(
      verification.mismatches.some(
        (mismatch) =>
          mismatch.path === "agent-result.json/transcript[0].event" &&
          mismatch.expected === "non-empty string"
      )
    ).toBe(true);
    expect(
      verification.mismatches.some(
        (mismatch) =>
          mismatch.path === "agent-result.json/model_turns" &&
          mismatch.expected === "non-negative integer when provided"
      )
    ).toBe(true);
    expect(
      verification.mismatches.some(
        (mismatch) =>
          mismatch.path === "agent-result.json/feedback_summaries[1]" &&
          mismatch.expected === "string"
      )
    ).toBe(true);
    expect(
      verification.mismatches.some(
        (mismatch) =>
          mismatch.path === "agent-result.json/feedback_assets_modified" &&
          mismatch.expected === "boolean when provided"
      )
    ).toBe(true);
  });

  test("checkpoint artifact verification reports workspace snapshot hash drift", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));

    const result = await runPilot({
      task,
      run_id: "run-provenance-snapshot-drift",
      runs_root: join(root, "runs"),
      agent: createFakeAgent()
    });
    const checkpoint = result.condition_results.context_only_spec.checkpoints[0];
    const snapshotBeforePath = join(checkpoint.artifact_dir, "workspace-before.json");
    const snapshotBefore = JSON.parse(await readFile(snapshotBeforePath, "utf8"));

    snapshotBefore.hash = "0".repeat(64);
    await writeFile(snapshotBeforePath, `${JSON.stringify(snapshotBefore, null, 2)}\n`);

    const verification = await verifyCheckpointArtifacts({
      artifact_dir: checkpoint.artifact_dir,
      workspace_path: checkpoint.workspace_path
    });
    const fixture = await readFile("test/fixtures/workspace-snapshot-drift-mismatch.txt", "utf8");

    expect(verification.ok).toBe(false);
    expect(
      verification.mismatches.some(
        (mismatch) =>
          `${mismatch.path}:${mismatch.expected}:${mismatch.actual}` === fixture.trim()
      )
    ).toBe(true);
  });

  test("checkpoint artifact verification validates hidden oracle check fields", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));
    task.hidden_oracle_path = join(root, "hidden-oracle");
    await mkdir(task.hidden_oracle_path, { recursive: true });
    await writeFile(join(task.hidden_oracle_path, "oracle-note.txt"), "private\n");

    const result = await runPilot({
      task,
      run_id: "run-provenance-hidden-oracle-checks",
      runs_root: join(root, "runs"),
      agent: createFakeAgent(),
      hidden_oracle: {
        async run() {
          return {
            status: "ok",
            checks: [
              {
                check_id: "valid-check",
                commitment_id: "cart-total-visible",
                passed: true
              }
            ]
          };
        }
      }
    });
    const checkpoint = result.condition_results.context_only_spec.checkpoints[0];
    const hiddenOraclePath = join(checkpoint.artifact_dir, "hidden-oracle-result.json");
    const checkpointManifestPath = join(checkpoint.artifact_dir, "manifest.json");
    const checkpointManifest = JSON.parse(await readFile(checkpointManifestPath, "utf8"));

    await writeFile(
      hiddenOraclePath,
      `${JSON.stringify(
        {
          status: "ok",
          checks: [
            {
              check_id: "valid-check",
              commitment_id: "cart-total-visible",
              passed: true,
              details: 42
            }
          ]
        },
        null,
        2
      )}\n`
    );
    checkpointManifest.hidden_oracle_result_hash = await hashFile(hiddenOraclePath);
    await writeFile(checkpointManifestPath, `${JSON.stringify(checkpointManifest, null, 2)}\n`);

    const verification = await verifyCheckpointArtifacts({
      artifact_dir: checkpoint.artifact_dir,
      workspace_path: checkpoint.workspace_path
    });

    expect(verification.ok).toBe(false);
    expect(
      verification.mismatches.some(
        (mismatch) =>
          mismatch.path === "hidden-oracle-result.json/valid-check.details" &&
          mismatch.expected === "string when provided" &&
          mismatch.actual === "42"
      )
    ).toBe(true);
  });

  test("checkpoint artifact verification validates hidden oracle status and notes", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));
    task.hidden_oracle_path = join(root, "hidden-oracle");
    await mkdir(task.hidden_oracle_path, { recursive: true });
    await writeFile(join(task.hidden_oracle_path, "oracle-note.txt"), "private\n");

    const result = await runPilot({
      task,
      run_id: "run-provenance-hidden-oracle-metadata",
      runs_root: join(root, "runs"),
      agent: createFakeAgent(),
      hidden_oracle: {
        async run() {
          return {
            status: "ok",
            checks: [
              {
                check_id: "valid-check",
                commitment_id: "cart-total-visible",
                passed: true
              }
            ]
          };
        }
      }
    });
    const checkpoint = result.condition_results.context_only_spec.checkpoints[0];
    const hiddenOraclePath = join(checkpoint.artifact_dir, "hidden-oracle-result.json");
    const checkpointManifestPath = join(checkpoint.artifact_dir, "manifest.json");
    const checkpointManifest = JSON.parse(await readFile(checkpointManifestPath, "utf8"));

    await writeFile(
      hiddenOraclePath,
      `${JSON.stringify(
        {
          status: "unknown",
          notes: 42,
          checks: [
            {
              check_id: "valid-check",
              commitment_id: "cart-total-visible",
              passed: true
            }
          ]
        },
        null,
        2
      )}\n`
    );
    checkpointManifest.hidden_oracle_result_hash = await hashFile(hiddenOraclePath);
    await writeFile(checkpointManifestPath, `${JSON.stringify(checkpointManifest, null, 2)}\n`);

    const verification = await verifyCheckpointArtifacts({
      artifact_dir: checkpoint.artifact_dir,
      workspace_path: checkpoint.workspace_path
    });

    expect(verification.ok).toBe(false);
    expect(
      verification.mismatches.some(
        (mismatch) =>
          mismatch.path === "hidden-oracle-result.json/status" &&
          mismatch.expected === "ok|failed" &&
          mismatch.actual === "unknown"
      )
    ).toBe(true);
    expect(
      verification.mismatches.some(
        (mismatch) =>
          mismatch.path === "hidden-oracle-result.json/notes" &&
          mismatch.expected === "string when provided" &&
          mismatch.actual === "42"
      )
    ).toBe(true);
  });

  test("checkpoint artifact verification requires hidden oracle checks to be non-empty", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));
    task.hidden_oracle_path = join(root, "hidden-oracle");
    await mkdir(task.hidden_oracle_path, { recursive: true });
    await writeFile(join(task.hidden_oracle_path, "oracle-note.txt"), "private\n");

    const result = await runPilot({
      task,
      run_id: "run-provenance-hidden-oracle-empty-checks",
      runs_root: join(root, "runs"),
      agent: createFakeAgent(),
      hidden_oracle: {
        async run() {
          return {
            status: "ok",
            checks: [
              {
                check_id: "valid-check",
                commitment_id: "cart-total-visible",
                passed: true
              }
            ]
          };
        }
      }
    });
    const checkpoint = result.condition_results.context_only_spec.checkpoints[0];
    const hiddenOraclePath = join(checkpoint.artifact_dir, "hidden-oracle-result.json");
    const checkpointManifestPath = join(checkpoint.artifact_dir, "manifest.json");
    const checkpointManifest = JSON.parse(await readFile(checkpointManifestPath, "utf8"));

    await writeFile(hiddenOraclePath, `${JSON.stringify({ status: "ok", checks: [] }, null, 2)}\n`);
    checkpointManifest.hidden_oracle_result_hash = await hashFile(hiddenOraclePath);
    await writeFile(checkpointManifestPath, `${JSON.stringify(checkpointManifest, null, 2)}\n`);

    const verification = await verifyCheckpointArtifacts({
      artifact_dir: checkpoint.artifact_dir,
      workspace_path: checkpoint.workspace_path
    });

    expect(verification.ok).toBe(false);
    expect(
      verification.mismatches.some(
        (mismatch) =>
          mismatch.path === "hidden-oracle-result.json/checks" &&
          mismatch.expected === "non-empty array" &&
          mismatch.actual === "0" &&
          mismatch.reason === "schema_error"
      )
    ).toBe(true);
  });

  test("checkpoint artifact verification requires failed hidden oracle status when checks fail", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));
    task.hidden_oracle_path = join(root, "hidden-oracle");
    await mkdir(task.hidden_oracle_path, { recursive: true });
    await writeFile(join(task.hidden_oracle_path, "oracle-note.txt"), "private\n");

    const result = await runPilot({
      task,
      run_id: "run-provenance-hidden-oracle-failed-status",
      runs_root: join(root, "runs"),
      agent: createFakeAgent(),
      hidden_oracle: {
        async run() {
          return {
            status: "ok",
            checks: [
              {
                check_id: "valid-check",
                commitment_id: "cart-total-visible",
                passed: true
              }
            ]
          };
        }
      }
    });
    const checkpoint = result.condition_results.context_only_spec.checkpoints[0];
    const hiddenOraclePath = join(checkpoint.artifact_dir, "hidden-oracle-result.json");
    const checkpointManifestPath = join(checkpoint.artifact_dir, "manifest.json");
    const checkpointManifest = JSON.parse(await readFile(checkpointManifestPath, "utf8"));

    await writeFile(
      hiddenOraclePath,
      `${JSON.stringify(
        {
          status: "ok",
          checks: [
            {
              check_id: "failing-check",
              commitment_id: "cart-total-visible",
              passed: false
            }
          ]
        },
        null,
        2
      )}\n`
    );
    checkpointManifest.hidden_oracle_result_hash = await hashFile(hiddenOraclePath);
    await writeFile(checkpointManifestPath, `${JSON.stringify(checkpointManifest, null, 2)}\n`);

    const verification = await verifyCheckpointArtifacts({
      artifact_dir: checkpoint.artifact_dir,
      workspace_path: checkpoint.workspace_path
    });
    const fixture = await readFile("test/fixtures/hidden-oracle-failed-status-mismatch.txt", "utf8");

    expect(verification.ok).toBe(false);
    expect(
      verification.mismatches.some(
        (mismatch) =>
          `${mismatch.path}:${mismatch.expected}:${mismatch.actual}:${mismatch.reason}` === fixture.trim()
      )
    ).toBe(true);
  });

  test("run artifact verification reports invalid checkpoint manifests without cascading artifact reads", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));

    const result = await runPilot({
      task,
      run_id: "run-provenance-invalid-checkpoint-schema",
      runs_root: join(root, "runs"),
      agent: createFakeAgent()
    });
    const checkpoint = result.condition_results.context_only_spec.checkpoints[0];
    const checkpointManifestPath = join(checkpoint.artifact_dir, "manifest.json");
    const checkpointManifest = JSON.parse(await readFile(checkpointManifestPath, "utf8"));

    checkpointManifest.prompt_packet_hash = "not-a-hash";
    await writeFile(checkpointManifestPath, `${JSON.stringify(checkpointManifest, null, 2)}\n`);
    await writeFile(join(checkpoint.artifact_dir, "prompt-packet.json"), "{}\n");

    const verification = await verifyRunArtifacts(result.run_manifest_path);
    const fixture = await readFile("test/fixtures/invalid-checkpoint-manifest-schema-error.txt", "utf8");

    expect(verification.ok).toBe(false);
    expect(
      verification.mismatches.some(
        (mismatch) =>
          `${mismatch.path}:${mismatch.expected}:${mismatch.actual}:${mismatch.reason}` === fixture.trim()
      )
    ).toBe(true);
    expect(
      verification.mismatches.some(
        (mismatch) => mismatch.path === "prompt-packet.json"
      )
    ).toBe(false);
  });
});

async function setupTemplateWorkspace() {
  const root = await mkTempRoot();
  const template = join(root, "template");

  await mkdir(join(template, "src"), { recursive: true });
  await writeFile(join(template, "README.md"), "template workspace\n");
  await writeFile(join(template, "src", "cart.ts"), "export function cartTotal() { return 0; }\n");

  return root;
}

function validRunManifestCheckpoint(checkpointId: string, artifactDir: string) {
  return {
    checkpoint_id: checkpointId,
    artifact_dir: artifactDir,
    prompt_packet_hash: "a".repeat(64),
    agent_result_hash: "b".repeat(64),
    expected_feedback_asset_hashes: {},
    snapshot_before_hash: "c".repeat(64),
    snapshot_after_hash: "d".repeat(64),
    agent_status: "ok"
  };
}

async function mkTempRoot() {
  const root = join(tmpdir(), `hit-sdd-bench-provenance-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  await mkdir(root, { recursive: true });
  return root;
}
