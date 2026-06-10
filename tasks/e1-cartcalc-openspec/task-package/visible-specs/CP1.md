# CP1 - Line And Cart Subtotals

Implement the CartCalc exported API in `src/cartcalc.ts`.

Types:

- `LineItem = { sku: string; unitCents: number; quantity: number }`
- `QuoteInput = { items: LineItem[]; discountBps?: number; discountCapCents?: number }`

Required exports:

- `lineSubtotalCents(item: LineItem): number`
- `subtotalCents(items: LineItem[]): number`
- `discountCents(input: QuoteInput): number`
- `totalCents(input: QuoteInput): number`

Rules:

- Money is represented as integer cents.
- A line subtotal is `unitCents * quantity`.
- A cart subtotal is the sum of all line subtotals in input order.
- With no discount, `discountCents` is `0`.
- `totalCents` is `subtotalCents(items) - discountCents(input)`.

Worked examples:

- `lineSubtotalCents({ sku: "mug", unitCents: 1000, quantity: 2 })` returns `2000`.
- `lineSubtotalCents({ sku: "sticker", unitCents: 125, quantity: 3 })` returns `375`.
- `subtotalCents([{ sku: "mug", unitCents: 1000, quantity: 2 }, { sku: "pin", unitCents: 500, quantity: 1 }])` returns `2500`.
- `totalCents({ items: [{ sku: "mug", unitCents: 1000, quantity: 2 }, { sku: "pin", unitCents: 500, quantity: 1 }] })` returns `2500`.
