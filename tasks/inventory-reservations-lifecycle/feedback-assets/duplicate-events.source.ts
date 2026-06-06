import { expect, test } from "bun:test";
import { applyEvent, getAvailability } from "../src/inventory";

test("duplicate event IDs are idempotent", () => {
  const stockEvent = {
    id: "stock-visible",
    type: "stock_received",
    sku: "sku-visible",
    quantity: 4,
    receivedAt: "2026-02-01T00:00:00.000Z"
  };
  const reserveEvent = {
    id: "reserve-visible",
    type: "reservation_requested",
    reservationId: "res-visible",
    sku: "sku-visible",
    quantity: 2,
    requestedAt: "2026-02-01T01:00:00.000Z",
    expiresAt: "2026-02-05T00:00:00.000Z"
  };

  let state = applyEvent({}, stockEvent);
  state = applyEvent(state, stockEvent);
  state = applyEvent(state, reserveEvent);
  state = applyEvent(state, reserveEvent);

  expect(getAvailability(state, "sku-visible", "2026-02-02T00:00:00.000Z")).toMatchObject({
    onHand: 4,
    held: 2,
    sellable: 2
  });
});
