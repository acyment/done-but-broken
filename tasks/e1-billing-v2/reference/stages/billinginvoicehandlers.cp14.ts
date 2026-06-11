// Invoice and payment handlers. Pure functions over an explicit immutable state value;
// money is integer cents; time exists only as ISO timestamps carried inside events.

import {
  requireInvoice,
  requireString,
  requireSubscription,
  withInvoice,
  withSubscription,
  type BillingEvent,
  type BillingState,
  type DispatchOutcome
} from "./billing-types";
import type { Subscription } from "./domain/subscription";
import { applyDiscount, createInvoice, planLine, usageLine, type InvoiceLine } from "./domain/invoice";
import { computeDiscountTotal, consumeCouponUse } from "./domain/coupons";
import { applyRefund } from "./domain/refunds";
import { recordPaymentFailure, resolveDunningOnPaid } from "./domain/dunning";

function buildInvoiceLines(state: BillingState, subscription: Subscription, event: BillingEvent): InvoiceLine[] {
  const lines: InvoiceLine[] = [planLine(requireString(event.invoice_id, "invoice_id"), subscription)];

  for (const seed of event.usage ?? []) {
    lines.push(usageLine(seed));
  }

  lines.push(...(state.pending_prorations[subscription.subscription_id] ?? []));

  return lines;
}

export function handleInvoiceGenerated(state: BillingState, event: BillingEvent): DispatchOutcome {
  const subscription = requireSubscription(state, event.subscription_id);
  const invoice_id = requireString(event.invoice_id, "invoice_id");

  if (subscription.status === "canceled" || subscription.status === "trialing") {
    throw new Error(`Cannot invoice a ${subscription.status} subscription`);
  }

  if (state.invoices[invoice_id]) {
    throw new Error(`Invoice ${invoice_id} already exists`);
  }

  const grants = state.coupons[subscription.subscription_id] ?? [];
  let invoice = createInvoice(invoice_id, subscription.subscription_id, buildInvoiceLines(state, subscription, event));
  invoice = applyDiscount(invoice, computeDiscountTotal(invoice.subtotal_cents, grants));

  return {
    state: {
      ...withInvoice(state, invoice),
      pending_prorations: { ...state.pending_prorations, [subscription.subscription_id]: [] },
      coupons: { ...state.coupons, [subscription.subscription_id]: consumeCouponUse(grants) }
    },
    aggregate_id: invoice_id
  };
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
  let next = withInvoice(state, { ...invoice, captured_cents: captured, status: paid ? "paid" : invoice.status });
  const subscription = next.subscriptions[invoice.subscription_id];

  if (paid && subscription && subscription.status === "past_due") {
    next = withSubscription(next, resolveDunningOnPaid(subscription));
  }

  return { state: next, aggregate_id: invoice.invoice_id };
}

export function handlePaymentRefunded(state: BillingState, event: BillingEvent): DispatchOutcome {
  const invoice = requireInvoice(state, event.invoice_id);
  const refunded = applyRefund(invoice, event.amount_cents ?? 0);

  if (refunded === null) {
    return null;
  }

  return { state: withInvoice(state, refunded), aggregate_id: invoice.invoice_id };
}

export function handlePaymentFailed(state: BillingState, event: BillingEvent): DispatchOutcome {
  const invoice = requireInvoice(state, event.invoice_id);

  if (invoice.status === "paid") {
    throw new Error(`Cannot fail a paid invoice ${invoice.invoice_id}`);
  }

  const subscription = requireSubscription(state, invoice.subscription_id);

  return {
    state: withSubscription(state, recordPaymentFailure(subscription, event.at)),
    aggregate_id: invoice.invoice_id
  };
}
