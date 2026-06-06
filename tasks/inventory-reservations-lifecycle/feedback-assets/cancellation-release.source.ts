import { expect, test } from "bun:test";
import { applyEvent, getAvailability, getReservationStatus } from "../src/inventory";

test("cancellation releases unshipped allocations", () => {
  let state = applyEvent({}, {
    id: "stock-visible",
    type: "stock_received",
    sku: "sku-visible",
    quantity: 5,
    receivedAt: "2026-02-01T00:00:00.000Z"
  });
  state = applyEvent(state, {
    id: "reserve-visible",
    type: "reservation_requested",
    reservationId: "res-visible",
    sku: "sku-visible",
    quantity: 3,
    requestedAt: "2026-02-01T01:00:00.000Z",
    expiresAt: "2026-02-05T00:00:00.000Z"
  });
  state = applyEvent(state, {
    id: "confirm-visible",
    type: "order_confirmed",
    reservationId: "res-visible",
    orderId: "order-visible",
    confirmedAt: "2026-02-01T02:00:00.000Z"
  });
  state = applyEvent(state, {
    id: "cancel-visible",
    type: "reservation_cancelled",
    reservationId: "res-visible",
    canceledAt: "2026-02-01T03:00:00.000Z"
  });

  expect(getReservationStatus(state, "res-visible", "2026-02-02T00:00:00.000Z").status).toBe("canceled");
  expect(getAvailability(state, "sku-visible", "2026-02-02T00:00:00.000Z")).toMatchObject({
    committed: 0,
    sellable: 5
  });
});
