import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSubscriptionEntitlementsOracle } from "../src/subscription-entitlements-oracle";

const repoRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/test$/, "");
const templateSourcePath = join(
  repoRoot,
  "tasks",
  "subscription-entitlements-lifecycle",
  "template-workspace",
  "src",
  "subscription.ts"
);
const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("subscription-entitlements hidden oracle", () => {
  test("passes the reference template candidate at every checkpoint", async () => {
    const source = await readFile(templateSourcePath, "utf8");
    const root = await setupWorkspace(source);
    const oracle = createSubscriptionEntitlementsOracle();

    for (const checkpoint_id of ["I01", "I02", "I03", "I04", "I05", "I06", "I07", "I08", "I09"]) {
      const result = await oracle.run({
        condition_id: "feedback_capable_spec",
        checkpoint_id,
        workspace_path: join(root, "workspace"),
        artifact_dir: join(root, "artifacts", checkpoint_id),
        hidden_oracle_path: join(root, "hidden-oracle")
      });

      expect(result.status).toBe("ok");
      expect(result.checks.length).toBeGreaterThanOrEqual(1);
      expect(result.checks.every((check) => check.passed)).toBe(true);
    }
  });

  test("fails a candidate that double-applies duplicate event IDs", async () => {
    const root = await setupWorkspace(duplicateEventsRegressionSource());
    const oracle = createSubscriptionEntitlementsOracle();
    const result = await oracle.run({
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I06",
      workspace_path: join(root, "workspace"),
      artifact_dir: join(root, "artifacts", "I06"),
      hidden_oracle_path: join(root, "hidden-oracle")
    });

    expect(result.status).toBe("failed");
    expect(failedCommitments(result.checks)).toContain("duplicate-events-are-idempotent");
  });

  test("fails a candidate that lets paid access survive fraud suspension", async () => {
    const root = await setupWorkspace(noSuspensionOverrideSource());
    const oracle = createSubscriptionEntitlementsOracle();
    const result = await oracle.run({
      condition_id: "context_only_spec",
      checkpoint_id: "I07",
      workspace_path: join(root, "workspace"),
      artifact_dir: join(root, "artifacts", "I07"),
      hidden_oracle_path: join(root, "hidden-oracle")
    });

    expect(result.status).toBe("failed");
    expect(failedCommitments(result.checks)).toContain("fraud-suspension-overrides-all-access");
  });

  test("fails a candidate that treats refund as an invoice-only event", async () => {
    const root = await setupWorkspace(refundDoesNotRestrictSource());
    const oracle = createSubscriptionEntitlementsOracle();
    const result = await oracle.run({
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I09",
      workspace_path: join(root, "workspace"),
      artifact_dir: join(root, "artifacts", "I09"),
      hidden_oracle_path: join(root, "hidden-oracle")
    });

    expect(result.status).toBe("failed");
    expect(failedCommitments(result.checks)).toContain("refund-chargeback-restricts-without-resurrection");
  });
});

function failedCommitments(checks: Array<{ commitment_id: string; passed: boolean }>) {
  return checks.filter((check) => !check.passed).map((check) => check.commitment_id);
}

async function setupWorkspace(subscriptionSource: string) {
  const root = await mkTempRoot();

  await mkdir(join(root, "workspace", "src"), { recursive: true });
  await mkdir(join(root, "hidden-oracle"), { recursive: true });
  await mkdir(join(root, "artifacts"), { recursive: true });
  await writeFile(join(root, "workspace", "src", "subscription.ts"), subscriptionSource);
  await writeFile(join(root, "hidden-oracle", "oracle-cases.txt"), "private hidden cases\n");

  return root;
}

async function mkTempRoot() {
  const root = join(
    tmpdir(),
    `hit-sdd-bench-subscription-oracle-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );

  tempRoots.push(root);
  await mkdir(root, { recursive: true });

  return root;
}

function duplicateEventsRegressionSource(): string {
  return [
    "export function applyEvent(state = {}, event) {",
    "  const next = { ...state, invoices: [...(state.invoices ?? [])] };",
    "  if (event.type === 'payment_succeeded') {",
    "    next.status = 'active';",
    "    next.plan = event.plan;",
    "    next.currentPeriodEnd = event.currentPeriodEnd;",
    "    next.invoices.push({ id: event.invoiceId, amount: event.amount, status: 'paid' });",
    "  }",
    "  return next;",
    "}",
    "export function canAccessFeature(state, feature, now) { return state.status === 'active' && feature === 'core' && now < state.currentPeriodEnd; }",
    "export function getBillingStatus(state) { return { status: state.status ?? 'inactive', plan: state.plan }; }",
    "export function getInvoiceSummary(state) { return { totalCharged: (state.invoices ?? []).reduce((sum, invoice) => sum + invoice.amount, 0), totalReversed: 0, net: (state.invoices ?? []).reduce((sum, invoice) => sum + invoice.amount, 0), invoices: state.invoices ?? [] }; }",
    ""
  ].join("\n");
}

function noSuspensionOverrideSource(): string {
  return [
    "export function applyEvent(state = {}, event) {",
    "  if (event.type === 'payment_succeeded') return { ...state, status: 'active', plan: event.plan, currentPeriodEnd: event.currentPeriodEnd, invoices: [{ id: event.invoiceId, amount: event.amount, status: 'paid' }] };",
    "  if (event.type === 'fraud_suspended') return { ...state, suspended: true };",
    "  return state;",
    "}",
    "export function canAccessFeature(state, feature, now) { return state.status === 'active' && feature === 'core' && now < state.currentPeriodEnd; }",
    "export function getBillingStatus(state) { return { status: state.status ?? 'inactive', plan: state.plan }; }",
    "export function getInvoiceSummary(state) { return { totalCharged: 1000, totalReversed: 0, net: 1000, invoices: state.invoices ?? [] }; }",
    ""
  ].join("\n");
}

function refundDoesNotRestrictSource(): string {
  return [
    "export function applyEvent(state = {}, event) {",
    "  if (event.type === 'payment_succeeded') return { ...state, status: 'active', plan: event.plan, currentPeriodEnd: event.currentPeriodEnd, invoices: [{ id: event.invoiceId, amount: event.amount, status: 'paid' }] };",
    "  if (event.type === 'refund') return { ...state, invoices: [...(state.invoices ?? []), { id: event.invoiceId, amount: -event.amount, status: 'refunded' }] };",
    "  return state;",
    "}",
    "export function canAccessFeature(state, feature, now) { return state.status === 'active' && feature === 'core' && now < state.currentPeriodEnd; }",
    "export function getBillingStatus(state) { return { status: state.status ?? 'inactive', plan: state.plan }; }",
    "export function getInvoiceSummary(state) { return { totalCharged: 1000, totalReversed: 1000, net: 0, invoices: state.invoices ?? [] }; }",
    ""
  ].join("\n");
}
