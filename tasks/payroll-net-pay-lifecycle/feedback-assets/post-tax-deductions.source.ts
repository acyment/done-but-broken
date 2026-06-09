import { describe, expect, test } from "bun:test";
import { applyEvent, getPaycheck, getYearToDate } from "../src/payroll";

describe("Post-tax deductions reduce net after withholding and credits", () => {
  test("Worked example: gross 1200.00 with post-tax deduction 75.00. Expected values: paycheck.postTaxTotal 75.00, lineItems.post_tax 75.00, paycheck.net 821.15.", () => {
    let state = {};
    for (const event of [
      {
            "id": "c10-period",
            "type": "pay_period_started",
            "periodIndex": 1,
            "gross": 1200,
            "periodsPerYear": 26,
            "filingStatus": "single",
            "allowances": 0
      },
      {
            "id": "c10-post-tax",
            "type": "post_tax_deduction_set",
            "code": "union",
            "amount": 75
      }
]) {
      state = applyEvent(state, event as never);
    }

    const paycheck = getPaycheck(state);
    const ytd = getYearToDate(state);

    expect(getPath(paycheck, "postTaxTotal")).toBeCloseTo(75, 2);
    expect(paycheck.lineItems.find((item) => item.code === "post_tax")?.amount).toBeCloseTo(75, 2);
    expect(getPath(paycheck, "net")).toBeCloseTo(821.15, 2);
  });
});

function getPath(value: unknown, keyPath: string) {
  return keyPath.split(".").reduce((current: any, key) => current?.[key], value as any);
}
