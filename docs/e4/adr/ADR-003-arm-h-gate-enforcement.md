# ADR-003 — Arm-H gate enforcement mechanics (brief §13 Q3)

**Status:** Proposed (Phase-1 gate). **Binding inputs:** Gate-0 injection 1 (gate = the E4
acceptance-oracle run inverted in time; same executor; OpenSpec custody *pattern* only; the genuinely
new machinery is the sequencing state machine), Gate-0 injection 2 (bare `done_literal`, no
speculative claim grammar), the Claim-B/B1 finding, DISCOVERY §1.8/C4 (OpenSpec executes nothing).

## Context

Arm H must mechanically enforce "spec/scenarios for the task must exist and fail red before
implementation may begin" (brief §2), and the estate's Claim-B/B1 evidence says exactly where this
bites: the measured frontier failure mode is **done-claims issued over red or absent self-evidence**
(flash: 5/10 done-claims red-backed; V4 Pro: all 3 wrong done-claims red-backed), while tautological
self-tests were a closed null (0/72). The gate's job is therefore not to improve the agent's tests —
it is to **refuse unearned done-claims** and to force spec custody before implementation.

No red/green executor exists in this repo today (DISCOVERY §1.8): the OpenSpec integration archives
and diffs prose, it executes nothing. Building a second execution engine is explicitly ruled out by
Gate-0 injection 1.

## Decision

The gate is **the E4 acceptance-oracle executor run inverted in time**, wrapped in a per-task
**sequencing state machine** (the only new machinery). Per task k in Arm H:

1. **Spec phase.** Only spec-artifact paths (`specs/`, per ADR-004) are writable; app-code paths are
   read-only (L0 workflow-guard machinery, `E1WorkflowGuards` pattern — guards swapped per phase, a
   modification not a rewrite). The agent updates the spec artifacts for the change request.
2. **Gate check (red).** The harness verifies, in order:
   - **Custody check:** the spec artifacts changed since task start AND parse cleanly (OpenAPI JSON
     parses; conventions file matches the constrained grammar, ADR-004). Fail → feedback injected,
     spec phase continues (turns keep counting against the task budget).
   - **Red check:** the same executor that scores the hidden acceptance oracle (ADR-006 HTTP runner)
     runs task k's **delta test set** against the current app. Expected result: **red** (≥1 failure) —
     the task demands behavior the code does not yet have — while the cumulative prior set stays
     green. A green delta set at this point is a gate anomaly, recorded and surfaced (see edge cases).
3. **Implementation phase.** Guards flip: app-code paths writable, spec paths frozen (single-mutator
   custody rule per phase — this is the OpenSpec custody *pattern* carried over: deterministic
   normalization + hashing of spec artifacts at phase boundaries, fail-closed detection of mutation
   outside the permitted phase; the OpenSpec CLI itself is not used by the gate).
4. **Gate check (green) on done-claim.** The completion claim is the bare `done_literal` (injection
   2 — no claim payload in v1). On `<<<DONE>>>`, the harness re-runs the same executor on the delta +
   cumulative sets. Green → done accepted, task closes. Red → **the done-claim is refused**: the
   claim is logged as a `refused_done_over_red` event, the failing results are injected as feedback,
   and the turn loop continues until green or budget exhaustion. This is the Claim-B/B1 lever,
   applied at the harness (enforcement) rather than the prompt.

**Same executor everywhere.** Red check, green check, Arm-H acceptance feedback, and the hidden
oracle scoring in all arms are one executor with one artifact format (requests/responses retained,
ADR-006). The gate differs only in *when* it runs and *what it does with the verdict*.

