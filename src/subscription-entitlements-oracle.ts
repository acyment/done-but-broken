import { execFile } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import type { HiddenOracleAdapter, HiddenOracleRunInput, HiddenOracleRunResult } from "./runner";
import type { OracleCheckResult } from "./result-schema";

const execFileAsync = promisify(execFile);
const ORACLE_OUTPUT_PREFIX = "__SUBSCRIPTION_ENTITLEMENTS_ORACLE_OUTPUT__";

const COMMITMENTS_BY_CHECKPOINT = {
  I01: ["trial-access-until-trial-end"],
  I02: ["trial-access-until-trial-end", "payment-activates-paid-period"],
  I03: [
    "trial-access-until-trial-end",
    "payment-activates-paid-period",
    "cancel-at-period-end-preserves-access"
  ],
  I04: [
    "trial-access-until-trial-end",
    "payment-activates-paid-period",
    "cancel-at-period-end-preserves-access",
    "payment-failure-grace-period"
  ],
  I05: [
    "trial-access-until-trial-end",
    "payment-activates-paid-period",
    "cancel-at-period-end-preserves-access",
    "payment-failure-grace-period",
    "retry-success-during-grace-restores-active"
  ],
  I06: [
    "trial-access-until-trial-end",
    "payment-activates-paid-period",
    "cancel-at-period-end-preserves-access",
    "payment-failure-grace-period",
    "retry-success-during-grace-restores-active",
    "duplicate-events-are-idempotent"
  ],
  I07: [
    "trial-access-until-trial-end",
    "payment-activates-paid-period",
    "cancel-at-period-end-preserves-access",
    "payment-failure-grace-period",
    "retry-success-during-grace-restores-active",
    "duplicate-events-are-idempotent",
    "fraud-suspension-overrides-all-access"
  ],
  I08: [
    "trial-access-until-trial-end",
    "payment-activates-paid-period",
    "cancel-at-period-end-preserves-access",
    "payment-failure-grace-period",
    "retry-success-during-grace-restores-active",
    "duplicate-events-are-idempotent",
    "fraud-suspension-overrides-all-access",
    "downgrade-takes-effect-next-period"
  ],
  I09: [
    "trial-access-until-trial-end",
    "payment-activates-paid-period",
    "cancel-at-period-end-preserves-access",
    "payment-failure-grace-period",
    "retry-success-during-grace-restores-active",
    "duplicate-events-are-idempotent",
    "fraud-suspension-overrides-all-access",
    "downgrade-takes-effect-next-period",
    "refund-chargeback-restricts-without-resurrection"
  ]
} as const;

type SubscriptionCheckpoint = keyof typeof COMMITMENTS_BY_CHECKPOINT;

type OracleAssertion =
  | {
      kind: "access";
      feature: string;
      now: string;
      expected: boolean;
    }
  | {
      kind: "billing_status";
      now: string;
      expected: string;
    }
  | {
      kind: "billing_field";
      now: string;
      field: string;
      expected: unknown;
    }
  | {
      kind: "invoice_field";
      field: string;
      expected: unknown;
    };

type OracleCase = {
  case_id: string;
  commitment_id: string;
  events: unknown[];
  assertions: OracleAssertion[];
};

type CaseEvaluation = OracleCase & {
  actual: boolean;
  failures: string[];
  error?: string;
};

const PAYMENT_EVENT = {
  id: "payment-private",
  type: "payment_succeeded",
  paidAt: "2026-01-01T00:00:00.000Z",
  invoiceId: "inv-private-1",
  amount: 5000,
  plan: "pro",
  currentPeriodEnd: "2026-03-01T00:00:00.000Z"
};

