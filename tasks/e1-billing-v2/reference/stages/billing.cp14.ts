// Engine facade and public API (composition root). Pure functions over an explicit
// immutable state value; money is integer cents; time exists only as ISO timestamps
// carried inside events.

import { appendAuditEntry, type AuditEntry, type AuditMap } from "./events/audit";
import {
  activateSubscription,
  applyPlanChangeNow,
  cancelImmediately,
  createSubscription,
  markCancelAtPeriodEnd,
  renewPeriod,
  scheduleDowngrade,
  type Subscription
} from "./domain/subscription";
import {
  applyDiscount,
  createInvoice,
  invoiceView,
  planLine,
  usageLine,
  type Invoice,
  type InvoiceLine,
  type InvoiceView,
  type UsageSeed
} from "./domain/invoice";
import { prorationLinesForUpgrade } from "./domain/proration";
import {
  computeDiscountTotal,
  consumeCouponUse,
  createCouponGrant,
  type CouponGrant,
  type CouponKind
} from "./domain/coupons";
import { applyRefund } from "./domain/refunds";
import { entitlementFor, recordPaymentFailure, resolveDunningOnPaid, type Entitlement } from "./domain/dunning";
import { serializeInvoiceV1 as renderV1 } from "./api/serializers";

export type BillingEvent = {
  event_id: string;
  type: string;
  at: string;
  subscription_id?: string;
  invoice_id?: string;
  customer_id?: string;
  plan_id?: string;
  plan_price_cents?: number;
  period_start?: string;
  period_end?: string;
  trial?: boolean;
  usage?: UsageSeed[];
  amount_cents?: number;
  new_plan_id?: string;
  new_plan_price_cents?: number;
  remaining_days?: number;
  period_days?: number;
  new_period_start?: string;
  new_period_end?: string;
  coupon_id?: string;
  coupon_kind?: CouponKind;
  percent_bp?: number;
  duration_invoices?: number;
  mode?: "immediate" | "at_period_end";
};

export type BillingState = {
  subscriptions: Record<string, Subscription>;
  invoices: Record<string, Invoice>;
  coupons: Record<string, CouponGrant[]>;
  pending_prorations: Record<string, InvoiceLine[]>;
  audit: AuditMap;
  applied_event_ids: Record<string, true>;
};

export type Query = {
  kind: "subscription" | "invoice" | "entitlement" | "serialize_v1" | "audit_log";
  subscription_id?: string;
  invoice_id?: string;
  aggregate_id?: string;
};

export type SubscriptionView = {
  subscription_id: string;
  customer_id: string;
  plan_id: string;
  plan_price_cents: number;
  status: Subscription["status"];
  period_start: string;
  period_end: string;
};

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export function emptyState(): BillingState {
  return {
    subscriptions: {},
    invoices: {},
    coupons: {},
    pending_prorations: {},
    audit: {},
    applied_event_ids: {}
  };
}

type DispatchOutcome = { state: BillingState; aggregate_id: string } | null;

function requireSubscription(state: BillingState, subscription_id: string | undefined): Subscription {
  const subscription = subscription_id ? state.subscriptions[subscription_id] : undefined;

  if (!subscription) {
    throw new Error(`Unknown subscription ${String(subscription_id)}`);
  }

  return subscription;
}

function requireInvoice(state: BillingState, invoice_id: string | undefined): Invoice {
  const invoice = invoice_id ? state.invoices[invoice_id] : undefined;

  if (!invoice) {
    throw new Error(`Unknown invoice ${String(invoice_id)}`);
  }

  return invoice;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }

  return value;
}

function withSubscription(state: BillingState, subscription: Subscription): BillingState {
  return {
    ...state,
    subscriptions: { ...state.subscriptions, [subscription.subscription_id]: subscription }
  };
}

function withInvoice(state: BillingState, invoice: Invoice): BillingState {
  return { ...state, invoices: { ...state.invoices, [invoice.invoice_id]: invoice } };
}

function buildInvoiceLines(state: BillingState, subscription: Subscription, event: BillingEvent): InvoiceLine[] {
  const lines: InvoiceLine[] = [planLine(requireString(event.invoice_id, "invoice_id"), subscription)];

  for (const seed of event.usage ?? []) {
    lines.push(usageLine(seed));
  }

  lines.push(...(state.pending_prorations[subscription.subscription_id] ?? []));

  return lines;
}

