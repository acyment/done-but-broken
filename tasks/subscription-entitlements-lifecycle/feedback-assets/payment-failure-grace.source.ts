import { expect, test } from "bun:test";
import { applyEvent, canAccessFeature, getBillingStatus, getInvoiceSummary } from "../src/subscription";

test("payment failure keeps access during grace and denies after grace", () => {
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
    id: "failure-visible",
    type: "payment_failed",
    failedAt: "2026-01-20T00:00:00.000Z",
    graceEndsAt: "2026-01-25T00:00:00.000Z"
  });

  expect(getBillingStatus(state, "2026-01-24T00:00:00.000Z").status).toBe("past_due");
  expect(canAccessFeature(state, "core", "2026-01-24T00:00:00.000Z")).toBe(true);
  expect(canAccessFeature(state, "core", "2026-01-25T00:00:00.000Z")).toBe(false);
  expect(getInvoiceSummary(state).totalCharged).toBe(5000);
});
