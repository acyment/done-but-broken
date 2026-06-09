import { describe, expect, test } from "bun:test";
import { applyEvent, getPaycheck, getYearToDate } from "../src/payroll";

describe("Filing status selects the bracket table", () => {
  test("Worked example: gross 2000.00, pre-tax 100.00, 26 periods, joint, 0 allowances. Expected values: paycheck.withholding.federalish 249.69.", () => {
    let state = {};
    for (const event of [
      {
            "id": "c04-period",
            "type": "pay_period_started",
            "periodIndex": 1,
            "gross": 2000,
            "periodsPerYear": 26,
            "filingStatus": "joint",
            "allowances": 0
      },
      {
            "id": "c04-pre-tax",
            "type": "pre_tax_deduction_set",
            "code": "retirement",
            "amount": 100
      }
]) {
      state = applyEvent(state, event as never);
    }

    const paycheck = getPaycheck(state);
    const ytd = getYearToDate(state);

    expect(getPath(paycheck, "withholding.federalish")).toBeCloseTo(249.69, 2);
  });
});

function getPath(value: unknown, keyPath: string) {
  return keyPath.split(".").reduce((current: any, key) => current?.[key], value as any);
}
