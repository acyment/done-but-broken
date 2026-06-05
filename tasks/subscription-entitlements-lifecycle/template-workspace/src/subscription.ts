type Invoice = {
  id: string;
  eventId: string;
  amount: number;
  status: "paid" | "refunded" | "chargeback";
};

type SubscriptionState = {
  processedEventIds?: string[];
  events?: unknown[];
  status?: string;
  plan?: string;
  trialEnd?: string;
  currentPeriodEnd?: string;
  graceEndsAt?: string;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string;
  lastPaymentFailureAt?: string;
  paymentFailureCount?: number;
  suspended?: boolean;
  restricted?: boolean;
  nextPlan?: string;
  downgradeEffectiveAt?: string;
  invoices?: Invoice[];
};

const PLAN_FEATURES: Record<string, string[]> = {
  trial: ["core"],
  basic: ["core"],
  pro: ["core", "analytics", "exports"]
};

export function applyEvent(state: SubscriptionState = {}, event: any): SubscriptionState {
  const next = cloneState(state);

  if (!event || typeof event.id !== "string" || event.id.length === 0) {
    return next;
  }

  if ((next.processedEventIds ?? []).includes(event.id)) {
    return next;
  }

  next.processedEventIds = [...(next.processedEventIds ?? []), event.id];
  next.events = [...(next.events ?? []), event];

  if (event.type === "trial_started") {
    next.status = "trialing";
    next.plan = event.plan ?? "trial";
    next.trialEnd = event.trialEnd;
  } else if (event.type === "payment_succeeded" || event.type === "retry_succeeded") {
    next.status = next.suspended ? "suspended" : "active";
    next.restricted = false;
    next.cancelAtPeriodEnd = false;
    next.graceEndsAt = undefined;
    next.plan = event.plan ?? next.plan ?? "pro";
    next.currentPeriodEnd = event.currentPeriodEnd ?? next.currentPeriodEnd;
    recordPaidInvoice(next, event);
  } else if (event.type === "cancel_at_period_end") {
    next.cancelAtPeriodEnd = true;
    next.canceledAt = event.canceledAt;
    if (!next.suspended && !next.restricted) {
      next.status = "canceling";
    }
  } else if (event.type === "payment_failed") {
    next.status = next.suspended ? "suspended" : "past_due";
    next.lastPaymentFailureAt = event.failedAt;
    next.paymentFailureCount = (next.paymentFailureCount ?? 0) + 1;
    next.graceEndsAt = event.graceEndsAt;
  } else if (event.type === "fraud_suspended") {
    next.suspended = true;
    next.status = "suspended";
  } else if (event.type === "downgrade_scheduled") {
    next.nextPlan = event.nextPlan;
    next.downgradeEffectiveAt = event.effectiveAt;
  } else if (event.type === "refund" || event.type === "chargeback") {
    next.restricted = true;
    next.status = "restricted";
    recordReversalInvoice(next, event);
  }

  return next;
}

export function canAccessFeature(
  state: SubscriptionState = {},
  feature: string,
  now: string
): boolean {
  const status = getBillingStatus(state, now);

  if (!["trialing", "active", "canceling", "past_due"].includes(status.status)) {
    return false;
  }

  return planFeatures(status.plan).includes(feature);
}

