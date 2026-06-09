import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPayrollNetPayOracle } from "../src/payroll-net-pay-oracle";

const repoRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/test$/, "");
const referenceSourcePath = join(
  repoRoot,
  "tasks",
  "payroll-net-pay-lifecycle",
  "hidden-oracle",
  "reference",
  "payroll.ts"
);
const templateSourcePath = join(
  repoRoot,
  "tasks",
  "payroll-net-pay-lifecycle",
  "template-workspace",
  "src",
  "payroll.ts"
);
const hiddenOraclePath = join(repoRoot, "tasks", "payroll-net-pay-lifecycle", "hidden-oracle");
const checkpointIds = Array.from({ length: 18 }, (_, index) => `C${String(index + 1).padStart(2, "0")}`);
const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("payroll-net-pay hidden oracle", () => {
  test("passes the reference implementation at every checkpoint", async () => {
    const source = await readFile(referenceSourcePath, "utf8");
    const root = await setupWorkspace(source);
    const oracle = createPayrollNetPayOracle();

    for (const checkpoint_id of checkpointIds) {
      const result = await oracle.run({
        condition_id: "feedback_capable_spec",
        checkpoint_id,
        workspace_path: join(root, "workspace"),
        artifact_dir: join(root, "artifacts", checkpoint_id),
        hidden_oracle_path: hiddenOraclePath
      });

      expect(result.status).toBe("ok");
      expect(result.checks.length).toBeGreaterThanOrEqual(1);
      expect(result.checks.every((check) => check.passed)).toBe(true);
    }
  });

  test("partial-seed template passes C01-C02 and fails from C03", async () => {
    const source = await readFile(templateSourcePath, "utf8");
    const root = await setupWorkspace(source);
    const oracle = createPayrollNetPayOracle();

    for (const checkpoint_id of ["C01", "C02"]) {
      const result = await oracle.run({
        condition_id: "feedback_capable_spec",
        checkpoint_id,
        workspace_path: join(root, "workspace"),
        artifact_dir: join(root, "artifacts", checkpoint_id),
        hidden_oracle_path: hiddenOraclePath
      });

      expect(result.status).toBe("ok");
      expect(result.checks.every((check) => check.passed)).toBe(true);
    }

    const c03 = await oracle.run({
      condition_id: "feedback_capable_spec",
      checkpoint_id: "C03",
      workspace_path: join(root, "workspace"),
      artifact_dir: join(root, "artifacts", "C03"),
      hidden_oracle_path: hiddenOraclePath
    });

    expect(c03.status).toBe("failed");
    expect(failedCommitments(c03.checks)).toContain("federalish-bracketed-withholding");
  });

  test("fails a candidate that treats benefits as state-pre-tax", async () => {
    const reference = await readFile(referenceSourcePath, "utf8");
    const broken = reference.replace(
      "const taxableBaseState = Math.max(0, gross - ordinaryPreTax);",
      "const taxableBaseState = Math.max(0, gross - ordinaryPreTax - benefitTotal);"
    );
    expect(broken).not.toBe(reference);

    const root = await setupWorkspace(broken);
    const result = await createPayrollNetPayOracle().run({
      condition_id: "context_only_spec",
      checkpoint_id: "C11",
      workspace_path: join(root, "workspace"),
      artifact_dir: join(root, "artifacts", "C11"),
      hidden_oracle_path: hiddenOraclePath
    });

    expect(result.status).toBe("failed");
    expect(failedCommitments(result.checks)).toContain("benefit-pre-tax-federal-post-tax-state");
  });

  test("fails a candidate that ignores the socialish YTD wage-base cap", async () => {
    const reference = await readFile(referenceSourcePath, "utf8");
    const broken = reference.replace("return taxable * SOCIALISH_RATE;", "return gross * SOCIALISH_RATE;");
    expect(broken).not.toBe(reference);

    const root = await setupWorkspace(broken);
    const result = await createPayrollNetPayOracle().run({
      condition_id: "feedback_capable_spec",
      checkpoint_id: "C07",
      workspace_path: join(root, "workspace"),
      artifact_dir: join(root, "artifacts", "C07"),
      hidden_oracle_path: hiddenOraclePath
    });

    expect(result.status).toBe("failed");
    expect(failedCommitments(result.checks)).toContain("socialish-ytd-wage-base-cap");
  });

  test("fails a candidate that does not void the matching bonus", async () => {
    const reference = await readFile(referenceSourcePath, "utf8");
    const broken = reference.replace("    delete bonuses[event.bonusId];", "    // bonus void ignored");
    expect(broken).not.toBe(reference);

    const root = await setupWorkspace(broken);
    const result = await createPayrollNetPayOracle().run({
      condition_id: "feedback_capable_spec",
      checkpoint_id: "C18",
      workspace_path: join(root, "workspace"),
      artifact_dir: join(root, "artifacts", "C18"),
      hidden_oracle_path: hiddenOraclePath
    });

    expect(result.status).toBe("failed");
    expect(failedCommitments(result.checks)).toContain("event-idempotency-and-bonus-void");
  });
});

function failedCommitments(checks: Array<{ commitment_id: string; passed: boolean }>) {
  return checks.filter((check) => !check.passed).map((check) => check.commitment_id);
}

async function setupWorkspace(payrollSource: string) {
  const root = await mkTempRoot();

  await mkdir(join(root, "workspace", "src"), { recursive: true });
  await mkdir(join(root, "hidden-oracle"), { recursive: true });
  await mkdir(join(root, "artifacts"), { recursive: true });
  await writeFile(join(root, "workspace", "src", "payroll.ts"), payrollSource);
  await writeFile(join(root, "hidden-oracle", "oracle-cases.txt"), "private hidden cases\n");

  return root;
}

async function mkTempRoot() {
  const root = join(
    tmpdir(),
    `hit-sdd-bench-payroll-oracle-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );

  tempRoots.push(root);
  await mkdir(root, { recursive: true });

  return root;
}
