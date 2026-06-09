import { describe, expect, test } from "bun:test";
import { applyEvent, getPaycheck, getYearToDate } from "../src/payroll";

describe("Pre-tax deductions reduce both taxable bases", () => {
  test("Worked example: gross 2000.00 plus retirement pre-tax deduction 100.00. Expected values: paycheck.preTaxTotal 100.00, paycheck.taxableBaseFederal 1900.00, paycheck.taxableBaseState 1900.00, lineItems.pre_tax 100.00.", () => {
    let state = {};
    for (const event of [
      {
            "id": "c02-period",
            "type": "pay_period_started",
            "periodIndex": 1,
            "gross": 2000,
            "periodsPerYear": 26,
            "filingStatus": "single",
            "allowances": 0
      },
      {
            "id": "c02-pre-tax",
            "type": "pre_tax_deduction_set",
            "code": "retirement",
            "amount": 100
      }
]) {
      state = applyEvent(state, event as never);
    }

    const paycheck = getPaycheck(state);
    const ytd = getYearToDate(state);

    expect(getPath(paycheck, "preTaxTotal")).toBeCloseTo(100, 2);
    expect(getPath(paycheck, "taxableBaseFederal")).toBeCloseTo(1900, 2);
    expect(getPath(paycheck, "taxableBaseState")).toBeCloseTo(1900, 2);
    expect(paycheck.lineItems.find((item) => item.code === "pre_tax")?.amount).toBeCloseTo(100, 2);
  });
});

function getPath(value: unknown, keyPath: string) {
  return keyPath.split(".").reduce((current: any, key) => current?.[key], value as any);
}
