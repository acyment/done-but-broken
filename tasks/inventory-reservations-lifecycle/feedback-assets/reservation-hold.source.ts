import { expect, test } from "bun:test";
import { applyEvent, canReserve, getAvailability, getReservationStatus } from "../src/inventory";

test("reservation holds stock until expiration", () => {
  let state = applyEvent({}, {
    id: "stock-visible",
    type: "stock_received",
    sku: "sku-visible",
    quantity: 4,
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

  expect(getReservationStatus(state, "res-visible", "2026-02-02T00:00:00.000Z").status).toBe("held");
  expect(getAvailability(state, "sku-visible", "2026-02-02T00:00:00.000Z")).toMatchObject({
    held: 3,
    sellable: 1
  });
  expect(canReserve(state, "sku-visible", 2, "2026-02-02T00:00:00.000Z")).toBe(false);
});
