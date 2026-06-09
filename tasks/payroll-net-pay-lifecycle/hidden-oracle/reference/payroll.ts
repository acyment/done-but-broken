export type PayrollState = {
  seenEventIds?: string[];
  period?: {
    periodIndex: number;
    gross: number;
    periodsPerYear: number;
    filingStatus: "single" | "joint";
    allowances: number;
  };
  preTaxDeductions?: Record<string, number>;
  postTaxDeductions?: Record<string, number>;
  benefits?: Record<string, number>;
  bonuses?: Record<string, number>;
  priorYtd?: {
    gross: number;
    socialishWages: number;
    medicareishWages: number;
  };
  garnishments?: Record<string, { priority: number; amount: number; percentCap: number }>;
  additionalWithholding?: number;
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
  | { id: string; type: "pre_tax_deduction_set"; code: string; amount: number }
  | { id: string; type: "post_tax_deduction_set"; code: string; amount: number }
  | { id: string; type: "benefit_elected"; code: string; amount: number }
  | { id: string; type: "bonus_paid"; bonusId: string; amount: number }
  | { id: string; type: "bonus_voided"; bonusId: string }
  | {
      id: string;
      type: "prior_ytd_set";
      gross: number;
      socialishWages: number;
      medicareishWages: number;
    }
  | {
      id: string;
      type: "garnishment_order_set";
      orderId: string;
      priority: number;
      amount: number;
      percentCap: number;
    }
  | { id: string; type: "additional_withholding_set"; amount: number };

export type Paycheck = {
  gross: number;
  regularGross: number;
  bonusGross: number;
  preTaxTotal: number;
  taxableBaseFederal: number;
  taxableBaseState: number;
  withholding: {
    federalish: number;
    stateish: number;
    socialish: number;
    medicareish: number;
    additional: number;
  };
  creditTotal: number;
  postTaxTotal: number;
  garnishmentTotal: number;
  net: number;
  lineItems: Array<{ code: string; amount: number }>;
};

export type YearToDate = {
  gross: number;
  socialishWages: number;
  medicareishWages: number;
  socialishTax: number;
  medicareishTax: number;
};

const FEDERAL_BRACKETS = {
  single: [
    { upTo: 12_000, rate: 0.1 },
    { upTo: 48_000, rate: 0.2 },
    { upTo: Infinity, rate: 0.3 }
  ],
  joint: [
    { upTo: 24_000, rate: 0.08 },
    { upTo: 96_000, rate: 0.18 },
    { upTo: Infinity, rate: 0.28 }
  ]
} as const;

const ALLOWANCE_ANNUAL_AMOUNT = 4_000;
const STATEISH_RATE = 0.05;
const SOCIALISH_RATE = 0.06;
const SOCIALISH_WAGE_BASE = 50_000;
const MEDICAREISH_RATE = 0.015;
const MEDICAREISH_SURTAX_RATE = 0.009;
const MEDICAREISH_SURTAX_THRESHOLD = 30_000;
const BASE_CREDIT_PER_PERIOD = 40;
const CREDIT_PHASEOUT_START_ANNUAL_GROSS = 40_000;
const CREDIT_PHASEOUT_RATE = 0.05;
const BONUS_SUPPLEMENTAL_RATE = 0.22;
const COMBINED_GARNISHMENT_CAP = 0.25;

export function applyEvent(state: PayrollState = {}, event: PayrollEvent): PayrollState {
  const seen = new Set(state.seenEventIds ?? []);

  if (seen.has(event.id)) {
    return cloneState(state);
  }

  seen.add(event.id);
  const next: PayrollState = {
    ...cloneState(state),
    seenEventIds: [...seen]
  };

  if (event.type === "pay_period_started") {
    next.period = {
      periodIndex: event.periodIndex,
      gross: event.gross,
      periodsPerYear: event.periodsPerYear,
      filingStatus: event.filingStatus,
      allowances: event.allowances
    };
  } else if (event.type === "pre_tax_deduction_set") {
    next.preTaxDeductions = { ...(next.preTaxDeductions ?? {}), [event.code]: event.amount };
  } else if (event.type === "post_tax_deduction_set") {
    next.postTaxDeductions = { ...(next.postTaxDeductions ?? {}), [event.code]: event.amount };
  } else if (event.type === "benefit_elected") {
    next.benefits = { ...(next.benefits ?? {}), [event.code]: event.amount };
  } else if (event.type === "bonus_paid") {
    next.bonuses = { ...(next.bonuses ?? {}), [event.bonusId]: event.amount };
  } else if (event.type === "bonus_voided") {
    const bonuses = { ...(next.bonuses ?? {}) };
    delete bonuses[event.bonusId];
    next.bonuses = bonuses;
  } else if (event.type === "prior_ytd_set") {
    next.priorYtd = {
      gross: event.gross,
      socialishWages: event.socialishWages,
      medicareishWages: event.medicareishWages
    };
  } else if (event.type === "garnishment_order_set") {
    next.garnishments = {
      ...(next.garnishments ?? {}),
      [event.orderId]: {
        priority: event.priority,
        amount: event.amount,
        percentCap: event.percentCap
      }
    };
  } else if (event.type === "additional_withholding_set") {
    next.additionalWithholding = event.amount;
  }

  return next;
}

export function getPaycheck(state: PayrollState = {}): Paycheck {
  const period = state.period ?? {
    periodIndex: 1,
    gross: 0,
    periodsPerYear: 26,
    filingStatus: "single" as const,
    allowances: 0
  };
  const regularGross = period.gross;
  const bonusGross = sumValues(state.bonuses);
  const gross = regularGross + bonusGross;
  const ordinaryPreTax = sumValues(state.preTaxDeductions);
  const benefitTotal = sumValues(state.benefits);
  const preTaxTotal = ordinaryPreTax + benefitTotal;
  const taxableBaseFederal = Math.max(0, gross - ordinaryPreTax - benefitTotal);
  const taxableBaseState = Math.max(0, gross - ordinaryPreTax);
  const federalish = federalishWithholding({
    taxableBaseFederal,
    regularTaxableBaseFederal: Math.max(0, regularGross - ordinaryPreTax - benefitTotal),
    bonusGross,
    periodsPerYear: period.periodsPerYear,
    filingStatus: period.filingStatus,
    allowances: period.allowances
  });
  const stateish = taxableBaseState * STATEISH_RATE;
  const socialish = socialishTax(state, gross);
  const medicareish = medicareishTax(state, gross);
  const additional = state.additionalWithholding ?? 0;
  const creditTotal = payrollCredit({
    regularGross,
    bonusGross,
    periodsPerYear: period.periodsPerYear
  });
  const postTaxTotal = sumValues(state.postTaxDeductions);
  const disposableEarnings = Math.max(
    0,
    gross - preTaxTotal - federalish - stateish - socialish - medicareish + creditTotal
  );
  const garnishmentTotal = garnishments(state, disposableEarnings);
  const net =
    gross -
    preTaxTotal -
    federalish -
    stateish -
    socialish -
    medicareish -
    additional +
    creditTotal -
    postTaxTotal -
    garnishmentTotal;

  return {
    gross: money(gross),
    regularGross: money(regularGross),
    bonusGross: money(bonusGross),
    preTaxTotal: money(preTaxTotal),
    taxableBaseFederal: money(taxableBaseFederal),
    taxableBaseState: money(taxableBaseState),
    withholding: {
      federalish: money(federalish),
      stateish: money(stateish),
      socialish: money(socialish),
      medicareish: money(medicareish),
      additional: money(additional)
    },
    creditTotal: money(creditTotal),
    postTaxTotal: money(postTaxTotal),
    garnishmentTotal: money(garnishmentTotal),
    net: money(net),
    lineItems: lineItems({
      ordinaryPreTax,
      benefitTotal,
      federalish,
      stateish,
      socialish,
      medicareish,
      additional,
      creditTotal,
      postTaxTotal,
      garnishmentTotal
    })
  };
}

export function getYearToDate(state: PayrollState = {}): YearToDate {
  const paycheck = getPaycheck(state);
  const prior = state.priorYtd ?? {
    gross: 0,
    socialishWages: 0,
    medicareishWages: 0
  };
  const gross = prior.gross + paycheck.gross;
  const socialishWages = prior.socialishWages + paycheck.gross;
  const medicareishWages = prior.medicareishWages + paycheck.gross;

  return {
    gross: money(gross),
    socialishWages: money(socialishWages),
    medicareishWages: money(medicareishWages),
    socialishTax: paycheck.withholding.socialish,
    medicareishTax: paycheck.withholding.medicareish
  };
}

function federalishWithholding(input: {
  taxableBaseFederal: number;
  regularTaxableBaseFederal: number;
  bonusGross: number;
  periodsPerYear: number;
  filingStatus: "single" | "joint";
  allowances: number;
}) {
  const annualRegularTaxable = Math.max(
    0,
    input.regularTaxableBaseFederal * input.periodsPerYear -
      input.allowances * ALLOWANCE_ANNUAL_AMOUNT
  );
  const regularWithholding =
    bracketTax(annualRegularTaxable, FEDERAL_BRACKETS[input.filingStatus]) / input.periodsPerYear;
  const bonusWithholding = input.bonusGross * BONUS_SUPPLEMENTAL_RATE;

  return regularWithholding + bonusWithholding;
}

function bracketTax(annualAmount: number, brackets: ReadonlyArray<{ upTo: number; rate: number }>) {
  let lower = 0;
  let tax = 0;

  for (const bracket of brackets) {
    const taxableInBracket = Math.max(0, Math.min(annualAmount, bracket.upTo) - lower);
    tax += taxableInBracket * bracket.rate;
    lower = bracket.upTo;

    if (annualAmount <= bracket.upTo) {
      break;
    }
  }

  return tax;
}

function socialishTax(state: PayrollState, gross: number) {
  const prior = state.priorYtd?.socialishWages ?? 0;
  const remainingWageBase = Math.max(0, SOCIALISH_WAGE_BASE - prior);
  const taxable = Math.min(gross, remainingWageBase);

  return taxable * SOCIALISH_RATE;
}

function medicareishTax(state: PayrollState, gross: number) {
  const prior = state.priorYtd?.medicareishWages ?? 0;
  const priorAboveThreshold = Math.max(0, prior - MEDICAREISH_SURTAX_THRESHOLD);
  const afterAboveThreshold = Math.max(0, prior + gross - MEDICAREISH_SURTAX_THRESHOLD);
  const surtaxWages = afterAboveThreshold - priorAboveThreshold;

  return gross * MEDICAREISH_RATE + surtaxWages * MEDICAREISH_SURTAX_RATE;
}

function payrollCredit(input: {
  regularGross: number;
  bonusGross: number;
  periodsPerYear: number;
}) {
  const annualizedGross = (input.regularGross + input.bonusGross) * input.periodsPerYear;
  const annualPhaseout = Math.max(0, annualizedGross - CREDIT_PHASEOUT_START_ANNUAL_GROSS) * CREDIT_PHASEOUT_RATE;
  const perPeriodPhaseout = annualPhaseout / input.periodsPerYear;

  return Math.max(0, BASE_CREDIT_PER_PERIOD - perPeriodPhaseout);
}

function garnishments(state: PayrollState, disposableEarnings: number) {
  const orders = Object.entries(state.garnishments ?? {})
    .map(([orderId, order]) => ({ orderId, ...order }))
    .sort((left, right) => left.priority - right.priority || left.orderId.localeCompare(right.orderId));
  let remainingCombinedCap = disposableEarnings * COMBINED_GARNISHMENT_CAP;
  let total = 0;

  for (const order of orders) {
    const orderCap = disposableEarnings * (order.percentCap / 100);
    const amount = Math.min(order.amount, orderCap, remainingCombinedCap);
    total += amount;
    remainingCombinedCap -= amount;
  }

  return total;
}

function lineItems(input: {
  ordinaryPreTax: number;
  benefitTotal: number;
  federalish: number;
  stateish: number;
  socialish: number;
  medicareish: number;
  additional: number;
  creditTotal: number;
  postTaxTotal: number;
  garnishmentTotal: number;
}) {
  const items = [
    ["pre_tax", input.ordinaryPreTax],
    ["benefit", input.benefitTotal],
    ["federalish", input.federalish],
    ["stateish", input.stateish],
    ["socialish", input.socialish],
    ["medicareish", input.medicareish],
    ["additional", input.additional],
    ["credit", -input.creditTotal],
    ["post_tax", input.postTaxTotal],
    ["garnishment", input.garnishmentTotal]
  ] as const;

  return items
    .filter(([, amount]) => Math.abs(amount) > 1e-9)
    .map(([code, amount]) => ({ code, amount: money(amount) }));
}

function sumValues(values?: Record<string, number>) {
  return Object.values(values ?? {}).reduce((total, value) => total + value, 0);
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function cloneState(state: PayrollState): PayrollState {
  return JSON.parse(JSON.stringify(state ?? {}));
}
