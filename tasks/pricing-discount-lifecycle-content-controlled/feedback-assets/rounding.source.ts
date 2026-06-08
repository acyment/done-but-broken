import { expect, test } from "bun:test";
import { applyEvent, getQuote } from "../src/pricing";

test("the final total is rounded once, half-up, to two decimals", () => {
  // Three lines of 3.33 at 50% off compute to 1.665 each = 4.995 total.
  // Rounding once gives 5.00; rounding each line to 1.67 first would wrongly give 5.01.
  let state = {};
  for (const sku of ["a", "b", "c"]) {
    state = applyEvent(state, { id: `v-round-item-${sku}`, type: "item_added", sku, unitPrice: 3.33, quantity: 1 });
    state = applyEvent(state, { id: `v-round-sale-${sku}`, type: "line_sale_set", sku, percentOff: 50 });
  }

  const total = getQuote(state).total;
  expect(total).toBeCloseTo(5.0, 2);
  // Rounded to two decimals: no third decimal place remains.
  expect(Math.round(total * 100)).toBe(total * 100);
});
