// Subscription-lifecycle and coupon handlers, plus the dispatch switch (invoice and
// payment handlers live in billing-invoice-handlers.ts). Pure functions over an explicit
// immutable state value; money is integer cents; time exists only as ISO timestamps
// carried inside events.

import {
  requireString,
  requireSubscription,
  withSubscription,
  type BillingEvent,
  type BillingState,
  type DispatchOutcome
} from "./billing-types";
import {
  handleInvoiceFinalized,
  handleInvoiceGenerated,
  handleInvoiceRecomputed,
  handlePaymentCaptured,
  handlePaymentFailed,
  handlePaymentRefunded
} from "./billing-invoice-handlers";
import {
  activateSubscription,
  applyPlanChangeNow,
  cancelImmediately,
  createSubscription,
  markCancelAtPeriodEnd,
  renewPeriod,
  scheduleDowngrade
} from "./domain/subscription";
import { prorationLinesForUpgrade } from "./domain/proration";
import { createCouponGrant } from "./domain/coupons";

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

function handleSubscriptionCanceled(state: BillingState, event: BillingEvent): DispatchOutcome {
  const subscription = requireSubscription(state, event.subscription_id);
  const canceled =
    event.mode === "at_period_end" ? markCancelAtPeriodEnd(subscription) : cancelImmediately(subscription);

  return { state: withSubscription(state, canceled), aggregate_id: subscription.subscription_id };
}

export function dispatch(state: BillingState, event: BillingEvent): DispatchOutcome {
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
    case "invoice_finalized":
      return handleInvoiceFinalized(state, event);
    case "invoice_recomputed":
      return handleInvoiceRecomputed(state, event);
    default:
      throw new Error(`Unknown event type ${event.type}`);
  }
}
