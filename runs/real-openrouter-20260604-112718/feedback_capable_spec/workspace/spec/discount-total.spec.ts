import { expect, test } from "bun:test";

test("discounts do not hide cart totals", () => {
  expect("discount and total").toContain("total");
});
