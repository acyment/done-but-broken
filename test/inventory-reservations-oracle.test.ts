import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInventoryReservationsOracle } from "../src/inventory-reservations-oracle";

const repoRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/test$/, "");
const templateSourcePath = join(
  repoRoot,
  "tasks",
  "inventory-reservations-lifecycle",
  "template-workspace",
  "src",
  "inventory.ts"
);
const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("inventory-reservations hidden oracle", () => {
  test("passes the reference template candidate at every checkpoint", async () => {
    const source = await readFile(templateSourcePath, "utf8");
    const root = await setupWorkspace(source);
    const oracle = createInventoryReservationsOracle();

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

  test("fails a candidate that double-applies duplicate stock event IDs", async () => {
    const root = await setupWorkspace(duplicateStockRegressionSource());
    const oracle = createInventoryReservationsOracle();
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

  test("fails a candidate that leaves shipped committed stock on hand", async () => {
    const root = await setupWorkspace(noShipmentConsumptionSource());
    const oracle = createInventoryReservationsOracle();
    const result = await oracle.run({
      condition_id: "context_only_spec",
      checkpoint_id: "I07",
      workspace_path: join(root, "workspace"),
      artifact_dir: join(root, "artifacts", "I07"),
      hidden_oracle_path: join(root, "hidden-oracle")
    });

    expect(result.status).toBe("failed");
    expect(failedCommitments(result.checks)).toContain("shipment-consumes-committed-stock");
  });

  test("fails a candidate that restores damaged returns to sellable inventory", async () => {
    const root = await setupWorkspace(damagedReturnRestoresStockSource());
    const oracle = createInventoryReservationsOracle();
    const result = await oracle.run({
      condition_id: "feedback_capable_spec",
      checkpoint_id: "I09",
      workspace_path: join(root, "workspace"),
      artifact_dir: join(root, "artifacts", "I09"),
      hidden_oracle_path: join(root, "hidden-oracle")
    });

    expect(result.status).toBe("failed");
    expect(failedCommitments(result.checks)).toContain("returns-restore-only-sellable-stock");
  });
});

function failedCommitments(checks: Array<{ commitment_id: string; passed: boolean }>) {
  return checks.filter((check) => !check.passed).map((check) => check.commitment_id);
}

async function setupWorkspace(inventorySource: string) {
  const root = await mkTempRoot();

  await mkdir(join(root, "workspace", "src"), { recursive: true });
  await mkdir(join(root, "hidden-oracle"), { recursive: true });
  await mkdir(join(root, "artifacts"), { recursive: true });
  await writeFile(join(root, "workspace", "src", "inventory.ts"), inventorySource);
  await writeFile(join(root, "hidden-oracle", "oracle-cases.txt"), "private hidden cases\n");

  return root;
}

async function mkTempRoot() {
  const root = join(
    tmpdir(),
    `hit-sdd-bench-inventory-oracle-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );

  tempRoots.push(root);
  await mkdir(root, { recursive: true });

  return root;
}

function duplicateStockRegressionSource(): string {
  return [
    "export function applyEvent(state = {}, event) {",
    "  const inventory = { ...(state.inventory ?? {}) };",
    "  const reservations = { ...(state.reservations ?? {}) };",
    "  if (event.type === 'stock_received') inventory[event.sku] = (inventory[event.sku] ?? 0) + event.quantity;",
    "  if (event.type === 'reservation_requested') reservations[event.reservationId] = { ...event, status: 'held' };",
    "  return { inventory, reservations };",
    "}",
    "export function getAvailability(state = {}, sku) {",
    "  const onHand = state.inventory?.[sku] ?? 0;",
    "  const held = Object.values(state.reservations ?? {}).filter((r) => r.sku === sku && r.status === 'held').reduce((sum, r) => sum + r.quantity, 0);",
    "  return { sku, onHand, held, committed: 0, shipped: 0, backordered: 0, sellable: onHand - held, damagedReturns: 0, returnedSellable: 0 };",
    "}",
    "export function canReserve(state, sku, quantity, now) { return getAvailability(state, sku, now).sellable >= quantity; }",
    "export function getReservationStatus(state = {}, reservationId) { return state.reservations?.[reservationId] ?? { reservationId, status: 'missing' }; }",
    ""
  ].join("\n");
}

function noShipmentConsumptionSource(): string {
  return [
    "export function applyEvent(state = {}, event) {",
    "  const next = { ...state, inventory: { ...(state.inventory ?? {}) }, reservations: { ...(state.reservations ?? {}) }, shipped: state.shipped ?? 0 };",
    "  if (event.type === 'stock_received') next.inventory[event.sku] = (next.inventory[event.sku] ?? 0) + event.quantity;",
    "  if (event.type === 'reservation_requested') next.reservations[event.reservationId] = { ...event, status: 'held' };",
    "  if (event.type === 'order_confirmed') next.reservations[event.reservationId].status = 'confirmed';",
    "  if (event.type === 'order_shipped') { next.reservations[event.reservationId].status = 'shipped'; next.shipped += next.reservations[event.reservationId].quantity; }",
    "  return next;",
    "}",
    "export function getAvailability(state = {}, sku) {",
    "  const onHand = state.inventory?.[sku] ?? 0;",
    "  return { sku, onHand, held: 0, committed: 0, shipped: state.shipped ?? 0, backordered: 0, sellable: onHand, damagedReturns: 0, returnedSellable: 0 };",
    "}",
    "export function canReserve(state, sku, quantity, now) { return getAvailability(state, sku, now).sellable >= quantity; }",
    "export function getReservationStatus(state = {}, reservationId) { return state.reservations?.[reservationId] ?? { reservationId, status: 'missing' }; }",
    ""
  ].join("\n");
}

function damagedReturnRestoresStockSource(): string {
  return [
    "export function applyEvent(state = {}, event) {",
    "  const next = { ...state, inventory: { ...(state.inventory ?? {}) }, reservations: { ...(state.reservations ?? {}) }, damagedReturns: state.damagedReturns ?? 0, returnedSellable: state.returnedSellable ?? 0 };",
    "  if (event.type === 'stock_received') next.inventory[event.sku] = (next.inventory[event.sku] ?? 0) + event.quantity;",
    "  if (event.type === 'reservation_requested') next.reservations[event.reservationId] = { ...event, status: 'held' };",
    "  if (event.type === 'order_confirmed') next.reservations[event.reservationId].status = 'confirmed';",
    "  if (event.type === 'order_shipped') { const r = next.reservations[event.reservationId]; r.status = 'shipped'; next.inventory[r.sku] -= r.quantity; }",
    "  if (event.type === 'item_returned') { next.inventory[event.sku] = (next.inventory[event.sku] ?? 0) + event.quantity; next.damagedReturns += event.quantity; }",
    "  return next;",
    "}",
    "export function getAvailability(state = {}, sku) {",
    "  const onHand = state.inventory?.[sku] ?? 0;",
    "  return { sku, onHand, held: 0, committed: 0, shipped: 0, backordered: 0, sellable: onHand, damagedReturns: state.damagedReturns ?? 0, returnedSellable: state.returnedSellable ?? 0 };",
    "}",
    "export function canReserve(state, sku, quantity, now) { return getAvailability(state, sku, now).sellable >= quantity; }",
    "export function getReservationStatus(state = {}, reservationId) { return state.reservations?.[reservationId] ?? { reservationId, status: 'missing' }; }",
    ""
  ].join("\n");
}
