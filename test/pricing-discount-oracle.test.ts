import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPricingDiscountOracle } from "../src/pricing-discount-oracle";

const repoRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/test$/, "");
const referenceSourcePath = join(
  repoRoot,
  "tasks",
  "pricing-discount-lifecycle",
  "hidden-oracle",
  "reference",
  "pricing.ts"
);
const templateSourcePath = join(
  repoRoot,
  "tasks",
  "pricing-discount-lifecycle",
  "template-workspace",
  "src",
  "pricing.ts"
);
// The oracle loads its sealed cases from this directory, so tests point at the real
// task package hidden-oracle path rather than a stand-in.
const hiddenOraclePath = join(repoRoot, "tasks", "pricing-discount-lifecycle", "hidden-oracle");
const checkpointIds = ["I01", "I02", "I03", "I04", "I05", "I06", "I07", "I08", "I09"];
const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("pricing-discount hidden oracle", () => {
  test("passes the reference implementation at every checkpoint", async () => {
    const source = await readFile(referenceSourcePath, "utf8");
    const root = await setupWorkspace(source);
    const oracle = createPricingDiscountOracle();

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

  test("partial-seed template passes I01-I02 and fails from I03", async () => {
    const source = await readFile(templateSourcePath, "utf8");
    const root = await setupWorkspace(source);
    const oracle = createPricingDiscountOracle();

    for (const checkpoint_id of ["I01", "I02"]) {
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

    const i03 = await oracle.run({
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I03",
      workspace_path: join(root, "workspace"),
      artifact_dir: join(root, "artifacts", "I03"),
      hidden_oracle_path: hiddenOraclePath
    });

    expect(i03.status).toBe("failed");
    expect(failedCommitments(i03.checks)).toContain("order-percent-coupon-on-post-line-subtotal");
  });

  test("fails a candidate that taxes the pre-discount base", async () => {
    const reference = await readFile(referenceSourcePath, "utf8");
    const broken = reference.replace(
      "const allocated = postDiscountTotal * (line.lineTotal / postLineSubtotal);",
      "const allocated = line.lineTotal;"
    );
    expect(broken).not.toBe(reference);

    const root = await setupWorkspace(broken);
    const result = await createPricingDiscountOracle().run({
      condition_id: "context_only_spec",
      checkpoint_id: "I08",
      workspace_path: join(root, "workspace"),
      artifact_dir: join(root, "artifacts", "I08"),
      hidden_oracle_path: hiddenOraclePath
    });

    expect(result.status).toBe("failed");
    expect(failedCommitments(result.checks)).toContain("tax-applies-to-post-discount-taxable-base");
  });

  test("fails a candidate that rounds each line total per stage", async () => {
    const reference = await readFile(referenceSourcePath, "utf8");
    const broken = reference.replace(
      "const lineTotal = netUnit * line.quantity;",
      "const lineTotal = Math.round((netUnit * line.quantity + Number.EPSILON) * 100) / 100;"
    );
    expect(broken).not.toBe(reference);

    const root = await setupWorkspace(broken);
    const result = await createPricingDiscountOracle().run({
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I09",
      workspace_path: join(root, "workspace"),
      artifact_dir: join(root, "artifacts", "I09"),
      hidden_oracle_path: hiddenOraclePath
    });

    expect(result.status).toBe("failed");
    expect(failedCommitments(result.checks)).toContain("single-final-currency-rounding");
  });

  test("fails a candidate that never rounds the final total", async () => {
    const reference = await readFile(referenceSourcePath, "utf8");
    const broken = reference.replace(
      "const total = roundHalfUp(postDiscountTotal + taxTotal);",
      "const total = postDiscountTotal + taxTotal;"
    );
    expect(broken).not.toBe(reference);

    const root = await setupWorkspace(broken);
    const result = await createPricingDiscountOracle().run({
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I09",
      workspace_path: join(root, "workspace"),
      artifact_dir: join(root, "artifacts", "I09"),
      hidden_oracle_path: hiddenOraclePath
    });

    expect(result.status).toBe("failed");
    expect(failedCommitments(result.checks)).toContain("single-final-currency-rounding");
  });

  test("fails a candidate that rounds tax before the final total", async () => {
    const reference = await readFile(referenceSourcePath, "utf8");
    const broken = reference.replace(
      "const taxTotal = taxableBase * ((state.taxRatePercent ?? 0) / 100);",
      "const taxTotal = Math.round((taxableBase * ((state.taxRatePercent ?? 0) / 100) + Number.EPSILON) * 100) / 100;"
    );
    expect(broken).not.toBe(reference);

    const root = await setupWorkspace(broken);
    const result = await createPricingDiscountOracle().run({
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I09",
      workspace_path: join(root, "workspace"),
      artifact_dir: join(root, "artifacts", "I09"),
      hidden_oracle_path: hiddenOraclePath
    });

    expect(result.status).toBe("failed");
    expect(failedCommitments(result.checks)).toContain("single-final-currency-rounding");
  });
});

function failedCommitments(checks: Array<{ commitment_id: string; passed: boolean }>) {
  return checks.filter((check) => !check.passed).map((check) => check.commitment_id);
}

async function setupWorkspace(pricingSource: string) {
  const root = await mkTempRoot();

  await mkdir(join(root, "workspace", "src"), { recursive: true });
  await mkdir(join(root, "hidden-oracle"), { recursive: true });
  await mkdir(join(root, "artifacts"), { recursive: true });
  await writeFile(join(root, "workspace", "src", "pricing.ts"), pricingSource);
  await writeFile(join(root, "hidden-oracle", "oracle-cases.txt"), "private hidden cases\n");

  return root;
}

async function mkTempRoot() {
  const root = join(
    tmpdir(),
    `hit-sdd-bench-pricing-oracle-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );

  tempRoots.push(root);
  await mkdir(root, { recursive: true });

  return root;
}
