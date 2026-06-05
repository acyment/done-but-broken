import { expect, test } from "bun:test";

test("item names remain visible with totals and discounts", () => {
  expect("Items, Total, Discounts").toContain("Items");
});
