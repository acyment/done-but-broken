# E4 Gate 1 — Operator Decisions (2026-07-08)

Verbatim record of the operator's Phase-1 gate review, received 2026-07-08 in response to
`docs/e4/E4-ARCHITECTURE.md` and the seven ADRs in `docs/e4/adr/`. This document is part of E4's
provenance record; the required changes below were applied before the Phase-1 commits.

---

Gate 1 review complete. Phase 1 is APPROVED with the required changes below. Apply them, commit as
instructed, report SHAs, then stop — Phase 2 begins in a fresh session.

## Required changes before commit

**1. ADR-001 + meter + known-drift fixture — close the registry-bypass blind spot.**
The surface dump enumerates the registry, so the "code-side inventory" is really "registry-declared
inventory." An agent that wires a route directly (bypassing the registry) is invisible to the dump
while potentially green in the executor. Add a reconciliation rule to the meter design: when
executor evidence shows a ground-truth endpoint passing while the surface dump lacks it, record a
`registry_bypass` event and attribute the discrepancy to the conventions channel
(structural-convention violation), not the API channel. Add one cell to the known-drift fixture: a
route served but absent from the registry, with its expected classification. This turns a validity
hole into a measured behavior.

**2. ADR-003 — two additions, no design change.**
(a) Add an explicit paragraph: the gate enforces *custody and sequencing*, not spec accuracy — the
red check runs harness-generated tests, and the custody check requires changed+parseable, not
correct. Arm H's spec quality is therefore an outcome measured by the meter, not enforced by the
gate; H2 remains falsifiable and the tautology defense holds by construction. State this so critics
find it pre-answered.
(b) Record as a design limitation: spec paths frozen during implementation phase means one-shot
spec-first per task — a spec error discovered mid-implementation cannot be corrected within the
task and lands as measured H drift. This biases against H2 and H5 (conservative); record it as
pre-registered, not discoverable.
(c) The behavior-preserving "no-change affirmation" mechanism stays deferred to Phase 2, with one
constraint fixed now: no new claim-grammar token (Gate-0 injection 2 stands); the mechanism must
live inside existing machinery.

**3. ADR-007 — enforce the full forbidden list now, not Phase 3.**
Extend `test/e4-no-legacy-imports.test.ts` to the entire normative forbidden set (legacy stack AND
the E1-orchestrator/closed-world list) before the Phase-1 commit. A normative-but-unenforced rule
is spec-code drift, and this repo of all repos doesn't ship that. Update ADR-007's "Phase-3
hardening candidate" line accordingly.

**4. Manifest — add per-phase usage.**
H5's freshness tax requires Arm H's spec-phase + gate overhead isolated as a first-class number.
Add a per-phase usage split to `E4TaskRecord` (turns/tokens/wall-clock by `E4TaskPhase`, plus
gate-check executor costs). Headline numbers must be cheap reads from the manifest, not turn-record
archaeology.

**5. Pins (one line each, in the named doc).**
- ADR-005/Phase-2 analysis: aborted partial-task usage is infrastructure-classified and excluded
  from tax computations.
- §5 floor-effect rule: the collapse threshold that blocks H4 gets a pinned numeric definition in
  the Phase-2 pre-registration.
- ADR-004/T0 README: the conventions bullet grammar appears verbatim with one example per
  convention kind; the JSON-vs-YAML reversibility window closes at meter freeze — state both.

## Confirmations

- ADR-001 deviation (TypeScript app): APPROVED — the coverage-gap/surface-dump argument is decisive.
- ADR-004 deviation (OpenAPI JSON): APPROVED.
- ADR-002, ADR-005, ADR-006: APPROVED as written.
- 382/382 is the approved successor baseline (379 + 3 lint tests); it will move again when change 3
  extends the lint suite — report the new count.
- `bun run e1:protect` triad: APPROVED as the per-milestone check, pending operator's local run.

## Commits (after changes, in order, both pushed)

1. **Docs commit:** E4-ARCHITECTURE.md, the seven ADRs (as amended above), GATE-1-DECISIONS.md
   (create it; record this message verbatim).
2. **Code commit:** `bin/e1-protection-check.ts`, the extended `test/e4-no-legacy-imports.test.ts`,
   package.json script wiring.

Then stop. Phase 2 will be kicked off in a fresh session per the standing pattern.

---

*The operator's message additionally asked whether Opus can safely be used for Phase 2; that is a
session-operations question, answered in the session transcript, not a gate decision — recorded
here only for completeness of the verbatim rule.*

*Execution record (same day): changes 1–5 applied — registry-bypass reconciliation rule +
`registry_bypass` report field + fixture cell and Gherkin scenario (ADR-001, architecture §2.4/§6);
ADR-003 2a/2b paragraphs + 2c constraint; full forbidden set (legacy stack + E1
orchestrators/closed-world) lint-enforced with a dedicated self-test; `E4TaskRecord.usage.by_phase`
+ `gate_executor`; the three pins in ADR-005/architecture §5/ADR-004. New test count reported at
commit time in the session transcript. Commit SHAs in the commit history (docs commit, then code
commit, both pushed).*
