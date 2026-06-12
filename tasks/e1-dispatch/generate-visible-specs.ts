// Generates task-package/visible-specs/CPNN.md from checkpoint narratives plus
// the visible worked examples in task-package/feedback-assets/cases/.
// Both arms see this exact text; the worked examples are the same cases the feedback
// arm can execute.
//
// Run after generate-cases.ts: bun tasks/e1-dispatch/generate-visible-specs.ts

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const here = import.meta.dir;

const SPECS: Record<string, { title: string; body: string }> = {
  "1": {
    title: "Order notes",
    body: `Support agents attach free-text notes to orders. Accept a \`note_added\` event with a \`note\` string; notes accumulate in order and never change an order's status. Exported orders include a \`notes\` array when any notes exist; orders without notes export exactly as before. Re-importing an exported order preserves its notes.

## Scenarios

#### Scenario: Notes survive the round-trip
- **GIVEN** a paid order with a note
- **WHEN** the order is exported and re-imported
- **THEN** the re-imported order carries the note

#### Scenario: Notes never change status
- **GIVEN** a processing order
- **WHEN** a note is added
- **THEN** the order status is still processing`
  },
  "2": {
    title: "Digest revenue",
    body: `The operations dashboard needs money at risk per lifecycle stage. Each status digest bucket now also reports \`total_cents\`: the summed order totals (integer cents) of the orders in that bucket. Buckets keep appearing in lifecycle order, and empty buckets stay omitted.

## Scenarios

#### Scenario: Buckets carry money
- **GIVEN** two paid unshipped orders and one shipped order
- **WHEN** the status digest is queried
- **THEN** the processing bucket reports count 2 with the two orders' summed total_cents, and the shipped bucket reports its own sum`
  },
  "3": {
    title: "Line returns",
    body: `Customers return merchandise. Accept a \`line_returned\` event for a shipped line; a return on a line that never shipped is ignored. An order whose lines are all returned is shown as \`returned\` everywhere a status is shown. Exported orders mark returned lines with \`"returned":true\` (omitted when false), and re-importing an exported order preserves the returned marks.

## Scenarios

#### Scenario: Fully returned order
- **GIVEN** a paid order with every line shipped and then returned
- **WHEN** the order status is queried
- **THEN** the status is returned

#### Scenario: Returns only apply to shipped lines
- **GIVEN** a paid order whose line never shipped
- **WHEN** a line_returned event arrives for it
- **THEN** the order status is unchanged`
  },
  "4": {
    title: "Partial shipments",
    body: `Warehouses ship multi-line orders in waves. A paid order with at least one shipped line and at least one unshipped line is now reported as \`partially_shipped\` everywhere a status is shown; such orders previously appeared as processing. In lifecycle order, partially_shipped sits between processing and shipped.

## Scenarios

#### Scenario: First wave shipped
- **GIVEN** a paid two-line order with exactly one line shipped
- **WHEN** the order status is queried
- **THEN** the status is partially_shipped

#### Scenario: Final wave completes the order
- **GIVEN** a partially shipped order
- **WHEN** its remaining lines ship
- **THEN** the status is shipped`
  },
  "5": {
    title: "Shipment metadata",
    body: `Partners need to know which carrier handled each shipment so they can track deliveries and process claims. Carrier name and tracking number may be included on a \`line_shipped\` event; they are stored against the line and survive the export/import round-trip. Exported orders include \`carrier\` and \`tracking\` on each shipped line when recorded; lines without this information export exactly as before. An order's status is not affected by whether carrier information is present.

## Scenarios

#### Scenario: Carrier survives the round-trip
- **GIVEN** a paid order with a shipped line carrying carrier and tracking
- **WHEN** the order is exported and re-imported
- **THEN** the re-imported line carries the same carrier and tracking

#### Scenario: Status is unaffected by carrier information
- **GIVEN** a paid order with one shipped line and a carrier recorded
- **WHEN** the order status is queried
- **THEN** the status reflects only the shipment state`
  },
  "6": {
    title: "Partial returns",
    body: `A fully shipped order with some lines on their way back is neither cleanly shipped nor fully returned. A fully shipped order with at least one returned line, but not all lines returned, is now reported as \`partially_returned\` everywhere a status is shown; such orders previously appeared as shipped. In lifecycle order, partially_returned sits between shipped and returned. Orders that still have unshipped lines keep their existing status rules.

## Scenarios

#### Scenario: One line comes back
- **GIVEN** a fully shipped two-line order with one line returned
- **WHEN** the order status is queried
- **THEN** the status is partially_returned

#### Scenario: All lines returned stays returned
- **GIVEN** a fully shipped order with every line returned
- **WHEN** the order status is queried
- **THEN** the status is returned`
  },
  "7": {
    title: "Partial payments",
    body: `Some customers pay in installments. Accept a \`partial_payment_received\` event with an \`amount_cents\` field; multiple partial payments accumulate. Everywhere a status is shown, an order with at least one partial payment recorded but not yet fully paid is reported as \`partially_paid\`; this sits between \`awaiting_payment\` and \`processing\` in lifecycle order. A subsequent \`payment_received\` event marks the order fully paid and it then follows the existing status rules. Exports and re-imports recognise \`partially_paid\` as a valid status.

## Scenarios

#### Scenario: Order with partial payment
- **GIVEN** an order with a partial_payment_received event covering less than the total
- **WHEN** the order status is queried
- **THEN** the status is partially_paid

#### Scenario: Full payment overrides partial payment history
- **GIVEN** an order that received a partial payment followed by a full payment_received
- **WHEN** the order status is queried
- **THEN** the status reflects the fully paid state, not partially_paid`
  },
  "8": {
    title: "Cancel after shipment",
    body: `Operations cancels orders even after some lines have shipped. An order cancelled after at least one line has shipped is now reported as \`cancelled_partial\` everywhere a status is shown; such orders previously appeared as \`cancelled\`. An exported \`cancelled_partial\` order carries \`"requires_refund":true\`; re-importing it preserves that flag.

## Scenarios

#### Scenario: Partially shipped order is cancelled
- **GIVEN** a paid order with one line shipped
- **WHEN** the order is cancelled
- **THEN** everywhere a status is shown it is cancelled_partial and the export carries requires_refund:true

#### Scenario: Clean cancellation is unchanged
- **GIVEN** a paid order with no lines shipped
- **WHEN** the order is cancelled
- **THEN** the status is cancelled with no requires_refund flag`
  },
  "9": {
    title: "Refunds",
    body: `When a returned line is refunded, operations tracks the refund through export, import, and the status digest. Accept a \`refund_issued\` event with a \`line_id\`; refunds only apply to returned lines. Exported orders mark each refunded line with \`"refunded":true\` (omitted when false); re-importing an exported order preserves the refunded flag. The status digest includes a \`refund_cents\` field per bucket when any order in that bucket has refunded lines; buckets with no refunds omit the field. An order's status is not changed by refunds alone.

## Scenarios

#### Scenario: Refunded line appears in export
- **GIVEN** a paid order with a shipped, returned, and refunded line
- **WHEN** the order is exported
- **THEN** the line carries refunded:true

#### Scenario: Digest shows refund totals
- **GIVEN** orders with some refunded lines
- **WHEN** the status digest is queried
- **THEN** buckets with refunds carry refund_cents; buckets without refunds omit it`
  },
  "10": {
    title: "Closed status",
    body: `An order that has been fully returned and every line refunded has reached its final settled state. Everywhere a status is shown, a fully paid order where every line has been both returned and refunded is now reported as \`closed\`; it previously appeared as \`returned\`. An order where every line is returned but at least one line has not been refunded remains \`returned\`. \`closed\` sits after \`returned\` in lifecycle order.

## Scenarios

#### Scenario: Fully settled order becomes closed
- **GIVEN** a paid order with every line shipped, returned, and refunded
- **WHEN** the order status is queried
- **THEN** the status is closed

#### Scenario: Unrefunded returns stay returned
- **GIVEN** a paid order with every line returned but one line not yet refunded
- **WHEN** the order status is queried
- **THEN** the status is returned`
  },
  "11": {
    title: "Receivables digest",
    body: `Finance needs a view of how much money is still outstanding across all orders, grouped by status. A new \`receivables_digest\` query returns one entry per status bucket where any order has outstanding amounts; \`outstanding_cents\` equals the total order value minus payments received minus refunded line amounts. Buckets where all orders are fully settled are omitted. The existing \`status_digest\` query is unchanged.

## Scenarios

#### Scenario: Unpaid orders show full outstanding amount
- **GIVEN** an order that has received no payment
- **WHEN** the receivables digest is queried
- **THEN** the order's bucket shows outstanding_cents equal to the order total

#### Scenario: Partially paid orders show remaining balance
- **GIVEN** an order with a partial_payment_received covering some of the total
- **WHEN** the receivables digest is queried
- **THEN** outstanding_cents equals the total minus what was paid`
  },
  "12": {
    title: "Cancelled owing",
    body: `When a customer has made a partial payment then cancels, the business is still owed money. Everywhere a status is shown, a cancelled order that had at least one partial payment recorded but was never fully paid is now reported as \`cancelled_owing\`; an exported order in this status carries \`"outstanding_owing":true\`. Plain cancellation of an order that never received any payment remains \`cancelled\`. Full-payment-then-cancellation is unchanged. \`cancelled_owing\` takes precedence over \`cancelled_partial\` when both conditions would otherwise apply. \`cancelled_owing\` sits after \`cancelled_partial\` in lifecycle order.

## Scenarios

#### Scenario: Partial payment then cancel
- **GIVEN** an order that received a partial payment and was then cancelled
- **WHEN** the order status is queried
- **THEN** everywhere a status is shown it is cancelled_owing and the export carries outstanding_owing:true

#### Scenario: Never-paid cancellation is unchanged
- **GIVEN** an order that received no payment and was cancelled
- **WHEN** the order status is queried
- **THEN** the status is cancelled with no outstanding_owing flag`
  }
};

const visibleSpecsDir = join(here, "task-package", "visible-specs");
await mkdir(visibleSpecsDir, { recursive: true });

for (const [cp, spec] of Object.entries(SPECS)) {
  const casesPath = join(here, "task-package", "feedback-assets", "cases", `cp${cp.padStart(2, "0")}.json`);
  let casesJson: Array<Record<string, unknown>> = [];
  try {
    casesJson = JSON.parse(await readFile(casesPath, "utf8")) as Array<Record<string, unknown>>;
  } catch {
    // no visible cases for this checkpoint
  }

  const examplesBlock =
    casesJson.length === 0
      ? ""
      : `\n\n## Worked examples\n\nEach example is \`evaluate(events, query) -> expected\`, verbatim. These exact cases are the checkpoint's acceptance examples.\n\n${casesJson.map((c) => "```json\n" + JSON.stringify(c, null, 2) + "\n```").join("\n\n")}`;

  const content = `# CP${cp.padStart(2, "0")}: ${spec.title}\n\n${spec.body}${examplesBlock}\n`;
  await writeFile(join(visibleSpecsDir, `CP${cp.padStart(2, "0")}.md`), content);
}

console.log("Generated visible specs for CPs 1–12");
