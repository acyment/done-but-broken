import { expect, test } from "bun:test";
import { applyEvent, canApplyCoupon, getQuote } from "../src/pricing";

test("applying the same coupon code twice counts once", () => {
  // mug 10.00; SAVE20 applied twice should discount only once -> 8.00, not 6.40.
  let state = applyEvent({}, { id: "v-dup-mug", type: "item_added", sku: "mug", unitPrice: 10.0, quantity: 1 });
  state = applyEvent(state, { id: "v-dup-1", type: "coupon_applied", code: "SAVE20", couponKind: "percent", value: 20 });
  state = applyEvent(state, { id: "v-dup-2", type: "coupon_applied", code: "SAVE20", couponKind: "percent", value: 20 });

  expect(getQuote(state).total).toBeCloseTo(8, 2);
  expect(canApplyCoupon(state, "SAVE20")).toBe(false);
  expect(canApplyCoupon(state, "FRESH")).toBe(true);
});

test("a distinct second coupon is not dropped", () => {
  // SAVE20 then PLUS5: 10.00 x 0.8 x 0.95 = 7.60.
  let state = applyEvent({}, { id: "v-dist-mug", type: "item_added", sku: "mug", unitPrice: 10.0, quantity: 1 });
  state = applyEvent(state, { id: "v-dist-1", type: "coupon_applied", code: "SAVE20", couponKind: "percent", value: 20 });
  state = applyEvent(state, { id: "v-dist-2", type: "coupon_applied", code: "PLUS5", couponKind: "percent", value: 5 });
  expect(getQuote(state).total).toBeCloseTo(7.6, 2);
});
