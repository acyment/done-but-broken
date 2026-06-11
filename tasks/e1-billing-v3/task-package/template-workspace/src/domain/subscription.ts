// Subscription lifecycle state machine (I-STATE).
// Documented machine: trialing -> active -> past_due -> canceled, with recovery past_due -> active.

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

export type Subscription = {
  subscription_id: string;
  customer_id: string;
  plan_id: string;
  plan_price_cents: number;
  status: SubscriptionStatus;
  period_start: string;
  period_end: string;
};

const ALLOWED_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  trialing: ["active", "canceled"],
  active: ["past_due", "canceled"],
  past_due: ["active", "canceled"],
  canceled: []
};

export function assertTransition(from: SubscriptionStatus, to: SubscriptionStatus): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new Error(`Illegal subscription transition ${from} -> ${to}`);
  }
}

export function createSubscription(input: {
  subscription_id: string;
  customer_id: string;
  plan_id: string;
  plan_price_cents: number;
  period_start: string;
  period_end: string;
  trial: boolean;
}): Subscription {
  if (!Number.isSafeInteger(input.plan_price_cents) || input.plan_price_cents < 0) {
    throw new Error("plan_price_cents must be non-negative integer cents");
  }

  return {
    subscription_id: input.subscription_id,
    customer_id: input.customer_id,
    plan_id: input.plan_id,
    plan_price_cents: input.plan_price_cents,
    status: input.trial ? "trialing" : "active",
    period_start: input.period_start,
    period_end: input.period_end
  };
}

export function activateSubscription(subscription: Subscription): Subscription {
  assertTransition(subscription.status, "active");

  if (subscription.status !== "trialing") {
    throw new Error("Only trialing subscriptions can be activated");
  }

  return { ...subscription, status: "active" };
}
