import { expect, test } from "bun:test";
import { applyEvent, canAccessFeature, getBillingStatus, getInvoiceSummary } from "../src/subscription";

test("payment activates paid period and records one invoice", () => {
  let state = applyEvent({}, {
    id: "trial-visible",
    type: "trial_started",
    startedAt: "2026-01-01T00:00:00.000Z",
    trialEnd: "2026-01-08T00:00:00.000Z",
    plan: "trial"
  });

  state = applyEvent(state, {
    id: "payment-visible",
    type: "payment_succeeded",
    paidAt: "2026-01-04T00:00:00.000Z",
    invoiceId: "inv-visible",
    amount: 5000,
    plan: "pro",
    currentPeriodEnd: "2026-02-04T00:00:00.000Z"
  });

  expect(getBillingStatus(state, "2026-01-15T00:00:00.000Z")).toMatchObject({
    status: "active",
    plan: "pro",
    trialEnd: "2026-01-08T00:00:00.000Z"
  });
  expect(canAccessFeature(state, "analytics", "2026-01-15T00:00:00.000Z")).toBe(true);
  expect(getInvoiceSummary(state)).toMatchObject({
    totalCharged: 5000,
    paidInvoiceCount: 1,
    net: 5000
  });
});