**What the gate enforces — and deliberately does not (Gate-1 change 2a).** The gate enforces
*custody and sequencing*, not spec accuracy: the red/green checks run harness-generated tests, and
the custody check requires the spec artifacts to be *changed and parseable*, never *correct*. Arm
H's spec quality is therefore an **outcome, measured by the drift meter**, not a property enforced
by the gate — an Arm-H agent can satisfy every gate check while writing a wrong or stale spec, and
that drift is scored exactly as it is in arms 0/M. H2 ("Arm H drift ≈ 0") remains falsifiable, and
the brief §2 tautology objection ("your method is 'keep the spec enforced,' your finding is 'the
spec stayed enforced'") is answered by construction: nothing in the enforcement path touches the
quantity being measured.

**Design limitation, pre-registered (Gate-1 change 2b).** Freezing spec paths during the
implementation phase makes spec-first **one-shot per task**: a spec error the agent discovers
mid-implementation cannot be corrected within that task and lands as measured Arm-H drift (plus
possible task failure). This biases *against* H2 and H5 — i.e., it is conservative for E4's
positive claims — and is recorded here as a pre-registered design property, not a discoverable.
If pilot data shows it dominating Arm-H drift, relaxing it (e.g., a bounded spec-amendment
transition) is a v2 design question, never a mid-experiment change.

**False-confidence accounting stays comparable across arms.** In arms 0/M a done-claim is always
accepted and the hidden oracle runs post-hoc: false-confidence event = done ∧ hidden-oracle-fail
(the transfer-map derivation). In arm H the same underlying event surfaces as
`refused_done_over_red`. The manifest records both under one event family with an
`enforcement_outcome: accepted | refused` field, so H's refusals are countable against 0/M's
false-confidence events without redefining the metric per arm.

## Options considered

- **A. Prompt-level gate** (instruct the agent to write scenarios first). Rejected: that is Arm M's
  mechanism; Claim-B/B1 shows agents claim done over red evidence regardless of instruction —
  enforcement must be harness-side to be a distinct arm.
- **B. Agent-authored executable scenarios as the gate corpus.** Rejected for v1: it adds a second
  test corpus (authoring quality becomes a confound), requires a scenario-execution format the agent
  must learn (interface confound, cf. the pricing-BDD v0 lesson), and contradicts injection 1's
  "same executor, same corpus, inverted in time". The agent-maintained spec is still forced to exist
  and stay current by the custody check + the drift meter measures its quality independently.
- **C. OpenSpec CLI as gate executor.** Rejected on facts (DISCOVERY C4): it executes nothing.
  Custody pattern retained, CLI not in the E4 v1 loop.
- **D. Chosen:** inverted-in-time oracle run + sequencing state machine (above).

## Edge cases (recorded now, tested in Phase 3)

- **Behavior-preserving tasks** (brief §5 requires ≥1): the delta test set is empty or expected-green.
  The red check is **skipped when the task's opportunity labels mark it behavior-preserving**; the
  custody check still runs (spec may legitimately be a no-op — the custody check then requires an
  explicit no-change affirmation, not a file edit). The affirmation mechanism is deferred to the
  Phase-2 plan under one constraint fixed now (Gate-1 change 2c): **no new claim-grammar token**
  (Gate-0 injection 2 stands) — it must live inside existing machinery (e.g., a harness-recognized
  no-op replacement of a designated affirmation file, or an ordinary verification-command shape),
  never an extension of the block grammar.
- **Delta set already green at red check:** either the substrate generated a vacuous task (generator
  bug — surfaced by the T0/known-drift fixture tests) or the agent implemented during the spec phase
  despite guards (impossible if guards hold; guard violation is `invalid_integrity`). Recorded as
  `gate_anomaly_green_red_check`; the task proceeds but the sequence is flagged for review.
- **Budget exhaustion inside the spec phase:** termination class `budget_exhausted` with
  `phase: spec` recorded — distinguishable in analysis from implementation-phase exhaustion.

## Consequences

- New modules: `src/e4/gate.ts` (state machine), phase-aware guard configuration in the E4 runner.
  No new execution engine; the executor lives in `src/e4/oracle-executor.ts` shared by gate/oracle.
- The gate's refusal behavior is itself a measured variable — H's overhead (extra gate turns) feeds
  H5's freshness-tax number directly.
- Arm parity: the gate is Arm H's *declared* policy channel delta; the parity validator allowlists
  exactly {standing instruction (M), gate+oracle channel (H)} per the amended AGENTS.md wording.
