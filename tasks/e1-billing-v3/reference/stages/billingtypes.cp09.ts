// Engine state, event/query types, and shared guards (kept separate from the facade so
// every source file stays small enough to rewrite whole in one protocol turn).

import type { AuditMap } from "./events/audit";
import type { Subscription } from "./domain/subscription";
import type { Invoice, InvoiceLine, UsageSeed } from "./domain/invoice";
import type { CouponGrant, CouponKind } from "./domain/coupons";

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
  kind: "subscription" | "invoice" | "serialize_v1" | "audit_log" | "replay_hash";
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

export type DispatchOutcome = { state: BillingState; aggregate_id: string } | null;

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

export function requireSubscription(state: BillingState, subscription_id: string | undefined): Subscription {
  const subscription = subscription_id ? state.subscriptions[subscription_id] : undefined;

  if (!subscription) {
    throw new Error(`Unknown subscription ${String(subscription_id)}`);
  }

  return subscription;
}

export function requireInvoice(state: BillingState, invoice_id: string | undefined): Invoice {
  const invoice = invoice_id ? state.invoices[invoice_id] : undefined;

  if (!invoice) {
    throw new Error(`Unknown invoice ${String(invoice_id)}`);
  }

  return invoice;
}

export function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }

  return value;
}

export function withSubscription(state: BillingState, subscription: Subscription): BillingState {
  return {
    ...state,
    subscriptions: { ...state.subscriptions, [subscription.subscription_id]: subscription }
  };
}

export function withInvoice(state: BillingState, invoice: Invoice): BillingState {
  return { ...state, invoices: { ...state.invoices, [invoice.invoice_id]: invoice } };
}
