import { expect, test } from "bun:test";
import { applyEvent, getQuote } from "../src/pricing";

test("discount cap limits total discount to the configured percent of subtotal", () => {
  // list subtotal 20.00; SAVE20 (20%) -> 16.00, then TEN ($10) -> 6.00 (discount 14.00 = 70%).
  // A 50% cap limits discount to 10.00, so total is 10.00.
  let state = applyEvent({}, { id: "v-cap-mug", type: "item_added", sku: "mug", unitPrice: 10.0, quantity: 2 });
  state = applyEvent(state, { id: "v-cap-pct", type: "coupon_applied", code: "SAVE20", couponKind: "percent", value: 20 });
  state = applyEvent(state, { id: "v-cap-fixed", type: "coupon_applied", code: "TEN", couponKind: "fixed", value: 10 });
  state = applyEvent(state, { id: "v-cap-set", type: "cap_set", maxDiscountPercent: 50 });
  expect(getQuote(state).total).toBeCloseTo(10, 2);
});

test("discount cap is a no-op when the discount is under the cap", () => {
  // list subtotal 20.00; SAVE20 (20%) -> discount 4.00 = 20% < 50% cap, so total stays 16.00.
  let state = applyEvent({}, { id: "v-capn-mug", type: "item_added", sku: "mug", unitPrice: 10.0, quantity: 2 });
  state = applyEvent(state, { id: "v-capn-pct", type: "coupon_applied", code: "SAVE20", couponKind: "percent", value: 20 });
  state = applyEvent(state, { id: "v-capn-set", type: "cap_set", maxDiscountPercent: 50 });
  expect(getQuote(state).total).toBeCloseTo(16, 2);
});
