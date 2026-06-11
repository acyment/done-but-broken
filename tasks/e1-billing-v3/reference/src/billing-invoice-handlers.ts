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
import {
  applyDiscount,
  createInvoice,
  finalizeInvoice,
  planLine,
  usageLine,
  type InvoiceLine
} from "./domain/invoice";
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

export function handleInvoiceFinalized(state: BillingState, event: BillingEvent): DispatchOutcome {
  const invoice = requireInvoice(state, event.invoice_id);

  return { state: withInvoice(state, finalizeInvoice(invoice)), aggregate_id: invoice.invoice_id };
}

// Recompute reprices an invoice from current subscription/coupon state: the plan line is
// rebuilt at the current plan price, non-plan lines are kept, and current coupons are
// reapplied without consuming uses. A finalized invoice is immutable (I-IMMUT): its
// recomputation writes a brand-new open document at new_invoice_id instead.
export function handleInvoiceRecomputed(state: BillingState, event: BillingEvent): DispatchOutcome {
  const original = requireInvoice(state, event.invoice_id);

  if (original.refunded_cents > 0) {
    throw new Error(`Cannot recompute refunded invoice ${original.invoice_id}`);
  }

  const subscription = requireSubscription(state, original.subscription_id);
  const grants = state.coupons[subscription.subscription_id] ?? [];
  const target_id = original.finalized
    ? requireString(event.new_invoice_id, "new_invoice_id")
    : original.invoice_id;

  if (original.finalized && state.invoices[target_id]) {
    throw new Error(`Invoice ${target_id} already exists`);
  }

  const lines: InvoiceLine[] = [
    planLine(target_id, subscription),
    ...original.lines
      .filter((line) => line.kind !== "plan")
      .map((line) => ({ ...line, discount_cents: 0, refunded_cents: 0 }))
  ];
  let recomputed = createInvoice(target_id, subscription.subscription_id, lines);
  recomputed = applyDiscount(recomputed, computeDiscountTotal(recomputed.subtotal_cents, grants));

  if (!original.finalized) {
    const captured = original.captured_cents;
    recomputed = {
      ...recomputed,
      captured_cents: captured,
      status: captured >= recomputed.total_cents && captured > 0 ? "paid" : "open"
    };
  }

  return { state: withInvoice(state, recomputed), aggregate_id: original.invoice_id };
}
