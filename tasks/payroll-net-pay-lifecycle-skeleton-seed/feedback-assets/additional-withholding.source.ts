import { describe, expect, test } from "bun:test";
import { applyEvent, getPaycheck, getYearToDate } from "../src/payroll";

describe("Additional flat withholding reduces net but not garnishment base", () => {
  test("Worked example: gross 1200.00, additional withholding 25.00, one 15 percent garnishment. Expected values: paycheck.withholding.additional 25.00, paycheck.garnishmentTotal 134.42, paycheck.net 736.73, lineItems.additional 25.00.", () => {
    let state = {};
    for (const event of [
      {
            "id": "c15-period",
            "type": "pay_period_started",
            "periodIndex": 1,
            "gross": 1200,
            "periodsPerYear": 26,
            "filingStatus": "single",
            "allowances": 0
      },
      {
            "id": "c15-additional",
            "type": "additional_withholding_set",
            "amount": 25
      },
      {
            "id": "c15-garnish",
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

    expect(getPath(paycheck, "withholding.additional")).toBeCloseTo(25, 2);
    expect(getPath(paycheck, "garnishmentTotal")).toBeCloseTo(134.42, 2);
    expect(getPath(paycheck, "net")).toBeCloseTo(736.73, 2);
    expect(paycheck.lineItems.find((item) => item.code === "additional")?.amount).toBeCloseTo(25, 2);
  });
});

function getPath(value: unknown, keyPath: string) {
  return keyPath.split(".").reduce((current: any, key) => current?.[key], value as any);
}
