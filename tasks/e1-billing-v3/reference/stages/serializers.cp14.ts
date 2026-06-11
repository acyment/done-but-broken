// Pure string-builder serializer with fixed field order. The v1 serializer is the
// legacy byte-stable format (I-V1BYTES): fixed field order, omits-zero style, and it
// must never gain new fields.

type SerializableLine = {
  line_id: string;
  kind: string;
  description: string;
  amount_cents: number;
  discount_cents?: number;
};

type SerializableInvoice = {
  invoice_id: string;
  subscription_id: string;
  status: string;
  lines: SerializableLine[];
  subtotal_cents: number;
  discount_total_cents?: number;
  total_cents: number;
};

function jsonString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function v1Line(line: SerializableLine): string {
  const discount = line.discount_cents ?? 0;
  const parts = [
    `"id":${jsonString(line.line_id)}`,
    `"kind":${jsonString(line.kind)}`,
    `"desc":${jsonString(line.description)}`,
    `"amount":${line.amount_cents}`
  ];

  if (discount > 0) {
    parts.push(`"discount":${discount}`);
  }

  return `{${parts.join(",")}}`;
}

// Legacy v1 format. Field order is frozen: v, invoice, subscription, status, lines
// (id, kind, desc, amount, discount-if-positive), subtotal, discount-if-positive, total.
// No other fields may ever appear in v1 output.
export function serializeInvoiceV1(invoice: SerializableInvoice): string {
  const discount = invoice.discount_total_cents ?? 0;
  const parts = [
    `"v":1`,
    `"invoice":${jsonString(invoice.invoice_id)}`,
    `"subscription":${jsonString(invoice.subscription_id)}`,
    `"status":${jsonString(invoice.status)}`,
    `"lines":[${invoice.lines.map(v1Line).join(",")}]`,
    `"subtotal":${invoice.subtotal_cents}`
  ];

  if (discount > 0) {
    parts.push(`"discount":${discount}`);
  }

  parts.push(`"total":${invoice.total_cents}`);

  return `{${parts.join(",")}}`;
}
