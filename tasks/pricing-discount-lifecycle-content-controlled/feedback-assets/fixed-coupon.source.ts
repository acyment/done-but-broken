import { expect, test } from "bun:test";
import { applyEvent, getQuote } from "../src/pricing";

test("fixed-amount coupon applies after the percentage coupon", () => {
  // mug 10.00 x 2 = 20.00; SAVE20 (20%) -> 16.00; THREE ($3 off) -> 13.00.
  // Applying the fixed amount first would wrongly give (20 - 3) x 0.8 = 13.60.
  let state = applyEvent({}, { id: "v-fx-mug", type: "item_added", sku: "mug", unitPrice: 10.0, quantity: 2 });
  state = applyEvent(state, { id: "v-fx-pct", type: "coupon_applied", code: "SAVE20", couponKind: "percent", value: 20 });
  state = applyEvent(state, { id: "v-fx-fixed", type: "coupon_applied", code: "THREE", couponKind: "fixed", value: 3 });

  const quote = getQuote(state);
  expect(quote.total).toBeCloseTo(13, 2);
  expect(quote.discountTotal).toBeCloseTo(7, 2);
});
