# CP3 - Discount Cap

Preserve all CP1 and CP2 behavior.

Rules:

- `discountCapCents` is optional.
- When `discountCapCents` is present, `discountCents` returns the lower of the uncapped discount and the cap.
- When the uncapped discount is below the cap, the uncapped discount still applies.
- `totalCents` subtracts the capped discount.

Worked examples:

- `discountCents({ items: [{ sku: "mug", unitCents: 1000, quantity: 2 }, { sku: "pin", unitCents: 500, quantity: 1 }], discountBps: 2000, discountCapCents: 100 })` returns `100`.
- `totalCents({ items: [{ sku: "mug", unitCents: 1000, quantity: 2 }, { sku: "pin", unitCents: 500, quantity: 1 }], discountBps: 2000, discountCapCents: 100 })` returns `2400`.
- `discountCents({ items: [{ sku: "book", unitCents: 1000, quantity: 1 }], discountBps: 1000, discountCapCents: 200 })` returns `100`.
