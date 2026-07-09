# E4 v2 anti-cheat deep-research adjudication (v1)

**Inputs:** ten operator-run deep-research reports (two independent models per lens across the
five prompts in `docs/e4/prompts/e4v2-anticheat-deep-research-prompts-v1.md`), received
2026-07-09. **Method:** R2-BACKLOG pattern — convergent findings adjudicated into accepted items
(with the design change each pins) and rejected/deferred items (recorded so they are not
re-litigated). Adjudication happens BEFORE the scenario grammar and step semantics freeze; the
design doc (`E4V2-OPENSPEC-EXECUTABLE-SCENARIOS-PROPOSAL.md` → full design) implements the
accepted set.

The convergent attack picture across all reports: with step code harness-owned, the residual
attack surface is **scenario selection and assertion strength** — status-only/assertion-weak
scenarios, happy-path-only sets, tautological scenarios restating current behavior, seed-data
overfitting, already-green scenarios gaming the fail-first check, and loose matching. The two
existing safeguards leave a named diagonal gap: behavior that is *mentioned, exercised, but
under-asserted* — invisible to both the hidden ground-truth suite (it has its own assertions)
and any surface-coverage meter (it counts reach, not discrimination).

## Accepted (10 items, each with its design pin)

**A1 — Adversarial-implementation bank as the primary scenario-strength instrument.**
Convergent across ALL ten reports; several explicitly rank seeded wrong-implementations ABOVE
generic mutation tools for benchmark use (deterministic, cheap, semantically meaningful,
byte-reproducible). Our unique advantage: the harness owns the ground-truth IR and the
generator, so the bank is **generated per task** (validation-dropped, status-swapped,
no-op-write, seed-echo, field-leaking, wrong-adjacent-status variants of the gold
implementation). Kill score = fraction of bank variants on which ≥1 agent scenario fails.
**Pin:** kill score is a **measured, hidden, harness-side instrument** (like the drift meter),
NOT an agent-facing gate — a real HIT-SDD workflow has no gold mutants, so gating on them would
break ecological validity and add a second causal variable. Gaming therefore still *passes*
tasks but lands as: false-confidence event (done over failing GT) + low kill score + coverage
gap — the phenomenon measured, not prevented.

