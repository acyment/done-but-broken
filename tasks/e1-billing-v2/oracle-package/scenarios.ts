// Sealed oracle scenario definitions for e1-billing-v2. Expected values are NEVER written
// here: the generator computes every expected value from the reference implementation.
// visible=true scenarios are exported as runnable feedback assets and quoted verbatim in
// the visible spec worked examples; held-out scenarios use the same rules with different
// values and are tagged held_out in the oracle package.

export type Ev = Record<string, unknown>;

export type Scenario = {
  check_id: string;
  commitment_id: string;
  checkpoint: string;
  visible: boolean;
  events: Ev[];
  query: Record<string, unknown>;
};

const AT_CREATE = "2026-01-01T00:00:00.000Z";
const AT_ACTIVATE = "2026-01-02T00:00:00.000Z";
const AT_COUPON = "2026-01-03T00:00:00.000Z";
const AT_DOWNGRADE = "2026-01-04T00:00:00.000Z";
const AT_UPGRADE = "2026-01-16T00:00:00.000Z";
const AT_INVOICE = "2026-01-17T00:00:00.000Z";
const AT_CAPTURE = "2026-01-18T00:00:00.000Z";
const AT_FAIL = "2026-01-19T00:00:00.000Z";
const AT_REFUND = "2026-01-20T00:00:00.000Z";
const AT_CANCEL = "2026-01-21T00:00:00.000Z";
const AT_FINALIZE = "2026-01-22T00:00:00.000Z";
const AT_RECOMPUTE = "2026-01-23T00:00:00.000Z";
const AT_RENEW = "2026-02-01T00:00:00.000Z";

function created(sub: string, over: Ev = {}): Ev {
  return {
    event_id: `${sub}-create`,
    type: "subscription_created",
    at: AT_CREATE,
    subscription_id: sub,
    customer_id: `C-${sub}`,
    plan_id: "basic",
    plan_price_cents: 3000,
    period_start: "2026-01-01",
    period_end: "2026-01-31",
    ...over
  };
}

function activated(sub: string): Ev {
  return { event_id: `${sub}-activate`, type: "subscription_activated", at: AT_ACTIVATE, subscription_id: sub };
}

function usage(line_id: string, unit_price_cents: number, quantity_milli: number, description = "API calls"): Ev {
  return { line_id, description, unit_price_cents, quantity_milli };
}

function invoice(inv: string, sub: string, over: Ev = {}): Ev {
  return { event_id: `${inv}-gen`, type: "invoice_generated", at: AT_INVOICE, invoice_id: inv, subscription_id: sub, ...over };
}

function capture(inv: string, amount_cents: number, eid: string): Ev {
  return { event_id: eid, type: "payment_captured", at: AT_CAPTURE, invoice_id: inv, amount_cents };
}

function upgrade(sub: string, over: Ev = {}): Ev {
  return {
    event_id: `${sub}-upgrade`,
    type: "plan_upgraded",
    at: AT_UPGRADE,
    subscription_id: sub,
    new_plan_id: "pro",
    new_plan_price_cents: 5000,
    remaining_days: 15,
    period_days: 30,
    ...over
  };
}

function downgrade(sub: string, over: Ev = {}): Ev {
  return {
    event_id: `${sub}-downgrade`,
    type: "plan_downgraded",
    at: AT_DOWNGRADE,
    subscription_id: sub,
    new_plan_id: "basic",
    new_plan_price_cents: 3000,
    ...over
  };
}

function renew(sub: string, over: Ev = {}): Ev {
  return {
    event_id: `${sub}-renew`,
    type: "period_renewed",
    at: AT_RENEW,
    subscription_id: sub,
    new_period_start: "2026-02-01",
    new_period_end: "2026-02-28",
    ...over
  };
}

function percentCoupon(sub: string, over: Ev = {}): Ev {
  return {
    event_id: `${sub}-coupon-pct`,
    type: "coupon_applied",
    at: AT_COUPON,
    subscription_id: sub,
    coupon_id: "SAVE10",
    coupon_kind: "percent",
    percent_bp: 1000,
    duration_invoices: 2,
    ...over
  };
}

function fixedCoupon(sub: string, coupon_id: string, amount_cents: number, over: Ev = {}): Ev {
  return {
    event_id: `${sub}-coupon-${coupon_id}`,
    type: "coupon_applied",
    at: AT_COUPON,
    subscription_id: sub,
    coupon_id,
    coupon_kind: "fixed",
    amount_cents,
    duration_invoices: 1,
    ...over
  };
}

function refund(inv: string, amount_cents: number, eid: string): Ev {
  return { event_id: eid, type: "payment_refunded", at: AT_REFUND, invoice_id: inv, amount_cents };
}

function failed(inv: string, eid: string): Ev {
  return { event_id: eid, type: "payment_failed", at: AT_FAIL, invoice_id: inv };
}

function cancel(sub: string, mode: "immediate" | "at_period_end"): Ev {
  return { event_id: `${sub}-cancel`, type: "subscription_canceled", at: AT_CANCEL, subscription_id: sub, mode };
}

function finalize(inv: string): Ev {
  return { event_id: `${inv}-finalize`, type: "invoice_finalized", at: AT_FINALIZE, invoice_id: inv };
}

function recompute(inv: string, new_invoice_id?: string): Ev {
  return {
    event_id: `${inv}-recompute`,
    type: "invoice_recomputed",
    at: AT_RECOMPUTE,
    invoice_id: inv,
    ...(new_invoice_id ? { new_invoice_id } : {})
  };
}

const qSub = (sub: string) => ({ kind: "subscription", subscription_id: sub });
const qInv = (inv: string) => ({ kind: "invoice", invoice_id: inv });
const qEnt = (sub: string) => ({ kind: "entitlement", subscription_id: sub });
const qV1 = (inv: string) => ({ kind: "serialize_v1", invoice_id: inv });
const qV2 = (inv: string) => ({ kind: "serialize_v2", invoice_id: inv });
const qAudit = (aggregate: string) => ({ kind: "audit_log", aggregate_id: aggregate });
const qReplay = () => ({ kind: "replay_hash" });

function s(
  checkpoint: number,
  check_id: string,
  commitment_id: string,
  visible: boolean,
  events: Ev[],
  query: Record<string, unknown>
): Scenario {
  return { check_id, commitment_id, checkpoint: String(checkpoint), visible, events, query };
}