function handleSubscriptionCreated(state: BillingState, event: BillingEvent): DispatchOutcome {
  const subscription_id = requireString(event.subscription_id, "subscription_id");

  if (state.subscriptions[subscription_id]) {
    throw new Error(`Subscription ${subscription_id} already exists`);
  }

  const subscription = createSubscription({
    subscription_id,
    customer_id: requireString(event.customer_id, "customer_id"),
    plan_id: requireString(event.plan_id, "plan_id"),
    plan_price_cents: event.plan_price_cents ?? 0,
    period_start: requireString(event.period_start, "period_start"),
    period_end: requireString(event.period_end, "period_end"),
    trial: event.trial === true
  });

  return { state: withSubscription(state, subscription), aggregate_id: subscription_id };
}

function handleSubscriptionActivated(state: BillingState, event: BillingEvent): DispatchOutcome {
  const subscription = requireSubscription(state, event.subscription_id);

  return {
    state: withSubscription(state, activateSubscription(subscription)),
    aggregate_id: subscription.subscription_id
  };
}

function handleInvoiceGenerated(state: BillingState, event: BillingEvent): DispatchOutcome {
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

function handlePaymentCaptured(state: BillingState, event: BillingEvent): DispatchOutcome {
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

function handlePlanUpgraded(state: BillingState, event: BillingEvent): DispatchOutcome {
  const subscription = requireSubscription(state, event.subscription_id);
  const lines = prorationLinesForUpgrade({
    event_id: event.event_id,
    old_plan_id: subscription.plan_id,
    old_plan_price_cents: subscription.plan_price_cents,
    new_plan_id: requireString(event.new_plan_id, "new_plan_id"),
    new_plan_price_cents: event.new_plan_price_cents ?? 0,
    remaining_days: event.remaining_days ?? 0,
    period_days: event.period_days ?? 0
  });
  const upgraded = applyPlanChangeNow(
    subscription,
    requireString(event.new_plan_id, "new_plan_id"),
    event.new_plan_price_cents ?? 0
  );
  const pending = state.pending_prorations[subscription.subscription_id] ?? [];

  return {
    state: {
      ...withSubscription(state, upgraded),
      pending_prorations: {
        ...state.pending_prorations,
        [subscription.subscription_id]: [...pending, ...lines]
      }
    },
    aggregate_id: subscription.subscription_id
  };
}

function handlePlanDowngraded(state: BillingState, event: BillingEvent): DispatchOutcome {
  const subscription = requireSubscription(state, event.subscription_id);
  const downgraded = scheduleDowngrade(
    subscription,
    requireString(event.new_plan_id, "new_plan_id"),
    event.new_plan_price_cents ?? 0
  );

  return { state: withSubscription(state, downgraded), aggregate_id: subscription.subscription_id };
}

function handlePeriodRenewed(state: BillingState, event: BillingEvent): DispatchOutcome {
  const subscription = requireSubscription(state, event.subscription_id);
  const renewed = renewPeriod(
    subscription,
    requireString(event.new_period_start, "new_period_start"),
    requireString(event.new_period_end, "new_period_end")
  );

  return { state: withSubscription(state, renewed), aggregate_id: subscription.subscription_id };
}

function handleCouponApplied(state: BillingState, event: BillingEvent): DispatchOutcome {
  const subscription = requireSubscription(state, event.subscription_id);

  if (subscription.status === "canceled") {
    throw new Error("Cannot apply a coupon to a canceled subscription");
  }

  const grant = createCouponGrant({
    coupon_id: requireString(event.coupon_id, "coupon_id"),
    kind: event.coupon_kind === "fixed" ? "fixed" : "percent",
    percent_bp: event.percent_bp,
    amount_cents: event.amount_cents,
    duration_invoices: event.duration_invoices ?? 0
  });
  const grants = state.coupons[subscription.subscription_id] ?? [];

  return {
    state: {
      ...state,
      coupons: { ...state.coupons, [subscription.subscription_id]: [...grants, grant] }
    },
    aggregate_id: subscription.subscription_id
  };
}

function handlePaymentRefunded(state: BillingState, event: BillingEvent): DispatchOutcome {
  const invoice = requireInvoice(state, event.invoice_id);
  const refunded = applyRefund(invoice, event.amount_cents ?? 0);

  if (refunded === null) {
    return null;
  }

  return { state: withInvoice(state, refunded), aggregate_id: invoice.invoice_id };
}

function handlePaymentFailed(state: BillingState, event: BillingEvent): DispatchOutcome {
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

function handleSubscriptionCanceled(state: BillingState, event: BillingEvent): DispatchOutcome {
  const subscription = requireSubscription(state, event.subscription_id);
  const canceled =
    event.mode === "at_period_end" ? markCancelAtPeriodEnd(subscription) : cancelImmediately(subscription);

  return { state: withSubscription(state, canceled), aggregate_id: subscription.subscription_id };
}

function dispatch(state: BillingState, event: BillingEvent): DispatchOutcome {
  switch (event.type) {
    case "subscription_created":
      return handleSubscriptionCreated(state, event);
    case "subscription_activated":
      return handleSubscriptionActivated(state, event);
    case "invoice_generated":
      return handleInvoiceGenerated(state, event);
    case "payment_captured":
      return handlePaymentCaptured(state, event);
    case "plan_upgraded":
      return handlePlanUpgraded(state, event);
    case "plan_downgraded":
      return handlePlanDowngraded(state, event);
    case "period_renewed":
      return handlePeriodRenewed(state, event);
    case "coupon_applied":
      return handleCouponApplied(state, event);
    case "payment_refunded":
      return handlePaymentRefunded(state, event);
    case "payment_failed":
      return handlePaymentFailed(state, event);
    case "subscription_canceled":
      return handleSubscriptionCanceled(state, event);
    default:
      throw new Error(`Unknown event type ${event.type}`);
  }
}

// Duplicate event ids are complete no-ops for every event type (I-IDEM, generalized at
// CP18): no state change and no audit entry. Every applied event appends exactly one
// audit entry to its aggregate (I-SEQ).
export function applyEvent(state: BillingState, event: BillingEvent): BillingState {
  requireString(event.event_id, "event_id");
  requireString(event.type, "type");
  requireString(event.at, "at");

  if (state.applied_event_ids[event.event_id]) {
    return state;
  }

  const outcome = dispatch(state, event);

  if (outcome === null) {
    return state;
  }

  return {
    ...outcome.state,
    audit: appendAuditEntry(outcome.state.audit, outcome.aggregate_id, event),
    applied_event_ids: { ...outcome.state.applied_event_ids, [event.event_id]: true }
  };
}

// Deprecated wrapper kept for legacy callers; it must keep working. The engine itself
// folds through it.
export function applyEvents(state: BillingState, events: BillingEvent[]): BillingState {
  return events.reduce(applyEvent, state);
}

export function getSubscription(state: BillingState, subscription_id: string): SubscriptionView {
  const subscription = requireSubscription(state, subscription_id);

  return {
    subscription_id: subscription.subscription_id,
    customer_id: subscription.customer_id,
    plan_id: subscription.plan_id,
    plan_price_cents: subscription.plan_price_cents,
    status: subscription.status,
    period_start: subscription.period_start,
    period_end: subscription.period_end
  };
}

export function getInvoice(state: BillingState, invoice_id: string): InvoiceView {
  return invoiceView(requireInvoice(state, invoice_id));
}

export function getEntitlement(state: BillingState, subscription_id: string): Entitlement {
  return entitlementFor(requireSubscription(state, subscription_id));
}

export function serializeInvoiceV1(state: BillingState, invoice_id: string): string {
  return renderV1(requireInvoice(state, invoice_id));
}

export function auditLog(state: BillingState, aggregate_id: string): AuditEntry[] {
  return state.audit[aggregate_id] ?? [];
}

// Single oracle/spec entry point: fold the events, answer one query.
export function evaluate(events: BillingEvent[], query: Query): JsonValue {
  const state = applyEvents(emptyState(), events);

  switch (query.kind) {
    case "subscription":
      return getSubscription(state, requireString(query.subscription_id, "subscription_id")) as JsonValue;
    case "invoice":
      return getInvoice(state, requireString(query.invoice_id, "invoice_id")) as JsonValue;
    case "entitlement":
      return getEntitlement(state, requireString(query.subscription_id, "subscription_id"));
    case "serialize_v1":
      return serializeInvoiceV1(state, requireString(query.invoice_id, "invoice_id"));
    case "audit_log":
      return auditLog(state, requireString(query.aggregate_id, "aggregate_id")) as JsonValue;
    default:
      throw new Error(`Unknown query kind ${String(query.kind)}`);
  }
}
