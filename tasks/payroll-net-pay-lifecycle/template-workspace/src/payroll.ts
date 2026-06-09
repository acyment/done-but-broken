export type PayrollState = {
  period?: {
    periodIndex: number;
    gross: number;
    periodsPerYear: number;
    filingStatus: "single" | "joint";
    allowances: number;
  };
  preTaxDeductions?: Record<string, number>;
};

export type PayrollEvent =
  | {
      id: string;
      type: "pay_period_started";
      periodIndex: number;
      gross: number;
      periodsPerYear: number;
      filingStatus: "single" | "joint";
      allowances: number;
    }
  | { id: string; type: "pre_tax_deduction_set"; code: string; amount: number };

export function applyEvent(state: PayrollState = {}, event: PayrollEvent): PayrollState {
  if (event.type === "pay_period_started") {
    return {
      ...state,
      period: {
        periodIndex: event.periodIndex,
        gross: event.gross,
        periodsPerYear: event.periodsPerYear,
        filingStatus: event.filingStatus,
        allowances: event.allowances
      }
    };
  }

  if (event.type === "pre_tax_deduction_set") {
    return {
      ...state,
      preTaxDeductions: {
        ...(state.preTaxDeductions ?? {}),
        [event.code]: event.amount
      }
    };
  }

  return state;
}

export function getPaycheck(state: PayrollState = {}) {
  const gross = state.period?.gross ?? 0;
  const preTaxTotal = Object.values(state.preTaxDeductions ?? {}).reduce(
    (total, amount) => total + amount,
    0
  );
  const taxableBase = Math.max(0, gross - preTaxTotal);

  return {
    gross: money(gross),
    regularGross: money(gross),
    bonusGross: 0,
    preTaxTotal: money(preTaxTotal),
    taxableBaseFederal: money(taxableBase),
    taxableBaseState: money(taxableBase),
    withholding: {
      federalish: 0,
      stateish: 0,
      socialish: 0,
      medicareish: 0,
      additional: 0
    },
    creditTotal: 0,
    postTaxTotal: 0,
    garnishmentTotal: 0,
    net: money(taxableBase),
    lineItems: preTaxTotal > 0 ? [{ code: "pre_tax", amount: money(preTaxTotal) }] : []
  };
}

export function getYearToDate(state: PayrollState = {}) {
  const paycheck = getPaycheck(state);

  return {
    gross: paycheck.gross,
    socialishWages: paycheck.gross,
    medicareishWages: paycheck.gross,
    socialishTax: paycheck.withholding.socialish,
    medicareishTax: paycheck.withholding.medicareish
  };
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
