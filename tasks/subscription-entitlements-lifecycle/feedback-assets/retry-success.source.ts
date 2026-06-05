import { expect, test } from "bun:test";
import { applyEvent, canAccessFeature, getBillingStatus, getInvoiceSummary } from "../src/subscription";

test("retry success during grace restores active paid status", () => {
  let state = applyEvent({}, {
    id: "payment-visible",
    type: "payment_succeeded",
    paidAt: "2026-01-01T00:00:00.000Z",
    invoiceId: "inv-visible-1",
    amount: 5000,
    plan: "pro",
    currentPeriodEnd: "2026-02-01T00:00:00.000Z"
  });
  state = applyEvent(state, {
    id: "failure-visible",
    type: "payment_failed",
    failedAt: "2026-01-20T00:00:00.000Z",
    graceEndsAt: "2026-01-25T00:00:00.000Z"
  });
  state = applyEvent(state, {
    id: "retry-visible",
    type: "retry_succeeded",
    paidAt: "2026-01-22T00:00:00.000Z",
    invoiceId: "inv-visible-2",
    amount: 5000,
    currentPeriodEnd: "2026-02-22T00:00:00.000Z"
  });

  expect(getBillingStatus(state, "2026-01-24T00:00:00.000Z").status).toBe("active");
  expect(canAccessFeature(state, "analytics", "2026-01-24T00:00:00.000Z")).toBe(true);
  expect(getInvoiceSummary(state)).toMatchObject({
    totalCharged: 10000,
    paidInvoiceCount: 2,
    paymentFailureCount: 1
  });
});