const ORACLE_CASES: OracleCase[] = [
  {
    case_id: "trial-access-before-at-after-boundary-private",
    commitment_id: "trial-access-until-trial-end",
    events: [
      {
        id: "trial-private",
        type: "trial_started",
        startedAt: "2026-01-01T00:00:00.000Z",
        trialEnd: "2026-01-08T00:00:00.000Z",
        plan: "trial"
      }
    ],
    assertions: [
      { kind: "billing_status", now: "2026-01-07T23:59:59.000Z", expected: "trialing" },
      { kind: "access", feature: "core", now: "2026-01-07T23:59:59.000Z", expected: true },
      { kind: "access", feature: "core", now: "2026-01-08T00:00:00.000Z", expected: false }
    ]
  },
  {
    case_id: "trial-access-feature-scope-private",
    commitment_id: "trial-access-until-trial-end",
    events: [
      {
        id: "trial-private-feature-scope",
        type: "trial_started",
        startedAt: "2026-01-01T00:00:00.000Z",
        trialEnd: "2026-01-08T00:00:00.000Z",
        plan: "trial"
      }
    ],
    assertions: [
      { kind: "access", feature: "analytics", now: "2026-01-02T00:00:00.000Z", expected: false }
    ]
  },
  {
    case_id: "payment-activates-paid-status-and-access-private",
    commitment_id: "payment-activates-paid-period",
    events: [
      {
        id: "trial-before-payment-private",
        type: "trial_started",
        startedAt: "2025-12-30T00:00:00.000Z",
        trialEnd: "2026-01-06T00:00:00.000Z",
        plan: "trial"
      },
      PAYMENT_EVENT
    ],
    assertions: [
      { kind: "billing_status", now: "2026-01-15T00:00:00.000Z", expected: "active" },
      { kind: "billing_field", now: "2026-01-15T00:00:00.000Z", field: "trialEnd", expected: "2026-01-06T00:00:00.000Z" },
      { kind: "access", feature: "analytics", now: "2026-01-15T00:00:00.000Z", expected: true },
      { kind: "invoice_field", field: "totalCharged", expected: 5000 },
      { kind: "invoice_field", field: "paidInvoiceCount", expected: 1 }
    ]
  },
  {
    case_id: "payment-access-expires-at-period-end-private",
    commitment_id: "payment-activates-paid-period",
    events: [PAYMENT_EVENT],
    assertions: [
      { kind: "access", feature: "core", now: "2026-03-01T00:00:00.000Z", expected: false }
    ]
  },
  {
    case_id: "cancel-preserves-before-and-denies-after-private",
    commitment_id: "cancel-at-period-end-preserves-access",
    events: [
      PAYMENT_EVENT,
      {
        id: "cancel-private",
        type: "cancel_at_period_end",
        canceledAt: "2026-01-15T00:00:00.000Z"
      }
    ],
    assertions: [
      { kind: "billing_status", now: "2026-02-01T00:00:00.000Z", expected: "canceling" },
      { kind: "access", feature: "analytics", now: "2026-02-01T00:00:00.000Z", expected: true },
      { kind: "billing_status", now: "2026-03-01T00:00:00.000Z", expected: "inactive" },
      { kind: "access", feature: "core", now: "2026-03-01T00:00:00.000Z", expected: false }
    ]
  },
  {
    case_id: "grace-survives-before-deadline-private",
    commitment_id: "payment-failure-grace-period",
    events: [
      PAYMENT_EVENT,
      {
        id: "failure-private",
        type: "payment_failed",
        failedAt: "2026-01-20T00:00:00.000Z",
        graceEndsAt: "2026-01-25T00:00:00.000Z"
      }
    ],
    assertions: [
      { kind: "billing_status", now: "2026-01-24T00:00:00.000Z", expected: "past_due" },
      { kind: "access", feature: "core", now: "2026-01-24T00:00:00.000Z", expected: true },
      { kind: "access", feature: "core", now: "2026-01-25T00:00:00.000Z", expected: false },
      { kind: "invoice_field", field: "totalCharged", expected: 5000 }
    ]
  },
  {
    case_id: "retry-success-clears-past-due-private",
    commitment_id: "retry-success-during-grace-restores-active",
    events: [
      PAYMENT_EVENT,
      {
        id: "failure-before-retry-private",
        type: "payment_failed",
        failedAt: "2026-01-20T00:00:00.000Z",
        graceEndsAt: "2026-01-25T00:00:00.000Z"
      },
      {
        id: "retry-private",
        type: "retry_succeeded",
        paidAt: "2026-01-22T00:00:00.000Z",
        invoiceId: "inv-private-2",
        amount: 5000,
        currentPeriodEnd: "2026-03-22T00:00:00.000Z"
      }
    ],
    assertions: [
      { kind: "billing_status", now: "2026-01-24T00:00:00.000Z", expected: "active" },
      { kind: "access", feature: "analytics", now: "2026-01-24T00:00:00.000Z", expected: true },
      { kind: "invoice_field", field: "totalCharged", expected: 10000 },
      { kind: "invoice_field", field: "paymentFailureCount", expected: 1 }
    ]
  },
  {
    case_id: "duplicate-payment-does-not-double-charge-private",
    commitment_id: "duplicate-events-are-idempotent",
    events: [PAYMENT_EVENT, PAYMENT_EVENT],
    assertions: [
      { kind: "invoice_field", field: "totalCharged", expected: 5000 },
      { kind: "invoice_field", field: "paidInvoiceCount", expected: 1 },
      { kind: "access", feature: "analytics", now: "2026-02-01T00:00:00.000Z", expected: true }
    ]
  },
  {
    case_id: "duplicate-cancel-is-noop-private",
    commitment_id: "duplicate-events-are-idempotent",
    events: [
      PAYMENT_EVENT,
      {
        id: "cancel-duplicate-private",
        type: "cancel_at_period_end",
        canceledAt: "2026-01-15T00:00:00.000Z"
      },
      {
        id: "cancel-duplicate-private",
        type: "cancel_at_period_end",
        canceledAt: "2026-01-16T00:00:00.000Z"
      }
    ],
    assertions: [
      { kind: "billing_status", now: "2026-02-01T00:00:00.000Z", expected: "canceling" },
      { kind: "invoice_field", field: "paidInvoiceCount", expected: 1 }
    ]
  },
  {
    case_id: "suspension-overrides-paid-private",
    commitment_id: "fraud-suspension-overrides-all-access",
    events: [
      PAYMENT_EVENT,
      {
        id: "suspend-paid-private",
        type: "fraud_suspended",
        suspendedAt: "2026-01-15T00:00:00.000Z"
      }
    ],
    assertions: [
      { kind: "billing_status", now: "2026-02-01T00:00:00.000Z", expected: "suspended" },
      { kind: "access", feature: "core", now: "2026-02-01T00:00:00.000Z", expected: false },
      { kind: "invoice_field", field: "totalCharged", expected: 5000 }
    ]
  },
  {
    case_id: "suspension-overrides-grace-private",
    commitment_id: "fraud-suspension-overrides-all-access",
    events: [
      PAYMENT_EVENT,
      {
        id: "failure-before-suspend-private",
        type: "payment_failed",
        failedAt: "2026-01-20T00:00:00.000Z",
        graceEndsAt: "2026-01-25T00:00:00.000Z"
      },
      {
        id: "suspend-grace-private",
        type: "fraud_suspended",
        suspendedAt: "2026-01-21T00:00:00.000Z"
      }
    ],
    assertions: [
      { kind: "access", feature: "core", now: "2026-01-22T00:00:00.000Z", expected: false },
      { kind: "invoice_field", field: "paymentFailureCount", expected: 1 }
    ]
  },
  {
    case_id: "downgrade-preserves-old-before-and-basic-after-private",
    commitment_id: "downgrade-takes-effect-next-period",
    events: [
      PAYMENT_EVENT,
      {
        id: "downgrade-private",
        type: "downgrade_scheduled",
        nextPlan: "basic",
        effectiveAt: "2026-02-01T00:00:00.000Z"
      }
    ],
    assertions: [
      { kind: "access", feature: "analytics", now: "2026-01-31T00:00:00.000Z", expected: true },
      { kind: "billing_field", now: "2026-02-02T00:00:00.000Z", field: "plan", expected: "basic" },
      { kind: "access", feature: "analytics", now: "2026-02-02T00:00:00.000Z", expected: false },
      { kind: "access", feature: "core", now: "2026-02-02T00:00:00.000Z", expected: true }
    ]
  },
  {
    case_id: "downgrade-remains-blocked-by-suspension-private",
    commitment_id: "downgrade-takes-effect-next-period",
    events: [
      PAYMENT_EVENT,
      {
        id: "downgrade-before-suspend-private",
        type: "downgrade_scheduled",
        nextPlan: "basic",
        effectiveAt: "2026-02-01T00:00:00.000Z"
      },
      {
        id: "suspend-downgrade-private",
        type: "fraud_suspended",
        suspendedAt: "2026-01-20T00:00:00.000Z"
      }
    ],
    assertions: [
      { kind: "billing_status", now: "2026-02-02T00:00:00.000Z", expected: "suspended" },
      { kind: "access", feature: "core", now: "2026-02-02T00:00:00.000Z", expected: false }
    ]
  },
  {
    case_id: "refund-restricts-access-private",
    commitment_id: "refund-chargeback-restricts-without-resurrection",
    events: [
      PAYMENT_EVENT,
      {
        id: "refund-private",
        type: "refund",
        invoiceId: "inv-private-1",
        amount: 5000,
        reversedAt: "2026-01-15T00:00:00.000Z"
      }
    ],
    assertions: [
      { kind: "billing_status", now: "2026-02-01T00:00:00.000Z", expected: "restricted" },
      { kind: "access", feature: "core", now: "2026-02-01T00:00:00.000Z", expected: false },
      { kind: "invoice_field", field: "totalReversed", expected: 5000 },
      { kind: "invoice_field", field: "net", expected: 0 }
    ]
  },
  {
    case_id: "chargeback-restricts-access-private",
    commitment_id: "refund-chargeback-restricts-without-resurrection",
    events: [
      PAYMENT_EVENT,
      {
        id: "chargeback-private",
        type: "chargeback",
        invoiceId: "inv-private-1",
        amount: 5000,
        reversedAt: "2026-01-16T00:00:00.000Z"
      }
    ],
    assertions: [
      { kind: "billing_status", now: "2026-02-01T00:00:00.000Z", expected: "restricted" },
      { kind: "access", feature: "analytics", now: "2026-02-01T00:00:00.000Z", expected: false },
      { kind: "invoice_field", field: "reversalCount", expected: 1 }
    ]
  },
  {
    case_id: "reversal-does-not-resurrect-canceled-access-private",
    commitment_id: "refund-chargeback-restricts-without-resurrection",
    events: [
      PAYMENT_EVENT,
      {
        id: "cancel-before-refund-private",
        type: "cancel_at_period_end",
        canceledAt: "2026-01-15T00:00:00.000Z"
      },
      {
        id: "refund-after-cancel-private",
        type: "refund",
        invoiceId: "inv-private-1",
        amount: 5000,
        reversedAt: "2026-03-02T00:00:00.000Z"
      }
    ],
    assertions: [
      { kind: "billing_status", now: "2026-03-03T00:00:00.000Z", expected: "restricted" },
      { kind: "access", feature: "core", now: "2026-03-03T00:00:00.000Z", expected: false }
    ]
  }
];

