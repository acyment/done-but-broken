import { describe, expect, test } from "bun:test";
import { applyEvent, getPaycheck, getYearToDate } from "../src/payroll";

describe("Allowances reduce the annual federalish base before bracketing", () => {
  test("Worked example: gross 2000.00, pre-tax 100.00, 26 periods, single, 2 allowances. Expected values: paycheck.withholding.federalish 272.31.", () => {
    let state = {};
    for (const event of [
      {
            "id": "c05-period",
            "type": "pay_period_started",
            "periodIndex": 1,
            "gross": 2000,
            "periodsPerYear": 26,
            "filingStatus": "single",
            "allowances": 2
      },
      {
            "id": "c05-pre-tax",
            "type": "pre_tax_deduction_set",
            "code": "retirement",
            "amount": 100
      }
]) {
      state = applyEvent(state, event as never);
    }

    const paycheck = getPaycheck(state);
    const ytd = getYearToDate(state);

    expect(getPath(paycheck, "withholding.federalish")).toBeCloseTo(272.31, 2);
  });
});

function getPath(value: unknown, keyPath: string) {
  return keyPath.split(".").reduce((current: any, key) => current?.[key], value as any);
}
