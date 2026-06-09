import { describe, expect, test } from "bun:test";
import { applyEvent, getPaycheck, getYearToDate } from "../src/payroll";

describe("Stateish withholding uses a flat rate on its own base", () => {
  test("Worked example: gross 2000.00 with pre-tax deduction 100.00. Expected values: paycheck.taxableBaseState 1900.00, paycheck.withholding.stateish 95.00.", () => {
    let state = {};
    for (const event of [
      {
            "id": "c06-period",
            "type": "pay_period_started",
            "periodIndex": 1,
            "gross": 2000,
            "periodsPerYear": 26,
            "filingStatus": "single",
            "allowances": 0
      },
      {
            "id": "c06-pre-tax",
            "type": "pre_tax_deduction_set",
            "code": "retirement",
            "amount": 100
      }
]) {
      state = applyEvent(state, event as never);
    }

    const paycheck = getPaycheck(state);
    const ytd = getYearToDate(state);

    expect(getPath(paycheck, "taxableBaseState")).toBeCloseTo(1900, 2);
    expect(getPath(paycheck, "withholding.stateish")).toBeCloseTo(95, 2);
  });
});

function getPath(value: unknown, keyPath: string) {
  return keyPath.split(".").reduce((current: any, key) => current?.[key], value as any);
}
