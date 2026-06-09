import { describe, expect, test } from "bun:test";
import { applyEvent, getPaycheck, getYearToDate } from "../src/payroll";

describe("Socialish payroll tax stops at a YTD wage-base cap", () => {
  test("Worked example: prior socialishWages 49000.00 and current gross 2000.00. Expected values: paycheck.withholding.socialish 60.00, ytd.socialishWages 51000.00, ytd.socialishTax 60.00.", () => {
    let state = {};
    for (const event of [
      {
            "id": "c07-prior",
            "type": "prior_ytd_set",
            "gross": 49000,
            "socialishWages": 49000,
            "medicareishWages": 49000
      },
      {
            "id": "c07-period",
            "type": "pay_period_started",
            "periodIndex": 25,
            "gross": 2000,
            "periodsPerYear": 26,
            "filingStatus": "single",
            "allowances": 0
      }
]) {
      state = applyEvent(state, event as never);
    }

    const paycheck = getPaycheck(state);
    const ytd = getYearToDate(state);

    expect(getPath(paycheck, "withholding.socialish")).toBeCloseTo(60, 2);
    expect(getPath(ytd, "socialishWages")).toBeCloseTo(51000, 2);
    expect(getPath(ytd, "socialishTax")).toBeCloseTo(60, 2);
  });
});

function getPath(value: unknown, keyPath: string) {
  return keyPath.split(".").reduce((current: any, key) => current?.[key], value as any);
}
