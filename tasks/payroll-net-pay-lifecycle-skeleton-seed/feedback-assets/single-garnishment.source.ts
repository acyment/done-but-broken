import { describe, expect, test } from "bun:test";
import { applyEvent, getPaycheck, getYearToDate } from "../src/payroll";

describe("Single garnishment is capped by disposable earnings", () => {
  test("Worked example: gross 1200.00 with one order amount 400.00 and percentCap 15. Expected values: paycheck.garnishmentTotal 134.42, lineItems.garnishment 134.42, paycheck.net 761.73.", () => {
    let state = {};
    for (const event of [
      {
            "id": "c13-period",
            "type": "pay_period_started",
            "periodIndex": 1,
            "gross": 1200,
            "periodsPerYear": 26,
            "filingStatus": "single",
            "allowances": 0
      },
      {
            "id": "c13-garnish",
            "type": "garnishment_order_set",
            "orderId": "child",
            "priority": 1,
            "amount": 400,
            "percentCap": 15
      }
]) {
      state = applyEvent(state, event as never);
    }

    const paycheck = getPaycheck(state);
    const ytd = getYearToDate(state);

    expect(getPath(paycheck, "garnishmentTotal")).toBeCloseTo(134.42, 2);
    expect(paycheck.lineItems.find((item) => item.code === "garnishment")?.amount).toBeCloseTo(134.42, 2);
    expect(getPath(paycheck, "net")).toBeCloseTo(761.73, 2);
  });
});

function getPath(value: unknown, keyPath: string) {
  return keyPath.split(".").reduce((current: any, key) => current?.[key], value as any);
}