const heldCreated = (sub: string, over: Ev = {}): Ev =>
  created(sub, {
    customer_id: `C-${sub}`,
    plan_id: "scale",
    plan_price_cents: 4700,
    period_start: "2026-02-01",
    period_end: "2026-02-28",
    ...over
  });

export const SCENARIOS: Scenario[] = [
  // ---------------------------------------------------------------- CP01
  s(1, "cp01-sub-active", "I-STATE", true, [created("S1")], qSub("S1")),
  s(1, "cp01-sub-trialing", "I-STATE", true, [created("S2", { trial: true })], qSub("S2")),
  s(1, "cp01-trial-activated", "I-STATE", true, [created("S2", { trial: true }), activated("S2")], qSub("S2")),
  s(1, "cp01-audit-create", "I-SEQ", true, [created("S1")], qAudit("S1")),
  s(1, "cp01-audit-two", "I-SEQ", true, [created("S2", { trial: true }), activated("S2")], qAudit("S2")),
  s(1, "cp01-sub-active-h", "I-STATE", false, [heldCreated("S91")], qSub("S91")),
  s(1, "cp01-trial-activated-h", "I-STATE", false, [heldCreated("S92", { trial: true }), activated("S92")], qSub("S92")),
  s(1, "cp01-audit-h", "I-SEQ", false, [heldCreated("S93", { trial: true }), activated("S93")], qAudit("S93")),

  // ---------------------------------------------------------------- CP02
  s(2, "cp02-invoice-plan", "I-TOTALS", true, [created("S1"), invoice("INV-1", "S1")], qInv("INV-1")),
  s(
    2,
    "cp02-usage-tie-down",
    "I-ROUND",
    true,
    [created("S1"), invoice("INV-1", "S1", { usage: [usage("U1", 125, 500)] })],
    qInv("INV-1")
  ),
  s(
    2,
    "cp02-usage-tie-up",
    "I-ROUND",
    true,
    [created("S1"), invoice("INV-1", "S1", { usage: [usage("U1", 125, 1500)] })],
    qInv("INV-1")
  ),
  s(
    2,
    "cp02-usage-frac",
    "I-ROUND",
    true,
    [created("S1"), invoice("INV-1", "S1", { usage: [usage("U1", 333, 1100)] })],
    qInv("INV-1")
  ),
  s(
    2,
    "cp02-invoice-multi",
    "I-TOTALS",
    true,
    [created("S1"), invoice("INV-1", "S1", { usage: [usage("U1", 125, 500), usage("U2", 125, 1500, "Storage")] })],
    qInv("INV-1")
  ),
  s(2, "cp02-audit-invoice", "I-SEQ", true, [created("S1"), invoice("INV-1", "S1")], qAudit("INV-1")),
  s(2, "cp02-invoice-plan-h", "I-TOTALS", false, [heldCreated("S91"), invoice("INV-91", "S91")], qInv("INV-91")),
  s(
    2,
    "cp02-usage-tie-h",
    "I-ROUND",
    false,
    [heldCreated("S91"), invoice("INV-91", "S91", { usage: [usage("U9", 375, 1500, "Bandwidth")] })],
    qInv("INV-91")
  ),
  s(
    2,
    "cp02-invoice-multi-h",
    "I-TOTALS",
    false,
    [heldCreated("S91"), invoice("INV-91", "S91", { usage: [usage("U9", 375, 1500, "Bandwidth"), usage("U10", 41, 2500, "Seats")] })],
    qInv("INV-91")
  ),

  // ---------------------------------------------------------------- CP03
  s(
    3,
    "cp03-capture-partial",
    "B-CAPTURE",
    true,
    [created("S1"), invoice("INV-1", "S1"), capture("INV-1", 1000, "cap-1")],
    qInv("INV-1")
  ),
  s(
    3,
    "cp03-capture-paid",
    "B-CAPTURE",
    true,
    [created("S1"), invoice("INV-1", "S1"), capture("INV-1", 3000, "cap-1")],
    qInv("INV-1")
  ),
  s(
    3,
    "cp03-capture-duplicate",
    "I-IDEM",
    true,
    [created("S1"), invoice("INV-1", "S1"), capture("INV-1", 2000, "cap-1"), capture("INV-1", 2000, "cap-1")],
    qInv("INV-1")
  ),
  s(
    3,
    "cp03-audit-duplicate",
    "I-IDEM",
    true,
    [created("S1"), invoice("INV-1", "S1"), capture("INV-1", 2000, "cap-1"), capture("INV-1", 2000, "cap-1")],
    qAudit("INV-1")
  ),
  s(
    3,
    "cp03-capture-two",
    "B-CAPTURE",
    true,
    [created("S1"), invoice("INV-1", "S1"), capture("INV-1", 1000, "cap-1"), capture("INV-1", 2000, "cap-2")],
    qInv("INV-1")
  ),
  s(
    3,
    "cp03-capture-partial-h",
    "B-CAPTURE",
    false,
    [heldCreated("S91"), invoice("INV-91", "S91"), capture("INV-91", 1700, "cap-9")],
    qInv("INV-91")
  ),
  s(
    3,
    "cp03-capture-duplicate-h",
    "I-IDEM",
    false,
    [heldCreated("S91"), invoice("INV-91", "S91"), capture("INV-91", 2100, "cap-9"), capture("INV-91", 2100, "cap-9")],
    qInv("INV-91")
  ),
  s(
    3,
    "cp03-capture-paid-h",
    "B-CAPTURE",
    false,
    [heldCreated("S91"), invoice("INV-91", "S91"), capture("INV-91", 4700, "cap-9")],
    qInv("INV-91")
  ),

  // ---------------------------------------------------------------- CP04
  s(4, "cp04-v1-plan", "I-V1BYTES", true, [created("S1"), invoice("INV-1", "S1")], qV1("INV-1")),
  s(
    4,
    "cp04-v1-usage",
    "I-V1BYTES",
    true,
    [created("S1"), invoice("INV-1", "S1", { usage: [usage("U1", 125, 500)] })],
    qV1("INV-1")
  ),
  s(
    4,
    "cp04-v1-paid",
    "I-V1BYTES",
    true,
    [created("S1"), invoice("INV-1", "S1"), capture("INV-1", 3000, "cap-1")],
    qV1("INV-1")
  ),
  s(
    4,
    "cp04-v1-multi",
    "I-V1BYTES",
    true,
    [created("S1"), invoice("INV-1", "S1", { usage: [usage("U1", 125, 500), usage("U2", 125, 1500, "Storage")] })],
    qV1("INV-1")
  ),
  s(
    4,
    "cp04-v1-team",
    "I-V1BYTES",
    true,
    [created("S3", { plan_id: "team", plan_price_cents: 12500 }), invoice("INV-3", "S3")],
    qV1("INV-3")
  ),
  s(4, "cp04-v1-h1", "I-V1BYTES", false, [heldCreated("S91"), invoice("INV-91", "S91")], qV1("INV-91")),
  s(
    4,
    "cp04-v1-h2",
    "I-V1BYTES",
    false,
    [heldCreated("S91"), invoice("INV-91", "S91"), capture("INV-91", 4700, "cap-9")],
    qV1("INV-91")
  ),
  s(
    4,
    "cp04-v1-h3",
    "I-V1BYTES",
    false,
    [heldCreated("S91"), invoice("INV-91", "S91", { usage: [usage("U9", 375, 1500, "Bandwidth")] })],
    qV1("INV-91")
  ),

  // ---------------------------------------------------------------- CP05
  s(5, "cp05-invoice-upgrade", "I-TOTALS", true, [created("S1"), upgrade("S1"), invoice("INV-1", "S1")], qInv("INV-1")),
  s(
    5,
    "cp05-proration-tie-down",
    "I-ROUND",
    true,
    [created("S1", { plan_price_cents: 1001 }), upgrade("S1", { new_plan_price_cents: 2003 }), invoice("INV-1", "S1")],
    qInv("INV-1")
  ),
  s(
    5,
    "cp05-proration-frac",
    "I-ROUND",
    true,
    [
      created("S1", { plan_price_cents: 1999 }),
      upgrade("S1", { new_plan_price_cents: 2999, remaining_days: 10, period_days: 30 }),
      invoice("INV-1", "S1")
    ],
    qInv("INV-1")
  ),
  s(5, "cp05-serialize-prorated", "I-V1BYTES", true, [created("S1"), upgrade("S1"), invoice("INV-1", "S1")], qV1("INV-1")),
  s(5, "cp05-subview-upgraded", "I-STATE", true, [created("S1"), upgrade("S1")], qSub("S1")),
  s(5, "cp05-audit-upgrade", "I-SEQ", true, [created("S1"), upgrade("S1")], qAudit("S1")),
  s(
    5,
    "cp05-invoice-upgrade-h",
    "I-TOTALS",
    false,
    [
      heldCreated("S91"),
      upgrade("S91", { new_plan_id: "max", new_plan_price_cents: 7900, remaining_days: 11, period_days: 31 }),
      invoice("INV-91", "S91")
    ],
    qInv("INV-91")
  ),
  s(
    5,
    "cp05-proration-tie-h",
    "I-ROUND",
    false,
    [
      heldCreated("S91", { plan_price_cents: 2001 }),
      upgrade("S91", { new_plan_id: "max", new_plan_price_cents: 4001 }),
      invoice("INV-91", "S91")
    ],
    qInv("INV-91")
  ),
  s(
    5,
    "cp05-serialize-h",
    "I-V1BYTES",
    false,
    [
      heldCreated("S91"),
      upgrade("S91", { new_plan_id: "max", new_plan_price_cents: 7900, remaining_days: 11, period_days: 31 }),
      invoice("INV-91", "S91")
    ],
    qV1("INV-91")
  ),
  s(
    5,
    "cp05-subview-h",
    "I-STATE",
    false,
    [heldCreated("S91"), upgrade("S91", { new_plan_id: "max", new_plan_price_cents: 7900, remaining_days: 11, period_days: 31 })],
    qSub("S91")
  ),

  // ---------------------------------------------------------------- CP06
  s(
    6,
    "cp06-downgrade-no-change",
    "B-DOWNGRADE",
    true,
    [created("S4", { plan_id: "pro", plan_price_cents: 5000 }), downgrade("S4")],
    qSub("S4")
  ),
  s(
    6,
    "cp06-invoice-before-renewal",
    "B-DOWNGRADE",
    true,
    [created("S4", { plan_id: "pro", plan_price_cents: 5000 }), downgrade("S4"), invoice("INV-4", "S4")],
    qInv("INV-4")
  ),
  s(
    6,
    "cp06-renewal-applies",
    "B-DOWNGRADE",
    true,
    [created("S4", { plan_id: "pro", plan_price_cents: 5000 }), downgrade("S4"), renew("S4")],
    qSub("S4")
  ),
  s(
    6,
    "cp06-invoice-after-renewal",
    "I-TOTALS",
    true,
    [
      created("S4", { plan_id: "pro", plan_price_cents: 5000 }),
      downgrade("S4"),
      renew("S4"),
      invoice("INV-4", "S4", { event_id: "INV-4-gen2", at: AT_RENEW })
    ],
    qInv("INV-4")
  ),
  s(
    6,
    "cp06-audit",
    "I-SEQ",
    true,
    [created("S4", { plan_id: "pro", plan_price_cents: 5000 }), downgrade("S4"), renew("S4")],
    qAudit("S4")
  ),
  s(
    6,
    "cp06-downgrade-h",
    "B-DOWNGRADE",
    false,
    [heldCreated("S94"), downgrade("S94", { new_plan_id: "starter", new_plan_price_cents: 1900 })],
    qSub("S94")
  ),
  s(
    6,
    "cp06-renewal-h",
    "B-DOWNGRADE",
    false,
    [
      heldCreated("S94"),
      downgrade("S94", { new_plan_id: "starter", new_plan_price_cents: 1900 }),
      renew("S94", { new_period_start: "2026-03-01", new_period_end: "2026-03-31" })
    ],
    qSub("S94")
  ),
  s(
    6,
    "cp06-invoice-after-renewal-h",
    "I-TOTALS",
    false,
    [
      heldCreated("S94"),
      downgrade("S94", { new_plan_id: "starter", new_plan_price_cents: 1900 }),
      renew("S94", { new_period_start: "2026-03-01", new_period_end: "2026-03-31" }),
      invoice("INV-94", "S94", { at: AT_RENEW })
    ],
    qInv("INV-94")
  ),

  // ---------------------------------------------------------------- CP07
  s(7, "cp07-percent-basic", "I-TOTALS", true, [created("S1"), percentCoupon("S1"), invoice("INV-1", "S1")], qInv("INV-1")),
  s(
    7,
    "cp07-alloc-remainder",
    "I-ALLOC",
    true,
    [
      created("S1", { plan_price_cents: 999 }),
      percentCoupon("S1"),
      invoice("INV-1", "S1", { usage: [usage("U1", 500, 1000)] })
    ],
    qInv("INV-1")
  ),
  // Two equal positive lines with an odd discount: exact shares are .5/.5, so per-line
  // rounding produces 13/13 (sum drifts) while largest remainder produces 13/12. This is
  // the friction-registry row 2 mutation witness.
  s(
    7,
    "cp07-alloc-equal-tie",
    "I-ALLOC",
    true,
    [
      created("S1", { plan_price_cents: 1000 }),
      percentCoupon("S1", { percent_bp: 125 }),
      invoice("INV-1", "S1", { usage: [usage("U1", 1000, 1000)] })
    ],
    qInv("INV-1")
  ),
  s(
    7,
    "cp07-duration-expiry",
    "B-COUPON",
    true,
    [
      created("S1"),
      percentCoupon("S1"),
      invoice("INV-1", "S1"),
      invoice("INV-2", "S1", { event_id: "INV-2-gen" }),
      invoice("INV-3", "S1", { event_id: "INV-3-gen" })
    ],
    qInv("INV-3")
  ),
  s(
    7,
    "cp07-percent-prorated",
    "I-ALLOC",
    true,
    [created("S1"), percentCoupon("S1"), upgrade("S1"), invoice("INV-1", "S1")],
    qInv("INV-1")
  ),
  s(
    7,
    "cp07-percent-tie",
    "I-ROUND",
    true,
    [created("S1", { plan_price_cents: 2500 }), percentCoupon("S1", { percent_bp: 250 }), invoice("INV-1", "S1")],
    qInv("INV-1")
  ),
  s(7, "cp07-serialize-discount", "I-V1BYTES", true, [created("S1"), percentCoupon("S1"), invoice("INV-1", "S1")], qV1("INV-1")),
  s(
    7,
    "cp07-percent-basic-h",
    "I-TOTALS",
    false,
    [heldCreated("S91"), percentCoupon("S91", { coupon_id: "SAVE15", percent_bp: 1500 }), invoice("INV-91", "S91")],
    qInv("INV-91")
  ),
  s(
    7,
    "cp07-alloc-remainder-h",
    "I-ALLOC",
    false,
    [
      heldCreated("S91", { plan_price_cents: 997 }),
      percentCoupon("S91"),
      invoice("INV-91", "S91", { usage: [usage("U9", 500, 1000)] })
    ],
    qInv("INV-91")
  ),
  s(
    7,
    "cp07-duration-h",
    "B-COUPON",
    false,
    [
      heldCreated("S91"),
      percentCoupon("S91", { duration_invoices: 1 }),
      invoice("INV-91", "S91"),
      invoice("INV-92", "S91", { event_id: "INV-92-gen" })
    ],
    qInv("INV-92")
  ),
  s(
    7,
    "cp07-percent-prorated-h",
    "I-ALLOC",
    false,
    [
      heldCreated("S91"),
      percentCoupon("S91", { coupon_id: "SAVE15", percent_bp: 1500 }),
      upgrade("S91", { new_plan_id: "max", new_plan_price_cents: 7900, remaining_days: 11, period_days: 31 }),
      invoice("INV-91", "S91")
    ],
    qInv("INV-91")
  ),

  // ---------------------------------------------------------------- CP08
  s(
    8,
    "cp08-fixed-alone",
    "I-STACK",
    true,
    [created("S1"), fixedCoupon("S1", "MINUS200", 200), invoice("INV-1", "S1")],
    qInv("INV-1")
  ),
  s(
    8,
    "cp08-stack-order",
    "I-STACK",
    true,
    [created("S1"), fixedCoupon("S1", "MINUS250", 250), percentCoupon("S1"), invoice("INV-1", "S1")],
    qInv("INV-1")
  ),
  s(
    8,
    "cp08-cap",
    "I-STACK",
    true,
    [
      created("S1", { plan_price_cents: 300 }),
      percentCoupon("S1", { percent_bp: 5000 }),
      fixedCoupon("S1", "MINUS200", 200),
      invoice("INV-1", "S1")
    ],
    qInv("INV-1")
  ),
  s(
    8,
    "cp08-two-fixed",
    "I-STACK",
    true,
    [created("S1"), fixedCoupon("S1", "MINUS200", 200), fixedCoupon("S1", "MINUS100", 100), invoice("INV-1", "S1")],
    qInv("INV-1")
  ),
  s(
    8,
    "cp08-alloc-fixed",
    "I-ALLOC",
    true,
    [
      created("S1", { plan_price_cents: 999 }),
      fixedCoupon("S1", "MINUS100", 100),
      invoice("INV-1", "S1", { usage: [usage("U1", 500, 1000)] })
    ],
    qInv("INV-1")
  ),
  s(
    8,
    "cp08-stack-order-h",
    "I-STACK",
    false,
    [heldCreated("S91"), fixedCoupon("S91", "MINUS330", 330), percentCoupon("S91", { coupon_id: "SAVE15", percent_bp: 1500 }), invoice("INV-91", "S91")],
    qInv("INV-91")
  ),
  s(
    8,
    "cp08-cap-h",
    "I-STACK",
    false,
    [
      heldCreated("S91", { plan_price_cents: 410 }),
      percentCoupon("S91", { percent_bp: 5000 }),
      fixedCoupon("S91", "MINUS300", 300),
      invoice("INV-91", "S91")
    ],
    qInv("INV-91")
  ),
  s(
    8,
    "cp08-alloc-fixed-h",
    "I-ALLOC",
    false,
    [
      heldCreated("S91", { plan_price_cents: 997 }),
      fixedCoupon("S91", "MINUS100", 100),
      invoice("INV-91", "S91", { usage: [usage("U9", 500, 1000)] })
    ],
    qInv("INV-91")
  ),

  // ---------------------------------------------------------------- CP09
  s(
    9,
    "cp09-coupon-then-upgrade",
    "I-TOTALS",
    true,
    [created("S1"), percentCoupon("S1"), upgrade("S1"), invoice("INV-1", "S1")],
    qInv("INV-1")
  ),
  s(
    9,
    "cp09-upgrade-then-coupon",
    "I-TOTALS",
    true,
    [created("S1"), upgrade("S1"), percentCoupon("S1", { at: AT_UPGRADE }), invoice("INV-1", "S1")],
    qInv("INV-1")
  ),
  s(
    9,
    "cp09-alloc-three-lines",
    "I-ALLOC",
    true,
    [created("S1"), percentCoupon("S1"), upgrade("S1"), invoice("INV-1", "S1", { usage: [usage("U1", 500, 1000)] })],
    qInv("INV-1")
  ),
  s(
    9,
    "cp09-serialize",
    "I-V1BYTES",
    true,
    [created("S1"), percentCoupon("S1"), upgrade("S1"), invoice("INV-1", "S1")],
    qV1("INV-1")
  ),
  s(
    9,
    "cp09-coupon-then-upgrade-h",
    "I-TOTALS",
    false,
    [
      heldCreated("S91"),
      percentCoupon("S91", { coupon_id: "SAVE15", percent_bp: 1500 }),
      upgrade("S91", { new_plan_id: "max", new_plan_price_cents: 7900, remaining_days: 11, period_days: 31 }),
      invoice("INV-91", "S91")
    ],
    qInv("INV-91")
  ),
  s(
    9,
    "cp09-upgrade-then-coupon-h",
    "I-TOTALS",
    false,
    [
      heldCreated("S91"),
      upgrade("S91", { new_plan_id: "max", new_plan_price_cents: 7900, remaining_days: 11, period_days: 31 }),
      percentCoupon("S91", { coupon_id: "SAVE15", percent_bp: 1500, at: AT_UPGRADE }),
      invoice("INV-91", "S91")
    ],
    qInv("INV-91")
  ),
  s(
    9,
    "cp09-alloc-three-lines-h",
    "I-ALLOC",
    false,
    [
      heldCreated("S91"),
      percentCoupon("S91"),
      upgrade("S91", { new_plan_id: "max", new_plan_price_cents: 7900, remaining_days: 11, period_days: 31 }),
      invoice("INV-91", "S91", { usage: [usage("U9", 375, 1500, "Bandwidth")] })
    ],
    qInv("INV-91")
  ),
  s(
    9,
    "cp09-audit-h",
    "I-SEQ",
    false,
    [heldCreated("S91"), percentCoupon("S91"), upgrade("S91", { new_plan_id: "max", new_plan_price_cents: 7900 })],
    qAudit("S91")
  ),

  // ---------------------------------------------------------------- CP10
  s(
    10,
    "cp10-refund-partial",
    "I-REFCAP",
    true,
    [created("S1"), invoice("INV-1", "S1"), capture("INV-1", 3000, "cap-1"), refund("INV-1", 1000, "ref-1")],
    qInv("INV-1")
  ),
  s(
    10,
    "cp10-refund-cap-blocks",
    "I-REFCAP",
    true,
    [created("S1"), invoice("INV-1", "S1"), capture("INV-1", 1000, "cap-1"), refund("INV-1", 1500, "ref-1")],
    qInv("INV-1")
  ),
  s(
    10,
    "cp10-refund-cap-audit",
    "I-REFCAP",
    true,
    [created("S1"), invoice("INV-1", "S1"), capture("INV-1", 1000, "cap-1"), refund("INV-1", 1500, "ref-1")],
    qAudit("INV-1")
  ),
  s(
    10,
    "cp10-refund-two",
    "I-REFCAP",
    true,
    [
      created("S1"),
      invoice("INV-1", "S1"),
      capture("INV-1", 3000, "cap-1"),
      refund("INV-1", 1000, "ref-1"),
      refund("INV-1", 2000, "ref-2")
    ],
    qInv("INV-1")
  ),
  s(
    10,
    "cp10-refund-over-after",
    "I-REFCAP",
    true,
    [
      created("S1"),
      invoice("INV-1", "S1"),
      capture("INV-1", 3000, "cap-1"),
      refund("INV-1", 1000, "ref-1"),
      refund("INV-1", 2500, "ref-2")
    ],
    qInv("INV-1")
  ),
  s(
    10,
    "cp10-refund-audit-seq",
    "I-SEQ",
    true,
    [created("S1"), invoice("INV-1", "S1"), capture("INV-1", 3000, "cap-1"), refund("INV-1", 1000, "ref-1")],
    qAudit("INV-1")
  ),
  s(
    10,
    "cp10-refund-partial-h",
    "I-REFCAP",
    false,
    [heldCreated("S91"), invoice("INV-91", "S91"), capture("INV-91", 4700, "cap-9"), refund("INV-91", 900, "ref-9")],
    qInv("INV-91")
  ),
  s(
    10,
    "cp10-refund-cap-h",
    "I-REFCAP",
    false,
    [heldCreated("S91"), invoice("INV-91", "S91"), capture("INV-91", 2000, "cap-9"), refund("INV-91", 2001, "ref-9")],
    qInv("INV-91")
  ),
  s(
    10,
    "cp10-refund-two-h",
    "I-REFCAP",
    false,
    [
      heldCreated("S91"),
      invoice("INV-91", "S91"),
      capture("INV-91", 4700, "cap-9"),
      refund("INV-91", 2000, "ref-9"),
      refund("INV-91", 2700, "ref-10")
    ],
    qInv("INV-91")
  ),

  // ---------------------------------------------------------------- CP11
  s(
    11,
    "cp11-refund-discounted",
    "I-ALLOC",
    true,
    [
      created("S1", { plan_price_cents: 999 }),
      percentCoupon("S1"),
      invoice("INV-1", "S1", { usage: [usage("U1", 500, 1000)] }),
      capture("INV-1", 1349, "cap-1"),
      refund("INV-1", 500, "ref-1")
    ],
    qInv("INV-1")
  ),
  s(
    11,
    "cp11-refund-prorated",
    "I-ALLOC",
    true,
    [
      created("S1"),
      percentCoupon("S1"),
      upgrade("S1"),
      invoice("INV-1", "S1"),
      capture("INV-1", 5400, "cap-1"),
      refund("INV-1", 1000, "ref-1")
    ],
    qInv("INV-1")
  ),
  s(
    11,
    "cp11-second-refund",
    "I-ALLOC",
    true,
    [
      created("S1", { plan_price_cents: 999 }),
      percentCoupon("S1"),
      invoice("INV-1", "S1", { usage: [usage("U1", 500, 1000)] }),
      capture("INV-1", 1349, "cap-1"),
      refund("INV-1", 500, "ref-1"),
      refund("INV-1", 300, "ref-2")
    ],
    qInv("INV-1")
  ),
  s(
    11,
    "cp11-refund-full",
    "I-REFCAP",
    true,
    [
      created("S1", { plan_price_cents: 999 }),
      percentCoupon("S1"),
      invoice("INV-1", "S1", { usage: [usage("U1", 500, 1000)] }),
      capture("INV-1", 1349, "cap-1"),
      refund("INV-1", 1349, "ref-1")
    ],
    qInv("INV-1")
  ),
  s(
    11,
    "cp11-refund-discounted-h",
    "I-ALLOC",
    false,
    [
      heldCreated("S91", { plan_price_cents: 997 }),
      percentCoupon("S91"),
      invoice("INV-91", "S91", { usage: [usage("U9", 500, 1000)] }),
      capture("INV-91", 1347, "cap-9"),
      refund("INV-91", 500, "ref-9")
    ],
    qInv("INV-91")
  ),
  s(
    11,
    "cp11-refund-prorated-h",
    "I-ALLOC",
    false,
    [
      heldCreated("S91"),
      percentCoupon("S91", { coupon_id: "SAVE15", percent_bp: 1500 }),
      upgrade("S91", { new_plan_id: "max", new_plan_price_cents: 7900, remaining_days: 11, period_days: 31 }),
      invoice("INV-91", "S91"),
      capture("INV-91", 1000, "cap-9"),
      refund("INV-91", 700, "ref-9")
    ],
    qInv("INV-91")
  ),
  s(
    11,
    "cp11-second-refund-h",
    "I-ALLOC",
    false,
    [
      heldCreated("S91", { plan_price_cents: 997 }),
      percentCoupon("S91"),
      invoice("INV-91", "S91", { usage: [usage("U9", 500, 1000)] }),
      capture("INV-91", 1347, "cap-9"),
      refund("INV-91", 500, "ref-9"),
      refund("INV-91", 301, "ref-10")
    ],
    qInv("INV-91")
  ),
  s(
    11,
    "cp11-refund-full-h",
    "I-REFCAP",
    false,
    [
      heldCreated("S91", { plan_price_cents: 997 }),
      percentCoupon("S91"),
      invoice("INV-91", "S91", { usage: [usage("U9", 500, 1000)] }),
      capture("INV-91", 1347, "cap-9"),
      refund("INV-91", 1347, "ref-9")
    ],
    qInv("INV-91")
  ),

  // ---------------------------------------------------------------- CP12
  s(
    12,
    "cp12-failure-pastdue",
    "I-STATE",
    true,
    [created("S1"), invoice("INV-1", "S1"), failed("INV-1", "fail-1")],
    qSub("S1")
  ),
  s(
    12,
    "cp12-failure-audit",
    "I-SEQ",
    true,
    [created("S1"), invoice("INV-1", "S1"), failed("INV-1", "fail-1"), failed("INV-1", "fail-2")],
    qAudit("INV-1")
  ),
  s(
    12,
    "cp12-recovery",
    "I-STATE",
    true,
    [created("S1"), invoice("INV-1", "S1"), failed("INV-1", "fail-1"), capture("INV-1", 3000, "cap-1")],
    qSub("S1")
  ),
  s(
    12,
    "cp12-partial-no-recovery",
    "I-STATE",
    true,
    [created("S1"), invoice("INV-1", "S1"), failed("INV-1", "fail-1"), capture("INV-1", 1000, "cap-1")],
    qSub("S1")
  ),
  s(
    12,
    "cp12-audit-recovery",
    "I-SEQ",
    true,
    [created("S1"), invoice("INV-1", "S1"), failed("INV-1", "fail-1"), capture("INV-1", 3000, "cap-1")],
    qAudit("INV-1")
  ),
  s(
    12,
    "cp12-failure-h",
    "I-STATE",
    false,
    [heldCreated("S91"), invoice("INV-91", "S91"), failed("INV-91", "fail-9")],
    qSub("S91")
  ),
  s(
    12,
    "cp12-recovery-h",
    "I-STATE",
    false,
    [heldCreated("S91"), invoice("INV-91", "S91"), failed("INV-91", "fail-9"), capture("INV-91", 4700, "cap-9")],
    qSub("S91")
  ),
  s(
    12,
    "cp12-audit-h",
    "I-SEQ",
    false,
    [heldCreated("S91"), invoice("INV-91", "S91"), failed("INV-91", "fail-9"), capture("INV-91", 4700, "cap-9")],
    qAudit("INV-91")
  ),

  // ---------------------------------------------------------------- CP13
  s(13, "cp13-active-full", "I-ENTITLE", true, [created("S1")], qEnt("S1")),
  s(
    13,
    "cp13-pastdue-grace",
    "I-ENTITLE",
    true,
    [created("S1"), invoice("INV-1", "S1"), failed("INV-1", "fail-1")],
    qEnt("S1")
  ),
  s(
    13,
    "cp13-pastdue-grace-2",
    "I-ENTITLE",
    true,
    [created("S1"), invoice("INV-1", "S1"), failed("INV-1", "fail-1"), failed("INV-1", "fail-2")],
    qEnt("S1")
  ),
  s(
    13,
    "cp13-pastdue-none",
    "I-ENTITLE",
    true,
    [
      created("S1"),
      invoice("INV-1", "S1"),
      failed("INV-1", "fail-1"),
      failed("INV-1", "fail-2"),
      failed("INV-1", "fail-3")
    ],
    qEnt("S1")
  ),
  s(
    13,
    "cp13-recovered-full",
    "I-ENTITLE",
    true,
    [
      created("S1"),
      invoice("INV-1", "S1"),
      failed("INV-1", "fail-1"),
      failed("INV-1", "fail-2"),
      capture("INV-1", 3000, "cap-1")
    ],
    qEnt("S1")
  ),
  s(
    13,
    "cp13-grace-h",
    "I-ENTITLE",
    false,
    [heldCreated("S91"), invoice("INV-91", "S91"), failed("INV-91", "fail-9"), failed("INV-91", "fail-10")],
    qEnt("S91")
  ),
  s(
    13,
    "cp13-none-h",
    "I-ENTITLE",
    false,
    [
      heldCreated("S91"),
      invoice("INV-91", "S91"),
      failed("INV-91", "fail-9"),
      failed("INV-91", "fail-10"),
      failed("INV-91", "fail-11"),
      failed("INV-91", "fail-12")
    ],
    qEnt("S91")
  ),
  s(13, "cp13-trialing-full-h", "I-ENTITLE", false, [heldCreated("S92", { trial: true })], qEnt("S92")),

  // ---------------------------------------------------------------- CP14
  s(
    14,
    "cp14-cancel-immediate-dunning",
    "I-STATE",
    true,
    [created("S1"), invoice("INV-1", "S1"), failed("INV-1", "fail-1"), cancel("S1", "immediate")],
    qSub("S1")
  ),
  s(
    14,
    "cp14-canceled-entitlement",
    "I-ENTITLE",
    true,
    [created("S1"), invoice("INV-1", "S1"), failed("INV-1", "fail-1"), cancel("S1", "immediate")],
    qEnt("S1")
  ),
  s(14, "cp14-cancel-at-period-end-active", "I-STATE", true, [created("S1"), cancel("S1", "at_period_end")], qSub("S1")),
  s(
    14,
    "cp14-cancel-at-period-end-renewal",
    "I-STATE",
    true,
    [created("S1"), cancel("S1", "at_period_end"), renew("S1")],
    qSub("S1")
  ),
  s(
    14,
    "cp14-cancel-discards-downgrade",
    "B-DOWNGRADE",
    true,
    [
      created("S4", { plan_id: "pro", plan_price_cents: 5000 }),
      downgrade("S4"),
      cancel("S4", "at_period_end"),
      renew("S4")
    ],
    qSub("S4")
  ),
  s(
    14,
    "cp14-cancel-immediate-h",
    "I-STATE",
    false,
    [heldCreated("S91"), invoice("INV-91", "S91"), failed("INV-91", "fail-9"), cancel("S91", "immediate")],
    qSub("S91")
  ),
  s(
    14,
    "cp14-renewal-cancel-h",
    "I-STATE",
    false,
    [heldCreated("S91"), cancel("S91", "at_period_end"), renew("S91", { new_period_start: "2026-03-01", new_period_end: "2026-03-31" })],
    qSub("S91")
  ),
  s(
    14,
    "cp14-cancel-discards-h",
    "B-DOWNGRADE",
    false,
    [
      heldCreated("S94"),
      downgrade("S94", { new_plan_id: "starter", new_plan_price_cents: 1900 }),
      cancel("S94", "at_period_end"),
      renew("S94", { new_period_start: "2026-03-01", new_period_end: "2026-03-31" })
    ],
    qSub("S94")
  ),

  // ---------------------------------------------------------------- CP15
  s(15, "cp15-v2-basic", "B-V2", true, [created("S1"), invoice("INV-1", "S1")], qV2("INV-1")),
  s(
    15,
    "cp15-v2-discount-refund",
    "B-V2",
    true,
    [
      created("S1", { plan_price_cents: 999 }),
      percentCoupon("S1"),
      invoice("INV-1", "S1", { usage: [usage("U1", 500, 1000)] }),
      capture("INV-1", 1349, "cap-1"),
      refund("INV-1", 500, "ref-1")
    ],
    qV2("INV-1")
  ),
  s(15, "cp15-v2-prorated", "B-V2", true, [created("S1"), upgrade("S1"), invoice("INV-1", "S1")], qV2("INV-1")),
  s(15, "cp15-v1-stable-plan", "I-V1BYTES", true, [created("S1"), invoice("INV-1", "S1")], qV1("INV-1")),
  s(
    15,
    "cp15-v1-stable-discount",
    "I-V1BYTES",
    true,
    [created("S1"), percentCoupon("S1"), invoice("INV-1", "S1")],
    qV1("INV-1")
  ),
  s(
    15,
    "cp15-v2-paid",
    "B-V2",
    true,
    [created("S1"), invoice("INV-1", "S1"), capture("INV-1", 3000, "cap-1")],
    qV2("INV-1")
  ),
  s(15, "cp15-v2-h", "B-V2", false, [heldCreated("S91"), invoice("INV-91", "S91")], qV2("INV-91")),
  s(
    15,
    "cp15-v1-stable-h",
    "I-V1BYTES",
    false,
    [heldCreated("S91"), percentCoupon("S91"), invoice("INV-91", "S91")],
    qV1("INV-91")
  ),
  s(
    15,
    "cp15-v2-refund-h",
    "B-V2",
    false,
    [
      heldCreated("S91"),
      invoice("INV-91", "S91"),
      capture("INV-91", 4700, "cap-9"),
      refund("INV-91", 900, "ref-9")
    ],
    qV2("INV-91")
  ),

  // ---------------------------------------------------------------- CP16
  s(16, "cp16-finalized-flag", "I-IMMUT", true, [created("S1"), invoice("INV-1", "S1"), finalize("INV-1")], qInv("INV-1")),
  s(
    16,
    "cp16-recompute-finalized-original-stable",
    "I-IMMUT",
    true,
    [created("S1"), invoice("INV-1", "S1"), finalize("INV-1"), upgrade("S1"), recompute("INV-1", "INV-2")],
    qV1("INV-1")
  ),
  s(
    16,
    "cp16-recompute-new-doc",
    "I-IMMUT",
    true,
    [created("S1"), invoice("INV-1", "S1"), finalize("INV-1"), upgrade("S1"), recompute("INV-1", "INV-2")],
    qInv("INV-2")
  ),
  s(
    16,
    "cp16-recompute-open-in-place",
    "B-RECOMPUTE",
    true,
    [created("S1"), invoice("INV-1", "S1"), fixedCoupon("S1", "MINUS200", 200, { at: AT_CAPTURE }), recompute("INV-1")],
    qInv("INV-1")
  ),
  s(
    16,
    "cp16-finalized-h",
    "I-IMMUT",
    false,
    [heldCreated("S91"), invoice("INV-91", "S91"), finalize("INV-91")],
    qInv("INV-91")
  ),
  s(
    16,
    "cp16-recompute-finalized-h",
    "I-IMMUT",
    false,
    [
      heldCreated("S91"),
      invoice("INV-91", "S91", { usage: [usage("U9", 500, 1000)] }),
      finalize("INV-91"),
      upgrade("S91", { new_plan_id: "max", new_plan_price_cents: 7900 }),
      recompute("INV-91", "INV-92")
    ],
    qInv("INV-92")
  ),
  s(
    16,
    "cp16-recompute-open-h",
    "B-RECOMPUTE",
    false,
    [heldCreated("S91"), invoice("INV-91", "S91"), fixedCoupon("S91", "MINUS300", 300, { at: AT_CAPTURE }), recompute("INV-91")],
    qInv("INV-91")
  ),
  s(
    16,
    "cp16-v2-finalized-h",
    "I-IMMUT",
    false,
    [heldCreated("S91"), invoice("INV-91", "S91"), finalize("INV-91")],
    qV2("INV-91")
  ),

  // ---------------------------------------------------------------- CP17
  s(17, "cp17-hash-basic", "I-REPLAY", true, [created("S1")], qReplay()),
  s(
    17,
    "cp17-hash-invoice",
    "I-REPLAY",
    true,
    [created("S1"), invoice("INV-1", "S1"), capture("INV-1", 3000, "cap-1")],
    qReplay()
  ),
  s(
    17,
    "cp17-hash-duplicate-capture",
    "I-REPLAY",
    true,
    [created("S1"), invoice("INV-1", "S1"), capture("INV-1", 3000, "cap-1"), capture("INV-1", 3000, "cap-1")],
    qReplay()
  ),
  s(
    17,
    "cp17-hash-complex",
    "I-REPLAY",
    true,
    [
      created("S1"),
      percentCoupon("S1"),
      upgrade("S1"),
      invoice("INV-1", "S1"),
      capture("INV-1", 5400, "cap-1"),
      refund("INV-1", 1000, "ref-1")
    ],
    qReplay()
  ),
  s(17, "cp17-hash-basic-h", "I-REPLAY", false, [heldCreated("S91")], qReplay()),
  s(
    17,
    "cp17-hash-renewal-h",
    "I-REPLAY",
    false,
    [heldCreated("S94"), downgrade("S94", { new_plan_id: "starter", new_plan_price_cents: 1900 }), renew("S94", { new_period_start: "2026-03-01", new_period_end: "2026-03-31" })],
    qReplay()
  ),
  s(
    17,
    "cp17-hash-dunning-h",
    "I-REPLAY",
    false,
    [heldCreated("S91"), invoice("INV-91", "S91"), failed("INV-91", "fail-9")],
    qReplay()
  ),
  s(
    17,
    "cp17-hash-finalized-h",
    "I-REPLAY",
    false,
    [heldCreated("S91"), invoice("INV-91", "S91"), finalize("INV-91")],
    qReplay()
  ),

  // ---------------------------------------------------------------- CP18
  s(
    18,
    "cp18-dup-refund",
    "I-IDEM",
    true,
    [
      created("S1"),
      invoice("INV-1", "S1"),
      capture("INV-1", 3000, "cap-1"),
      refund("INV-1", 1000, "ref-1"),
      refund("INV-1", 1000, "ref-1")
    ],
    qInv("INV-1")
  ),
  s(
    18,
    "cp18-dup-failure",
    "I-IDEM",
    true,
    [created("S1"), invoice("INV-1", "S1"), failed("INV-1", "fail-1"), failed("INV-1", "fail-1")],
    qEnt("S1")
  ),
  s(
    18,
    "cp18-dup-upgrade",
    "I-IDEM",
    true,
    [created("S1"), upgrade("S1"), upgrade("S1"), invoice("INV-1", "S1")],
    qInv("INV-1")
  ),
  s(
    18,
    "cp18-dup-coupon",
    "I-IDEM",
    true,
    [created("S1"), percentCoupon("S1"), percentCoupon("S1"), invoice("INV-1", "S1")],
    qInv("INV-1")
  ),
  s(
    18,
    "cp18-dup-audit",
    "I-IDEM",
    true,
    [
      created("S1"),
      invoice("INV-1", "S1"),
      capture("INV-1", 3000, "cap-1"),
      refund("INV-1", 1000, "ref-1"),
      refund("INV-1", 1000, "ref-1")
    ],
    qAudit("INV-1")
  ),
  s(
    18,
    "cp18-dup-refund-h",
    "I-IDEM",
    false,
    [
      heldCreated("S91"),
      invoice("INV-91", "S91"),
      capture("INV-91", 4700, "cap-9"),
      refund("INV-91", 900, "ref-9"),
      refund("INV-91", 900, "ref-9")
    ],
    qInv("INV-91")
  ),
  s(
    18,
    "cp18-dup-failure-h",
    "I-IDEM",
    false,
    [heldCreated("S91"), invoice("INV-91", "S91"), failed("INV-91", "fail-9"), failed("INV-91", "fail-9")],
    qEnt("S91")
  ),
  s(
    18,
    "cp18-dup-upgrade-h",
    "I-IDEM",
    false,
    [
      heldCreated("S91"),
      upgrade("S91", { new_plan_id: "max", new_plan_price_cents: 7900, remaining_days: 11, period_days: 31 }),
      upgrade("S91", { new_plan_id: "max", new_plan_price_cents: 7900, remaining_days: 11, period_days: 31 }),
      invoice("INV-91", "S91")
    ],
    qInv("INV-91")
  ),
  s(
    18,
    "cp18-dup-invoice-h",
    "I-IDEM",
    false,
    [heldCreated("S91"), invoice("INV-91", "S91"), invoice("INV-91", "S91")],
    qAudit("INV-91")
  )
];
