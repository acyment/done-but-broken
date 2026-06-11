// Pure string-builder serializers with fixed field order. The v1 serializer is the
// legacy byte-stable format (I-V1BYTES): fixed field order, omits-zero style, and it
// must never gain new fields. The v2 serializer (CP15+) is the explicit format.

import type { Invoice, InvoiceLine } from "../domain/invoice";

function jsonString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function v1Line(line: InvoiceLine): string {
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
export function serializeInvoiceV1(invoice: Invoice): string {
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

function v2Line(line: InvoiceLine): string {
  const parts = [
    `"id":${jsonString(line.line_id)}`,
    `"kind":${jsonString(line.kind)}`,
    `"desc":${jsonString(line.description)}`,
    `"amount":${line.amount_cents}`,
    `"discount":${line.discount_cents ?? 0}`,
    `"refunded":${line.refunded_cents ?? 0}`
  ];

  return `{${parts.join(",")}}`;
}

// v2 format: explicit fields, fixed order: v, invoice, subscription, status, finalized,
// lines (id, kind, desc, amount, discount, refunded), subtotal, discount, total,
// captured, refunded.
export function serializeInvoiceV2(invoice: Invoice): string {
  const parts = [
    `"v":2`,
    `"invoice":${jsonString(invoice.invoice_id)}`,
    `"subscription":${jsonString(invoice.subscription_id)}`,
    `"status":${jsonString(invoice.status)}`,
    `"finalized":${invoice.finalized ? "true" : "false"}`,
    `"lines":[${invoice.lines.map(v2Line).join(",")}]`,
    `"subtotal":${invoice.subtotal_cents}`,
    `"discount":${invoice.discount_total_cents ?? 0}`,
    `"total":${invoice.total_cents}`,
    `"captured":${invoice.captured_cents}`,
    `"refunded":${invoice.refunded_cents}`
  ];

  return `{${parts.join(",")}}`;
}
