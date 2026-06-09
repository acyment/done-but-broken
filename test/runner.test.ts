import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPilot } from "../src/runner";
import { hashWorkspace } from "../src/snapshot";
import { createFakeAgent } from "./support/fake-agent";
import { createSampleTask } from "./support/sample-task";

const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("pilot runner skeleton", () => {
  test("each condition carries one workspace forward across checkpoints", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));

    const result = await runPilot({
      task,
      run_id: "run-001",
      runs_root: join(root, "runs"),
      agent: createFakeAgent()
    });

    const templateHash = await hashWorkspace(task.template_workspace);
    const context = result.condition_results.context_only_spec;
    const feedback = result.condition_results.feedback_capable_spec;

    expect(context.workspace_path).toBe(context.checkpoints[0].workspace_path);
    expect(context.workspace_path).toBe(context.checkpoints[1].workspace_path);
    expect(feedback.workspace_path).toBe(feedback.checkpoints[0].workspace_path);
    expect(feedback.workspace_path).toBe(feedback.checkpoints[1].workspace_path);
    expect(context.workspace_path).not.toBe(feedback.workspace_path);

    expect(context.checkpoints[0].snapshot_before.hash).toBe(templateHash.hash);
    expect(feedback.checkpoints[0].snapshot_before.hash).toBe(templateHash.hash);
    expect(context.checkpoints[1].snapshot_before.hash).toBe(context.checkpoints[0].snapshot_after.hash);
    expect(feedback.checkpoints[1].snapshot_before.hash).toBe(feedback.checkpoints[0].snapshot_after.hash);

    const contextLog = await readFile(join(context.workspace_path, "agent-state.txt"), "utf8");
    const feedbackLog = await readFile(join(feedback.workspace_path, "agent-state.txt"), "utf8");
    const feedbackMarker = await readFile(join(feedback.workspace_path, "feedback-simulated.txt"), "utf8");

    expect(contextLog).toContain("I01 context_only_spec");
    expect(contextLog).toContain("I02 context_only_spec");
    expect(contextLog).toContain("saw_previous=true");
    expect(feedbackLog).toContain("I01 feedback_capable_spec");
    expect(feedbackLog).toContain("I02 feedback_capable_spec");
    expect(feedbackLog).toContain("feedback_command=bun run spec");
    expect(feedbackMarker).toContain("spec/cart-total-visible.spec.ts");
    expect(feedbackMarker).toContain("spec/discount-total.spec.ts");
  });

  test("checkpoint artifacts are written under the required run layout", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));

    const result = await runPilot({
      task,
      run_id: "run-002",
      runs_root: join(root, "runs"),
      agent: createFakeAgent()
    });

    const checkpoint = result.condition_results.feedback_capable_spec.checkpoints[1];

    expect(checkpoint.artifact_dir).toBe(
      join(root, "runs", "run-002", "feedback_capable_spec", "checkpoints", "I02")
    );

    const packet = JSON.parse(await readFile(join(checkpoint.artifact_dir, "prompt-packet.json"), "utf8"));
    const manifest = JSON.parse(await readFile(join(checkpoint.artifact_dir, "manifest.json"), "utf8"));
    const before = JSON.parse(await readFile(join(checkpoint.artifact_dir, "workspace-before.json"), "utf8"));
    const after = JSON.parse(await readFile(join(checkpoint.artifact_dir, "workspace-after.json"), "utf8"));

    expect(packet.condition_id).toBe("feedback_capable_spec");
    expect(packet.feedback_command).toBe("bun run spec");
    expect(manifest.workspace_path).toBe(result.condition_results.feedback_capable_spec.workspace_path);
    expect(before.hash).toBe(checkpoint.snapshot_before.hash);
    expect(after.hash).toBe(checkpoint.snapshot_after.hash);
    expect(Number.isInteger(manifest.timing?.checkpoint_ms)).toBe(true);
    expect(Number.isInteger(manifest.timing?.agent_ms)).toBe(true);
    expect(manifest.timing.checkpoint_ms >= manifest.timing.agent_ms).toBe(true);
  });

  test("difficulty probes persist auditable source code after each checkpoint", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));

    const result = await runPilot({
      task,
      run_id: "run-difficulty-code-capture",
      runs_root: join(root, "runs"),
      agent: createFakeAgent(),
      run_classification: "difficulty_probe"
    });

    const checkpoint = result.condition_results.context_only_spec.checkpoints[0];
    const manifest = JSON.parse(await readFile(join(checkpoint.artifact_dir, "manifest.json"), "utf8"));
    const runManifest = JSON.parse(await readFile(result.run_manifest_path, "utf8"));
    const codeCapture = JSON.parse(
      await readFile(join(checkpoint.artifact_dir, "workspace-code-after.json"), "utf8")
    );

    expect(manifest.workspace_code_after_path).toBe(
      join(checkpoint.artifact_dir, "workspace-code-after.json")
    );
    expect(manifest.workspace_code_after_hash).toBe(codeCapture.hash);
    expect(checkpoint.workspace_code_after?.hash).toBe(codeCapture.hash);
    expect(codeCapture.files["src/cart.ts"].content).toContain("export function cartTotal()");
    expect(
      runManifest.condition_results.context_only_spec.checkpoints[0].workspace_code_after_hash
    ).toBe(codeCapture.hash);
  });

  test("can run independent condition pipelines concurrently while preserving checkpoint order", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));
    const events: Array<{
      condition_id: string;
      checkpoint_id: string;
      phase: "start" | "finish";
      time: number;
    }> = [];

    await runPilot({
      task,
      run_id: "run-parallel-conditions",
      runs_root: join(root, "runs"),
      budget: {
        condition_concurrency: 2
      },
      agent: {
        async run(input) {
          events.push({
            condition_id: input.condition_id,
            checkpoint_id: input.checkpoint_id,
            phase: "start",
            time: Date.now()
          });
          await delay(40);
          events.push({
            condition_id: input.condition_id,
            checkpoint_id: input.checkpoint_id,
            phase: "finish",
            time: Date.now()
          });

          return {
            status: "ok"
          };
        }
      }
    });

    const contextI01Start = eventTime(events, "context_only_spec", "I01", "start");
    const contextI01Finish = eventTime(events, "context_only_spec", "I01", "finish");
    const feedbackI01Start = eventTime(events, "feedback_capable_spec", "I01", "start");
    const contextI02Start = eventTime(events, "context_only_spec", "I02", "start");

    expect(feedbackI01Start).toBeLessThan(contextI01Finish);
    expect(contextI02Start).toBeGreaterThanOrEqual(contextI01Finish);
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

async function mkTempRoot() {
  const root = join(tmpdir(), `hit-sdd-bench-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  await mkdir(root, { recursive: true });
  return root;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function eventTime(
  events: Array<{ condition_id: string; checkpoint_id: string; phase: "start" | "finish"; time: number }>,
  conditionId: string,
  checkpointId: string,
  phase: "start" | "finish"
) {
  const event = events.find(
    (candidate) =>
      candidate.condition_id === conditionId &&
      candidate.checkpoint_id === checkpointId &&
      candidate.phase === phase
  );

  expect(event).toBeDefined();

  return event!.time;
}
