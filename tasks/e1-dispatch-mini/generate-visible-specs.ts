// Generates task-package/visible-specs/CPNN.md from the checkpoint narratives below plus
// the visible worked examples in task-package/feedback-assets/cases/. Both arms see this
// exact text; the worked examples are the same cases the feedback arm can execute.
//
// Run after generate-cases.ts: bun tasks/e1-dispatch-mini/generate-visible-specs.ts

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
    title: "Partial returns",
    body: `A fully shipped order with some lines on their way back is neither cleanly shipped nor fully returned. A fully shipped order with at least one returned line, but not all lines returned, is now reported as \`partially_returned\` everywhere a status is shown; such orders previously appeared as shipped. In lifecycle order, partially_returned sits between shipped and returned. Orders that still have unshipped lines keep their existing status rules.

## Scenarios

#### Scenario: One line comes back
- **GIVEN** a fully shipped two-line order with one line returned
- **WHEN** the order status is queried
- **THEN** the status is partially_returned

#### Scenario: Unshipped lines take precedence
- **GIVEN** a paid order with an unshipped line and a returned shipped line
- **WHEN** the order status is queried
- **THEN** the status is partially_shipped`
  },
  "6": {
    title: "Cancellation after shipment",
    body: `Cancelling an order after merchandise already left the warehouse creates refund work that a plain cancellation does not. An order cancelled after at least one of its lines shipped is now reported as \`cancelled_partial\` everywhere a status is shown; such orders previously appeared as cancelled. In lifecycle order, cancelled_partial sits after cancelled. The export of a cancelled_partial order is flagged \`"requires_refund":true\` (omitted otherwise), and re-importing preserves the flag.

## Scenarios

#### Scenario: Cancelled mid-fulfilment
- **GIVEN** a paid two-line order with one line shipped
- **WHEN** the order is cancelled
- **THEN** the status is cancelled_partial and the export is flagged requires_refund

#### Scenario: Plain cancellation unchanged
- **GIVEN** an order with no shipped lines
- **WHEN** the order is cancelled
- **THEN** the status is cancelled and no refund flag appears`
  }
};

const outDir = join(here, "task-package", "visible-specs");
await mkdir(outDir, { recursive: true });

for (const [checkpoint, spec] of Object.entries(SPECS)) {
  const padded = String(checkpoint).padStart(2, "0");
  const casesPath = join(here, "task-package", "feedback-assets", "cases", `cp${padded}.json`);
  const cases = JSON.parse(await readFile(casesPath, "utf8")) as Array<Record<string, unknown>>;

  const examples = cases
    .map((item) => "```json\n" + JSON.stringify(item, null, 2) + "\n```")
    .join("\n\n");

  const document = `# CP${padded}: ${spec.title}

${spec.body}

## Worked examples

Each example is \`evaluate(events, query) -> expected\`, verbatim. These exact cases are the checkpoint's acceptance examples.

${examples}
`;

  await writeFile(join(outDir, `CP${padded}.md`), document);
}

console.log("visible specs written");
