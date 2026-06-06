import { expect, test } from "bun:test";
import { applyEvent, getAvailability, getReservationStatus } from "../src/inventory";

test("restock fills backorders FIFO", () => {
  let state = applyEvent({}, {
    id: "backorder-visible-1",
    type: "reservation_requested",
    reservationId: "backorder-visible-1",
    sku: "sku-visible",
    quantity: 2,
    requestedAt: "2026-02-01T00:00:00.000Z",
    expiresAt: "2026-02-10T00:00:00.000Z"
  });
  state = applyEvent(state, {
    id: "backorder-visible-2",
    type: "reservation_requested",
    reservationId: "backorder-visible-2",
    sku: "sku-visible",
    quantity: 2,
    requestedAt: "2026-02-01T00:05:00.000Z",
    expiresAt: "2026-02-10T00:00:00.000Z"
  });
  state = applyEvent(state, {
    id: "restock-visible",
    type: "stock_received",
    sku: "sku-visible",
    quantity: 3,
    receivedAt: "2026-02-01T01:00:00.000Z"
  });

  expect(getReservationStatus(state, "backorder-visible-1", "2026-02-01T02:00:00.000Z").status).toBe("held");
  expect(getReservationStatus(state, "backorder-visible-2", "2026-02-01T02:00:00.000Z").status).toBe("backordered");
  expect(getAvailability(state, "sku-visible", "2026-02-01T02:00:00.000Z")).toMatchObject({
    held: 2,
    backordered: 2,
    sellable: 1
  });
});
