// Subscription-lifecycle handlers, plus the dispatch switch (invoice and payment handlers
// live in billing-invoice-handlers.ts). Pure functions over an explicit immutable state
// value; money is integer cents; time exists only as ISO timestamps carried inside events.

import {
  requireString,
  requireSubscription,
  withSubscription,
  type BillingEvent,
  type BillingState,
  type DispatchOutcome
} from "./billing-types";
import { handleInvoiceGenerated, handlePaymentCaptured } from "./billing-invoice-handlers";
import { activateSubscription, createSubscription } from "./domain/subscription";

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
    default:
      throw new Error(`Unknown event type ${event.type}`);
  }
}
