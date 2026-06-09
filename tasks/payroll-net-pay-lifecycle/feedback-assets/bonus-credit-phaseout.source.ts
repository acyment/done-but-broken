import { describe, expect, test } from "bun:test";
import { applyEvent, getPaycheck, getYearToDate } from "../src/payroll";

describe("Bonus gross recomputes the credit phase-out", () => {
  test("Worked example: regular gross 1500.00 with bonus 500.00. Expected values: paycheck.creditTotal 16.92.", () => {
    let state = {};
    for (const event of [
      {
            "id": "c16-period",
            "type": "pay_period_started",
            "periodIndex": 1,
            "gross": 1500,
            "periodsPerYear": 26,
            "filingStatus": "single",
            "allowances": 0
      },
      {
            "id": "c16-bonus",
            "type": "bonus_paid",
            "bonusId": "spot",
            "amount": 500
      }
]) {
      state = applyEvent(state, event as never);
    }

    const paycheck = getPaycheck(state);
    const ytd = getYearToDate(state);

    expect(getPath(paycheck, "creditTotal")).toBeCloseTo(16.92, 2);
  });
});

function getPath(value: unknown, keyPath: string) {
  return keyPath.split(".").reduce((current: any, key) => current?.[key], value as any);
}
