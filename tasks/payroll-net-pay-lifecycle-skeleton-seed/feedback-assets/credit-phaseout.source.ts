import { describe, expect, test } from "bun:test";
import { applyEvent, getPaycheck, getYearToDate } from "../src/payroll";

describe("Refundable credit phases out as annualized gross rises", () => {
  test("Worked example: current regular gross 2000.00 over 26 periods. Expected values: paycheck.creditTotal 16.92.", () => {
    let state = {};
    for (const event of [
      {
            "id": "c09-period",
            "type": "pay_period_started",
            "periodIndex": 1,
            "gross": 2000,
            "periodsPerYear": 26,
            "filingStatus": "single",
            "allowances": 0
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
