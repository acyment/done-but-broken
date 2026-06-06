import { expect, test } from "bun:test";
import { applyEvent, getAvailability, getReservationStatus } from "../src/inventory";

test("order confirmation commits held stock", () => {
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

  expect(getReservationStatus(state, "res-visible", "2026-02-02T00:00:00.000Z").status).toBe("confirmed");
  expect(getAvailability(state, "sku-visible", "2026-02-02T00:00:00.000Z")).toMatchObject({
    held: 0,
    committed: 3,
    sellable: 2
  });
});
