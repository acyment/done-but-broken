// Payment-failure dunning (I-STATE extension) and entitlement gating (I-ENTITLE).
// Grace policy: a past_due subscription keeps "grace" entitlement through the second
// failed attempt; from the third attempt entitlement is "none".

import { assertTransition, type Subscription } from "./subscription";

export const GRACE_MAX_ATTEMPTS = 2;

export type Entitlement = "full" | "grace" | "none";

export function recordPaymentFailure(subscription: Subscription, at: string): Subscription {
  if (subscription.status !== "past_due") {
    assertTransition(subscription.status, "past_due");
  }

  return {
    ...subscription,
    status: "past_due",
    dunning: {
      attempts: (subscription.dunning?.attempts ?? 0) + 1,
      entered_at: subscription.dunning?.entered_at ?? at
    }
  };
}

export function resolveDunningOnPaid(subscription: Subscription): Subscription {
  if (subscription.status !== "past_due") {
    return subscription;
  }

  assertTransition(subscription.status, "active");

  return { ...subscription, status: "active", dunning: null };
}

export function entitlementFor(subscription: Subscription): Entitlement {
  if (subscription.status === "canceled") {
    return "none";
  }

  if (subscription.status === "past_due") {
    return (subscription.dunning?.attempts ?? 0) <= GRACE_MAX_ATTEMPTS ? "grace" : "none";
  }

  return "full";
}
