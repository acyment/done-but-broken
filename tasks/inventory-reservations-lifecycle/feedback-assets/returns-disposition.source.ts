import { expect, test } from "bun:test";
import { applyEvent, getAvailability } from "../src/inventory";

test("returns restore only sellable stock", () => {
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
    id: "ship-visible",
    type: "order_shipped",
    reservationId: "res-visible",
    shipmentId: "ship-visible",
    shippedAt: "2026-02-01T03:00:00.000Z"
  });
  state = applyEvent(state, {
    id: "return-sellable-visible",
    type: "item_returned",
    reservationId: "res-visible",
    sku: "sku-visible",
    quantity: 1,
    disposition: "sellable",
    returnedAt: "2026-02-04T00:00:00.000Z"
  });
  state = applyEvent(state, {
    id: "return-damaged-visible",
    type: "item_returned",
    reservationId: "res-visible",
    sku: "sku-visible",
    quantity: 1,
    disposition: "damaged",
    returnedAt: "2026-02-04T01:00:00.000Z"
  });

  expect(getAvailability(state, "sku-visible", "2026-02-04T02:00:00.000Z")).toMatchObject({
    onHand: 3,
    returnedSellable: 1,
    damagedReturns: 1,
    sellable: 3
  });
});
