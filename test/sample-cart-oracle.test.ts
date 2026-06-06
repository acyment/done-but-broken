import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSampleCartOracle } from "../src/sample-cart-oracle";

const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("sample-cart hidden oracle", () => {
  test("evaluates active sample-cart commitments from workspace state", async () => {
    const root = await setupWorkspace({
      cartSource:
        "export function renderCart(items) { return `Items: ${items.map((item) => item.name).join(', ')}; Total: 10; Discounts: sale`; }\n"
    });
    const oracle = createSampleCartOracle();

    const i01 = await oracle.run({
      condition_id: "context_only_spec",
      checkpoint_id: "I01",
      workspace_path: join(root, "workspace"),
      artifact_dir: join(root, "artifacts", "I01"),
      hidden_oracle_path: join(root, "hidden-oracle")
    });
    const i02 = await oracle.run({
      condition_id: "context_only_spec",
      checkpoint_id: "I02",
      workspace_path: join(root, "workspace"),
      artifact_dir: join(root, "artifacts", "I02"),
      hidden_oracle_path: join(root, "hidden-oracle")
    });
    const i03 = await oracle.run({
      condition_id: "context_only_spec",
      checkpoint_id: "I03",
      workspace_path: join(root, "workspace"),
      artifact_dir: join(root, "artifacts", "I03"),
      hidden_oracle_path: join(root, "hidden-oracle")
    });

    expect(i01.status).toBe("ok");
    expect(i01.checks.map((check) => check.commitment_id)).toEqual(["cart-total-visible"]);
    expect(i01.checks[0].passed).toBe(true);
    expect(i02.checks.map((check) => check.commitment_id)).toEqual([
      "cart-total-visible",
      "discount-does-not-hide-total"
    ]);
    expect(i02.checks.every((check) => check.passed)).toBe(true);
    expect(i03.checks.map((check) => check.commitment_id)).toEqual([
      "cart-total-visible",
      "discount-does-not-hide-total",
      "item-names-remain-visible"
    ]);
    expect(i03.checks.every((check) => check.passed)).toBe(true);
  });

  test("detects drift when a later workspace hides totals behind discounts", async () => {
    const root = await setupWorkspace({
      cartSource: "export function renderCart() { return `Discounts: sale`; }\n"
    });
    const oracle = createSampleCartOracle();

    const result = await oracle.run({
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I02",
      workspace_path: join(root, "workspace"),
      artifact_dir: join(root, "artifacts", "I02"),
      hidden_oracle_path: join(root, "hidden-oracle")
    });

    expect(result.status).toBe("failed");
    expect(result.checks).toEqual([
      {
        check_id: "sample-cart:I02:cart-total-visible",
        commitment_id: "cart-total-visible",
        passed: false,
        details: "Expected src/cart.ts to render a Total label."
      },
      {
        check_id: "sample-cart:I02:discount-does-not-hide-total",
        commitment_id: "discount-does-not-hide-total",
        passed: false,
        details: "Expected src/cart.ts to render both Total and Discounts labels."
      }
    ]);
  });

  test("detects I03 drift when item names disappear while totals remain", async () => {
    const root = await setupWorkspace({
      cartSource: "export function renderCart() { return `Total: 10; Discounts: sale`; }\n"
    });
    const oracle = createSampleCartOracle();

    const result = await oracle.run({
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I03",
      workspace_path: join(root, "workspace"),
      artifact_dir: join(root, "artifacts", "I03"),
      hidden_oracle_path: join(root, "hidden-oracle")
    });

    expect(result.status).toBe("failed");
    expect(result.checks.find((check) => check.commitment_id === "item-names-remain-visible")).toEqual({
      check_id: "sample-cart:I03:item-names-remain-visible",
      commitment_id: "item-names-remain-visible",
      passed: false,
      details: "Expected src/cart.ts to render item names alongside Total and Discounts labels."
    });
  });

  test("does not pass commitments from labels that only appear in source comments", async () => {
    const root = await setupWorkspace({
      cartSource: [
        "export function renderCart() {",
        "  // Items: Alpha, Beta; Total: 10; Discounts: sale; item.name",
        "  return '';",
        "}",
        ""
      ].join("\n")
    });
    const oracle = createSampleCartOracle();

    const result = await oracle.run({
      condition_id: "context_only_spec",
      checkpoint_id: "I03",
      workspace_path: join(root, "workspace"),
      artifact_dir: join(root, "artifacts", "I03"),
      hidden_oracle_path: join(root, "hidden-oracle")
    });

    expect(result.status).toBe("failed");
    expect(result.checks.map((check) => check.passed)).toEqual([false, false, false]);
  });
});

async function setupWorkspace(input: { cartSource: string }) {
  const root = join(tmpdir(), `hit-sdd-bench-sample-oracle-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);

  await mkdir(join(root, "workspace", "src"), { recursive: true });
  await mkdir(join(root, "hidden-oracle"), { recursive: true });
  await mkdir(join(root, "artifacts"), { recursive: true });
  await writeFile(join(root, "workspace", "src", "cart.ts"), input.cartSource);
  await writeFile(join(root, "hidden-oracle", "oracle-note.txt"), "private\n");

  return root;
}
