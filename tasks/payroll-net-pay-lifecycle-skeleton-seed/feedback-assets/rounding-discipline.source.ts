import { describe, expect, test } from "bun:test";
import { applyEvent, getPaycheck, getYearToDate } from "../src/payroll";

describe("Components are rounded once and net is the residual", () => {
  test("Worked example: gross 1234.56, pre-tax 123.45, benefit 67.89, post-tax 12.34, additional 7.89. Expected values: paycheck.withholding.federalish 131.72, paycheck.withholding.stateish 55.56, paycheck.withholding.socialish 74.07, paycheck.withholding.medicareish 18.52, paycheck.creditTotal 40.00, paycheck.net 783.12; paycheck.net rounded to 2 decimals.", () => {
    let state = {};
    for (const event of [
      {
            "id": "c17-period",
            "type": "pay_period_started",
            "periodIndex": 1,
            "gross": 1234.56,
            "periodsPerYear": 26,
            "filingStatus": "single",
            "allowances": 1
      },
      {
            "id": "c17-pre-tax",
            "type": "pre_tax_deduction_set",
            "code": "retirement",
            "amount": 123.45
      },
      {
            "id": "c17-benefit",
            "type": "benefit_elected",
            "code": "health",
            "amount": 67.89
      },
      {
            "id": "c17-post-tax",
            "type": "post_tax_deduction_set",
            "code": "union",
            "amount": 12.34
      },
      {
            "id": "c17-additional",
            "type": "additional_withholding_set",
            "amount": 7.89
      }
]) {
      state = applyEvent(state, event as never);
    }

    const paycheck = getPaycheck(state);
    const ytd = getYearToDate(state);

    expect(getPath(paycheck, "withholding.federalish")).toBeCloseTo(131.72, 2);
    expect(getPath(paycheck, "withholding.stateish")).toBeCloseTo(55.56, 2);
    expect(getPath(paycheck, "withholding.socialish")).toBeCloseTo(74.07, 2);
    expect(getPath(paycheck, "withholding.medicareish")).toBeCloseTo(18.52, 2);
    expect(getPath(paycheck, "creditTotal")).toBeCloseTo(40, 2);
    expect(getPath(paycheck, "net")).toBeCloseTo(783.12, 2);
    expect(Number.isInteger(getPath(paycheck, "net") * 100)).toBe(true);
  });
});

function getPath(value: unknown, keyPath: string) {
  return keyPath.split(".").reduce((current: any, key) => current?.[key], value as any);
}
