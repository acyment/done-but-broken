import { describe, expect, test } from "bun:test";
import { applyEvent, getPaycheck, getYearToDate } from "../src/payroll";

describe("Medicareish tax adds a YTD surtax above threshold", () => {
  test("Worked example: prior medicareishWages 29500.00 and current gross 1000.00. Expected values: paycheck.withholding.medicareish 19.50, ytd.medicareishWages 30500.00, ytd.medicareishTax 19.50.", () => {
    let state = {};
    for (const event of [
      {
            "id": "c08-prior",
            "type": "prior_ytd_set",
            "gross": 29500,
            "socialishWages": 29500,
            "medicareishWages": 29500
      },
      {
            "id": "c08-period",
            "type": "pay_period_started",
            "periodIndex": 16,
            "gross": 1000,
            "periodsPerYear": 26,
            "filingStatus": "single",
            "allowances": 0
      }
]) {
      state = applyEvent(state, event as never);
    }

    const paycheck = getPaycheck(state);
    const ytd = getYearToDate(state);

    expect(getPath(paycheck, "withholding.medicareish")).toBeCloseTo(19.5, 2);
    expect(getPath(ytd, "medicareishWages")).toBeCloseTo(30500, 2);
    expect(getPath(ytd, "medicareishTax")).toBeCloseTo(19.5, 2);
  });
});

function getPath(value: unknown, keyPath: string) {
  return keyPath.split(".").reduce((current: any, key) => current?.[key], value as any);
}
