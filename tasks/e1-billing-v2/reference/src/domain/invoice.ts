// Invoice generation, line items, totals (I-ROUND, I-TOTALS), discount application
// (I-ALLOC via money.allocateLargestRemainder), finalization (I-IMMUT).

import { allocateLargestRemainder, assertIntegerCents, mulDivHalfEven } from "./money";
import type { Subscription } from "./subscription";

export type InvoiceLineKind = "plan" | "usage" | "proration_credit" | "proration_charge";

export type InvoiceLine = {
  line_id: string;
  kind: InvoiceLineKind;
  description: string;
  amount_cents: number;
  discount_cents: number;
  refunded_cents: number;
};

export type InvoiceStatus = "open" | "paid";

export type Invoice = {
  invoice_id: string;
  subscription_id: string;
  status: InvoiceStatus;
  finalized: boolean;
  lines: InvoiceLine[];
  subtotal_cents: number;
  discount_total_cents: number;
  total_cents: number;
  captured_cents: number;
  refunded_cents: number;
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
    amount_cents: subscription.plan_price_cents,
    discount_cents: 0,
    refunded_cents: 0
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
    amount_cents: mulDivHalfEven(seed.unit_price_cents, seed.quantity_milli, 1000),
    discount_cents: 0,
    refunded_cents: 0
  };
}

// The invoice total is the sum of rounded line amounts minus the discount (I-TOTALS).
export function createInvoice(invoice_id: string, subscription_id: string, lines: InvoiceLine[]): Invoice {
  const subtotal = lines.reduce((sum, line) => {
    assertIntegerCents(line.amount_cents, `line ${line.line_id} amount_cents`);

    return sum + line.amount_cents;
  }, 0);

  return {
    invoice_id,
    subscription_id,
    status: "open",
    finalized: false,
    lines,
    subtotal_cents: subtotal,
    discount_total_cents: 0,
    total_cents: subtotal,
    captured_cents: 0,
    refunded_cents: 0
  };
}

// Allocates a discount total across positive lines by amount weight using the
// largest-remainder method (I-ALLOC). Credits (negative lines) receive no discount.
export function applyDiscount(invoice: Invoice, discount_total_cents: number): Invoice {
  assertIntegerCents(discount_total_cents, "discount_total_cents");

  if (discount_total_cents < 0) {
    throw new Error("discount_total_cents must be non-negative");
  }

  if (discount_total_cents === 0) {
    return invoice;
  }

  const positiveIndexes = invoice.lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.amount_cents > 0);
  const shares = allocateLargestRemainder(
    discount_total_cents,
    positiveIndexes.map(({ line }) => line.amount_cents)
  );
  const lines = invoice.lines.map((line) => ({ ...line }));

  positiveIndexes.forEach(({ index }, position) => {
    lines[index].discount_cents = shares[position];
  });

  return {
    ...invoice,
    lines,
    discount_total_cents,
    total_cents: invoice.subtotal_cents - discount_total_cents
  };
}

export function finalizeInvoice(invoice: Invoice): Invoice {
  if (invoice.finalized) {
    throw new Error(`Invoice ${invoice.invoice_id} is already finalized`);
  }

  return { ...invoice, finalized: true };
}

export type InvoiceLineView = {
  line_id: string;
  kind: InvoiceLineKind;
  description: string;
  amount_cents: number;
  discount_cents?: number;
  refunded_cents?: number;
};

export type InvoiceView = {
  invoice_id: string;
  subscription_id: string;
  status: InvoiceStatus;
  finalized?: boolean;
  lines: InvoiceLineView[];
  subtotal_cents: number;
  discount_cents?: number;
  total_cents: number;
  captured_cents?: number;
  refunded_cents?: number;
};

// Views use the legacy omits-zero style: zero-valued optional money fields and a false
// finalized flag are omitted entirely.
export function invoiceView(invoice: Invoice): InvoiceView {
  return {
    invoice_id: invoice.invoice_id,
    subscription_id: invoice.subscription_id,
    status: invoice.status,
    ...(invoice.finalized ? { finalized: true } : {}),
    lines: invoice.lines.map((line) => ({
      line_id: line.line_id,
      kind: line.kind,
      description: line.description,
      amount_cents: line.amount_cents,
      ...(line.discount_cents > 0 ? { discount_cents: line.discount_cents } : {}),
      ...(line.refunded_cents > 0 ? { refunded_cents: line.refunded_cents } : {})
    })),
    subtotal_cents: invoice.subtotal_cents,
    ...(invoice.discount_total_cents > 0 ? { discount_cents: invoice.discount_total_cents } : {}),
    total_cents: invoice.total_cents,
    ...(invoice.captured_cents > 0 ? { captured_cents: invoice.captured_cents } : {}),
    ...(invoice.refunded_cents > 0 ? { refunded_cents: invoice.refunded_cents } : {})
  };
}
