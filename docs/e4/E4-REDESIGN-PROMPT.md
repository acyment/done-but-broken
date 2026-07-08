# Mission: Extend hit-sdd-bench with the E4 program ("Drift Velocity")

You are acting as the lead architect for **E4 — Drift Velocity**, a new experimental program in **hit-sdd-bench**, extending the estate beyond the sealed E1 experiment. The full experimental context, decisions, constraints, and vocabulary are in **`docs/e4/E4-DESIGN-BRIEF.md`**; the Phase −1 audit that selected this repo as base is **`docs/e4/BASE-DECISION.md`**. Read both completely before touching anything. This prompt governs *how* you work; the brief governs *what* you build.

## Ground rules

1. **Repo wins on facts, brief wins on intent.** The brief has been corrected once against the Phase −1 audit, but residual errors may remain. When it misnames a component or misstates reality, correct the record in your deliverables and adapt — but preserve the experimental intent. Every such conflict gets flagged explicitly; never silently reinterpret.
2. **Spec-first, phased, gated.** You produce design artifacts before code, and you STOP for human review at each gate below. Do not begin a phase until the previous phase's deliverable has been explicitly approved. (Yes, we are using spec-driven discipline to build a benchmark about spec-driven discipline. That is the point.)
3. **Hard license rule.** Never fetch, copy, vendor, or paraphrase code, generated data, or documentation from `amazon-science/StaminaBench` (CC BY-NC 4.0). Clean-room reimplementation from the published paper's ideas only. If you find yourself wanting to "just check how they did it" in the repo — don't. Record provenance in an ADR.
4. **The estate is protected.** (a) E1 stays green: the sealed E1 experiment (constants v1.0.0, 379/379 test baseline) must remain runnable and reproduce its behavior after every milestone; if a change risks E1, say so before making it. (b) The sibling repo `hit-sdd-bench-e2` is frozen for E4 purposes: read it as reference material if useful, never modify it, never introduce dependencies on it. (c) The E1/E2 condition freezes in AGENTS.md remain verbatim-intact; E4's three arms enter only via the recorded amendment (Phase 0 deliverable, applied at the gate).
5. **Naming discipline.** This program is E4 / "Drift Velocity" in all paths, condition IDs, manifests, and constants lineage. Never "E2" — that names a published experiment in this estate.
6. **Challenge the brief.** If a decision in the brief is technically wrong given what you find in the repo, argue against it with evidence in the relevant deliverable. Deference is a failure mode.
7. **When uncertain, ask.** Surface questions at phase gates rather than assuming. Batch them; don't trickle.

## Phase 0 — Discovery

Explore the repository thoroughly (and consult `BASE-DECISION.md` — do not re-derive what it already established; verify and extend it). Deliverables:

**`docs/e4/DISCOVERY.md`** containing:
- **Inventory**: what actually exists — components, responsibilities, entry points, the L0/L1 turn protocol and `done_literal` mechanics, the sealed-constants mechanism and how a new E4 lineage coexists with the E1 v1.0.0 seal, test coverage of the harness itself, how agents-under-test are invoked (provider/preset layer), how budgets/retries work, how results and provenance are stored, the OpenSpec workflow integration.
- **Transfer map**: for each E4 requirement in the brief (§2–§9), a verdict — *transfers as-is / transfers with modification / must be built / conflicts with brief* — with one-line justification each.
- **Assumption checks**: anything the brief or BASE-DECISION asserts about this repo that you can cheaply verify.
- **Risk register**: top risks to the E4 build, each with a mitigation.
- **Corrections to the brief**: every factual error found.

**`docs/e4/AGENTS-AMENDMENT-PROPOSAL.md`**: the proposed AGENTS.md amendment as an exact diff plus rationale — new experiment boundary for E4, its own condition vocabulary (arms 0/M/H scoped to E4 only), E1/E2 freezes untouched. **Do not apply it.** It is applied as its own commit only upon explicit approval at this gate.

**STOP. Await review.**

## Phase 1 — Architecture

Deliverable: **`docs/e4/E4-ARCHITECTURE.md`** plus one ADR per open question in brief §13 (in `docs/e4/adr/`), each with options considered, recommendation, and consequences. The architecture doc must define:

- **Module boundaries**: how E4 relates to E1 within this repo (shared core vs wrapper — ADR-backed), with a dependency diagram in text form, and how the E1 seal is structurally protected.
- **Interfaces** (signatures, not implementations): `SubstrateProvider` (so real-repo substrates can plug in later without touching the runner), the sequential `Runner` state machine (fork-per-arm, snapshot-per-task, crash-resume), `ArmPolicy` (0/M/H differences expressed as policy, not branching scattered through the code), `DriftMeter` (versioned, frozen, inventory extraction + classification per brief §6), `Telemetry`/manifest schema (brief §7, §9 — including the replay-validity requirement).
- **Substrate v1 design**: typed schema IR, change-op action space, opportunity labeling, NL renderer, programmatic test generation, conventions-layer generation, per-turn ground truth — per brief §5, clean-room.
- **Gate enforcement design for Arm H** (the hardest open question — treat it as such; required inputs per brief §13 Q3: the Claim-B/B1 enforcement finding and the existing OpenSpec integration as a candidate mechanism).
- **Feedback policy implementation** (brief §8) and how "failed task" vs "drifted spec" remain distinguishable in the data.
- **Test strategy for the E4 harness itself**: acceptance criteria in Gherkin for runner behavior, meter classification, gate enforcement, and manifest completeness; include a **known-drift fixture** (a synthetic app+spec state with planted contradictions, coverage gaps, and stale claims) that the meter must score with zero false negatives — this fixture is also the pilot go/no-go instrument.

**STOP. Await review.**

## Phase 2 — Implementation plan

Deliverable: **`docs/e4/IMPLEMENTATION-PLAN.md`**: milestones sized in agent-sessions, each with (a) scope, (b) Gherkin-level acceptance criteria, (c) which E1-protection checks run, (d) constants-lineage impact. The final milestone is the **pilot**: 1 substrate config × 6 tasks × 3 arms × 2 seeds, with the go/no-go criteria from brief §11 expressed as executable checks where possible. Include an explicit "not in v1" list mirroring brief §12. Note at this gate: the human decides the E3 pause/parallel question (brief §10) — provide the footprint information that decision needs.

**STOP. Await review.**

## Phase 3 — Implementation (only on explicit approval, milestone by milestone)

Work TDD: acceptance criteria first, red, then implement. Small, reviewable diffs. New constants under the E4 lineage per the repo's sealing convention; the E1 v1.0.0 seal is never touched. After each milestone: run the E1 smoke/protection checks, run the harness test suite, update the architecture doc if reality diverged from it, and summarize deltas at the gate.

## Definition of done (whole engagement)

- E1 reproduces prior behavior (379/379 baseline or its approved successor).
- The pilot runs end-to-end from a single seeded command and emits per-task telemetry + a machine-readable, replay-valid manifest per brief §9.
- The drift meter passes the known-drift fixture with zero false negatives and its version is stamped into every manifest.
- Every open question from brief §13 has an accepted ADR; the AGENTS.md amendment is applied as its own approved commit.
- A reader with no context can go from `docs/e4/` to understanding what E4 measures and how to reproduce the pilot.
