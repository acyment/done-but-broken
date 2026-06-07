import { expect, test } from "bun:test";
import { applyEvent, getQuote } from "../src/pricing";

test("order percentage coupon applies to the post-line-discount subtotal", () => {
  // mug: 10.00 x 2 = 20.00 list; 20% line sale -> 16.00; WELCOME 10% off -> 16.00 x 0.9 = 14.40.
  let state = applyEvent({}, { id: "v-oc-mug", type: "item_added", sku: "mug", unitPrice: 10.0, quantity: 2 });
  state = applyEvent(state, { id: "v-oc-sale", type: "line_sale_set", sku: "mug", percentOff: 20 });
  state = applyEvent(state, { id: "v-oc-coupon", type: "coupon_applied", code: "WELCOME", couponKind: "percent", value: 10 });

  const quote = getQuote(state);
  expect(quote.total).toBeCloseTo(14.4, 2);
  expect(quote.discountTotal).toBeCloseTo(5.6, 2);
});
