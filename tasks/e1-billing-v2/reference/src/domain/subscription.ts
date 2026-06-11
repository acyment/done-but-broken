// Subscription lifecycle state machine (I-STATE) and plan-change scheduling (I-SEQ via billing).
// Documented machine: trialing -> active -> past_due -> canceled, with recovery past_due -> active.

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

export type DunningState = {
  attempts: number;
  entered_at: string;
};

export type ScheduledChange = {
  plan_id: string;
  plan_price_cents: number;
};

export type Subscription = {
  subscription_id: string;
  customer_id: string;
  plan_id: string;
  plan_price_cents: number;
  status: SubscriptionStatus;
  period_start: string;
  period_end: string;
  scheduled_change: ScheduledChange | null;
  cancel_at_period_end: boolean;
  dunning: DunningState | null;
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
    period_end: input.period_end,
    scheduled_change: null,
    cancel_at_period_end: false,
    dunning: null
  };
}

export function activateSubscription(subscription: Subscription): Subscription {
  assertTransition(subscription.status, "active");

  if (subscription.status !== "trialing") {
    throw new Error("Only trialing subscriptions can be activated");
  }

  return { ...subscription, status: "active" };
}

// Upgrades change the plan immediately (proration handled by the caller).
export function applyPlanChangeNow(
  subscription: Subscription,
  plan_id: string,
  plan_price_cents: number
): Subscription {
  if (subscription.status !== "active") {
    throw new Error("Plan upgrades require an active subscription");
  }

  return { ...subscription, plan_id, plan_price_cents };
}

// Downgrades are scheduled and take effect at the next period renewal (no proration).
export function scheduleDowngrade(
  subscription: Subscription,
  plan_id: string,
  plan_price_cents: number
): Subscription {
  if (subscription.status !== "active" && subscription.status !== "past_due") {
    throw new Error("Plan downgrades require an active or past_due subscription");
  }

  return { ...subscription, scheduled_change: { plan_id, plan_price_cents } };
}

// Period renewal: applies a pending cancellation first, otherwise the scheduled plan
// change; the billing period always advances. Status is otherwise preserved.
export function renewPeriod(
  subscription: Subscription,
  new_period_start: string,
  new_period_end: string
): Subscription {
  if (subscription.status === "canceled") {
    throw new Error("Cannot renew a canceled subscription");
  }

  if (subscription.cancel_at_period_end) {
    assertTransition(subscription.status, "canceled");

    return {
      ...subscription,
      status: "canceled",
      period_start: new_period_start,
      period_end: new_period_end,
      scheduled_change: null,
      cancel_at_period_end: false,
      dunning: null
    };
  }

  const change = subscription.scheduled_change;

  return {
    ...subscription,
    plan_id: change ? change.plan_id : subscription.plan_id,
    plan_price_cents: change ? change.plan_price_cents : subscription.plan_price_cents,
    period_start: new_period_start,
    period_end: new_period_end,
    scheduled_change: null
  };
}

export function cancelImmediately(subscription: Subscription): Subscription {
  assertTransition(subscription.status, "canceled");

  return {
    ...subscription,
    status: "canceled",
    scheduled_change: null,
    cancel_at_period_end: false,
    dunning: null
  };
}

export function markCancelAtPeriodEnd(subscription: Subscription): Subscription {
  if (subscription.status === "canceled") {
    throw new Error("Cannot schedule cancellation on a canceled subscription");
  }

  return { ...subscription, cancel_at_period_end: true };
}
