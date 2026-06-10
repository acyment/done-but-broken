import { lineSubtotalCents, subtotalCents, totalCents } from "../../src/cartcalc";

function assertEqual(actual: number, expected: number, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

assertEqual(lineSubtotalCents({ sku: "mug", unitCents: 1000, quantity: 2 }), 2000, "CP1 mug line subtotal");
assertEqual(lineSubtotalCents({ sku: "sticker", unitCents: 125, quantity: 3 }), 375, "CP1 sticker line subtotal");
assertEqual(
  subtotalCents([
    { sku: "mug", unitCents: 1000, quantity: 2 },
    { sku: "pin", unitCents: 500, quantity: 1 }
  ]),
  2500,
  "CP1 cart subtotal"
);
assertEqual(
  totalCents({
    items: [
      { sku: "mug", unitCents: 1000, quantity: 2 },
      { sku: "pin", unitCents: 500, quantity: 1 }
    ]
  }),
  2500,
  "CP1 total without discount"
);