export function getBillingStatus(state: SubscriptionState = {}, now: string) {
  const plan = effectivePlan(state, now);

  if (state.restricted) {
    return {
      status: "restricted",
      plan,
      trialEnd: state.trialEnd,
      currentPeriodEnd: state.currentPeriodEnd,
      graceEndsAt: state.graceEndsAt,
      nextPlan: state.nextPlan,
      downgradeEffectiveAt: state.downgradeEffectiveAt
    };
  }

  if (state.suspended) {
    return {
      status: "suspended",
      plan,
      trialEnd: state.trialEnd,
      currentPeriodEnd: state.currentPeriodEnd,
      graceEndsAt: state.graceEndsAt,
      nextPlan: state.nextPlan,
      downgradeEffectiveAt: state.downgradeEffectiveAt
    };
  }

  if (state.status === "trialing") {
    return {
      status: isBefore(now, state.trialEnd) ? "trialing" : "inactive",
      plan,
      trialEnd: state.trialEnd,
      currentPeriodEnd: state.currentPeriodEnd,
      graceEndsAt: state.graceEndsAt,
      nextPlan: state.nextPlan,
      downgradeEffectiveAt: state.downgradeEffectiveAt
    };
  }

  if (state.status === "past_due") {
    return {
      status: isBefore(now, state.graceEndsAt) ? "past_due" : "inactive",
      plan,
      trialEnd: state.trialEnd,
      currentPeriodEnd: state.currentPeriodEnd,
      graceEndsAt: state.graceEndsAt,
      nextPlan: state.nextPlan,
      downgradeEffectiveAt: state.downgradeEffectiveAt
    };
  }

  if (state.cancelAtPeriodEnd) {
    return {
      status: isBefore(now, state.currentPeriodEnd) ? "canceling" : "inactive",
      plan,
      trialEnd: state.trialEnd,
      currentPeriodEnd: state.currentPeriodEnd,
      graceEndsAt: state.graceEndsAt,
      nextPlan: state.nextPlan,
      downgradeEffectiveAt: state.downgradeEffectiveAt
    };
  }

  if (state.status === "active" || state.status === "canceling") {
    return {
      status: isBefore(now, state.currentPeriodEnd) ? "active" : "inactive",
      plan,
      trialEnd: state.trialEnd,
      currentPeriodEnd: state.currentPeriodEnd,
      graceEndsAt: state.graceEndsAt,
      nextPlan: state.nextPlan,
      downgradeEffectiveAt: state.downgradeEffectiveAt
    };
  }

  return {
    status: "inactive",
    plan,
    trialEnd: state.trialEnd,
    currentPeriodEnd: state.currentPeriodEnd,
    graceEndsAt: state.graceEndsAt,
    nextPlan: state.nextPlan,
    downgradeEffectiveAt: state.downgradeEffectiveAt
  };
}

export function getInvoiceSummary(state: SubscriptionState = {}) {
  const invoices = state.invoices ?? [];
  const totalCharged = invoices
    .filter((invoice) => invoice.status === "paid")
    .reduce((sum, invoice) => sum + invoice.amount, 0);
  const totalReversed = invoices
    .filter((invoice) => invoice.status !== "paid")
    .reduce((sum, invoice) => sum + Math.abs(invoice.amount), 0);

  return {
    totalCharged,
    totalReversed,
    net: totalCharged - totalReversed,
    invoiceCount: invoices.length,
    paidInvoiceCount: invoices.filter((invoice) => invoice.status === "paid").length,
    reversalCount: invoices.filter((invoice) => invoice.status !== "paid").length,
    paymentFailureCount: state.paymentFailureCount ?? 0,
    invoices: invoices.map((invoice) => ({ ...invoice }))
  };
}

function cloneState(state: SubscriptionState): SubscriptionState {
  return {
    ...state,
    processedEventIds: [...(state.processedEventIds ?? [])],
    events: [...(state.events ?? [])],
    invoices: (state.invoices ?? []).map((invoice) => ({ ...invoice }))
  };
}

function recordPaidInvoice(state: SubscriptionState, event: any) {
  if (typeof event.invoiceId !== "string" || typeof event.amount !== "number") {
    return;
  }

  state.invoices = [
    ...(state.invoices ?? []),
    {
      id: event.invoiceId,
      eventId: event.id,
      amount: event.amount,
      status: "paid"
    }
  ];
}

function recordReversalInvoice(state: SubscriptionState, event: any) {
  if (typeof event.invoiceId !== "string" || typeof event.amount !== "number") {
    return;
  }

  state.invoices = [
    ...(state.invoices ?? []),
    {
      id: event.invoiceId,
      eventId: event.id,
      amount: -Math.abs(event.amount),
      status: event.type === "chargeback" ? "chargeback" : "refunded"
    }
  ];
}

function effectivePlan(state: SubscriptionState, now: string): string {
  if (state.nextPlan && state.downgradeEffectiveAt && !isBefore(now, state.downgradeEffectiveAt)) {
    return state.nextPlan;
  }

  return state.plan ?? "none";
}

function planFeatures(plan: string | undefined): string[] {
  return PLAN_FEATURES[plan ?? "none"] ?? [];
}

function isBefore(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) {
    return false;
  }

  return Date.parse(left) < Date.parse(right);
}
