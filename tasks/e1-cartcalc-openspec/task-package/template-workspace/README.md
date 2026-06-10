# CartCalc (OpenSpec workflow)

Implement the exported CartCalc API in `src/cartcalc.ts` using only the visible semantic specification provided in each checkpoint prompt.

This project tracks its specification with OpenSpec. The spec-of-record lives in `openspec/specs/cartcalc/spec.md`; it is read-only for you and is updated only by the project's archive tooling at the end of each change.

For every checkpoint that has an open change request under `openspec/changes/<change-name>/` (see its `proposal.md`), you must also author that change's spec delta at `openspec/changes/<change-name>/specs/cartcalc/spec.md` before finishing the checkpoint. Use OpenSpec delta format:

- `## ADDED Requirements` for new requirements, `## MODIFIED Requirements` to rewrite an existing requirement block, `## REMOVED Requirements` to delete one.
- Each requirement is `### Requirement: <name>` followed by SHALL prose, then one or more `#### Scenario: <name>` blocks with `- **GIVEN**` / `- **WHEN**` / `- **THEN**` bullets.
- A `MODIFIED` block replaces the entire existing requirement block, so it must restate every scenario that should remain in force.

Do not modify files under `specs/` or `openspec/specs/`. Use integer cents throughout; do not introduce real-clock behavior.
