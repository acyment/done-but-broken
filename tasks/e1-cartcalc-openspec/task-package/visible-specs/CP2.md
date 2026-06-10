# CP2 - Basis-Point Discount

Preserve all CP1 behavior.

Rules:

- `discountBps` is a basis-point discount rate where `1000` means 10%.
- Missing `discountBps` behaves as `0`.
- `discountCents` is `floor(subtotalCents(items) * discountBps / 10000)`.
- `totalCents` subtracts the computed discount from the subtotal.

Worked examples:

- `discountCents({ items: [{ sku: "mug", unitCents: 1000, quantity: 2 }, { sku: "pin", unitCents: 500, quantity: 1 }], discountBps: 1000 })` returns `250`.
- `totalCents({ items: [{ sku: "mug", unitCents: 1000, quantity: 2 }, { sku: "pin", unitCents: 500, quantity: 1 }], discountBps: 1000 })` returns `2250`.
- `discountCents({ items: [{ sku: "rounding", unitCents: 333, quantity: 1 }], discountBps: 1000 })` returns `33`.
