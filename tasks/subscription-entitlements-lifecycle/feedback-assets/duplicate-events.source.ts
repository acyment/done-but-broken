import { expect, test } from "bun:test";
import { applyEvent, getBillingStatus, getInvoiceSummary } from "../src/subscription";

test("duplicate event IDs are idempotent", () => {
  const payment = {
    id: "payment-visible",
    type: "payment_succeeded",
    paidAt: "2026-01-01T00:00:00.000Z",
    invoiceId: "inv-visible",
    amount: 5000,
    plan: "pro",
    currentPeriodEnd: "2026-02-01T00:00:00.000Z"
  };
  let state = applyEvent({}, payment);
  state = applyEvent(state, payment);
  state = applyEvent(state, {
    id: "cancel-visible",
    type: "cancel_at_period_end",
    canceledAt: "2026-01-10T00:00:00.000Z"
  });
  state = applyEvent(state, {
    id: "cancel-visible",
    type: "cancel_at_period_end",
    canceledAt: "2026-01-10T00:00:00.000Z"
  });

  expect(getInvoiceSummary(state)).toMatchObject({
    totalCharged: 5000,
    paidInvoiceCount: 1,
    invoiceCount: 1
  });
  expect(getBillingStatus(state, "2026-01-20T00:00:00.000Z").status).toBe("canceling");
});
