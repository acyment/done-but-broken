import { discountCents, totalCents } from "../../src/cartcalc";

function assertEqual(actual: number, expected: number, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

assertEqual(
  discountCents({
    items: [
      { sku: "mug", unitCents: 1000, quantity: 2 },
      { sku: "pin", unitCents: 500, quantity: 1 }
    ],
    discountBps: 2000,
    discountCapCents: 100
  }),
  100,
  "CP3 capped discount"
);
assertEqual(
  totalCents({
    items: [
      { sku: "mug", unitCents: 1000, quantity: 2 },
      { sku: "pin", unitCents: 500, quantity: 1 }
    ],
    discountBps: 2000,
    discountCapCents: 100
  }),
  2400,
  "CP3 capped total"
);
assertEqual(
  discountCents({
    items: [{ sku: "book", unitCents: 1000, quantity: 1 }],
    discountBps: 1000,
    discountCapCents: 200
  }),
  100,
  "CP3 discount below cap"
);
