import { expect, test } from "bun:test";
import { applyEvent, canAccessFeature, getBillingStatus } from "../src/subscription";

test("cancel at period end preserves access until the paid boundary", () => {
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
    id: "cancel-visible",
    type: "cancel_at_period_end",
    canceledAt: "2026-01-10T00:00:00.000Z"
  });

  expect(getBillingStatus(state, "2026-01-20T00:00:00.000Z").status).toBe("canceling");
  expect(canAccessFeature(state, "analytics", "2026-01-20T00:00:00.000Z")).toBe(true);
  expect(getBillingStatus(state, "2026-02-01T00:00:00.000Z").status).toBe("inactive");
  expect(canAccessFeature(state, "core", "2026-02-01T00:00:00.000Z")).toBe(false);
});
