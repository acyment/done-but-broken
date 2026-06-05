import { expect, test } from "bun:test";
import { applyEvent, canAccessFeature, getBillingStatus } from "../src/subscription";

test("trial access lasts until trialEnd", () => {
  const state = applyEvent({}, {
    id: "trial-visible",
    type: "trial_started",
    startedAt: "2026-01-01T00:00:00.000Z",
    trialEnd: "2026-01-08T00:00:00.000Z",
    plan: "trial"
  });

  expect(getBillingStatus(state, "2026-01-07T23:59:59.000Z").status).toBe("trialing");
  expect(canAccessFeature(state, "core", "2026-01-07T23:59:59.000Z")).toBe(true);
  expect(canAccessFeature(state, "core", "2026-01-08T00:00:00.000Z")).toBe(false);
});
