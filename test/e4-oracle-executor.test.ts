// M3 acceptance — executor half (docs/e4/IMPLEMENTATION-PLAN.md §2 M3; ADR-006). Covers the ADR-006
// determinism criteria (fresh server per run, fixed order, canonicalized comparison, byte-stable
// verdicts) and the five named [R2: R2-5] executor-classification fixtures, with one reality pin:
// bun 1.3.x tolerates a malformed package.json (parse warning, boot continues), so the
// "broken package.json" presentation cannot produce a readiness failure on this runtime — the
// agent-caused config-breakage fixture is realized as a corrupted generated data file (seed.ts)
// instead, and the tolerance itself is pinned by a test so a runtime change resurfaces the
// original fixture.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { buildBaselineIr } from "../src/e4/substrate/ir";
import { buildE4WorkspaceFiles } from "../src/e4/substrate/scaffold";
import { generateCumulativeTests } from "../src/e4/substrate/testgen";
import {
  type E4ExecutorConfig,
  canonicalizeJson,
  runE4OracleExecutor
} from "../src/e4/oracle-executor";

const repoRoot = resolve(import.meta.dir, "..");
const scratchRoot = join(repoRoot, "tmp", "e4-oracle-executor-tests");
const createdDirs: string[] = [];

const CONFIG: E4ExecutorConfig = {
  readiness_timeout_ms: 10_000,
  request_timeout_ms: 5_000,
  readiness_poll_interval_ms: 25
};

// Small readiness window for fixtures whose whole point is never becoming ready.
const SHORT_READINESS_CONFIG: E4ExecutorConfig = { ...CONFIG, readiness_timeout_ms: 900 };

const baselineIr = buildBaselineIr();
const baselineWorkspace = buildE4WorkspaceFiles(baselineIr);
const cumulativeTests = generateCumulativeTests(baselineIr);

async function writeWorkspace(files: Record<string, string>): Promise<string> {
  await mkdir(scratchRoot, { recursive: true });
  const dir = await mkdtemp(join(scratchRoot, "ws-"));
  createdDirs.push(dir);

  for (const [relativePath, contents] of Object.entries(files)) {
    const absolute = join(dir, relativePath);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, contents);
  }

  return dir;
}

afterAll(async () => {
  await rm(scratchRoot, { recursive: true, force: true });
});

describe("E4 oracle executor — ADR-006 determinism", () => {
  test("the generated T0 app passes its own cumulative acceptance set end-to-end", async () => {
    const dir = await writeWorkspace(baselineWorkspace);
    const result = await runE4OracleExecutor({ workspace_dir: dir, tests: cumulativeTests, config: CONFIG });

    expect(result.kind).toBe("completed");

    if (result.kind === "completed") {
      const failing = result.verdicts.filter((verdict) => !verdict.passed);
      expect(failing).toEqual([]);
      expect(result.pass_count).toBe(result.total);
      expect(result.total).toBe(cumulativeTests.length);
    }
  });

  test("verdicts and transcript are byte-stable across runs on a fixed workspace (fresh server each run)", async () => {
    const dir = await writeWorkspace(baselineWorkspace);
    const first = await runE4OracleExecutor({ workspace_dir: dir, tests: cumulativeTests, config: CONFIG });
    const second = await runE4OracleExecutor({ workspace_dir: dir, tests: cumulativeTests, config: CONFIG });

    expect(first.kind).toBe("completed");
    expect(second.kind).toBe("completed");

    if (first.kind === "completed" && second.kind === "completed") {
      // Byte-stability is asserted on the comparison payloads (verdicts + transcript). Ports and
      // timing never appear in either (ADR-006); server stdout may carry the assigned port and is
      // an artifact, not a comparison payload.
      expect(JSON.stringify(first.verdicts)).toBe(JSON.stringify(second.verdicts));
      expect(JSON.stringify(first.transcript)).toBe(JSON.stringify(second.transcript));
    }
  });

  test("a behavior deviation is caught by canonicalized comparison, not string luck", async () => {
    // Flip the error envelope style in the workspace's schema.ts while the spec-derived tests
    // still expect the baseline style — a real behavior mismatch, detected canonically.
    const style = baselineWorkspace["schema.ts"].includes('"code_message"') ? "code_message" : "type_detail";
    const flipped = style === "code_message" ? "type_detail" : "code_message";
    const dir = await writeWorkspace({
      ...baselineWorkspace,
      "schema.ts": baselineWorkspace["schema.ts"].replace(`= ${JSON.stringify(style)}`, `= ${JSON.stringify(flipped)}`)
    });

    const result = await runE4OracleExecutor({ workspace_dir: dir, tests: cumulativeTests, config: CONFIG });

    expect(result.kind).toBe("completed");

    if (result.kind === "completed") {
      const failing = result.verdicts.filter((verdict) => !verdict.passed);
      expect(failing.length).toBeGreaterThan(0);
      expect(failing.every((verdict) => verdict.failures.some((failure) => failure.startsWith("body:")))).toBe(true);
    }
  });

  test("canonicalizeJson is key-order-insensitive and recursive", () => {
    expect(canonicalizeJson({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: 3 } })).toBe(
      canonicalizeJson({ a: { c: 3, d: [2, { y: 2, z: 1 }] }, b: 1 })
    );
    expect(canonicalizeJson([1, 2])).not.toBe(canonicalizeJson([2, 1]));
  });

  test("executor artifacts retain the full request/response transcript (injection 4)", async () => {
    const dir = await writeWorkspace(baselineWorkspace);
    const result = await runE4OracleExecutor({ workspace_dir: dir, tests: cumulativeTests.slice(0, 3), config: CONFIG });

    expect(result.kind).toBe("completed");

    if (result.kind === "completed") {
      expect(result.transcript.length).toBe(3);

      for (const entry of result.transcript) {
        expect(entry.request.method).toBeTruthy();
        expect(entry.request.path.startsWith("/")).toBe(true);
        expect(entry.request.path).not.toContain("127.0.0.1");
        expect(entry.outcome).toBe("response");
        expect(entry.response).not.toBeNull();
        expect(typeof entry.response?.body_raw).toBe("string");
      }
    }
  });
});

