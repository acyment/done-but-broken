import { expect, test } from "bun:test";
import { applyEvent, getLineTotal } from "../src/pricing";

test("bulk tier stacks with the line sale at or above the minimum quantity", () => {
  // mug: 5.00 each, 10% line sale, bulk 20% off at quantity >= 10.
  // At qty 10: 5.00 x 0.9 x 0.8 x 10 = 36.00.
  let state = applyEvent({}, { id: "v-bulk-mug", type: "item_added", sku: "mug", unitPrice: 5.0, quantity: 10 });
  state = applyEvent(state, { id: "v-bulk-sale", type: "line_sale_set", sku: "mug", percentOff: 10 });
  state = applyEvent(state, { id: "v-bulk-rule", type: "bulk_rule_set", sku: "mug", minQuantity: 10, percentOff: 20 });
  expect(getLineTotal(state, "mug")).toBeCloseTo(36, 2);
});

test("bulk tier does not apply below the minimum quantity", () => {
  // At qty 5 (below 10): only the 10% line sale applies -> 5.00 x 0.9 x 5 = 22.50.
  let state = applyEvent({}, { id: "v-bulk2-mug", type: "item_added", sku: "mug", unitPrice: 5.0, quantity: 5 });
  state = applyEvent(state, { id: "v-bulk2-sale", type: "line_sale_set", sku: "mug", percentOff: 10 });
  state = applyEvent(state, { id: "v-bulk2-rule", type: "bulk_rule_set", sku: "mug", minQuantity: 10, percentOff: 20 });
  expect(getLineTotal(state, "mug")).toBeCloseTo(22.5, 2);
});
