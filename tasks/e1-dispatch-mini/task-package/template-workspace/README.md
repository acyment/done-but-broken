# Order Dispatch (OpenSpec workflow)

Implement the exported dispatch engine API in `src/dispatch.ts` using only the visible semantic specification provided in each checkpoint prompt.

Workspace layout:

- `src/dispatch.ts` - engine facade and the public API (`evaluate(events, query)` is the single entry point: fold events, answer one query).
- `src/dispatch-types.ts` - engine state, event/query types, and shared guards.
- `src/orders.ts` - order lifecycle handlers and status rules.
- `src/api/render-order.ts` - the order exporter (pure string builder, fixed field order).
- `src/api/parse-order.ts` - the order importer.
- `src/notify/digest.ts` - the operations status digest.
- `specs/` - read-only provided spec tooling; do not modify anything under it.

Output discipline (important):

- Each of your responses has a hard output cap. A file block cut off by that cap is
  discarded entirely — the edit does not apply and the turn is wasted.
- Therefore rewrite **at most one source file per turn**. Never batch multiple files into
  a single response; spread a multi-file change across consecutive turns, one file each.
- Keep this module split as the engine grows: every file must stay small enough to
  rewrite in full within a single turn's output budget.

Data rules:

- All money is integer cents. Never use floating-point money.
- Exported orders use a fixed field order and omit empty or false values.
- The status digest lists buckets in lifecycle order and omits empty buckets.
- Re-importing an exported order must reproduce the order's data; imports reject unknown
  status values.

This project tracks its specification with OpenSpec. The spec-of-record lives in `openspec/specs/dispatch/spec.md`; it is read-only for you and is updated only by the project's archive tooling at the end of each change.

For every checkpoint that has an open change request under `openspec/changes/<change-name>/` (see its `proposal.md`), you must also author that change's spec delta at `openspec/changes/<change-name>/specs/dispatch/spec.md` before finishing the checkpoint. Use OpenSpec delta format:

- `## ADDED Requirements` for new requirements, `## MODIFIED Requirements` to rewrite an existing requirement block, `## REMOVED Requirements` to delete one.
- Each requirement is `### Requirement: <name>` followed by SHALL prose, then one or more `#### Scenario: <name>` blocks with `- **GIVEN**` / `- **WHEN**` / `- **THEN**` bullets.
- A `MODIFIED` block replaces the entire existing requirement block, so it must restate every scenario that should remain in force.

Do not modify files under `specs/` or `openspec/specs/`. The engine is deterministic: identical event arrays must produce byte-identical outputs; do not introduce real-clock behavior.