describe("E4 executor classification — [R2: R2-5] closed infra enumeration, agent-caused default", () => {
  test("fixture: server compile error ⇒ agent-caused readiness failure", async () => {
    const dir = await writeWorkspace({ ...baselineWorkspace, "server.ts": "const broken: = (\n" });
    const result = await runE4OracleExecutor({ workspace_dir: dir, tests: cumulativeTests, config: SHORT_READINESS_CONFIG });

    expect(result.kind).toBe("readiness_failed");

    if (result.kind === "readiness_failed") {
      expect(result.classification).toBe("agent_workspace");
      expect(result.reason).toContain("exited");
      expect(result.server_stderr.length).toBeGreaterThan(0);
    }
  });

  test("fixture: corrupted generated data file (config breakage) ⇒ agent-caused readiness failure", async () => {
    const dir = await writeWorkspace({ ...baselineWorkspace, "seed.ts": "{ this is not a module\n" });
    const result = await runE4OracleExecutor({ workspace_dir: dir, tests: cumulativeTests, config: SHORT_READINESS_CONFIG });

    expect(result.kind).toBe("readiness_failed");

    if (result.kind === "readiness_failed") {
      expect(result.classification).toBe("agent_workspace");
    }
  });

  test("reality pin: a malformed package.json alone does NOT block boot under bun (original fixture presentation)", async () => {
    // If a bun upgrade ever makes this fail, the original [R2: R2-5] broken-package.json fixture
    // becomes realizable again and this file should be updated to use it directly.
    const dir = await writeWorkspace({ ...baselineWorkspace, "package.json": '{ "name": ' });
    const result = await runE4OracleExecutor({ workspace_dir: dir, tests: cumulativeTests.slice(0, 1), config: CONFIG });

    expect(result.kind).toBe("completed");
  });

  test("fixture: infinite startup loop presents as a readiness timeout ⇒ MUST classify agent-caused", async () => {
    const dir = await writeWorkspace({ ...baselineWorkspace, "server.ts": "while (true) {}\n" });
    const result = await runE4OracleExecutor({ workspace_dir: dir, tests: cumulativeTests, config: SHORT_READINESS_CONFIG });

    expect(result.kind).toBe("readiness_failed");

    if (result.kind === "readiness_failed") {
      expect(result.classification).toBe("agent_workspace");
      expect(result.reason).toContain("readiness timeout");
    }
  });

  test("fixture: harness port-allocation/bind failure ⇒ infra executor_error with rationale", async () => {
    const dir = await writeWorkspace(baselineWorkspace);
    const result = await runE4OracleExecutor({
      workspace_dir: dir,
      tests: cumulativeTests,
      config: CONFIG,
      hooks: {
        allocate_port: () => {
          throw new Error("simulated bind failure");
        }
      }
    });

    expect(result.kind).toBe("executor_error");

    if (result.kind === "executor_error") {
      expect(result.classification_rationale).toContain("port-allocation/bind failure");
      expect(result.classification_rationale.length).toBeGreaterThan(0);
    }
  });

  test("fixture: executor internal crash ⇒ infra executor_error with rationale", async () => {
    const dir = await writeWorkspace(baselineWorkspace);
    const result = await runE4OracleExecutor({
      workspace_dir: dir,
      tests: cumulativeTests,
      config: CONFIG,
      hooks: {
        after_ready: () => {
          throw new Error("simulated executor fault");
        }
      }
    });

    expect(result.kind).toBe("executor_error");

    if (result.kind === "executor_error") {
      expect(result.classification_rationale).toContain("executor internal crash");
    }
  });

  test("spawn failure before agent code runs ⇒ infra executor_error (enumeration item 1)", async () => {
    const dir = await writeWorkspace(baselineWorkspace);
    const result = await runE4OracleExecutor({
      workspace_dir: dir,
      tests: cumulativeTests,
      config: CONFIG,
      hooks: { bun_binary: join(dir, "definitely-missing-binary") }
    });

    expect(result.kind).toBe("executor_error");

    if (result.kind === "executor_error") {
      expect(result.classification_rationale).toContain("spawn failure before agent code ran");
    }
  });

  test("readiness failures carry the server's stdout/stderr as retained artifacts", async () => {
    const dir = await writeWorkspace({
      ...baselineWorkspace,
      "server.ts": 'console.error("agent broke this on purpose");\nprocess.exit(7);\n'
    });
    const result = await runE4OracleExecutor({ workspace_dir: dir, tests: cumulativeTests, config: SHORT_READINESS_CONFIG });

    expect(result.kind).toBe("readiness_failed");

    if (result.kind === "readiness_failed") {
      expect(result.server_stderr).toContain("agent broke this on purpose");
      expect(result.reason).toContain("code 7");
    }
  });
});