export function createSubscriptionEntitlementsOracle(): HiddenOracleAdapter {
  return {
    async run(input) {
      return evaluateSubscriptionEntitlementsWorkspace(input);
    }
  };
}

export async function evaluateSubscriptionEntitlementsWorkspace(
  input: HiddenOracleRunInput
): Promise<HiddenOracleRunResult> {
  const active = new Set(activeCommitments(input.checkpoint_id));
  const caseEvaluations = await evaluateCases(
    input.workspace_path,
    ORACLE_CASES.filter((testCase) => active.has(testCase.commitment_id))
  );
  const checks = [...active].map((commitment_id) =>
    evaluateCommitment(input.checkpoint_id, commitment_id, caseEvaluations)
  );
  const passed = checks.every((check) => check.passed);

  return {
    status: passed ? "ok" : "failed",
    checks
  };
}

function activeCommitments(checkpoint_id: string): readonly string[] {
  return COMMITMENTS_BY_CHECKPOINT[checkpoint_id as SubscriptionCheckpoint] ?? [];
}

function evaluateCommitment(
  checkpoint_id: string,
  commitment_id: string,
  caseEvaluations: CaseEvaluation[]
): OracleCheckResult {
  const cases = caseEvaluations.filter((testCase) => testCase.commitment_id === commitment_id);
  const failingCases = cases.filter((testCase) => !testCase.actual || testCase.error);
  const passed = cases.length > 0 && failingCases.length === 0;

  return {
    check_id: `subscription-entitlements-lifecycle:${checkpoint_id}:${commitment_id}`,
    commitment_id,
    passed,
    details: passed
      ? `${cases.length} hidden ${commitment_id} case(s) passed.`
      : `Failed hidden case(s): ${failingCases.map((testCase) => testCase.case_id).join(", ")}`
  };
}

