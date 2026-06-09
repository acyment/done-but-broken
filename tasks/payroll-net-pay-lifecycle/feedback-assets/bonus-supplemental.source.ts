import { describe, expect, test } from "bun:test";
import { applyEvent, getPaycheck, getYearToDate } from "../src/payroll";

describe("Bonuses use supplemental withholding and count toward YTD wages", () => {
  test("Worked example: regular gross 1500.00 with bonus 500.00. Expected values: paycheck.bonusGross 500.00, paycheck.gross 2000.00, paycheck.withholding.federalish 363.85, ytd.gross 2000.00, ytd.socialishWages 2000.00.", () => {
    let state = {};
    for (const event of [
      {
            "id": "c12-period",
            "type": "pay_period_started",
            "periodIndex": 1,
            "gross": 1500,
            "periodsPerYear": 26,
            "filingStatus": "single",
            "allowances": 0
      },
      {
            "id": "c12-bonus",
            "type": "bonus_paid",
            "bonusId": "spot",
            "amount": 500
      }
]) {
      state = applyEvent(state, event as never);
    }

    const paycheck = getPaycheck(state);
    const ytd = getYearToDate(state);

    expect(getPath(paycheck, "bonusGross")).toBeCloseTo(500, 2);
    expect(getPath(paycheck, "gross")).toBeCloseTo(2000, 2);
    expect(getPath(paycheck, "withholding.federalish")).toBeCloseTo(363.85, 2);
    expect(getPath(ytd, "gross")).toBeCloseTo(2000, 2);
    expect(getPath(ytd, "socialishWages")).toBeCloseTo(2000, 2);
  });
});

function getPath(value: unknown, keyPath: string) {
  return keyPath.split(".").reduce((current: any, key) => current?.[key], value as any);
}
