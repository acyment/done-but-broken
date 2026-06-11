# Billing v2 (OpenSpec workflow)

Implement the exported billing engine API in `src/billing.ts` using only the visible semantic specification provided in each checkpoint prompt.

Workspace layout:

- `src/billing.ts` - engine facade and the public API (`evaluate(events, query)` is the single entry point: fold events, answer one query).
- `src/billing-types.ts` - engine state, event/query types, and shared guards.
- `src/billing-handlers.ts` - subscription-lifecycle handlers and the dispatch switch.
- `src/billing-invoice-handlers.ts` - invoice and payment handlers.
- `src/domain/` - `money.ts` (integer-cents arithmetic), `subscription.ts` (lifecycle), `invoice.ts` (invoices and lines), plus further domain modules as the spec grows.
- `src/api/serializers.ts` - invoice serializers (pure string builders, fixed field order).
- `src/events/audit.ts` - audit log helpers.
- `specs/` - read-only provided spec tooling; do not modify anything under it.

Output discipline (important):

- Each of your responses has a hard output cap. A file block cut off by that cap is
  discarded entirely — the edit does not apply and the turn is wasted.
- Therefore rewrite **at most one source file per turn**. Never batch multiple files into
  a single response; spread a multi-file change across consecutive turns, one file each.
- Keep this module split as the engine grows: every file must stay small enough to
  rewrite in full within a single turn's output budget. When a file approaches a few
  hundred lines, move cohesive pieces into a new module instead of letting it grow.

Money rules:

- All money is integer cents. Never use floating-point money.
- Fractional results round half-even (banker's rounding) via the helper in `src/domain/money.ts`; it is the only sanctioned rounding primitive.
- Splitting an amount across lines (discounts, refunds) must use a largest-remainder allocation helper in `src/domain/money.ts`; naive per-line rounding drifts by cents and is wrong.

Compatibility duties:

- The v1 invoice serializer is a frozen legacy format: fixed field order, omits-zero style. Its byte output for previously serializable invoices must never change.
- The facade exports a deprecated `applyEvents(state, events)` wrapper (plural). Legacy callers depend on it; it must keep working forever.

This project tracks its specification with OpenSpec. The spec-of-record lives in `openspec/specs/billing/spec.md`; it is read-only for you and is updated only by the project's archive tooling at the end of each change.

For every checkpoint that has an open change request under `openspec/changes/<change-name>/` (see its `proposal.md`), you must also author that change's spec delta at `openspec/changes/<change-name>/specs/billing/spec.md` before finishing the checkpoint. Use OpenSpec delta format:

- `## ADDED Requirements` for new requirements, `## MODIFIED Requirements` to rewrite an existing requirement block, `## REMOVED Requirements` to delete one.
- Each requirement is `### Requirement: <name>` followed by SHALL prose, then one or more `#### Scenario: <name>` blocks with `- **GIVEN**` / `- **WHEN**` / `- **THEN**` bullets.
- A `MODIFIED` block replaces the entire existing requirement block, so it must restate every scenario that should remain in force.

Do not modify files under `specs/` or `openspec/specs/`. The engine is deterministic: identical event arrays must produce byte-identical outputs; do not introduce real-clock behavior.
