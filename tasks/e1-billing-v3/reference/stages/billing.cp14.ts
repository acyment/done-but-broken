// Engine facade and public API (composition root). State/types live in billing-types.ts,
// per-event handlers in billing-handlers.ts and billing-invoice-handlers.ts; this file
// folds events and answers queries.

import { appendAuditRecords, canonicalizeState, fnv1aHex, type AuditEntry, type FeedEntry } from "./events/audit";
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

// Duplicate event ids are complete no-ops (I-IDEM): no state change, no audit entry, no
// feed entry. Every applied event appends exactly one audit entry to its aggregate
// (I-SEQ) and one entry to the global feed.
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

  const records = appendAuditRecords(outcome.state.audit, outcome.state.feed, outcome.aggregate_id, event);

  return {
    ...outcome.state,
    audit: records.audit,
    feed: records.feed,
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

// Global chronological audit feed (CP13): entries in application order with feed_seq
// starting at 1; supports after_feed_seq, limit, and event-type filtering. The filter
// applies before the limit; feed_seq values are preserved, never renumbered.
export function auditFeed(
  state: BillingState,
  options: { after_feed_seq?: number; limit?: number; event_types?: string[] }
): FeedEntry[] {
  let entries = state.feed;

  if (options.after_feed_seq !== undefined) {
    entries = entries.filter((entry) => entry.feed_seq > options.after_feed_seq!);
  }

  if (options.event_types !== undefined) {
    entries = entries.filter((entry) => options.event_types!.includes(entry.event_type));
  }

  if (options.limit !== undefined) {
    if (!Number.isSafeInteger(options.limit) || options.limit < 1) {
      throw new Error("audit_feed limit must be a positive integer");
    }

    entries = entries.slice(0, options.limit);
  }

  return entries;
}

// Replaying the event log reproduces the canonical state hash (I-REPLAY). The hash is
// FNV-1a 32-bit over the canonical registry rendering — see src/events/audit.ts.
export function replayStateHash(events: BillingEvent[]): string {
  return fnv1aHex(canonicalizeState(applyEvents(emptyState(), events)));
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
    case "audit_feed":
      return auditFeed(state, {
        after_feed_seq: query.after_feed_seq,
        limit: query.limit,
        event_types: query.event_types
      }) as JsonValue;
    case "replay_hash":
      return replayStateHash(events);
    default:
      throw new Error(`Unknown query kind ${String(query.kind)}`);
  }
}
