export type LineItem = { sku: string; unitCents: number; quantity: number };
export type QuoteInput = { items: LineItem[]; discountBps?: number; discountCapCents?: number };

export function lineSubtotalCents(_item: LineItem): number {
  return 0;
}

export function subtotalCents(_items: LineItem[]): number {
  return 0;
}

export function discountCents(_input: QuoteInput): number {
  return 0;
}

export function totalCents(_input: QuoteInput): number {
  return 0;
}
