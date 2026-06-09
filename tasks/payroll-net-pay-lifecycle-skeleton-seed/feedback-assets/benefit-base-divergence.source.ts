import { describe, expect, test } from "bun:test";
import { applyEvent, getPaycheck, getYearToDate } from "../src/payroll";

describe("Benefit elections are pre-tax federal but post-tax state", () => {
  test("Worked example: gross 2000.00, ordinary pre-tax 100.00, benefit 50.00. Expected values: paycheck.preTaxTotal 150.00, paycheck.taxableBaseFederal 1850.00, paycheck.taxableBaseState 1900.00, paycheck.withholding.stateish 95.00, lineItems.benefit 50.00.", () => {
    let state = {};
    for (const event of [
      {
            "id": "c11-period",
            "type": "pay_period_started",
            "periodIndex": 1,
            "gross": 2000,
            "periodsPerYear": 26,
            "filingStatus": "single",
            "allowances": 0
      },
      {
            "id": "c11-pre-tax",
            "type": "pre_tax_deduction_set",
            "code": "retirement",
            "amount": 100
      },
      {
            "id": "c11-benefit",
            "type": "benefit_elected",
            "code": "health",
            "amount": 50
      }
]) {
      state = applyEvent(state, event as never);
    }

    const paycheck = getPaycheck(state);
    const ytd = getYearToDate(state);

    expect(getPath(paycheck, "preTaxTotal")).toBeCloseTo(150, 2);
    expect(getPath(paycheck, "taxableBaseFederal")).toBeCloseTo(1850, 2);
    expect(getPath(paycheck, "taxableBaseState")).toBeCloseTo(1900, 2);
    expect(getPath(paycheck, "withholding.stateish")).toBeCloseTo(95, 2);
    expect(paycheck.lineItems.find((item) => item.code === "benefit")?.amount).toBeCloseTo(50, 2);
  });
});

function getPath(value: unknown, keyPath: string) {
  return keyPath.split(".").reduce((current: any, key) => current?.[key], value as any);
}
