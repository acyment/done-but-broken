import { expect, test } from "bun:test";
import { applyEvent, canAccessFeature, getBillingStatus, getInvoiceSummary } from "../src/subscription";

test("fraud suspension overrides paid access while preserving history", () => {
  let state = applyEvent({}, {
    id: "payment-visible",
    type: "payment_succeeded",
    paidAt: "2026-01-01T00:00:00.000Z",
    invoiceId: "inv-visible",
    amount: 5000,
    plan: "pro",
    currentPeriodEnd: "2026-02-01T00:00:00.000Z"
  });

  state = applyEvent(state, {
    id: "suspend-visible",
    type: "fraud_suspended",
    suspendedAt: "2026-01-15T00:00:00.000Z"
  });

  expect(getBillingStatus(state, "2026-01-20T00:00:00.000Z").status).toBe("suspended");
  expect(canAccessFeature(state, "core", "2026-01-20T00:00:00.000Z")).toBe(false);
  expect(canAccessFeature(state, "analytics", "2026-01-20T00:00:00.000Z")).toBe(false);
  expect(getInvoiceSummary(state).totalCharged).toBe(5000);
});
