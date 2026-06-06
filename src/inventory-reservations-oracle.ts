import { execFile } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import type { HiddenOracleAdapter, HiddenOracleRunInput, HiddenOracleRunResult } from "./runner";
import type { OracleCheckResult } from "./result-schema";

const execFileAsync = promisify(execFile);
const ORACLE_OUTPUT_PREFIX = "__INVENTORY_RESERVATIONS_ORACLE_OUTPUT__";

const COMMITMENTS_BY_CHECKPOINT = {
  I01: ["stock-received-increases-sellable"],
  I02: ["stock-received-increases-sellable", "reservation-holds-stock-until-expiration"],
  I03: [
    "stock-received-increases-sellable",
    "reservation-holds-stock-until-expiration",
    "order-confirmation-commits-held-stock"
  ],
  I04: [
    "stock-received-increases-sellable",
    "reservation-holds-stock-until-expiration",
    "order-confirmation-commits-held-stock",
    "reservation-expiration-releases-stock"
  ],
  I05: [
    "stock-received-increases-sellable",
    "reservation-holds-stock-until-expiration",
    "order-confirmation-commits-held-stock",
    "reservation-expiration-releases-stock",
    "cancellation-releases-unshipped-allocations"
  ],
  I06: [
    "stock-received-increases-sellable",
    "reservation-holds-stock-until-expiration",
    "order-confirmation-commits-held-stock",
    "reservation-expiration-releases-stock",
    "cancellation-releases-unshipped-allocations",
    "duplicate-events-are-idempotent"
  ],
  I07: [
    "stock-received-increases-sellable",
    "reservation-holds-stock-until-expiration",
    "order-confirmation-commits-held-stock",
    "reservation-expiration-releases-stock",
    "cancellation-releases-unshipped-allocations",
    "duplicate-events-are-idempotent",
    "shipment-consumes-committed-stock"
  ],
  I08: [
    "stock-received-increases-sellable",
    "reservation-holds-stock-until-expiration",
    "order-confirmation-commits-held-stock",
    "reservation-expiration-releases-stock",
    "cancellation-releases-unshipped-allocations",
    "duplicate-events-are-idempotent",
    "shipment-consumes-committed-stock",
    "restock-fills-backorders-fifo"
  ],
  I09: [
    "stock-received-increases-sellable",
    "reservation-holds-stock-until-expiration",
    "order-confirmation-commits-held-stock",
    "reservation-expiration-releases-stock",
    "cancellation-releases-unshipped-allocations",
    "duplicate-events-are-idempotent",
    "shipment-consumes-committed-stock",
    "restock-fills-backorders-fifo",
    "returns-restore-only-sellable-stock"
  ]
} as const;

type InventoryCheckpoint = keyof typeof COMMITMENTS_BY_CHECKPOINT;

