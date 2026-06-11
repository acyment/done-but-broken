// Engine facade and public API (composition root). State/types live in billing-types.ts,
// per-event handlers in billing-handlers.ts and billing-invoice-handlers.ts; this file
// folds events and answers queries.

import { appendAuditEntry, type AuditEntry } from "./events/audit";
import {
  emptyState,
  requireInvoice,
  requireString,
  requireSubscription,
  type BillingEvent,
  type BillingState,
  type JsonValue,
  type Query,
  type SubscriptionView
} from "./billing-types";
import { dispatch } from "./billing-handlers";
import { invoiceView, type InvoiceView } from "./domain/invoice";
import { entitlementFor, type Entitlement } from "./domain/dunning";
import { serializeInvoiceV1 as renderV1 } from "./api/serializers";

export {
  emptyState,
  type BillingEvent,
  type BillingState,
  type JsonValue,
  type Query,
  type SubscriptionView
};

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
