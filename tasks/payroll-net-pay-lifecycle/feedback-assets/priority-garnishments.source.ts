import { describe, expect, test } from "bun:test";
import { applyEvent, getPaycheck, getYearToDate } from "../src/payroll";

describe("Priority garnishments share a combined cap", () => {
  test("Worked example: gross 1200.00 with priority 1 amount 400.00 cap 20 and priority 2 amount 300.00 cap 20. Expected values: paycheck.garnishmentTotal 224.04.", () => {
    let state = {};
    for (const event of [
      {
            "id": "c14-period",
            "type": "pay_period_started",
            "periodIndex": 1,
            "gross": 1200,
            "periodsPerYear": 26,
            "filingStatus": "single",
            "allowances": 0
      },
      {
            "id": "c14-garnish-a",
            "type": "garnishment_order_set",
            "orderId": "child",
            "priority": 1,
            "amount": 400,
            "percentCap": 20
      },
      {
            "id": "c14-garnish-b",
            "type": "garnishment_order_set",
            "orderId": "debt",
            "priority": 2,
            "amount": 300,
            "percentCap": 20
      }
]) {
      state = applyEvent(state, event as never);
    }

    const paycheck = getPaycheck(state);
    const ytd = getYearToDate(state);

    expect(getPath(paycheck, "garnishmentTotal")).toBeCloseTo(224.04, 2);
  });
});

function getPath(value: unknown, keyPath: string) {
  return keyPath.split(".").reduce((current: any, key) => current?.[key], value as any);
}
