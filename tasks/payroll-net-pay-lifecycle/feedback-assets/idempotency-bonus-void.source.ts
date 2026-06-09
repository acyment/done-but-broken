import { describe, expect, test } from "bun:test";
import { applyEvent, getPaycheck, getYearToDate } from "../src/payroll";

describe("Duplicate events are idempotent and bonus voids undo bonus effects", () => {
  test("Worked example: regular gross 1500.00, a 500.00 bonus replayed twice, then bonus_voided for that bonusId. Expected values: paycheck.bonusGross 0.00, paycheck.gross 1500.00, paycheck.withholding.federalish 253.85, paycheck.creditTotal 40.00, paycheck.withholding.socialish 90.00, paycheck.withholding.medicareish 22.50, paycheck.net 1098.65, ytd.gross 1500.00, ytd.socialishWages 1500.00.", () => {
    let state = {};
    for (const event of [
      {
            "id": "c18-period",
            "type": "pay_period_started",
            "periodIndex": 1,
            "gross": 1500,
            "periodsPerYear": 26,
            "filingStatus": "single",
            "allowances": 0
      },
      {
            "id": "c18-bonus",
            "type": "bonus_paid",
            "bonusId": "spot",
            "amount": 500
      },
      {
            "id": "c18-bonus",
            "type": "bonus_paid",
            "bonusId": "spot",
            "amount": 500
      },
      {
            "id": "c18-void",
            "type": "bonus_voided",
            "bonusId": "spot"
      }
]) {
      state = applyEvent(state, event as never);
    }

    const paycheck = getPaycheck(state);
    const ytd = getYearToDate(state);

    expect(getPath(paycheck, "bonusGross")).toBeCloseTo(0, 2);
    expect(getPath(paycheck, "gross")).toBeCloseTo(1500, 2);
    expect(getPath(paycheck, "withholding.federalish")).toBeCloseTo(253.85, 2);
    expect(getPath(paycheck, "creditTotal")).toBeCloseTo(40, 2);
    expect(getPath(paycheck, "withholding.socialish")).toBeCloseTo(90, 2);
    expect(getPath(paycheck, "withholding.medicareish")).toBeCloseTo(22.5, 2);
    expect(getPath(paycheck, "net")).toBeCloseTo(1098.65, 2);
    expect(getPath(ytd, "gross")).toBeCloseTo(1500, 2);
    expect(getPath(ytd, "socialishWages")).toBeCloseTo(1500, 2);
  });
});

function getPath(value: unknown, keyPath: string) {
  return keyPath.split(".").reduce((current: any, key) => current?.[key], value as any);
}
