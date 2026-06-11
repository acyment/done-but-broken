// Invoice generation, line items, totals (I-ROUND, I-TOTALS).

import { assertIntegerCents, mulDivHalfEven } from "./money";
import type { Subscription } from "./subscription";

export type InvoiceLineKind = "plan" | "usage";

export type InvoiceLine = {
  line_id: string;
  kind: InvoiceLineKind;
  description: string;
  amount_cents: number;
};

export type InvoiceStatus = "open" | "paid";

export type Invoice = {
  invoice_id: string;
  subscription_id: string;
  status: InvoiceStatus;
  lines: InvoiceLine[];
  subtotal_cents: number;
  total_cents: number;
  captured_cents: number;
};

export type UsageSeed = {
  line_id: string;
  description: string;
  unit_price_cents: number;
  quantity_milli: number;
};

export function planLine(invoice_id: string, subscription: Subscription): InvoiceLine {
  return {
    line_id: `${invoice_id}-plan`,
    kind: "plan",
    description: `Plan ${subscription.plan_id}`,
    amount_cents: subscription.plan_price_cents
  };
}

// Usage line amounts are rounded half-even at line level (I-ROUND):
// amount = round_half_even(unit_price_cents * quantity_milli / 1000).
export function usageLine(seed: UsageSeed): InvoiceLine {
  assertIntegerCents(seed.unit_price_cents, "usage unit_price_cents");
  assertIntegerCents(seed.quantity_milli, "usage quantity_milli");

  if (seed.quantity_milli < 0) {
    throw new Error("usage quantity_milli must be non-negative");
  }

  return {
    line_id: seed.line_id,
    kind: "usage",
    description: seed.description,
    amount_cents: mulDivHalfEven(seed.unit_price_cents, seed.quantity_milli, 1000)
  };
}

// The invoice total is the sum of rounded line amounts (I-TOTALS).
export function createInvoice(invoice_id: string, subscription_id: string, lines: InvoiceLine[]): Invoice {
  const subtotal = lines.reduce((sum, line) => {
    assertIntegerCents(line.amount_cents, `line ${line.line_id} amount_cents`);

    return sum + line.amount_cents;
  }, 0);

  return {
    invoice_id,
    subscription_id,
    status: "open",
    lines,
    subtotal_cents: subtotal,
    total_cents: subtotal,
    captured_cents: 0
  };
}

export type InvoiceLineView = {
  line_id: string;
  kind: InvoiceLineKind;
  description: string;
  amount_cents: number;
};

export type InvoiceView = {
  invoice_id: string;
  subscription_id: string;
  status: InvoiceStatus;
  lines: InvoiceLineView[];
  subtotal_cents: number;
  total_cents: number;
  captured_cents?: number;
};

// Views use the legacy omits-zero style: zero-valued optional money fields are omitted.
export function invoiceView(invoice: Invoice): InvoiceView {
  return {
    invoice_id: invoice.invoice_id,
    subscription_id: invoice.subscription_id,
    status: invoice.status,
    lines: invoice.lines.map((line) => ({
      line_id: line.line_id,
      kind: line.kind,
      description: line.description,
      amount_cents: line.amount_cents
    })),
    subtotal_cents: invoice.subtotal_cents,
    total_cents: invoice.total_cents,
    ...(invoice.captured_cents > 0 ? { captured_cents: invoice.captured_cents } : {})
  };
}
