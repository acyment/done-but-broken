import { expect, test } from "bun:test";
import { applyEvent, canAccessFeature, getBillingStatus, getInvoiceSummary } from "../src/subscription";

test("refund restricts access and records reversal once", () => {
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
    id: "refund-visible",
    type: "refund",
    invoiceId: "inv-visible",
    amount: 5000,
    reversedAt: "2026-01-15T00:00:00.000Z"
  });

  expect(getBillingStatus(state, "2026-01-20T00:00:00.000Z").status).toBe("restricted");
  expect(canAccessFeature(state, "core", "2026-01-20T00:00:00.000Z")).toBe(false);
  expect(getInvoiceSummary(state)).toMatchObject({
    totalCharged: 5000,
    totalReversed: 5000,
    net: 0,
    reversalCount: 1
  });
});
