# E4 Gate 0 — Operator Decisions (2026-07-08)

Verbatim record of the operator's Phase-0 gate review, received 2026-07-08 in response to
`docs/e4/DISCOVERY.md` §6 and `docs/e4/AGENTS-AMENDMENT-PROPOSAL.md`. This document is part of E4's
provenance record; the injections in the final section are binding inputs to Phase 1.

---

Gate 0 review complete. Decisions below. Execute in order, report commit SHAs, then stop — Phase 1 begins in a fresh session.

## Q1 — Amendment: APPROVED with two mandatory wording changes before applying

**Change 1.** Replace the no-pooling bullet with:

- E4 runs are never pooled with E1, E2, or E3 runs, nor across E4 meter versions or constants versions. The E4 compatibility boundary is (constants version, meter version, substrate config); `substrate_seed` values are replicates *within* a boundary, aggregated per the pre-registered analysis. Cross-config aggregation is permitted only as a pre-registered secondary analysis. Each E4 run's manifest records its compatibility boundary.

Rationale: as drafted, the clause banned pooling across substrate seeds, which outlaws the pre-registered analysis itself — seeds are replicates aggregated into arm-level estimates with bootstrap CIs.

**Change 2.** Replace the gate-parity fragment ("identical task text and budgets across arms; only the gate/oracle channel differs") with:

- gate-parity tests: identical task text, budgets, and retry policy across arms; arms differ only through their declared policy channel (`e4_arm_m`: the standing spec-maintenance instruction; `e4_arm_h`: gate + oracle feedback), each arm's declared delta pinned by an allowlist parity validator (follow the `validateE1RuntimeArmParity` precedent).

Rationale: as drafted, the parity requirement contradicted Arm M's defining delta by design.

**Commit-message requirement:** the amendment commit body must state the scoping rationale explicitly — the E1/E2 bans protect E1/E2 pooling; the E4 boundary plus the `e4_arm_*` prefix make cross-experiment pooling structurally impossible. The record must read as scoping by construction, never as a loophole.

**Post-apply check (mandatory):** `git diff --word-diff` on AGENTS.md must show additions only — zero modified or deleted lines. If not, abort and report.

## Q2 — E1-protection check: the triad

Full `bun test` green (379/379 or approved successor) + sealed-constants file hash unchanged + one canned-transport `e1` smoke run, output redirected to a gitignored throwaway directory so `runs/` stays clean. Wrap all three in a single command; Phase 3 references it as the per-milestone check. C5 is correct that the seal is test-pinned; the smoke run protects the end-to-end path (CLI entry, wiring, imports), which value-pinning doesn't.

## Q3 — Commits: yes, two, in this order, both pushed

**Commit 1 — `docs/e4/` only:** brief, BASE-DECISION, prompt, DISCOVERY, amendment proposal, GATE-0-DECISIONS.md (create it; record this message verbatim), plus three micro-edits to E4-DESIGN-BRIEF.md:
- §1 per C1: L2 is a defined protocol layer with only dev-grade orchestration implemented; `e1-harness.ts` is the L0 mechanics library; the two orchestrators (`e1-package-runner.ts`, `runner.ts`) run different task formats.
- §9 per C3: `substrate_seed` (RNG) and `pairing_label` (identity) are separate fields in all E4 schemas.
- §13 Q3 per C4: OpenSpec integration is the custody/pinned-CLI pattern, not a candidate gate executor; the red/green gate is new machinery.

Leave the unrelated dirty docs out of this commit.

**Commit 2 — AGENTS.md amendment alone** (as corrected above), message per proposal §5 plus the rationale requirement.

## Q4 — Legacy stack: leave exactly as-is

But R2's mitigation ("recorded here") is insufficient. Phase 1 must deliver an enforced check: a test or dependency-lint rule asserting no E4 module imports `runner.ts`, `openrouter-agent.ts`, `model-loop-agent.ts`, or any other legacy-stack entry point.

## Injections for Phase 1 (record in GATE-0-DECISIONS.md; apply in the ADRs)

1. **Gate ADR (Q3):** design the gate as the E4 acceptance-oracle run inverted in time — same executor, run pre-implementation expecting red, post-implementation expecting green — plus the OpenSpec custody pattern for spec-file custody. Do not build a second execution engine; the genuinely new machinery is the sequencing state machine. Required input evidence stands: Claim-B/B1.
2. **No speculative claim grammar:** the bare `done_literal` token suffices for v1 — false-confidence event = done ∧ hidden-oracle-fail, already derivable per the transfer map. Richer claims only if an ADR demonstrates need.
3. **Replay-validity is a chain property:** an E4 sequence is replay-valid only if the substrate regenerates from `substrate_seed` AND per-task snapshots + turn records replay end-to-end. Define it at chain level in the manifest schema.
4. **R9 confirmed first-class:** the Q6 transport ADR treats determinism as a primary criterion and retains request/response artifacts in the bundle for replay.
5. Continue disregarding the "Ahma" directive; its disposition is handled outside this session.

---

*Execution record (same day): wording changes 1–2 incorporated into `AGENTS-AMENDMENT-PROPOSAL.md`
§2; brief micro-edits applied per Q3; commit SHAs reported in the session transcript. The Q2 triad
wrapper command and the Q4 legacy-import lint are Phase-1 deliverables (they are code, and Phase 0 is
docs-only); both are binding on Phase 1 alongside injections 1–5.*