async function evaluateCases(workspacePath: string, cases: OracleCase[]): Promise<CaseEvaluation[]> {
  if (cases.length === 0) {
    return [];
  }

  try {
    const subscriptionUrl = pathToFileURL(join(workspacePath, "src", "subscription.ts")).href;
    const script = [
      `const subscriptionModule = await import(${JSON.stringify(subscriptionUrl)});`,
      "const { applyEvent, canAccessFeature, getBillingStatus, getInvoiceSummary } = subscriptionModule;",
      `const cases = ${JSON.stringify(cases)};`,
      "const results = [];",
      "for (const testCase of cases) {",
      "  const failures = [];",
      "  let state = {};",
      "  let error;",
      "  try {",
      "    if (typeof applyEvent !== 'function' || typeof canAccessFeature !== 'function' || typeof getBillingStatus !== 'function' || typeof getInvoiceSummary !== 'function') {",
      "      throw new Error('subscription API export is missing');",
      "    }",
      "    for (const event of testCase.events) {",
      "      state = await applyEvent(state, event);",
      "    }",
      "    for (const assertion of testCase.assertions) {",
      "      const failure = evaluateAssertion(assertion, state);",
      "      if (failure) failures.push(failure);",
      "    }",
      "  } catch (caught) {",
      "    error = caught instanceof Error ? caught.message : String(caught);",
      "  }",
      "  results.push({ ...testCase, actual: failures.length === 0 && !error, failures, error });",
      "}",
      "function evaluateAssertion(assertion, state) {",
      "  if (assertion.kind === 'access') {",
      "    const actual = Boolean(canAccessFeature(state, assertion.feature, assertion.now));",
      "    return actual === assertion.expected ? undefined : `${assertion.feature} access at ${assertion.now}: expected ${assertion.expected}, got ${actual}`;",
      "  }",
      "  if (assertion.kind === 'billing_status') {",
      "    const actual = getBillingStatus(state, assertion.now)?.status;",
      "    return actual === assertion.expected ? undefined : `billing status at ${assertion.now}: expected ${assertion.expected}, got ${actual}`;",
      "  }",
      "  if (assertion.kind === 'billing_field') {",
      "    const actual = getBillingStatus(state, assertion.now)?.[assertion.field];",
      "    return Object.is(actual, assertion.expected) ? undefined : `billing ${assertion.field}: expected ${assertion.expected}, got ${actual}`;",
      "  }",
      "  if (assertion.kind === 'invoice_field') {",
      "    const actual = getInvoiceSummary(state)?.[assertion.field];",
      "    return Object.is(actual, assertion.expected) ? undefined : `invoice ${assertion.field}: expected ${assertion.expected}, got ${actual}`;",
      "  }",
      "  return `unknown assertion kind ${assertion.kind}`;",
      "}",
      `console.log(${JSON.stringify(ORACLE_OUTPUT_PREFIX)} + JSON.stringify(results));`
    ].join("\n");
    const { stdout } = await execFileAsync(process.execPath, ["--eval", script], {
      timeout: 5000,
      maxBuffer: 1024 * 1024
    });
    const outputLine = stdout
      .trimEnd()
      .split("\n")
      .findLast((line) => line.startsWith(ORACLE_OUTPUT_PREFIX));

    return outputLine ? JSON.parse(outputLine.slice(ORACLE_OUTPUT_PREFIX.length)) : failedImportCases(cases);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);

    return cases.map((testCase) => ({
      ...testCase,
      actual: false,
      failures: [],
      error: detail
    }));
  }
}

function failedImportCases(cases: OracleCase[]): CaseEvaluation[] {
  return cases.map((testCase) => ({
    ...testCase,
    actual: false,
    failures: [],
    error: "No oracle output was produced."
  }));
}
