import { expect, test } from "bun:test";
import { applyEvent, getLineTotal, getQuote } from "../src/pricing";

test("a line on sale reduces that line's total", () => {
  // mug: 6.00 x 2 = 12.00 list; 25% off -> 6.00 x 0.75 x 2 = 9.00.
  let state = applyEvent({}, { id: "v-sale-mug", type: "item_added", sku: "mug", unitPrice: 6.0, quantity: 2 });
  state = applyEvent(state, { id: "v-sale-set", type: "line_sale_set", sku: "mug", percentOff: 25 });

  const quote = getQuote(state);
  expect(getLineTotal(state, "mug")).toBeCloseTo(9, 2);
  expect(quote.subtotal).toBeCloseTo(12, 2);
  expect(quote.discountTotal).toBeCloseTo(3, 2);
  expect(quote.total).toBeCloseTo(9, 2);
});
