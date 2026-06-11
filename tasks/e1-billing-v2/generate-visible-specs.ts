// Generates task-package/visible-specs/CPnn.md for e1-billing-v2.
// Entailment holds by construction: every runnable feedback assertion (the visible cases)
// is quoted verbatim into the spec's worked examples, and event/query field documentation
// is extracted from ALL oracle cases so hidden cases never rely on undocumented fields.
//
// Run: bun tasks/e1-billing-v2/generate-visible-specs.ts

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const here = import.meta.dir;

type Pre = { title: string; intro: string; invariants: string[]; gwt: Array<[string, string, string, string]> };

const PRE: Record<string, Pre> = {
  "1": {
    title: "Subscription creation and the audit trail",
    intro:
      "The billing engine is event-sourced: `applyEvent(state, event)` folds events into an immutable state value, and `evaluate(events, query)` answers one query over a folded event list. Create subscriptions and keep a complete audit trail.",
    invariants: [
      "I-STATE: subscriptions move only along the documented lifecycle (trialing -> active -> past_due -> canceled).",
      "I-SEQ: every applied event appends exactly one audit entry to its aggregate, with sequence numbers starting at 1 and gap-free per aggregate."
    ],
    gwt: [
      ["Active subscription created", "a subscription_created event without the trial flag", "the subscription view is queried", "the status is active with the plan and period from the event"],
      ["Trial subscription activated", "a subscription created with trial=true and a subscription_activated event", "the subscription view is queried", "the status is active"],
      ["Audit sequence is gap-free", "a subscription with two applied events", "the audit log for the subscription is queried", "the entries carry sequence numbers 1 and 2 in application order"]
    ]
  },
  "2": {
    title: "Invoice generation with line-level rounding",
    intro: "Generate invoices from invoice_generated events: one plan line at the subscription's current plan price, plus one line per usage entry.",
    invariants: [
      "I-ROUND: each usage amount (rate_millicents x quantity / 1000) is rounded half-even at line level.",
      "I-TOTALS: the invoice total always equals the sum of the rounded line amounts."
    ],
    gwt: [
      ["Plan plus usage invoice", "an active subscription and an invoice_generated event with one usage entry", "the invoice view is queried", "the invoice has a plan line and a usage line and the total equals the sum of the rounded lines"],
      ["Half-cent ties round to even", "a usage entry whose raw amount lands exactly on a half cent", "the line amount is computed", "the amount rounds half-even to the nearest even cent"]
    ]
  },
  "3": {
    title: "Idempotent payment capture",
    intro: "Record payment captures against invoices. Webhooks retry, so the same capture event can arrive more than once.",
    invariants: ["I-IDEM: a payment_captured event whose event_id was already applied is a complete no-op: no state change and no audit entry."],
    gwt: [
      ["Capture marks the invoice paid", "a generated invoice and a payment_captured event for its full total", "the invoice view is queried", "the captured amount equals the total"],
      ["Duplicate capture is a no-op", "the same payment_captured event applied twice", "the invoice view and audit log are queried", "the captured amount counts once and the audit log has no duplicate entry"]
    ]
  },
  "4": {
    title: "v1 invoice serialization (legacy byte stability)",
    intro: "Expose the legacy v1 invoice serializer used by downstream partners. The v1 format has a fixed legacy field order and omits absent optional fields entirely; partners parse it positionally, so its bytes must never change for records it can already serialize.",
    invariants: ["I-V1BYTES: serialize_v1 output stays byte-identical for previously serializable invoices, forever."],
    gwt: [
      ["v1 serialization is stable", "a paid invoice", "serialize_v1 is queried", "the output is the exact documented byte string with the legacy field order"]
    ]
  },
  "5": {
    title: "Mid-period upgrade proration",
    intro: "Apply plan upgrades immediately. The next generated invoice carries a prorated credit for unused time on the old plan and a prorated charge for remaining time on the new plan, each rounded half-even from whole-day remainders.",
    invariants: ["Proration lines are invoice lines: I-ROUND and I-TOTALS apply to them, and v1 serialization of invoices with proration lines is stable from this checkpoint on (I-V1BYTES)."],
    gwt: [
      ["Upgrade prorates the next invoice", "an active subscription upgraded mid-period via plan_changed with change=upgrade", "the next invoice is generated and queried", "it carries a negative proration credit line for the old plan's unused days and a positive proration charge line for the new plan's remaining days, both rounded half-even"],
      ["Totals include proration", "an invoice with plan, usage, and proration lines", "the invoice view is queried", "the total equals the sum of all rounded lines"]
    ]
  },
  "6": {
    title: "Downgrade at period end",
    intro: "Plan downgrades never interrupt the paid period: they are scheduled and take effect at the next period renewal, with no proration lines.",
    invariants: [],
    gwt: [
      ["Downgrade is scheduled", "an active subscription with plan_changed change=downgrade", "the subscription view is queried before renewal", "the current plan is unchanged and the pending plan is recorded"],
      ["Downgrade applies at renewal", "a scheduled downgrade and a period_renewed event", "the subscription view is queried", "the plan is the downgraded plan and no proration lines appear on later invoices"]
    ]
  },
  "7": {
    title: "Percent coupons with duration and largest-remainder allocation",
    intro: "Percent coupons discount invoices for a fixed number of invoices (duration_invoices). The discount is computed half-even on the discountable base (the sum of positive lines) and allocated across positive lines by the largest-remainder method - never by rounding per line, which drifts by cents.",
    invariants: ["I-ALLOC: discount allocation across lines uses the largest-remainder method over positive lines; allocated parts always sum exactly to the discount."],
    gwt: [
      ["Percent coupon discounts the invoice", "an active subscription with a 10 percent coupon and a generated invoice", "the invoice view is queried", "the discount equals 10 percent of the positive-line base rounded half-even and the lines carry largest-remainder allocated shares"],
      ["Coupon duration expires", "a coupon with duration_invoices=1 and two generated invoices", "the second invoice is queried", "it carries no discount"],
      ["One-cent remainder lands on the largest line", "a discount that does not divide evenly across two positive lines", "the allocation is computed", "the extra cent goes to the line with the largest remainder"]
    ]
  },
  "8": {
    title: "Fixed coupons stack after percent coupons",
    intro: "Fixed-amount coupons stack with percent coupons: all percent coupons apply first to the discountable base, then fixed amounts are added, and the combined discount is capped at the discountable base.",
    invariants: ["I-STACK: percent before fixed; combined discount never exceeds the discountable base."],
    gwt: [
      ["Percent then fixed", "a 10 percent coupon and a 500-cent fixed coupon on one invoice", "the discount is computed", "the discount is 10 percent of the base plus 500 cents, allocated by largest remainder"],
      ["Discount capped at base", "fixed coupons exceeding the remaining base", "the discount is computed", "the discount equals the discountable base exactly"]
    ]
  },
  "9": {
    title: "Plan change while a coupon is active",
    intro: "Coupons keep working on invoices that carry proration lines from a plan change: the discountable base is the sum of positive lines including the proration charge, and allocation spreads across plan and proration charge lines.",
    invariants: [],
    gwt: [
      ["Coupon discounts a prorated invoice", "an active coupon and an upgrade mid-period", "the next invoice is generated and queried", "the discount is computed on the positive lines including the proration charge and allocated across them by largest remainder"]
    ]
  },
  "10": {
    title: "Partial refunds with a hard cap",
    intro: "payment_refunded events refund part of a captured invoice. Refunds accumulate; a refund that would push the refunded total past the captured amount is a complete no-op (no partial application, no audit entry).",
    invariants: ["I-REFCAP: refunded total never exceeds the captured amount per invoice."],
    gwt: [
      ["Partial refund accumulates", "a captured invoice and two partial refunds within the cap", "the invoice view is queried", "the refunded amount is their sum"],
      ["Over-cap refund is a no-op", "a refund exceeding the remaining refundable amount", "the invoice view and audit log are queried", "the refunded amount is unchanged and no audit entry was added"]
    ]
  },
  "11": {
    title: "Refund allocation across discounted lines",
    intro: "Refund amounts allocate across positive lines by remaining refundable net - line amount minus its allocated discount minus what was already refunded against it - using the largest-remainder method.",
    invariants: [],
    gwt: [
      ["Refund respects discounts", "a discounted captured invoice and a partial refund", "line refund shares are queried", "each line's share is proportional to its remaining refundable net by largest remainder, and shares sum exactly to the refund"]
    ]
  },
  "12": {
    title: "Dunning on payment failure",
    intro: "payment_failed events move an active subscription to past_due and count dunning attempts per subscription. A capture that pays the open invoice in full recovers the subscription to active and resets the attempt counter.",
    invariants: ["I-STATE extends: active -> past_due on failure; past_due -> active on full recovery."],
    gwt: [
      ["Failure enters dunning", "an active subscription and a payment_failed event", "the subscription view is queried", "the status is past_due with attempt count 1"],
      ["Full capture recovers", "a past_due subscription whose open invoice is captured in full", "the subscription view is queried", "the status is active and the attempt count is 0"]
    ]
  },
  "13": {
    title: "Entitlement gating during dunning",
    intro: "The entitlement query gates product access: full while trialing or active; grace while past_due through the second failed attempt; none from the third failed attempt onward or once canceled.",
    invariants: ["I-ENTITLE: entitlement derives only from lifecycle status and the dunning attempt count."],
    gwt: [
      ["Grace during early dunning", "a subscription with one or two failed attempts", "entitlement is queried", "the entitlement is grace"],
      ["Cut off at the third failure", "a subscription with three failed attempts", "entitlement is queried", "the entitlement is none"]
    ]
  },
  "14": {
    title: "Cancellation, including during dunning",
    intro: "subscription_canceled events support immediate and at_period_end modes. Immediate cancellation also clears dunning state and any scheduled plan change; at_period_end preserves access until renewal.",
    invariants: [],
    gwt: [
      ["Immediate cancel clears dunning", "a past_due subscription canceled with mode=immediate", "the subscription view and entitlement are queried", "the status is canceled, the scheduled change is cleared, and entitlement is none"],
      ["Cancel at period end keeps access", "an active subscription canceled with mode=at_period_end", "entitlement is queried before renewal", "the entitlement is full until the period renews"]
    ]
  },
  "15": {
    title: "v2 serializer beside a byte-stable v1",
    intro: "Add serialize_v2 with explicit fields including finalized, captured, and refunded. The legacy v1 output must remain byte-identical for every invoice it could already serialize - v1 never learns the new fields.",
    invariants: ["I-V1BYTES re-asserted across the v2 addition."],
    gwt: [
      ["v2 carries the new fields", "a captured and partially refunded invoice", "serialize_v2 is queried", "the output includes finalized, captured, and refunded fields in the documented order"],
      ["v1 is untouched by v2", "the same invoice", "serialize_v1 is queried", "the output is byte-identical to the pre-v2 format"]
    ]
  },
  "16": {
    title: "Finalized invoices are immutable",
    intro: "invoice_finalized freezes an invoice. invoice_recomputed reprices an open invoice in place; recomputing a finalized invoice instead writes a new invoice document (id suffix -r1, -r2, ...) and leaves the original untouched.",
    invariants: ["I-IMMUT: no event mutates a finalized invoice; recomputation produces new documents."],
    gwt: [
      ["Open recompute is in place", "an open invoice and an invoice_recomputed event", "the invoice view is queried", "the same invoice id carries the repriced lines"],
      ["Finalized recompute forks", "a finalized invoice and an invoice_recomputed event", "both invoice views are queried", "the original is byte-for-byte unchanged and a new -r1 document carries the repriced lines"]
    ]
  },
  "17": {
    title: "Deterministic audit replay",
    intro: "The replay_hash query folds the event log and returns a deterministic hash of the resulting state. Replaying the same events always reproduces the same hash; every piece of state must be derivable from events alone.",
    invariants: ["I-REPLAY: replaying the event log reproduces the state hash exactly."],
    gwt: [
      ["Replay is stable", "any event list", "replay_hash is queried twice", "both hashes are identical"],
      ["Hash covers the full state", "two event lists differing in one applied event", "replay_hash is queried for each", "the hashes differ"]
    ]
  },
  "18": {
    title: "Webhook idempotency for every event type",
    intro: "Generalize duplicate handling: any event whose event_id was already applied - capture, refund, failure, cancellation, plan change, or any other - is a complete no-op with no state change and no audit entry.",
    invariants: ["I-IDEM generalized to all event types."],
    gwt: [
      ["Duplicate refund is a no-op", "a refunded invoice and the same payment_refunded event applied again", "the invoice view is queried", "the refunded amount counts once"],
      ["Duplicate failure is a no-op", "a past_due subscription and the same payment_failed event applied again", "the subscription view is queried", "the attempt count is unchanged"]
    ]
  }
};

