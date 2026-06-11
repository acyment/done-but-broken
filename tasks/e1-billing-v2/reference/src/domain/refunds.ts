// Partial refunds with the refund cap (I-REFCAP): cumulative refunds never exceed the
// captured amount on an invoice. Refund amounts are allocated across the invoice's
// positive lines by remaining refundable net (amount - discount - already refunded)
// using the largest-remainder method (I-ALLOC).

import { allocateLargestRemainder, assertIntegerCents } from "./money";
import type { Invoice } from "./invoice";

// Returns the updated invoice, or null when the refund would exceed the cap; a rejected
// refund is a complete no-op for the engine (no state change, no audit entry).
export function applyRefund(invoice: Invoice, amount_cents: number): Invoice | null {
  assertIntegerCents(amount_cents, "refund amount_cents");

  if (amount_cents <= 0) {
    throw new Error("refund amount_cents must be positive");
  }

  if (invoice.refunded_cents + amount_cents > invoice.captured_cents) {
    return null;
  }

  const positiveIndexes = invoice.lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.amount_cents > 0);
  const weights = positiveIndexes.map(({ line }) =>
    Math.max(0, line.amount_cents - line.discount_cents - line.refunded_cents)
  );

  if (weights.reduce((sum, weight) => sum + weight, 0) <= 0) {
    throw new Error("refund has no refundable lines to allocate against");
  }

  const shares = allocateLargestRemainder(amount_cents, weights);
  const lines = invoice.lines.map((line) => ({ ...line }));

  positiveIndexes.forEach(({ index }, position) => {
    lines[index].refunded_cents += shares[position];
  });

  return {
    ...invoice,
    lines,
    refunded_cents: invoice.refunded_cents + amount_cents
  };
}
