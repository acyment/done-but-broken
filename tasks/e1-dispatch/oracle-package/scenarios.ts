// Sealed oracle scenario definitions for e1-dispatch.
// Expected values are NEVER written here: the generator computes every expected value
// from the reference implementation. visible=true scenarios become runnable feedback
// assets and are quoted verbatim in visible spec worked examples.
//
// Partition ledger (era-stability law):
//   partial shipments (mixed shipped/unshipped): first appear CP04
//   shipment metadata (carrier/tracking):        first appear CP05
//   partial returns (some returned, not all):    first appear CP06
//   partial payments (paid_cents > 0, !paid):    first appear CP07
//   cancel-after-shipment:                       first appear CP08
//   refunds (refund_issued / refunded lines):    first appear CP09
//   full-returned + full-refunded (→ closed):    first appear CP10
//   receivables_digest queries:                  first appear CP11
//   partial-payment-then-cancel (→ owing):       first appear CP12
//
// Sequence numbers are global (eid function increments seq) so event_ids are unique.

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

function partPay(order: string, amount: number): Ev {
  return { event_id: eid(`${order}-ppay`), type: "partial_payment_received", at: AT, order_id: order, amount_cents: amount };
}

function ship(order: string, lineIndex: number): Ev {
  return { event_id: eid(`${order}-ship`), type: "line_shipped", at: AT, order_id: order, line_id: `${order}-L${lineIndex}` };
}

function shipWith(order: string, lineIndex: number, carrier: string, tracking: string): Ev {
  return {
    event_id: eid(`${order}-ship`),
    type: "line_shipped",
    at: AT,
    order_id: order,
    line_id: `${order}-L${lineIndex}`,
    carrier,
    tracking
  };
}

function ret(order: string, lineIndex: number): Ev {
  return { event_id: eid(`${order}-ret`), type: "line_returned", at: AT, order_id: order, line_id: `${order}-L${lineIndex}` };
}

