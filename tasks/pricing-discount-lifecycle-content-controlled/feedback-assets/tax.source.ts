import { expect, test } from "bun:test";
import { applyEvent, getQuote } from "../src/pricing";

test("tax applies to the post-discount taxable base and skips exempt SKUs", () => {
  // pen: 4.00 x 2 = 8.00 (taxable); book: 12.00 (exempt). list subtotal 20.00.
  // SAVE10 (10%) -> post-discount total 18.00; pen share 18.00 x 8/20 = 7.20.
  // tax 10% on 7.20 = 0.72; total 18.00 + 0.72 = 18.72.
  let state = applyEvent({}, { id: "v-tax-pen", type: "item_added", sku: "pen", unitPrice: 4.0, quantity: 2 });
  state = applyEvent(state, { id: "v-tax-book", type: "item_added", sku: "book", unitPrice: 12.0, quantity: 1 });
  state = applyEvent(state, { id: "v-tax-coupon", type: "coupon_applied", code: "SAVE10", couponKind: "percent", value: 10 });
  state = applyEvent(state, { id: "v-tax-rate", type: "tax_rate_set", percent: 10 });
  state = applyEvent(state, { id: "v-tax-exempt", type: "tax_exempt_set", sku: "book" });

  const quote = getQuote(state);
  expect(quote.taxTotal).toBeCloseTo(0.72, 2);
  expect(quote.total).toBeCloseTo(18.72, 2);
});
