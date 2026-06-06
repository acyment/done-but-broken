import { expect, test } from "bun:test";
import { applyEvent, getAvailability, getReservationStatus } from "../src/inventory";

test("reservation expiration releases held stock", () => {
  let state = applyEvent({}, {
    id: "stock-visible",
    type: "stock_received",
    sku: "sku-visible",
    quantity: 2,
    receivedAt: "2026-02-01T00:00:00.000Z"
  });
  state = applyEvent(state, {
    id: "reserve-visible",
    type: "reservation_requested",
    reservationId: "res-visible",
    sku: "sku-visible",
    quantity: 2,
    requestedAt: "2026-02-01T01:00:00.000Z",
    expiresAt: "2026-02-03T00:00:00.000Z"
  });

  expect(getReservationStatus(state, "res-visible", "2026-02-03T00:00:00.000Z").status).toBe("expired");
  expect(getAvailability(state, "sku-visible", "2026-02-03T00:00:00.000Z")).toMatchObject({
    held: 0,
    sellable: 2
  });
});
