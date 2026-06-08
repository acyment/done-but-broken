import { expect, test } from "bun:test";
import { applyEvent, getLineTotal, getQuote } from "../src/pricing";

test("cart subtotal sums each line's list price", () => {
  let state = applyEvent({}, { id: "v-base-mug", type: "item_added", sku: "mug", unitPrice: 6.0, quantity: 3 });
  state = applyEvent(state, { id: "v-base-lid", type: "item_added", sku: "lid", unitPrice: 2.0, quantity: 2 });

  const quote = getQuote(state);
  expect(quote.subtotal).toBeCloseTo(22, 2);
  expect(quote.total).toBeCloseTo(22, 2);
  expect(getLineTotal(state, "mug")).toBeCloseTo(18, 2);
  expect(getLineTotal(state, "lid")).toBeCloseTo(4, 2);
});
