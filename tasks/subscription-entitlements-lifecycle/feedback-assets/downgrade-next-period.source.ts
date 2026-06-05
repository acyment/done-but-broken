import { expect, test } from "bun:test";
import { applyEvent, canAccessFeature, getBillingStatus } from "../src/subscription";

test("downgrade takes effect at the scheduled next period", () => {
  let state = applyEvent({}, {
    id: "payment-visible",
    type: "payment_succeeded",
    paidAt: "2026-01-01T00:00:00.000Z",
    invoiceId: "inv-visible",
    amount: 5000,
    plan: "pro",
    currentPeriodEnd: "2026-03-01T00:00:00.000Z"
  });

  state = applyEvent(state, {
    id: "downgrade-visible",
    type: "downgrade_scheduled",
    nextPlan: "basic",
    effectiveAt: "2026-02-01T00:00:00.000Z"
  });

  expect(canAccessFeature(state, "analytics", "2026-01-20T00:00:00.000Z")).toBe(true);
  expect(getBillingStatus(state, "2026-02-02T00:00:00.000Z")).toMatchObject({
    status: "active",
    plan: "basic",
    nextPlan: "basic"
  });
  expect(canAccessFeature(state, "analytics", "2026-02-02T00:00:00.000Z")).toBe(false);
  expect(canAccessFeature(state, "core", "2026-02-02T00:00:00.000Z")).toBe(true);
});
