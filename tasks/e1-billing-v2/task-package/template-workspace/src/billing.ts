// Engine facade and public API (composition root). Pure functions over an explicit
// immutable state value; money is integer cents; time exists only as ISO timestamps
// carried inside events.

import { appendAuditEntry, type AuditEntry, type AuditMap } from "./events/audit";
import {
  activateSubscription,
  createSubscription,
  type Subscription
} from "./domain/subscription";
import {
  createInvoice,
  invoiceView,
  planLine,
  usageLine,
  type Invoice,
  type InvoiceLine,
  type InvoiceView,
  type UsageSeed
} from "./domain/invoice";
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
};

export type BillingState = {
  subscriptions: Record<string, Subscription>;
  invoices: Record<string, Invoice>;
  audit: AuditMap;
  applied_event_ids: Record<string, true>;
};

export type Query = {
  kind: "subscription" | "invoice" | "serialize_v1" | "audit_log";
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

  const lines: InvoiceLine[] = [planLine(invoice_id, subscription)];

  for (const seed of event.usage ?? []) {
    lines.push(usageLine(seed));
  }

  const invoice = createInvoice(invoice_id, subscription.subscription_id, lines);

  return { state: withInvoice(state, invoice), aggregate_id: invoice_id };
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
  const next = withInvoice(state, { ...invoice, captured_cents: captured, status: paid ? "paid" : invoice.status });

  return { state: next, aggregate_id: invoice.invoice_id };
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
    default:
      throw new Error(`Unknown event type ${event.type}`);
  }
}

// Duplicate event ids are complete no-ops (I-IDEM): no state change and no audit entry.
// Every applied event appends exactly one audit entry to its aggregate (I-SEQ).
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
    case "serialize_v1":
      return serializeInvoiceV1(state, requireString(query.invoice_id, "invoice_id"));
    case "audit_log":
      return auditLog(state, requireString(query.aggregate_id, "aggregate_id")) as JsonValue;
    default:
      throw new Error(`Unknown query kind ${String(query.kind)}`);
  }
}
