import { describe, expect, test } from "bun:test";
import { applyEvent, getPaycheck, getYearToDate } from "../src/payroll";

describe("Gross pay starts each pay period", () => {
  test("Worked example: gross 2000.00, 26 periods, single filing, 0 allowances. Expected values: paycheck.gross 2000.00, paycheck.regularGross 2000.00, paycheck.bonusGross 0.00, ytd.gross 2000.00.", () => {
    let state = {};
    for (const event of [
      {
            "id": "c01-period",
            "type": "pay_period_started",
            "periodIndex": 1,
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

    expect(getPath(paycheck, "gross")).toBeCloseTo(2000, 2);
    expect(getPath(paycheck, "regularGross")).toBeCloseTo(2000, 2);
    expect(getPath(paycheck, "bonusGross")).toBeCloseTo(0, 2);
    expect(getPath(ytd, "gross")).toBeCloseTo(2000, 2);
  });
});

function getPath(value: unknown, keyPath: string) {
  return keyPath.split(".").reduce((current: any, key) => current?.[key], value as any);
}