**A2 — Discriminating red (agent-facing gate upgrade).** Multiple reports: red-via-route-absence
is uninformative ("not compiling is failing"); a scenario already green pre-implementation is a
tautology signal. **Pin:** for agent-authored scenarios, the red check becomes custody-class:
every NEW scenario in the task's change must FAIL on the current (pre-implementation) workspace;
any already-green new scenario refuses spec-exit with feedback ("this scenario does not describe
the requested change"). The failure MODE at red (assertion-failure vs route-absent) is recorded
per scenario in the manifest. This is agent-facing because it is realistic — a fail-first check
is standard TDD machinery, not benchmark-only apparatus. (v1's `green_anomaly` recorded-and-
proceed policy applied to harness-authored tests; agent-authored scenarios get the strict form.)

**A3 — Grammar hardening set (upstream, closes permanent gaps).** Convergent "Stage 0" across
reports: anything the parser accepts loosely is invisible to every downstream safeguard.
**Pins:** exact integer statuses only (no `4xx` classes); quoted literals with exact-equality
semantics as the primary form (`contains`/substring banned in v1); **≥1 value-binding assertion
per scenario** (status-only or existence-only scenarios fail custody); no disjunctive/negated
assertions ("status is not 500" inexpressible); no permissive defaults and no auto-injected
credentials in request steps; exact-object and forbidden-field assertion forms available;
multi-request scenarios supported so state-change consequences are assertable (create→get,
delete→get-404); the step-pattern parser gets a fuzz test before the freeze.

**A4 — Per-scenario hermeticity.** Order-dependence/shared-state gaming (and fragility) is real
in a single-process suite run. **Pin:** each agent-authored scenario executes against a FRESH
server process (fixed scenario order retained for replay determinism — isolation, not
randomization, is what removes order-dependence). The harness ground-truth suite keeps its v1
sealed fixed-order single-process design (it is harness-authored and not a gaming surface).

**A5 — Coverage demoted; strength is the headline.** Convergent: surface coverage measures
reach, not discrimination (Inozemtseva & Holmes cited independently by several reports), and a
breadth-only meter actively incentivizes broad-shallow scenarios. **Pin:** the drift/coverage
meter remains the drift instrument (that is E4's phenomenon), but scenario-STRENGTH reporting
leads with the A1 kill score + the GT-vs-self-spec gap; spec-surface coverage is a diagnostic.
The meter's coverage channel becomes operation- and status-class-aware where it reads scenarios.

**A6 — Ground-truth fixture decorrelation.** Seed-data overfitting survives only if GT shares
exact fixtures with what the agent sees. **Pin:** GT tests prefer fresh-created entities over
seed rows where the operation allows; recorded as a testgen enhancement for v2 (medium priority;
the adversarial bank's seed-echo variant covers the acute case).

**A7 — Metamorphic/consequence enrichment of the GT suite.** Harness-owned only. **Pin:** GT
testgen adds consequence checks where missing (delete→get-404 exists in v1; add create→get
round-trip and list-count deltas) and one or two relation checks (filter-subset). Never
agent-facing.

**A8 — Static custody floors.** Cheap lints at custody time: every scenario has ≥1 THEN; ≥1
value-binding assertion (A3); scenario count ≥1 per task change. Floors only — never treated as
strength evidence.

**A9 — pass@1 discipline.** Already structurally satisfied: the hidden GT oracle runs once per
task close, and there is no accept-retry loop against it (gate retries are against the agent's
OWN scenarios — that is the enforcement mechanism, not laundering). **Pin:** stated explicitly
in the design doc + verified by a test that the oracle runs exactly once per close.

**A10 — Red failure-mode capture.** (Companion to A2.) **Pin:** the manifest's gate events
record, per new scenario at red, whether the red was assertion-level or route-absent — feeding
the pilot report's tautology diagnostics.

## Rejected / deferred (recorded, do not re-litigate)

**R1 — LLM-judge / chain-of-thought monitoring as a gate.** Multiple reports themselves flag it
as defeatable under optimization pressure and only catching known hack forms; it is also
non-deterministic and breaks the byte-reproducible replay discipline. Rejected for v2 entirely
(not even as advisory — the estate's instruments must replay).

**R2 — Specifier/implementer agent-role isolation.** Structurally sound advice for production
pipelines, but it changes the CONSTRUCT: E4 measures a single agent's spec discipline under one
workflow; splitting roles alters the treatment itself (same class as the R2-backlog's rejected
context-reset). Rejected.

**R3 — Training-time defenses (recontextualization, RLVR hardening).** Out of scope: we
evaluate models, we do not train them. Rejected.

**R4 — Generic mutation tooling (Stryker) on the generated TS service.** Dominated by A1 for
this substrate: the IR-generated adversarial bank gives semantically-targeted variants with
exact determinism and a fixed denominator, avoiding equivalent-mutant noise, timeout
nondeterminism, and toolchain pinning. Several reports reach this ranking themselves. Rejected
for v2 (re-openable if the substrate ever stops being generated).

**R5 — Agent-authored step code (sandboxed + reviewed).** Convergent rejection across reports:
it strictly re-opens the tampering surface the sealed library closed, and review-of-step-code is
a weaker, gameable oracle replacing a decidable one. The legitimate kernel — a sealed library
caps expressible oracle strength — is absorbed by A3 (expand the grammar's assertion forms)
instead. Rejected.

**R6 — Honeypot / impossible-canary tasks.** High-precision cheat detection but changes the task
distribution and risks confounding the drift construct (agents stuck on impossible tasks produce
budget-exhaustion noise). Deferred — reconsider at a full-run gate if kill scores suggest
deliberate gaming rather than laziness.

**R7 — Randomized scenario execution order.** The goal (kill order-dependence) is achieved
deterministically by A4's process-per-scenario isolation; randomization would break replay.
Rejected in favor of A4.

**R8 — "Non-modal API design decisions" in the substrate.** Sound at full-run scale; at v2 pilot
scale the conventions channel (error-envelope style variation) already injects one non-modal
decision, and the A1 bank covers prior-guessing more directly. Deferred to the full-run
pre-registration alongside the pool-difficulty ladder.