type OracleAssertion =
  | {
      kind: "availability_field";
      sku: string;
      now: string;
      field: string;
      expected: unknown;
    }
  | {
      kind: "can_reserve";
      sku: string;
      quantity: number;
      now: string;
      expected: boolean;
    }
  | {
      kind: "reservation_status";
      reservationId: string;
      now: string;
      expected: string;
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

const RECEIVE_FIVE = {
  id: "receive-private-1",
  type: "stock_received",
  sku: "sku-private",
  quantity: 5,
  receivedAt: "2026-01-01T00:00:00.000Z"
};

const HELD_RESERVATION = {
  id: "reserve-private-1",
  type: "reservation_requested",
  reservationId: "res-private-1",
  sku: "sku-private",
  quantity: 3,
  requestedAt: "2026-01-01T01:00:00.000Z",
  expiresAt: "2026-01-03T00:00:00.000Z"
};

const CONFIRM_HELD = {
  id: "confirm-private-1",
  type: "order_confirmed",
  reservationId: "res-private-1",
  orderId: "order-private-1",
  confirmedAt: "2026-01-01T02:00:00.000Z"
};

const SHIP_HELD = {
  id: "ship-private-1",
  type: "order_shipped",
  reservationId: "res-private-1",
  shipmentId: "ship-private-1",
  shippedAt: "2026-01-01T03:00:00.000Z"
};

const ORACLE_CASES: OracleCase[] = [
  {
    case_id: "stock-received-sellable-private",
    commitment_id: "stock-received-increases-sellable",
    events: [RECEIVE_FIVE],
    assertions: [
      { kind: "availability_field", sku: "sku-private", now: "2026-01-01T00:01:00.000Z", field: "onHand", expected: 5 },
      { kind: "availability_field", sku: "sku-private", now: "2026-01-01T00:01:00.000Z", field: "sellable", expected: 5 },
      { kind: "can_reserve", sku: "sku-private", quantity: 5, now: "2026-01-01T00:01:00.000Z", expected: true },
      { kind: "can_reserve", sku: "sku-private", quantity: 6, now: "2026-01-01T00:01:00.000Z", expected: false }
    ]
  },
  {
    case_id: "reservation-hold-before-expiration-private",
    commitment_id: "reservation-holds-stock-until-expiration",
    events: [RECEIVE_FIVE, HELD_RESERVATION],
    assertions: [
      { kind: "reservation_status", reservationId: "res-private-1", now: "2026-01-02T00:00:00.000Z", expected: "held" },
      { kind: "availability_field", sku: "sku-private", now: "2026-01-02T00:00:00.000Z", field: "held", expected: 3 },
      { kind: "availability_field", sku: "sku-private", now: "2026-01-02T00:00:00.000Z", field: "sellable", expected: 2 }
    ]
  },
  {
    case_id: "confirmation-commits-held-stock-private",
    commitment_id: "order-confirmation-commits-held-stock",
    events: [RECEIVE_FIVE, HELD_RESERVATION, CONFIRM_HELD],
    assertions: [
      { kind: "reservation_status", reservationId: "res-private-1", now: "2026-01-02T00:00:00.000Z", expected: "confirmed" },
      { kind: "availability_field", sku: "sku-private", now: "2026-01-02T00:00:00.000Z", field: "held", expected: 0 },
      { kind: "availability_field", sku: "sku-private", now: "2026-01-02T00:00:00.000Z", field: "committed", expected: 3 },
      { kind: "availability_field", sku: "sku-private", now: "2026-01-02T00:00:00.000Z", field: "sellable", expected: 2 }
    ]
  },
  {
    case_id: "expiration-releases-held-stock-private",
    commitment_id: "reservation-expiration-releases-stock",
    events: [RECEIVE_FIVE, HELD_RESERVATION],
    assertions: [
      { kind: "reservation_status", reservationId: "res-private-1", now: "2026-01-03T00:00:00.000Z", expected: "expired" },
      { kind: "availability_field", sku: "sku-private", now: "2026-01-03T00:00:00.000Z", field: "held", expected: 0 },
      { kind: "availability_field", sku: "sku-private", now: "2026-01-03T00:00:00.000Z", field: "sellable", expected: 5 }
    ]
  },
  {
    case_id: "cancellation-releases-confirmed-stock-private",
    commitment_id: "cancellation-releases-unshipped-allocations",
    events: [
      RECEIVE_FIVE,
      HELD_RESERVATION,
      CONFIRM_HELD,
      {
        id: "cancel-private-1",
        type: "reservation_cancelled",
        reservationId: "res-private-1",
        canceledAt: "2026-01-01T04:00:00.000Z"
      }
    ],
    assertions: [
      { kind: "reservation_status", reservationId: "res-private-1", now: "2026-01-02T00:00:00.000Z", expected: "canceled" },
      { kind: "availability_field", sku: "sku-private", now: "2026-01-02T00:00:00.000Z", field: "committed", expected: 0 },
      { kind: "availability_field", sku: "sku-private", now: "2026-01-02T00:00:00.000Z", field: "sellable", expected: 5 }
    ]
  },
  {
    case_id: "duplicate-stock-and-reservation-ids-private",
    commitment_id: "duplicate-events-are-idempotent",
    events: [RECEIVE_FIVE, RECEIVE_FIVE, HELD_RESERVATION, HELD_RESERVATION],
    assertions: [
      { kind: "availability_field", sku: "sku-private", now: "2026-01-02T00:00:00.000Z", field: "onHand", expected: 5 },
      { kind: "availability_field", sku: "sku-private", now: "2026-01-02T00:00:00.000Z", field: "held", expected: 3 },
      { kind: "availability_field", sku: "sku-private", now: "2026-01-02T00:00:00.000Z", field: "sellable", expected: 2 }
    ]
  },
  {
    case_id: "shipment-consumes-stock-and-cannot-be-canceled-private",
    commitment_id: "shipment-consumes-committed-stock",
    events: [
      RECEIVE_FIVE,
      HELD_RESERVATION,
      CONFIRM_HELD,
      SHIP_HELD,
      {
        id: "cancel-after-ship-private-1",
        type: "reservation_cancelled",
        reservationId: "res-private-1",
        canceledAt: "2026-01-01T04:00:00.000Z"
      }
    ],
    assertions: [
      { kind: "reservation_status", reservationId: "res-private-1", now: "2026-01-02T00:00:00.000Z", expected: "shipped" },
      { kind: "availability_field", sku: "sku-private", now: "2026-01-02T00:00:00.000Z", field: "onHand", expected: 2 },
      { kind: "availability_field", sku: "sku-private", now: "2026-01-02T00:00:00.000Z", field: "shipped", expected: 3 },
      { kind: "availability_field", sku: "sku-private", now: "2026-01-02T00:00:00.000Z", field: "sellable", expected: 2 }
    ]
  },
  {
    case_id: "restock-fills-oldest-backorder-first-private",
    commitment_id: "restock-fills-backorders-fifo",
    events: [
      {
        id: "backorder-private-1",
        type: "reservation_requested",
        reservationId: "backorder-private-1",
        sku: "sku-private",
        quantity: 2,
        requestedAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-01-10T00:00:00.000Z"
      },
      {
        id: "backorder-private-2",
        type: "reservation_requested",
        reservationId: "backorder-private-2",
        sku: "sku-private",
        quantity: 2,
        requestedAt: "2026-01-01T00:05:00.000Z",
        expiresAt: "2026-01-10T00:00:00.000Z"
      },
      {
        id: "restock-private-1",
        type: "stock_received",
        sku: "sku-private",
        quantity: 3,
        receivedAt: "2026-01-01T01:00:00.000Z"
      }
    ],
    assertions: [
      { kind: "reservation_status", reservationId: "backorder-private-1", now: "2026-01-01T02:00:00.000Z", expected: "held" },
      { kind: "reservation_status", reservationId: "backorder-private-2", now: "2026-01-01T02:00:00.000Z", expected: "backordered" },
      { kind: "availability_field", sku: "sku-private", now: "2026-01-01T02:00:00.000Z", field: "held", expected: 2 },
      { kind: "availability_field", sku: "sku-private", now: "2026-01-01T02:00:00.000Z", field: "backordered", expected: 2 }
    ]
  },
  {
    case_id: "sellable-return-restores-stock-private",
    commitment_id: "returns-restore-only-sellable-stock",
    events: [
      RECEIVE_FIVE,
      HELD_RESERVATION,
      CONFIRM_HELD,
      SHIP_HELD,
      {
        id: "sellable-return-private-1",
        type: "item_returned",
        reservationId: "res-private-1",
        sku: "sku-private",
        quantity: 1,
        disposition: "sellable",
        returnedAt: "2026-01-05T00:00:00.000Z"
      }
    ],
    assertions: [
      { kind: "availability_field", sku: "sku-private", now: "2026-01-05T01:00:00.000Z", field: "onHand", expected: 3 },
      { kind: "availability_field", sku: "sku-private", now: "2026-01-05T01:00:00.000Z", field: "returnedSellable", expected: 1 }
    ]
  },
  {
    case_id: "damaged-return-does-not-restore-stock-private",
    commitment_id: "returns-restore-only-sellable-stock",
    events: [
      RECEIVE_FIVE,
      HELD_RESERVATION,
      CONFIRM_HELD,
      SHIP_HELD,
      {
        id: "damaged-return-private-1",
        type: "item_returned",
        reservationId: "res-private-1",
        sku: "sku-private",
        quantity: 1,
        disposition: "damaged",
        returnedAt: "2026-01-05T00:00:00.000Z"
      }
    ],
    assertions: [
      { kind: "availability_field", sku: "sku-private", now: "2026-01-05T01:00:00.000Z", field: "onHand", expected: 2 },
      { kind: "availability_field", sku: "sku-private", now: "2026-01-05T01:00:00.000Z", field: "damagedReturns", expected: 1 }
    ]
  }
];

export function createInventoryReservationsOracle(): HiddenOracleAdapter {
  return {
    async run(input) {
      return evaluateInventoryReservationsWorkspace(input);
    }
  };
}

export async function evaluateInventoryReservationsWorkspace(
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
  return COMMITMENTS_BY_CHECKPOINT[checkpoint_id as InventoryCheckpoint] ?? [];
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
    check_id: `inventory-reservations-lifecycle:${checkpoint_id}:${commitment_id}`,
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
    const inventoryUrl = pathToFileURL(join(workspacePath, "src", "inventory.ts")).href;
    const script = [
      `const inventoryModule = await import(${JSON.stringify(inventoryUrl)});`,
      "const { applyEvent, canReserve, getAvailability, getReservationStatus } = inventoryModule;",
      `const cases = ${JSON.stringify(cases)};`,
      "const results = [];",
      "for (const testCase of cases) {",
      "  const failures = [];",
      "  let state = {};",
      "  let error;",
      "  try {",
      "    if (typeof applyEvent !== 'function' || typeof canReserve !== 'function' || typeof getAvailability !== 'function' || typeof getReservationStatus !== 'function') {",
      "      throw new Error('inventory API export is missing');",
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
      "  if (assertion.kind === 'availability_field') {",
      "    const actual = getAvailability(state, assertion.sku, assertion.now)?.[assertion.field];",
      "    return Object.is(actual, assertion.expected) ? undefined : `availability ${assertion.field} for ${assertion.sku} at ${assertion.now}: expected ${assertion.expected}, got ${actual}`;",
      "  }",
      "  if (assertion.kind === 'can_reserve') {",
      "    const actual = Boolean(canReserve(state, assertion.sku, assertion.quantity, assertion.now));",
      "    return actual === assertion.expected ? undefined : `canReserve ${assertion.sku} x${assertion.quantity} at ${assertion.now}: expected ${assertion.expected}, got ${actual}`;",
      "  }",
      "  if (assertion.kind === 'reservation_status') {",
      "    const actual = getReservationStatus(state, assertion.reservationId, assertion.now)?.status;",
      "    return actual === assertion.expected ? undefined : `reservation ${assertion.reservationId} at ${assertion.now}: expected ${assertion.expected}, got ${actual}`;",
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