function refund(order: string, lineIndex: number): Ev {
  return { event_id: eid(`${order}-rfnd`), type: "refund_issued", at: AT, order_id: order, line_id: `${order}-L${lineIndex}` };
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

function qReceivables() {
  return { kind: "receivables_digest" };
}

export const SCENARIOS: Scenario[] = [
  // ---- CP01: order notes ----
  // Sites demanded: orders, render, parse
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
    check_id: "cp01-export-cancelled-no-notes",
    commitment_id: "I-EXPORT",
    checkpoint: "1",
    visible: false,
    events: [created("O8", [5000]), cancel("O8")],
    query: qExport("O8")
  },
  {
    check_id: "cp01-reimport-awaiting-no-notes",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "1",
    visible: false,
    events: [created("O9", [2000])],
    query: qReimport("O9")
  },
  {
    check_id: "cp01-export-two-notes",
    commitment_id: "I-NOTES",
    checkpoint: "1",
    visible: false,
    events: [created("OA", [6000]), paid("OA"), note("OA", "urgent"), note("OA", "fragile")],
    query: qExport("OA")
  },

  // ---- CP02: digest revenue (total_cents per bucket) ----
  // Sites demanded: digest
  {
    check_id: "cp02-digest-single-bucket",
    commitment_id: "I-DIGEST",
    checkpoint: "2",
    visible: true,
    events: [created("D1", [3000, 4000]), paid("D1"), created("D2", [5000]), paid("D2")],
    query: qDigest()
  },
  {
    check_id: "cp02-digest-two-buckets",
    commitment_id: "I-DIGEST",
    checkpoint: "2",
    visible: true,
    events: [created("D3", [2000]), created("D4", [7000]), paid("D4")],
    query: qDigest()
  },
  {
    check_id: "cp02-digest-shipped-revenue",
    commitment_id: "I-DIGEST",
    checkpoint: "2",
    visible: false,
    events: [created("D5", [1000, 2000]), paid("D5"), ship("D5", 1), ship("D5", 2)],
    query: qDigest()
  },
  {
    check_id: "cp02-digest-cancelled-revenue",
    commitment_id: "I-DIGEST",
    checkpoint: "2",
    visible: false,
    events: [created("D6", [8000]), paid("D6"), cancel("D6")],
    query: qDigest()
  },
  {
    check_id: "cp02-digest-omits-empty-buckets",
    commitment_id: "I-DIGEST",
    checkpoint: "2",
    visible: false,
    events: [created("D7", [3000]), paid("D7")],
    query: qDigest()
  },
  {
    check_id: "cp02-digest-multi-order-same-bucket",
    commitment_id: "I-DIGEST",
    checkpoint: "2",
    visible: false,
    events: [
      created("D8", [4000]),
      paid("D8"),
      created("D9", [6000]),
      paid("D9")
    ],
    query: qDigest()
  },

  // ---- CP03: line returns; full-return status ----
  // Sites demanded: orders, render, parse, digest
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
    events: [created("R2", [5000]), paid("R2"), ship("R2", 1), ret("R2", 1)],
    query: qExport("R2")
  },
  {
    check_id: "cp03-reimport-returned",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "3",
    visible: true,
    events: [created("R2", [5000]), paid("R2"), ship("R2", 1), ret("R2", 1)],
    query: qReimport("R2")
  },
  {
    check_id: "cp03-digest-returned-bucket",
    commitment_id: "I-DIGEST",
    checkpoint: "3",
    visible: true,
    events: [
      created("R3", [3000]), paid("R3"), ship("R3", 1), ret("R3", 1),
      created("R4", [5000]), paid("R4")
    ],
    query: qDigest()
  },
  {
    check_id: "cp03-return-requires-shipment",
    commitment_id: "I-STATUS",
    checkpoint: "3",
    visible: false,
    events: [created("R5", [2000]), paid("R5"), ret("R5", 1)],
    query: qStatus("R5")
  },
  {
    check_id: "cp03-export-return-flag",
    commitment_id: "I-EXPORT",
    checkpoint: "3",
    visible: false,
    events: [created("R6", [4000, 6000]), paid("R6"), ship("R6", 1), ship("R6", 2), ret("R6", 2)],
    query: qExport("R6")
  },
  {
    check_id: "cp03-reimport-two-returns",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "3",
    visible: false,
    events: [created("R7", [3000, 3000, 4000]), paid("R7"), ship("R7", 1), ship("R7", 2), ship("R7", 3), ret("R7", 1), ret("R7", 2), ret("R7", 3)],
    query: qReimport("R7")
  },
  {
    check_id: "cp03-digest-mixed-buckets-returned",
    commitment_id: "I-DIGEST",
    checkpoint: "3",
    visible: false,
    events: [
      created("R8", [2000]), paid("R8"), ship("R8", 1), ret("R8", 1),
      created("R9", [3000]), paid("R9"), ship("R9", 1),
      created("RA", [4000])
    ],
    query: qDigest()
  },
  {
    check_id: "cp03-status-shipped-not-returned",
    commitment_id: "I-STATUS",
    checkpoint: "3",
    visible: false,
    events: [created("RB", [1000]), paid("RB"), ship("RB", 1)],
    query: qStatus("RB")
  },
  {
    check_id: "cp03-reimport-no-return",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "3",
    visible: false,
    events: [created("RC", [9000]), paid("RC"), ship("RC", 1)],
    query: qReimport("RC")
  },
  {
    check_id: "cp03-status-single-line-returned",
    commitment_id: "I-STATUS",
    checkpoint: "3",
    visible: false,
    events: [created("RD", [4000]), paid("RD"), ship("RD", 1), ret("RD", 1)],
    query: qStatus("RD")
  },
  {
    check_id: "cp03-digest-returned-only",
    commitment_id: "I-DIGEST",
    checkpoint: "3",
    visible: false,
    events: [
      created("RE", [2000]), paid("RE"), ship("RE", 1), ret("RE", 1),
      created("RF", [3000]), paid("RF"), ship("RF", 1), ret("RF", 1)
    ],
    query: qDigest()
  },

  // ---- CP04: CORRECTION — partial shipments → partially_shipped ----
  // Sites demanded: orders, render, parse, digest
  {
    check_id: "cp04-status-partial-ship",
    commitment_id: "I-STATUS",
    checkpoint: "4",
    visible: true,
    events: [created("P1", [3000, 4000]), paid("P1"), ship("P1", 1)],
    query: qStatus("P1")
  },
  {
    check_id: "cp04-export-partial-ship",
    commitment_id: "I-EXPORT",
    checkpoint: "4",
    visible: true,
    events: [created("P1", [3000, 4000]), paid("P1"), ship("P1", 1)],
    query: qExport("P1")
  },
  {
    check_id: "cp04-reimport-partial-ship",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "4",
    visible: true,
    events: [created("P1", [3000, 4000]), paid("P1"), ship("P1", 1)],
    query: qReimport("P1")
  },
  {
    check_id: "cp04-digest-partial-ship",
    commitment_id: "I-DIGEST",
    checkpoint: "4",
    visible: true,
    events: [
      created("P2", [2000, 2000]), paid("P2"), ship("P2", 1),
      created("P3", [5000]), paid("P3"),
      created("P4", [1000]), paid("P4"), ship("P4", 1)
    ],
    query: qDigest()
  },
  {
    check_id: "cp04-status-completes-to-shipped",
    commitment_id: "I-STATUS",
    checkpoint: "4",
    visible: false,
    events: [created("P5", [1000, 2000]), paid("P5"), ship("P5", 1), ship("P5", 2)],
    query: qStatus("P5")
  },
  {
    check_id: "cp04-export-partial-with-note",
    commitment_id: "I-EXPORT",
    checkpoint: "4",
    visible: false,
    events: [created("P6", [1500, 1500]), paid("P6"), note("P6", "split shipment ok"), ship("P6", 2)],
    query: qExport("P6")
  },
  {
    check_id: "cp04-reimport-partial-ship-notes",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "4",
    visible: false,
    events: [created("P7", [2000, 3000]), paid("P7"), note("P7", "fragile"), ship("P7", 1)],
    query: qReimport("P7")
  },
  {
    check_id: "cp04-digest-multi-bucket",
    commitment_id: "I-DIGEST",
    checkpoint: "4",
    visible: false,
    events: [
      created("P8", [2000, 2000]), paid("P8"), ship("P8", 1),
      created("P9", [3000]), paid("P9"),
      created("PA", [4000]), paid("PA"),
      ship("PA", 1)
    ],
    query: qDigest()
  },
  {
    check_id: "cp04-status-three-lines-one-shipped",
    commitment_id: "I-STATUS",
    checkpoint: "4",
    visible: false,
    events: [created("PB", [1000, 2000, 3000]), paid("PB"), ship("PB", 2)],
    query: qStatus("PB")
  },
  {
    check_id: "cp04-export-partial-three-lines",
    commitment_id: "I-EXPORT",
    checkpoint: "4",
    visible: false,
    events: [created("PC", [1000, 2000, 3000]), paid("PC"), ship("PC", 1), ship("PC", 3)],
    query: qExport("PC")
  },
  {
    check_id: "cp04-reimport-three-lines-two-shipped",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "4",
    visible: false,
    events: [created("PD", [1000, 2000, 3000]), paid("PD"), ship("PD", 1), ship("PD", 3)],
    query: qReimport("PD")
  },

  // ---- CP05: shipment metadata (carrier, tracking) through export/import ----
  // Sites demanded: orders, render, parse
  {
    check_id: "cp05-status-unaffected-by-carrier",
    commitment_id: "I-STATUS",
    checkpoint: "5",
    visible: true,
    events: [created("M4", [6000, 7000]), paid("M4"), shipWith("M4", 1, "DHL", "DHL123")],
    query: qStatus("M4")
  },
  {
    check_id: "cp05-export-with-carrier",
    commitment_id: "I-EXPORT",
    checkpoint: "5",
    visible: true,
    events: [created("M1", [4000]), paid("M1"), shipWith("M1", 1, "FedEx", "TRACK001")],
    query: qExport("M1")
  },
  {
    check_id: "cp05-reimport-with-carrier",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "5",
    visible: true,
    events: [created("M1", [4000]), paid("M1"), shipWith("M1", 1, "FedEx", "TRACK001")],
    query: qReimport("M1")
  },
  {
    check_id: "cp05-export-no-metadata",
    commitment_id: "I-EXPORT",
    checkpoint: "5",
    visible: false,
    events: [created("M2", [2000]), paid("M2"), ship("M2", 1)],
    query: qExport("M2")
  },
  {
    check_id: "cp05-reimport-no-metadata",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "5",
    visible: false,
    events: [created("M2", [2000]), paid("M2"), ship("M2", 1)],
    query: qReimport("M2")
  },
  {
    check_id: "cp05-export-multi-line-mixed-metadata",
    commitment_id: "I-EXPORT",
    checkpoint: "5",
    visible: false,
    events: [
      created("M3", [3000, 5000]),
      paid("M3"),
      shipWith("M3", 1, "UPS", "1Z999"),
      ship("M3", 2)
    ],
    query: qExport("M3")
  },
  {
    check_id: "cp05-reimport-multi-line-mixed-metadata",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "5",
    visible: false,
    events: [
      created("M3", [3000, 5000]),
      paid("M3"),
      shipWith("M3", 1, "UPS", "1Z999"),
      ship("M3", 2)
    ],
    query: qReimport("M3")
  },
  {
    check_id: "cp05-status-fully-shipped-with-carrier",
    commitment_id: "I-STATUS",
    checkpoint: "5",
    visible: false,
    events: [created("M0", [3000]), paid("M0"), shipWith("M0", 1, "USPS", "USPS001")],
    query: qStatus("M0")
  },
  {
    check_id: "cp05-export-carrier-only-on-shipped",
    commitment_id: "I-EXPORT",
    checkpoint: "5",
    visible: false,
    events: [
      created("M5", [2000, 3000]),
      paid("M5"),
      shipWith("M5", 1, "USPS", "9400")
    ],
    query: qExport("M5")
  },
  {
    check_id: "cp05-reimport-partial-ship-with-carrier",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "5",
    visible: false,
    events: [
      created("M6", [4000, 6000]),
      paid("M6"),
      shipWith("M6", 2, "FedEx", "FX999")
    ],
    query: qReimport("M6")
  },

  // ---- CP06: CORRECTION — partial returns → partially_returned ----
  // Sites demanded: orders, render, parse, digest
  {
    check_id: "cp06-status-partial-return",
    commitment_id: "I-STATUS",
    checkpoint: "6",
    visible: true,
    events: [created("Q1", [3000, 4000]), paid("Q1"), ship("Q1", 1), ship("Q1", 2), ret("Q1", 1)],
    query: qStatus("Q1")
  },
  {
    check_id: "cp06-reimport-partial-return",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "6",
    visible: true,
    events: [created("Q1", [3000, 4000]), paid("Q1"), ship("Q1", 1), ship("Q1", 2), ret("Q1", 1)],
    query: qReimport("Q1")
  },
  {
    check_id: "cp06-digest-partial-return",
    commitment_id: "I-DIGEST",
    checkpoint: "6",
    visible: true,
    events: [
      created("Q2", [2000, 2000]), paid("Q2"), ship("Q2", 1), ship("Q2", 2), ret("Q2", 1),
      created("Q3", [5000]), paid("Q3"), ship("Q3", 1)
    ],
    query: qDigest()
  },
  {
    check_id: "cp06-export-partial-return",
    commitment_id: "I-EXPORT",
    checkpoint: "6",
    visible: true,
    events: [created("Q4", [1000, 9000]), paid("Q4"), ship("Q4", 1), ship("Q4", 2), ret("Q4", 2)],
    query: qExport("Q4")
  },
  {
    check_id: "cp06-status-one-of-three-returned",
    commitment_id: "I-STATUS",
    checkpoint: "6",
    visible: false,
    events: [
      created("Q5", [1000, 2000, 3000]), paid("Q5"),
      ship("Q5", 1), ship("Q5", 2), ship("Q5", 3), ret("Q5", 2)
    ],
    query: qStatus("Q5")
  },
  {
    check_id: "cp06-digest-return-spectrum",
    commitment_id: "I-DIGEST",
    checkpoint: "6",
    visible: false,
    events: [
      created("Q6", [1000, 1000]), paid("Q6"), ship("Q6", 1), ship("Q6", 2), ret("Q6", 1),
      created("Q7", [2000]), paid("Q7"), ship("Q7", 1), ret("Q7", 1),
      created("Q8", [3000]), paid("Q8"), ship("Q8", 1)
    ],
    query: qDigest()
  },
  {
    check_id: "cp06-reimport-return-flags",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "6",
    visible: false,
    events: [created("Q9", [4000, 6000]), paid("Q9"), ship("Q9", 1), ship("Q9", 2), ret("Q9", 2)],
    query: qReimport("Q9")
  },
  {
    check_id: "cp06-status-all-returned",
    commitment_id: "I-STATUS",
    checkpoint: "6",
    visible: false,
    events: [created("QA", [3000]), paid("QA"), ship("QA", 1), ret("QA", 1)],
    query: qStatus("QA")
  },
  {
    check_id: "cp06-export-partial-with-carrier",
    commitment_id: "I-EXPORT",
    checkpoint: "6",
    visible: false,
    events: [
      created("QB", [2000, 3000]), paid("QB"),
      shipWith("QB", 1, "FedEx", "FX100"), ship("QB", 2), ret("QB", 1)
    ],
    query: qExport("QB")
  },
  {
    check_id: "cp06-reimport-two-of-three-returned",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "6",
    visible: false,
    events: [
      created("QC", [2000, 3000, 5000]), paid("QC"),
      ship("QC", 1), ship("QC", 2), ship("QC", 3),
      ret("QC", 1), ret("QC", 3)
    ],
    query: qReimport("QC")
  },
  {
    check_id: "cp06-digest-partially-returned-revenue",
    commitment_id: "I-DIGEST",
    checkpoint: "6",
    visible: false,
    events: [
      created("QD", [5000, 5000]), paid("QD"), ship("QD", 1), ship("QD", 2), ret("QD", 2),
      created("QE", [3000, 3000]), paid("QE"), ship("QE", 1), ship("QE", 2), ret("QE", 1), ret("QE", 2)
    ],
    query: qDigest()
  },

  // ---- CP07: partial payments → partially_paid ----
  // Sites demanded: orders, render, parse, digest
  // (partial payments first appear here; no mixed paid_cents + full cancel combos yet)
  {
    check_id: "cp07-status-partially-paid",
    commitment_id: "I-STATUS",
    checkpoint: "7",
    visible: true,
    events: [created("PP1", [5000, 5000]), partPay("PP1", 3000)],
    query: qStatus("PP1")
  },
  {
    check_id: "cp07-export-partially-paid",
    commitment_id: "I-EXPORT",
    checkpoint: "7",
    visible: true,
    events: [created("PP1", [5000, 5000]), partPay("PP1", 3000)],
    query: qExport("PP1")
  },
  {
    check_id: "cp07-reimport-partially-paid",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "7",
    visible: true,
    events: [created("PP1", [5000, 5000]), partPay("PP1", 3000)],
    query: qReimport("PP1")
  },
  {
    check_id: "cp07-digest-partially-paid",
    commitment_id: "I-DIGEST",
    checkpoint: "7",
    visible: true,
    events: [
      created("PP2", [4000]), partPay("PP2", 1000),
      created("PP3", [6000]), paid("PP3")
    ],
    query: qDigest()
  },
  {
    check_id: "cp07-status-full-payment-not-partially-paid",
    commitment_id: "I-STATUS",
    checkpoint: "7",
    visible: false,
    events: [created("PP4", [3000]), paid("PP4")],
    query: qStatus("PP4")
  },
  {
    check_id: "cp07-status-no-payment-awaiting",
    commitment_id: "I-STATUS",
    checkpoint: "7",
    visible: false,
    events: [created("PP5", [2000])],
    query: qStatus("PP5")
  },
  {
    check_id: "cp07-export-partially-paid-no-notes",
    commitment_id: "I-EXPORT",
    checkpoint: "7",
    visible: false,
    events: [created("PP6", [10000]), partPay("PP6", 4000)],
    query: qExport("PP6")
  },
  {
    check_id: "cp07-reimport-partially-paid-with-note",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "7",
    visible: false,
    events: [created("PP7", [8000]), partPay("PP7", 2000), note("PP7", "deferred billing")],
    query: qReimport("PP7")
  },
  {
    check_id: "cp07-digest-three-payment-buckets",
    commitment_id: "I-DIGEST",
    checkpoint: "7",
    visible: false,
    events: [
      created("PP8", [3000]),
      created("PP9", [5000]), partPay("PP9", 2000),
      created("PPA", [7000]), paid("PPA"), ship("PPA", 1)
    ],
    query: qDigest()
  },
  {
    check_id: "cp07-status-partially-paid-lifecycle-order",
    commitment_id: "I-STATUS",
    checkpoint: "7",
    visible: false,
    events: [created("PPB", [6000, 4000]), partPay("PPB", 5000)],
    query: qStatus("PPB")
  },
  {
    check_id: "cp07-reimport-partially-paid-lines",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "7",
    visible: false,
    events: [created("PPC", [3000, 3000]), partPay("PPC", 1500)],
    query: qReimport("PPC")
  },
  {
    check_id: "cp07-digest-partially-paid-two-orders",
    commitment_id: "I-DIGEST",
    checkpoint: "7",
    visible: false,
    events: [
      created("PPD", [5000]), partPay("PPD", 2000),
      created("PPE", [3000]), partPay("PPE", 1000)
    ],
    query: qDigest()
  },

  // ---- CP08: CORRECTION — cancel after shipment → cancelled_partial + requires_refund ----
  // Sites demanded: orders, render, parse, digest
  // (partial payment + cancel = cancelled_owing is CP12; not allowed here)
  {
    check_id: "cp08-status-cancel-partial",
    commitment_id: "I-STATUS",
    checkpoint: "8",
    visible: true,
    events: [created("C1", [3000, 4000]), paid("C1"), ship("C1", 1), cancel("C1")],
    query: qStatus("C1")
  },
  {
    check_id: "cp08-export-requires-refund",
    commitment_id: "I-EXPORT",
    checkpoint: "8",
    visible: true,
    events: [created("C1", [3000, 4000]), paid("C1"), ship("C1", 1), cancel("C1")],
    query: qExport("C1")
  },
  {
    check_id: "cp08-reimport-cancel-partial",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "8",
    visible: true,
    events: [created("C1", [3000, 4000]), paid("C1"), ship("C1", 1), cancel("C1")],
    query: qReimport("C1")
  },
  {
    check_id: "cp08-digest-cancel-partial",
    commitment_id: "I-DIGEST",
    checkpoint: "8",
    visible: true,
    events: [
      created("C2", [2000]), paid("C2"), ship("C2", 1), cancel("C2"),
      created("C3", [1000]), cancel("C3"),
      created("C4", [5000]), paid("C4")
    ],
    query: qDigest()
  },
  {
    check_id: "cp08-status-cancel-clean",
    commitment_id: "I-STATUS",
    checkpoint: "8",
    visible: false,
    events: [created("C5", [2500]), paid("C5"), cancel("C5")],
    query: qStatus("C5")
  },
  {
    check_id: "cp08-cancel-fully-shipped",
    commitment_id: "I-STATUS",
    checkpoint: "8",
    visible: false,
    events: [created("C6", [1000, 2000]), paid("C6"), ship("C6", 1), ship("C6", 2), cancel("C6")],
    query: qStatus("C6")
  },
  {
    check_id: "cp08-reimport-refund-flag",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "8",
    visible: false,
    events: [created("C7", [8000, 500]), paid("C7"), ship("C7", 2), cancel("C7")],
    query: qReimport("C7")
  },
  {
    check_id: "cp08-export-cancel-with-carrier",
    commitment_id: "I-EXPORT",
    checkpoint: "8",
    visible: false,
    events: [created("C8", [3000, 4000]), paid("C8"), shipWith("C8", 1, "FedEx", "FX200"), cancel("C8")],
    query: qExport("C8")
  },
  {
    check_id: "cp08-digest-cancel-partial-revenue",
    commitment_id: "I-DIGEST",
    checkpoint: "8",
    visible: false,
    events: [
      created("C9", [5000, 5000]), paid("C9"), ship("C9", 1), cancel("C9"),
      created("CA", [3000]), cancel("CA")
    ],
    query: qDigest()
  },
  {
    check_id: "cp08-status-cancelled-before-any-ship",
    commitment_id: "I-STATUS",
    checkpoint: "8",
    visible: false,
    events: [created("CB", [7000]), paid("CB"), cancel("CB")],
    query: qStatus("CB")
  },

  // ---- CP09: refunds ----
  // Sites demanded: orders, render, parse, digest
  {
    check_id: "cp09-export-refunded-line",
    commitment_id: "I-EXPORT",
    checkpoint: "9",
    visible: true,
    events: [created("RF1", [5000]), paid("RF1"), ship("RF1", 1), ret("RF1", 1), refund("RF1", 1)],
    query: qExport("RF1")
  },
  {
    check_id: "cp09-reimport-refunded-line",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "9",
    visible: true,
    events: [created("RF1", [5000]), paid("RF1"), ship("RF1", 1), ret("RF1", 1), refund("RF1", 1)],
    query: qReimport("RF1")
  },
  {
    check_id: "cp09-digest-refund-total",
    commitment_id: "I-DIGEST",
    checkpoint: "9",
    visible: true,
    events: [
      created("RF2", [3000, 4000]), paid("RF2"), ship("RF2", 1), ship("RF2", 2), ret("RF2", 1), refund("RF2", 1),
      created("RF3", [5000]), paid("RF3"), ship("RF3", 1)
    ],
    query: qDigest()
  },
  {
    check_id: "cp09-status-returned-with-partial-refund",
    commitment_id: "I-STATUS",
    checkpoint: "9",
    visible: true,
    events: [
      created("RF4", [3000, 4000]), paid("RF4"), ship("RF4", 1), ship("RF4", 2),
      ret("RF4", 1), ret("RF4", 2), refund("RF4", 1)
    ],
    query: qStatus("RF4")
  },
  {
    check_id: "cp09-export-partial-refund",
    commitment_id: "I-EXPORT",
    checkpoint: "9",
    visible: false,
    events: [
      created("RF5", [3000, 4000]), paid("RF5"), ship("RF5", 1), ship("RF5", 2),
      ret("RF5", 1), refund("RF5", 1)
    ],
    query: qExport("RF5")
  },
  {
    check_id: "cp09-reimport-partial-refund",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "9",
    visible: false,
    events: [
      created("RF5", [3000, 4000]), paid("RF5"), ship("RF5", 1), ship("RF5", 2),
      ret("RF5", 1), refund("RF5", 1)
    ],
    query: qReimport("RF5")
  },
  {
    check_id: "cp09-digest-no-refunds-zero-omitted",
    commitment_id: "I-DIGEST",
    checkpoint: "9",
    visible: false,
    events: [
      created("RF6", [6000]), paid("RF6"), ship("RF6", 1), ret("RF6", 1)
    ],
    query: qDigest()
  },
  {
    check_id: "cp09-status-partially-returned-one-refunded",
    commitment_id: "I-STATUS",
    checkpoint: "9",
    visible: false,
    events: [
      created("RF7", [3000, 3000]), paid("RF7"), ship("RF7", 1), ship("RF7", 2), ret("RF7", 1), refund("RF7", 1)
    ],
    query: qStatus("RF7")
  },
  {
    check_id: "cp09-digest-multiple-buckets-with-refunds",
    commitment_id: "I-DIGEST",
    checkpoint: "9",
    visible: false,
    events: [
      created("RF8", [5000]), paid("RF8"), ship("RF8", 1), ret("RF8", 1), refund("RF8", 1),
      created("RF9", [3000, 4000]), paid("RF9"), ship("RF9", 1), ship("RF9", 2), ret("RF9", 2), refund("RF9", 2),
      created("RFA", [2000]), paid("RFA"), ship("RFA", 1)
    ],
    query: qDigest()
  },
  {
    check_id: "cp09-export-returned-unrefunded-line",
    commitment_id: "I-EXPORT",
    checkpoint: "9",
    visible: false,
    events: [
      created("RFB", [4000, 6000]), paid("RFB"), ship("RFB", 1), ship("RFB", 2), ret("RFB", 2)
    ],
    query: qExport("RFB")
  },
  {
    check_id: "cp09-reimport-refund-on-cancel-partial",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "9",
    visible: false,
    events: [
      created("RFC", [8000, 2000]), paid("RFC"), ship("RFC", 1), cancel("RFC"), refund("RFC", 1)
    ],
    query: qReimport("RFC")
  },
  {
    check_id: "cp09-digest-returned-with-full-refund",
    commitment_id: "I-DIGEST",
    checkpoint: "9",
    visible: false,
    events: [
      created("RFD", [7000]), paid("RFD"), ship("RFD", 1), ret("RFD", 1), refund("RFD", 1)
    ],
    query: qDigest()
  },
  {
    check_id: "cp09-export-refunded-with-carrier",
    commitment_id: "I-EXPORT",
    checkpoint: "9",
    visible: false,
    events: [
      created("RFE", [5000]), paid("RFE"), shipWith("RFE", 1, "UPS", "1ZRFE"), ret("RFE", 1), refund("RFE", 1)
    ],
    query: qExport("RFE")
  },
  {
    check_id: "cp09-status-returned-no-refund",
    commitment_id: "I-STATUS",
    checkpoint: "9",
    visible: false,
    events: [created("RFF", [3000]), paid("RFF"), ship("RFF", 1), ret("RFF", 1)],
    query: qStatus("RFF")
  },
  {
    check_id: "cp09-reimport-all-refunded",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "9",
    visible: false,
    events: [
      created("RFG", [4000, 4000]), paid("RFG"),
      ship("RFG", 1), ship("RFG", 2), ret("RFG", 1), ret("RFG", 2),
      refund("RFG", 1), refund("RFG", 2)
    ],
    query: qReimport("RFG")
  },
  {
    check_id: "cp09-digest-cancelled-partial-with-refund",
    commitment_id: "I-DIGEST",
    checkpoint: "9",
    visible: false,
    events: [
      created("RFH", [5000, 3000]), paid("RFH"), ship("RFH", 1), cancel("RFH"), refund("RFH", 1)
    ],
    query: qDigest()
  },

  // ---- CP10: CORRECTION — fully returned + fully refunded → closed ----
  // Sites demanded: orders, render, parse, digest
  {
    check_id: "cp10-status-closed",
    commitment_id: "I-STATUS",
    checkpoint: "10",
    visible: true,
    events: [
      created("CL1", [5000, 3000]), paid("CL1"),
      ship("CL1", 1), ship("CL1", 2), ret("CL1", 1), ret("CL1", 2),
      refund("CL1", 1), refund("CL1", 2)
    ],
    query: qStatus("CL1")
  },
  {
    check_id: "cp10-export-closed",
    commitment_id: "I-EXPORT",
    checkpoint: "10",
    visible: true,
    events: [
      created("CL2", [4000]), paid("CL2"), ship("CL2", 1), ret("CL2", 1), refund("CL2", 1)
    ],
    query: qExport("CL2")
  },
  {
    check_id: "cp10-reimport-closed",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "10",
    visible: true,
    events: [
      created("CL2", [4000]), paid("CL2"), ship("CL2", 1), ret("CL2", 1), refund("CL2", 1)
    ],
    query: qReimport("CL2")
  },
  {
    check_id: "cp10-digest-closed-bucket",
    commitment_id: "I-DIGEST",
    checkpoint: "10",
    visible: true,
    events: [
      created("CL3", [3000]), paid("CL3"), ship("CL3", 1), ret("CL3", 1), refund("CL3", 1),
      created("CL4", [5000]), paid("CL4"), ship("CL4", 1), ret("CL4", 1)
    ],
    query: qDigest()
  },
  {
    check_id: "cp10-returned-not-refunded-stays-returned",
    commitment_id: "I-STATUS",
    checkpoint: "10",
    visible: false,
    events: [
      created("CL5", [6000, 4000]), paid("CL5"),
      ship("CL5", 1), ship("CL5", 2), ret("CL5", 1), ret("CL5", 2),
      refund("CL5", 1)
    ],
    query: qStatus("CL5")
  },
  {
    check_id: "cp10-status-partial-refund-stays-partially-returned",
    commitment_id: "I-STATUS",
    checkpoint: "10",
    visible: false,
    events: [
      created("CL6", [3000, 3000]), paid("CL6"),
      ship("CL6", 1), ship("CL6", 2), ret("CL6", 1), refund("CL6", 1)
    ],
    query: qStatus("CL6")
  },
  {
    check_id: "cp10-export-returned-not-closed",
    commitment_id: "I-EXPORT",
    checkpoint: "10",
    visible: false,
    events: [
      created("CL7", [5000]), paid("CL7"), ship("CL7", 1), ret("CL7", 1)
    ],
    query: qExport("CL7")
  },
  {
    check_id: "cp10-reimport-partial-refund-not-closed",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "10",
    visible: false,
    events: [
      created("CL8", [4000, 6000]), paid("CL8"),
      ship("CL8", 1), ship("CL8", 2), ret("CL8", 1), ret("CL8", 2), refund("CL8", 2)
    ],
    query: qReimport("CL8")
  },
  {
    check_id: "cp10-digest-closed-vs-returned",
    commitment_id: "I-DIGEST",
    checkpoint: "10",
    visible: false,
    events: [
      created("CL9", [3000]), paid("CL9"), ship("CL9", 1), ret("CL9", 1), refund("CL9", 1),
      created("CLA", [5000]), paid("CLA"), ship("CLA", 1), ret("CLA", 1),
      created("CLB", [2000]), paid("CLB"), ship("CLB", 1)
    ],
    query: qDigest()
  },
  {
    check_id: "cp10-status-single-line-closed",
    commitment_id: "I-STATUS",
    checkpoint: "10",
    visible: false,
    events: [created("CLC", [7000]), paid("CLC"), ship("CLC", 1), ret("CLC", 1), refund("CLC", 1)],
    query: qStatus("CLC")
  },
  {
    check_id: "cp10-export-closed-with-carrier",
    commitment_id: "I-EXPORT",
    checkpoint: "10",
    visible: false,
    events: [
      created("CLD", [8000]), paid("CLD"), shipWith("CLD", 1, "FedEx", "FX300"), ret("CLD", 1), refund("CLD", 1)
    ],
    query: qExport("CLD")
  },
  {
    check_id: "cp10-reimport-closed-with-notes",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "10",
    visible: false,
    events: [
      created("CLE", [5000]), paid("CLE"), note("CLE", "warranty return"), ship("CLE", 1), ret("CLE", 1), refund("CLE", 1)
    ],
    query: qReimport("CLE")
  },
  {
    check_id: "cp10-digest-closed-with-refund-cents",
    commitment_id: "I-DIGEST",
    checkpoint: "10",
    visible: false,
    events: [
      created("CLF", [6000, 4000]), paid("CLF"),
      ship("CLF", 1), ship("CLF", 2), ret("CLF", 1), ret("CLF", 2),
      refund("CLF", 1), refund("CLF", 2)
    ],
    query: qDigest()
  },

  // ---- CP11: receivables digest (new query kind) ----
  // Sites demanded: digest, orders
  {
    check_id: "cp11-receivables-awaiting",
    commitment_id: "I-RECEIVABLES",
    checkpoint: "11",
    visible: true,
    events: [created("RV1", [5000, 3000])],
    query: qReceivables()
  },
  {
    check_id: "cp11-receivables-partially-paid",
    commitment_id: "I-RECEIVABLES",
    checkpoint: "11",
    visible: true,
    events: [created("RV2", [10000]), partPay("RV2", 4000)],
    query: qReceivables()
  },
  {
    check_id: "cp11-receivables-fully-paid-omitted",
    commitment_id: "I-RECEIVABLES",
    checkpoint: "11",
    visible: false,
    events: [created("RV3", [6000]), paid("RV3")],
    query: qReceivables()
  },
  {
    check_id: "cp11-receivables-mixed-buckets",
    commitment_id: "I-RECEIVABLES",
    checkpoint: "11",
    visible: false,
    events: [
      created("RV4", [3000]),
      created("RV5", [5000]), partPay("RV5", 2000),
      created("RV6", [4000]), paid("RV6")
    ],
    query: qReceivables()
  },
  {
    check_id: "cp11-receivables-after-partial-refund",
    commitment_id: "I-RECEIVABLES",
    checkpoint: "11",
    visible: false,
    events: [
      created("RV7", [8000, 2000]), paid("RV7"),
      ship("RV7", 1), ship("RV7", 2), ret("RV7", 1), refund("RV7", 1)
    ],
    query: qReceivables()
  },
  {
    check_id: "cp11-receivables-cancelled-unpaid-omitted",
    commitment_id: "I-RECEIVABLES",
    checkpoint: "11",
    visible: false,
    events: [created("RV8", [5000]), cancel("RV8")],
    query: qReceivables()
  },
  {
    check_id: "cp11-receivables-two-awaiting-orders",
    commitment_id: "I-RECEIVABLES",
    checkpoint: "11",
    visible: false,
    events: [
      created("RV9", [3000]),
      created("RVA", [7000])
    ],
    query: qReceivables()
  },
  {
    check_id: "cp11-receivables-partially-paid-two-orders",
    commitment_id: "I-RECEIVABLES",
    checkpoint: "11",
    visible: false,
    events: [
      created("RVB", [5000]), partPay("RVB", 1000),
      created("RVC", [8000]), partPay("RVC", 3000)
    ],
    query: qReceivables()
  },
  {
    check_id: "cp11-status-digest-unchanged-by-cp11",
    commitment_id: "I-DIGEST",
    checkpoint: "11",
    visible: false,
    events: [
      created("RVD", [5000]), paid("RVD"),
      created("RVE", [3000])
    ],
    query: qDigest()
  },
  {
    check_id: "cp11-receivables-closed-settled-omitted",
    commitment_id: "I-RECEIVABLES",
    checkpoint: "11",
    visible: false,
    events: [
      created("RVF", [4000]), paid("RVF"), ship("RVF", 1), ret("RVF", 1), refund("RVF", 1)
    ],
    query: qReceivables()
  },
  {
    check_id: "cp11-receivables-cancelled-partial-ship-outstanding",
    commitment_id: "I-RECEIVABLES",
    checkpoint: "11",
    visible: false,
    events: [
      created("RVG", [5000, 5000]), paid("RVG"), ship("RVG", 1), cancel("RVG")
    ],
    query: qReceivables()
  },

  // ---- CP12: CORRECTION — partial-payment-then-cancel → cancelled_owing ----
  // Sites demanded: orders, render, parse, digest
  // Precedence: cancelled_owing takes priority over cancelled_partial when both
  // conditions could apply (partial payment AND some shipped).
  {
    check_id: "cp12-status-cancelled-owing",
    commitment_id: "I-STATUS",
    checkpoint: "12",
    visible: true,
    events: [created("CO1", [5000, 5000]), partPay("CO1", 3000), cancel("CO1")],
    query: qStatus("CO1")
  },
  {
    check_id: "cp12-export-cancelled-owing",
    commitment_id: "I-EXPORT",
    checkpoint: "12",
    visible: true,
    events: [created("CO1", [5000, 5000]), partPay("CO1", 3000), cancel("CO1")],
    query: qExport("CO1")
  },
  {
    check_id: "cp12-reimport-cancelled-owing",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "12",
    visible: true,
    events: [created("CO1", [5000, 5000]), partPay("CO1", 3000), cancel("CO1")],
    query: qReimport("CO1")
  },
  {
    check_id: "cp12-digest-cancelled-owing",
    commitment_id: "I-DIGEST",
    checkpoint: "12",
    visible: true,
    events: [
      created("CO2", [4000]), partPay("CO2", 1500), cancel("CO2"),
      created("CO3", [3000]), cancel("CO3"),
      created("CO4", [6000]), paid("CO4")
    ],
    query: qDigest()
  },
  {
    check_id: "cp12-status-never-paid-cancel-unchanged",
    commitment_id: "I-STATUS",
    checkpoint: "12",
    visible: false,
    events: [created("CO5", [5000]), cancel("CO5")],
    query: qStatus("CO5")
  },
  {
    check_id: "cp12-status-fully-paid-cancel-not-owing",
    commitment_id: "I-STATUS",
    checkpoint: "12",
    visible: false,
    events: [created("CO6", [3000]), paid("CO6"), cancel("CO6")],
    query: qStatus("CO6")
  },
  {
    check_id: "cp12-export-owing-flag-no-requires-refund",
    commitment_id: "I-EXPORT",
    checkpoint: "12",
    visible: false,
    events: [created("CO7", [8000, 2000]), partPay("CO7", 4000), cancel("CO7")],
    query: qExport("CO7")
  },
  {
    check_id: "cp12-reimport-owing-flag",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "12",
    visible: false,
    events: [created("CO8", [6000]), partPay("CO8", 2000), cancel("CO8")],
    query: qReimport("CO8")
  },
  {
    check_id: "cp12-digest-owing-separate-from-cancelled",
    commitment_id: "I-DIGEST",
    checkpoint: "12",
    visible: false,
    events: [
      created("CO9", [5000]), partPay("CO9", 2000), cancel("CO9"),
      created("COA", [3000]), cancel("COA"),
      created("COB", [4000]), paid("COB"), ship("COB", 1), cancel("COB")
    ],
    query: qDigest()
  },
  {
    check_id: "cp12-receivables-cancelled-owing-outstanding",
    commitment_id: "I-RECEIVABLES",
    checkpoint: "12",
    visible: false,
    events: [created("COC", [10000]), partPay("COC", 3000), cancel("COC")],
    query: qReceivables()
  },
  {
    check_id: "cp12-status-partial-pay-then-cancel-with-shipment",
    commitment_id: "I-STATUS",
    checkpoint: "12",
    visible: false,
    events: [
      created("COD", [5000, 5000]), partPay("COD", 3000), ship("COD", 1), cancel("COD")
    ],
    query: qStatus("COD")
  },
  {
    check_id: "cp12-export-owing-with-shipped-line",
    commitment_id: "I-EXPORT",
    checkpoint: "12",
    visible: false,
    events: [
      created("COE", [5000, 5000]), partPay("COE", 2000), ship("COE", 1), cancel("COE")
    ],
    query: qExport("COE")
  },
  {
    check_id: "cp12-reimport-owing-with-notes",
    commitment_id: "I-ROUNDTRIP",
    checkpoint: "12",
    visible: false,
    events: [
      created("COF", [7000, 3000]), partPay("COF", 5000), note("COF", "partial order"), cancel("COF")
    ],
    query: qReimport("COF")
  },
  {
    check_id: "cp12-digest-full-spectrum",
    commitment_id: "I-DIGEST",
    checkpoint: "12",
    visible: false,
    events: [
      created("COG", [3000]), partPay("COG", 1000), cancel("COG"),
      created("COH", [5000]), cancel("COH"),
      created("COI", [4000]), paid("COI"),
      created("COJ", [6000]), paid("COJ"), ship("COJ", 1)
    ],
    query: qDigest()
  },
  {
    check_id: "cp12-receivables-owing-vs-awaiting",
    commitment_id: "I-RECEIVABLES",
    checkpoint: "12",
    visible: false,
    events: [
      created("COK", [8000]), partPay("COK", 3000), cancel("COK"),
      created("COL", [4000])
    ],
    query: qReceivables()
  },
  {
    check_id: "cp12-export-owing-multi-note",
    commitment_id: "I-EXPORT",
    checkpoint: "12",
    visible: false,
    events: [
      created("COM", [5000, 5000]), partPay("COM", 2000), note("COM", "disputed"), cancel("COM")
    ],
    query: qExport("COM")
  },
  {
    check_id: "cp12-status-owing-beats-cancelled-partial",
    commitment_id: "I-STATUS",
    checkpoint: "12",
    visible: false,
    events: [
      created("CON", [4000, 6000]), partPay("CON", 5000), ship("CON", 1), cancel("CON")
    ],
    query: qStatus("CON")
  }
];

