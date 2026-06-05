import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPilot, type HiddenOracleAdapter } from "../src/runner";
import { createFakeAgent } from "./support/fake-agent";
import { createSampleTask } from "./support/sample-task";

const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("hidden oracle execution boundary", () => {
  test("runs optional hidden oracle after the agent without exposing oracle paths to the workspace packet", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));
    task.hidden_oracle_path = join(root, "hidden-oracle");
    await mkdir(task.hidden_oracle_path, { recursive: true });
    await writeFile(join(task.hidden_oracle_path, "oracle-note.txt"), "private\n");

    const oracle = createFakeHiddenOracle();
    const result = await runPilot({
      task,
      run_id: "run-oracle-001",
      runs_root: join(root, "runs"),
      agent: createFakeAgent(),
      hidden_oracle: oracle
    });

    const checkpoint = result.condition_results.feedback_capable_spec.checkpoints[1];
    const hiddenOracleResult = JSON.parse(
      await readFile(join(checkpoint.artifact_dir, "hidden-oracle-result.json"), "utf8")
    );
    const resultRecord = JSON.parse(await readFile(result.result_record_path!, "utf8"));
    const runManifest = JSON.parse(await readFile(result.run_manifest_path, "utf8"));
    const manifest = JSON.parse(await readFile(join(checkpoint.artifact_dir, "manifest.json"), "utf8"));
    const lastPrompt = await readFile(join(checkpoint.workspace_path, "last-prompt.txt"), "utf8");

    expect(hiddenOracleResult.checks).toEqual([
      {
        check_id: "I02-feedback_capable_spec-agent-state",
        commitment_id: "cart-total-visible",
        passed: true
      }
    ]);
    expect(manifest.hidden_oracle_result_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(resultRecord.schema_version).toBe("result-schema-v1");
    expect(resultRecord.primary_metric.name).toBe("final_checkpoint_pass_rate");
    expect(resultRecord.primary_metric.by_condition.feedback_capable_spec.pass_rate).toBe(1);
    expect(runManifest.result_record_path).toBe(result.result_record_path);
    expect(runManifest.result_record_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(lastPrompt).not.toContain(task.hidden_oracle_path);
    expect(lastPrompt).not.toContain("hidden-oracle");
    expect(await fileMissing(join(checkpoint.workspace_path, "hidden-oracle-result.json"))).toBe(true);
  });

  test("rejects hidden oracle execution when the oracle path is inside the agent workspace", async () => {
    const root = await setupTemplateWorkspace();
    const task = createSampleTask(join(root, "template"));
    task.hidden_oracle_path = join(task.template_workspace, "hidden-oracle");

    await expect(
      runPilot({
        task,
        run_id: "run-oracle-002",
        runs_root: join(root, "runs"),
        agent: createFakeAgent(),
        hidden_oracle: createFakeHiddenOracle()
      })
    ).rejects.toThrow("hidden_oracle_path must be outside");
  });
});

function createFakeHiddenOracle(): HiddenOracleAdapter {
  return {
    async run(input) {
      const state = await readFile(join(input.workspace_path, "agent-state.txt"), "utf8");

      return {
        status: "ok",
        checks: [
          {
            check_id: `${input.checkpoint_id}-${input.condition_id}-agent-state`,
            commitment_id: "cart-total-visible",
            passed: state.includes(`${input.checkpoint_id} ${input.condition_id}`)
          }
        ]
      };
    }
  };
}

async function setupTemplateWorkspace() {
  const root = await mkTempRoot();
  const template = join(root, "template");

  await mkdir(join(template, "src"), { recursive: true });
  await writeFile(join(template, "README.md"), "template workspace\n");
  await writeFile(join(template, "src", "cart.ts"), "export function cartTotal() { return 0; }\n");

  return root;
}

async function mkTempRoot() {
  const root = join(tmpdir(), `hit-sdd-bench-oracle-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  await mkdir(root, { recursive: true });
  return root;
}

async function fileMissing(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return false;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return true;
    }

    throw error;
  }
}
