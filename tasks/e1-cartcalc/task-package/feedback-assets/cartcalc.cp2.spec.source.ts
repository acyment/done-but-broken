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
    discountBps: 1000
  }),
  250,
  "CP2 basis-point discount"
);
assertEqual(
  totalCents({
    items: [
      { sku: "mug", unitCents: 1000, quantity: 2 },
      { sku: "pin", unitCents: 500, quantity: 1 }
    ],
    discountBps: 1000
  }),
  2250,
  "CP2 discounted total"
);
assertEqual(
  discountCents({
    items: [{ sku: "rounding", unitCents: 333, quantity: 1 }],
    discountBps: 1000
  }),
  33,
  "CP2 discount floors fractional cents"
);
