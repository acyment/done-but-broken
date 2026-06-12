// Sealed oracle scenario definitions for e1-dispatch-mini. Expected values are NEVER
// written here: the generator computes every expected value from the reference
// implementation. visible=true scenarios are exported as runnable feedback assets and
// quoted verbatim in the visible spec worked examples.
//
// Era discipline (monotone cumulative oracle): corpora whose semantics a later
// checkpoint changes must not appear before that checkpoint. Mixed-shipment orders
// first appear at CP04, partially-returned orders at CP05, cancelled-after-shipment
// orders at CP06.

export type Ev = Record<string, unknown>;

export type Scenario = {
  check_id: string;
  commitment_id: string;
  checkpoint: string;
  visible: boolean;
  events: Ev[];
  query: Record<string, unknown>;
};

const AT = "2026-01-01T00:00:00.000Z";
let seq = 0;

function eid(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

function created(order: string, amounts: number[]): Ev {
  return {
    event_id: eid(`${order}-create`),
    type: "order_created",
    at: AT,
    order_id: order,
    lines: amounts.map((amount_cents, index) => ({ line_id: `${order}-L${index + 1}`, amount_cents }))
  };
}

function paid(order: string): Ev {
  return { event_id: eid(`${order}-pay`), type: "payment_received", at: AT, order_id: order };
}

function ship(order: string, lineIndex: number): Ev {
  return { event_id: eid(`${order}-ship`), type: "line_shipped", at: AT, order_id: order, line_id: `${order}-L${lineIndex}` };
}

function ret(order: string, lineIndex: number): Ev {
  return { event_id: eid(`${order}-ret`), type: "line_returned", at: AT, order_id: order, line_id: `${order}-L${lineIndex}` };
}

function cancel(order: string): Ev {
  return { event_id: eid(`${order}-cancel`), type: "order_cancelled", at: AT, order_id: order };
}

function note(order: string, text: string): Ev {
  return { event_id: eid(`${order}-note`), type: "note_added", at: AT, order_id: order, note: text };
}

function qStatus(order: string) {
  return { kind: "order_status", order_id: order };
}

function qExport(order: string) {
  return { kind: "export_order", order_id: order };
}

function qReimport(order: string) {
  return { kind: "reimport_order", order_id: order };
}

function qDigest() {
  return { kind: "status_digest" };
}

export const SCENARIOS: Scenario[] = [
  // ---- CP01: order notes + pins for all seeded behavior ----
  {
    check_id: "cp01-status-processing",
    commitment_id: "I-STATUS",
    checkpoint: "1",
    visible: true,
    events: [created("O1", [3000, 4000]), paid("O1")],
    query: qStatus("O1")
  },
  {
    check_id: "cp01-status-awaiting",
    commitment_id: "I-STATUS",
    checkpoint: "1",
    visible: false,
    events: [created("O2", [2500])],
    query: qStatus("O2")
  },
  {
    check_id: "cp01-status-shipped",
    commitment_id: "I-STATUS",
    checkpoint: "1",
    visible: false,
    events: [created("O3", [3000, 4000]), paid("O3"), ship("O3", 1), ship("O3", 2)],
    query: qStatus("O3")
  },
  {
    check_id: "cp01-status-cancelled",
    commitment_id: "I-STATUS",
    checkpoint: "1",
    visible: false,
    events: [created("O4", [1500]), cancel("O4")],
    query: qStatus("O4")
  },
  {
    check_id: "cp01-export-note",
    commitment_id: "I-NOTES",
    checkpoint: "1",
    visible: true,
    events: [created("O5", [3000, 4000]), paid("O5"), note("O5", "gift wrap")],
    query: qExport("O5")
  },
  {
    check_id: "cp01-reimport-note",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "1",
    visible: true,
    events: [created("O5", [3000, 4000]), paid("O5"), note("O5", "gift wrap")],
    query: qReimport("O5")
  },
  {
    check_id: "cp01-note-keeps-status",
    commitment_id: "I-NOTES",
    checkpoint: "1",
    visible: true,
    events: [created("O6", [2000]), paid("O6"), note("O6", "leave at door")],
    query: qStatus("O6")
  },
  {
    check_id: "cp01-export-shipped-notes",
    commitment_id: "I-EXPORT",
    checkpoint: "1",
    visible: false,
    events: [created("O7", [3000, 4000]), paid("O7"), ship("O7", 1), ship("O7", 2), note("O7", "fragile"), note("O7", "call first")],
    query: qExport("O7")
  },
  {
    check_id: "cp01-reimport-shipped-notes",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "1",
    visible: false,
    events: [created("O7", [3000, 4000]), paid("O7"), ship("O7", 1), ship("O7", 2), note("O7", "fragile"), note("O7", "call first")],
    query: qReimport("O7")
  },
  {
    check_id: "cp01-export-plain",
    commitment_id: "I-EXPORT",
    checkpoint: "1",
    visible: false,
    events: [created("O8", [9900])],
    query: qExport("O8")
  },

  // ---- CP02: digest revenue (buckets gain total_cents; lifecycle order; omit empty) ----
  {
    check_id: "cp02-digest-mixed-statuses",
    commitment_id: "I-DIGEST",
    checkpoint: "2",
    visible: true,
    events: [
      created("D1", [3000]),
      created("D2", [4000, 1000]),
      paid("D2"),
      created("D3", [2000]),
      paid("D3"),
      ship("D3", 1)
    ],
    query: qDigest()
  },
  {
    check_id: "cp02-digest-omit-empty",
    commitment_id: "I-DIGEST",
    checkpoint: "2",
    visible: true,
    events: [created("D4", [5000]), paid("D4"), created("D5", [1500]), paid("D5"), ship("D5", 1)],
    query: qDigest()
  },
  {
    check_id: "cp02-digest-sums-bucket",
    commitment_id: "I-DIGEST",
    checkpoint: "2",
    visible: true,
    events: [created("D6", [3000]), paid("D6"), created("D7", [4500, 500]), paid("D7")],
    query: qDigest()
  },
  {
    check_id: "cp02-digest-cancelled",
    commitment_id: "I-DIGEST",
    checkpoint: "2",
    visible: false,
    events: [created("D8", [2500]), cancel("D8"), created("D9", [1000]), paid("D9")],
    query: qDigest()
  },
  {
    check_id: "cp02-digest-single",
    commitment_id: "I-DIGEST",
    checkpoint: "2",
    visible: false,
    events: [created("DA", [700, 800])],
    query: qDigest()
  },
  {
    check_id: "cp02-digest-notes-ignored",
    commitment_id: "I-DIGEST",
    checkpoint: "2",
    visible: false,
    events: [created("DB", [6000]), paid("DB"), note("DB", "expedite")],
    query: qDigest()
  },

  // ---- CP03: line returns (full-return semantics; export/parse/digest touched) ----
  {
    check_id: "cp03-status-returned",
    commitment_id: "I-STATUS",
    checkpoint: "3",
    visible: true,
    events: [created("R1", [3000, 4000]), paid("R1"), ship("R1", 1), ship("R1", 2), ret("R1", 1), ret("R1", 2)],
    query: qStatus("R1")
  },
  {
    check_id: "cp03-export-returned",
    commitment_id: "I-EXPORT",
    checkpoint: "3",
    visible: true,
    events: [created("R2", [2000]), paid("R2"), ship("R2", 1), ret("R2", 1)],
    query: qExport("R2")
  },
  {
    check_id: "cp03-reimport-returned",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "3",
    visible: true,
    events: [created("R2", [2000]), paid("R2"), ship("R2", 1), ret("R2", 1)],
    query: qReimport("R2")
  },
  {
    check_id: "cp03-digest-returned",
    commitment_id: "I-DIGEST",
    checkpoint: "3",
    visible: true,
    events: [
      created("R3", [2000]),
      paid("R3"),
      ship("R3", 1),
      ret("R3", 1),
      created("R4", [5000]),
      paid("R4")
    ],
    query: qDigest()
  },
  {
    check_id: "cp03-return-unshipped-ignored",
    commitment_id: "I-STATUS",
    checkpoint: "3",
    visible: false,
    events: [created("R5", [3000]), paid("R5"), ret("R5", 1)],
    query: qStatus("R5")
  },
  {
    check_id: "cp03-export-returned-note",
    commitment_id: "I-EXPORT",
    checkpoint: "3",
    visible: false,
    events: [created("R6", [4000]), paid("R6"), note("R6", "defective"), ship("R6", 1), ret("R6", 1)],
    query: qExport("R6")
  },
  {
    check_id: "cp03-reimport-two-returned",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "3",
    visible: false,
    events: [created("R7", [1000, 2000]), paid("R7"), ship("R7", 1), ship("R7", 2), ret("R7", 1), ret("R7", 2)],
    query: qReimport("R7")
  },
  {
    check_id: "cp03-digest-mixed",
    commitment_id: "I-DIGEST",
    checkpoint: "3",
    visible: false,
    events: [
      created("R8", [1000]),
      paid("R8"),
      ship("R8", 1),
      ret("R8", 1),
      created("R9", [2000]),
      paid("R9"),
      ship("R9", 1),
      created("RA", [3000])
    ],
    query: qDigest()
  },
  {
    check_id: "cp03-status-single-returned",
    commitment_id: "I-STATUS",
    checkpoint: "3",
    visible: false,
    events: [created("RB", [4400]), paid("RB"), ship("RB", 1), ret("RB", 1)],
    query: qStatus("RB")
  },

  // ---- CP04: CORRECTION — partial shipments (mixed paid orders: processing -> partially_shipped) ----
  {
    check_id: "cp04-status-partial",
    commitment_id: "I-STATUS",
    checkpoint: "4",
    visible: true,
    events: [created("P1", [3000, 4000]), paid("P1"), ship("P1", 1)],
    query: qStatus("P1")
  },
  {
    check_id: "cp04-export-partial",
    commitment_id: "I-EXPORT",
    checkpoint: "4",
    visible: true,
    events: [created("P1", [3000, 4000]), paid("P1"), ship("P1", 1)],
    query: qExport("P1")
  },
  {
    check_id: "cp04-reimport-partial",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "4",
    visible: true,
    events: [created("P1", [3000, 4000]), paid("P1"), ship("P1", 1)],
    query: qReimport("P1")
  },
  {
    check_id: "cp04-digest-partial",
    commitment_id: "I-DIGEST",
    checkpoint: "4",
    visible: true,
    events: [
      created("P2", [2000, 2000]),
      paid("P2"),
      ship("P2", 1),
      created("P3", [5000]),
      paid("P3"),
      created("P4", [1000]),
      paid("P4"),
      ship("P4", 1)
    ],
    query: qDigest()
  },
  {
    check_id: "cp04-status-two-of-three",
    commitment_id: "I-STATUS",
    checkpoint: "4",
    visible: false,
    events: [created("P5", [1000, 2000, 3000]), paid("P5"), ship("P5", 1), ship("P5", 3)],
    query: qStatus("P5")
  },
  {
    check_id: "cp04-reimport-two-of-three",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "4",
    visible: false,
    events: [created("P5", [1000, 2000, 3000]), paid("P5"), ship("P5", 1), ship("P5", 3)],
    query: qReimport("P5")
  },
  {
    check_id: "cp04-digest-three-buckets",
    commitment_id: "I-DIGEST",
    checkpoint: "4",
    visible: false,
    events: [
      created("P6", [2000, 2000]),
      paid("P6"),
      ship("P6", 1),
      created("P7", [3000]),
      paid("P7"),
      created("P8", [4000]),
      paid("P8"),
      ship("P8", 1)
    ],
    query: qDigest()
  },
  {
    check_id: "cp04-export-partial-note",
    commitment_id: "I-EXPORT",
    checkpoint: "4",
    visible: false,
    events: [created("P9", [1500, 1500]), paid("P9"), note("P9", "split shipment ok"), ship("P9", 2)],
    query: qExport("P9")
  },
  {
    check_id: "cp04-status-completes-to-shipped",
    commitment_id: "I-STATUS",
    checkpoint: "4",
    visible: false,
    events: [created("PA", [1000, 2000]), paid("PA"), ship("PA", 1), ship("PA", 2)],
    query: qStatus("PA")
  },

  // ---- CP05: CORRECTION — partial returns (fully shipped, some returned: shipped -> partially_returned) ----
  {
    check_id: "cp05-status-partial-return",
    commitment_id: "I-STATUS",
    checkpoint: "5",
    visible: true,
    events: [created("Q1", [3000, 4000]), paid("Q1"), ship("Q1", 1), ship("Q1", 2), ret("Q1", 1)],
    query: qStatus("Q1")
  },
  {
    check_id: "cp05-reimport-partial-return",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "5",
    visible: true,
    events: [created("Q1", [3000, 4000]), paid("Q1"), ship("Q1", 1), ship("Q1", 2), ret("Q1", 1)],
    query: qReimport("Q1")
  },
  {
    check_id: "cp05-digest-partial-return",
    commitment_id: "I-DIGEST",
    checkpoint: "5",
    visible: true,
    events: [
      created("Q2", [2000, 2000]),
      paid("Q2"),
      ship("Q2", 1),
      ship("Q2", 2),
      ret("Q2", 1),
      created("Q3", [5000]),
      paid("Q3"),
      ship("Q3", 1)
    ],
    query: qDigest()
  },
  {
    check_id: "cp05-export-partial-return",
    commitment_id: "I-EXPORT",
    checkpoint: "5",
    visible: false,
    events: [created("Q4", [1000, 9000]), paid("Q4"), ship("Q4", 1), ship("Q4", 2), ret("Q4", 2)],
    query: qExport("Q4")
  },
  {
    check_id: "cp05-status-one-of-three-returned",
    commitment_id: "I-STATUS",
    checkpoint: "5",
    visible: false,
    events: [
      created("Q5", [1000, 2000, 3000]),
      paid("Q5"),
      ship("Q5", 1),
      ship("Q5", 2),
      ship("Q5", 3),
      ret("Q5", 2)
    ],
    query: qStatus("Q5")
  },
  {
    check_id: "cp05-digest-return-spectrum",
    commitment_id: "I-DIGEST",
    checkpoint: "5",
    visible: false,
    events: [
      created("Q6", [1000, 1000]),
      paid("Q6"),
      ship("Q6", 1),
      ship("Q6", 2),
      ret("Q6", 1),
      created("Q7", [2000]),
      paid("Q7"),
      ship("Q7", 1),
      ret("Q7", 1),
      created("Q8", [3000]),
      paid("Q8"),
      ship("Q8", 1)
    ],
    query: qDigest()
  },
  {
    check_id: "cp05-reimport-return-flags",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "5",
    visible: false,
    events: [
      created("Q9", [4000, 6000]),
      paid("Q9"),
      ship("Q9", 1),
      ship("Q9", 2),
      ret("Q9", 2)
    ],
    query: qReimport("Q9")
  },
  {
    check_id: "cp05-mixed-ship-beats-return",
    commitment_id: "I-STATUS",
    checkpoint: "5",
    visible: false,
    events: [created("QA", [1000, 2000, 3000]), paid("QA"), ship("QA", 1), ship("QA", 2), ret("QA", 1)],
    query: qStatus("QA")
  },

  // ---- CP06: CORRECTION — cancellation after shipment (cancelled -> cancelled_partial + requires_refund) ----
  {
    check_id: "cp06-status-cancel-partial",
    commitment_id: "I-STATUS",
    checkpoint: "6",
    visible: true,
    events: [created("C1", [3000, 4000]), paid("C1"), ship("C1", 1), cancel("C1")],
    query: qStatus("C1")
  },
  {
    check_id: "cp06-export-requires-refund",
    commitment_id: "I-EXPORT",
    checkpoint: "6",
    visible: true,
    events: [created("C1", [3000, 4000]), paid("C1"), ship("C1", 1), cancel("C1")],
    query: qExport("C1")
  },
  {
    check_id: "cp06-reimport-cancel-partial",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "6",
    visible: true,
    events: [created("C1", [3000, 4000]), paid("C1"), ship("C1", 1), cancel("C1")],
    query: qReimport("C1")
  },
  {
    check_id: "cp06-digest-cancel-partial",
    commitment_id: "I-DIGEST",
    checkpoint: "6",
    visible: false,
    events: [
      created("C2", [2000]),
      paid("C2"),
      ship("C2", 1),
      cancel("C2"),
      created("C3", [1000]),
      cancel("C3"),
      created("C4", [5000]),
      paid("C4")
    ],
    query: qDigest()
  },
  {
    check_id: "cp06-status-cancel-clean",
    commitment_id: "I-STATUS",
    checkpoint: "6",
    visible: false,
    events: [created("C5", [2500]), paid("C5"), cancel("C5")],
    query: qStatus("C5")
  },
  {
    check_id: "cp06-cancel-fully-shipped",
    commitment_id: "I-STATUS",
    checkpoint: "6",
    visible: false,
    events: [created("C6", [1000, 2000]), paid("C6"), ship("C6", 1), ship("C6", 2), cancel("C6")],
    query: qStatus("C6")
  },
  {
    check_id: "cp06-reimport-refund-flag",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "6",
    visible: false,
    events: [created("C7", [8000, 500]), paid("C7"), ship("C7", 2), cancel("C7")],
    query: qReimport("C7")
  }
];
