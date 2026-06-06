import { expect, test } from "bun:test";
import { applyEvent, canReserve, getAvailability } from "../src/inventory";

test("received stock becomes sellable inventory", () => {
  const state = applyEvent({}, {
    id: "stock-visible",
    type: "stock_received",
    sku: "sku-visible",
    quantity: 4,
    receivedAt: "2026-02-01T00:00:00.000Z"
  });

  expect(getAvailability(state, "sku-visible", "2026-02-01T00:01:00.000Z")).toMatchObject({
    onHand: 4,
    sellable: 4
  });
  expect(canReserve(state, "sku-visible", 4, "2026-02-01T00:01:00.000Z")).toBe(true);
  expect(canReserve(state, "sku-visible", 5, "2026-02-01T00:01:00.000Z")).toBe(false);
});