type OracleCase = {
  check_id: string;
  checkpoint_introduced: string;
  args: [Array<Record<string, unknown>>, Record<string, unknown>];
  held_out?: boolean;
};

const cases = JSON.parse(await readFile(join(here, "oracle-package", "cases.json"), "utf8")) as OracleCase[];
const seenEvents = new Set<string>();
const seenQueries = new Set<string>();
const outDir = join(here, "task-package", "visible-specs");
await mkdir(outDir, { recursive: true });

for (let index = 1; index <= 18; index += 1) {
  const checkpoint = String(index);
  const pre = PRE[checkpoint];
  const cpCases = cases.filter((c) => c.checkpoint_introduced === checkpoint);
  const eventDocs = new Map<string, Set<string>>();
  const queryDocs = new Map<string, Set<string>>();

  for (const c of cpCases) {
    for (const event of c.args[0]) {
      const type = String(event.type);

      if (!seenEvents.has(type)) {
        const fields = eventDocs.get(type) ?? new Set<string>();
        Object.keys(event).forEach((key) => fields.add(key));
        eventDocs.set(type, fields);
      }
    }

    const kind = String(c.args[1].kind);

    if (!seenQueries.has(kind)) {
      const fields = queryDocs.get(kind) ?? new Set<string>();
      Object.keys(c.args[1]).forEach((key) => fields.add(key));
      queryDocs.set(kind, fields);
    }
  }

  eventDocs.forEach((_, type) => seenEvents.add(type));
  queryDocs.forEach((_, kind) => seenQueries.add(kind));

  const visible = cpCases.filter((c) => !c.held_out);
  const lines: string[] = [
    `# CP${checkpoint.padStart(2, "0")}: ${pre.title}`,
    "",
    pre.intro,
    ""
  ];

  if (pre.invariants.length) {
    lines.push("## Invariants introduced (cumulative from now on)", "", ...pre.invariants.map((s) => `- ${s}`), "");
  }

  lines.push("## Scenarios", "");

  for (const [name, given, when, then] of pre.gwt) {
    lines.push(`#### Scenario: ${name}`, `- **GIVEN** ${given}`, `- **WHEN** ${when}`, `- **THEN** ${then}`, "");
  }

  if (eventDocs.size) {
    lines.push("## Events introduced", "");

    for (const [type, fields] of [...eventDocs.entries()].sort()) {
      lines.push(`- \`${type}\` with fields: ${[...fields].sort().map((f) => `\`${f}\``).join(", ")}`);
    }

    lines.push("");
  }

  if (queryDocs.size) {
    lines.push("## Queries introduced", "");

    for (const [kind, fields] of [...queryDocs.entries()].sort()) {
      lines.push(`- \`${kind}\` with fields: ${[...fields].sort().map((f) => `\`${f}\``).join(", ")}`);
    }

    lines.push("");
  }

  lines.push(
    "## Worked examples",
    "",
    "Each example is `evaluate(events, query) -> expected`, verbatim. These exact cases are the checkpoint's acceptance examples.",
    ""
  );

  const feedbackCases = JSON.parse(
    await readFile(join(here, "task-package", "feedback-assets", "cases", `cp${checkpoint.padStart(2, "0")}.json`), "utf8")
  ) as Array<Record<string, unknown>>;

  for (const example of feedbackCases) {
    lines.push("```json", JSON.stringify(example, null, 2), "```", "");
  }

  await writeFile(join(outDir, `CP${checkpoint.padStart(2, "0")}.md`), `${lines.join("\n")}\n`);
  console.log(`CP${checkpoint.padStart(2, "0")}: ${visible.length} worked examples, ${eventDocs.size} new events, ${queryDocs.size} new queries`);
}
