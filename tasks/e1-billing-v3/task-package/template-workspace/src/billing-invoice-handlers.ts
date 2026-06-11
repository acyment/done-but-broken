// Invoice and payment handlers. Pure functions over an explicit immutable state value;
// money is integer cents; time exists only as ISO timestamps carried inside events.

import {
  requireInvoice,
  requireString,
  requireSubscription,
  withInvoice,
  type BillingEvent,
  type BillingState,
  type DispatchOutcome
} from "./billing-types";
import { createInvoice, planLine, usageLine, type InvoiceLine } from "./domain/invoice";

export function handleInvoiceGenerated(state: BillingState, event: BillingEvent): DispatchOutcome {
  const subscription = requireSubscription(state, event.subscription_id);
  const invoice_id = requireString(event.invoice_id, "invoice_id");

  if (subscription.status === "canceled" || subscription.status === "trialing") {
    throw new Error(`Cannot invoice a ${subscription.status} subscription`);
  }

  if (state.invoices[invoice_id]) {
    throw new Error(`Invoice ${invoice_id} already exists`);
  }

  const lines: InvoiceLine[] = [planLine(invoice_id, subscription)];

  for (const seed of event.usage ?? []) {
    lines.push(usageLine(seed));
  }

  const invoice = createInvoice(invoice_id, subscription.subscription_id, lines);

  return { state: withInvoice(state, invoice), aggregate_id: invoice_id };
}

export function handlePaymentCaptured(state: BillingState, event: BillingEvent): DispatchOutcome {
  const invoice = requireInvoice(state, event.invoice_id);
  const amount = event.amount_cents ?? 0;

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("capture amount_cents must be positive integer cents");
  }

  if (invoice.captured_cents + amount > invoice.total_cents) {
    throw new Error(`Capture exceeds invoice total on ${invoice.invoice_id}`);
  }

  const captured = invoice.captured_cents + amount;
  const paid = captured === invoice.total_cents;
  const next = withInvoice(state, { ...invoice, captured_cents: captured, status: paid ? "paid" : invoice.status });

  return { state: next, aggregate_id: invoice.invoice_id };
}
