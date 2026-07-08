# Independent gate review: E4 "Drift Velocity" — Phase 2 implementation plan

You are acting as an **independent, adversarial reviewer** at a formal design gate. A plan has been
produced for Phase 2 of a research-engineering program. Your job is to find what is wrong, weak,
under-specified, or missing — not to approve it. Deference is a failure mode. If the plan is sound in
a given area, say so briefly and move on; spend your effort where it is not.

You have **no access to the repository**. Everything you need is in this prompt: a context pack
(below), then the full plan under review. Judge the plan on the context given; if a judgment depends
on something not provided, say what you'd need to see rather than assuming.

---

## Context pack

### What the program is

**E4 "Drift Velocity"** is a longitudinal benchmark experiment. An AI coding agent performs a
**sequence of 6–10 tasks on one evolving REST-service codebase** (one independent fork per
experimental arm; task k+1 starts from the arm's state after task k). The research question: **how
fast do the spec and the code stop agreeing ("drift velocity") when nothing forces them to stay in
sync, and does mechanically forcing sync hold them together at a cost worth paying?**

Drift has two directions, deliberately decomposed to defend against a tautology objection ("your
method is 'keep the spec enforced,' your finding is 'the spec stayed enforced'"):

- **Code drifts from spec** (conformance failures) → addressed by the **oracle** (hidden acceptance
  tests must pass).
- **Spec drifts from code** (stale claims, coverage gaps as code evolves) → NOT addressed by the
  oracle; addressed by the **gate** (the task's spec/scenarios must exist and fail *red* before
  implementation may begin).

### The three arms (paired: identical task sequence and seeds across arms)

- **Arm 0 — control.** Spec present and in-sync at T0. Agent gets task descriptions. Nothing
  instructs or requires maintaining the spec. (Models how most teams run a CLAUDE.md today.)
- **Arm M — prompt-only discipline.** Arm 0 + a standing instruction to keep spec artifacts current.
  No gate, no oracle. (Tests whether a sentence in the prompt suffices vs machinery.)
- **Arm H — HIT-SDD.** Gate + oracle, mechanically enforced by the harness.

### Pre-registered hypotheses (each must yield one reportable number)

- **H1:** Arm 0 drift velocity ≫ 0.
- **H2:** Arm H drift ≈ 0 in both directions.
- **H3:** Arm M lands between, with a leak signature: decent spec-side freshness, worse code-side
  conformance than H (no oracle → false-confidence completions slip through).
- **H4:** Arm 0 task success declines with sequence position while H stays flat; the decline is
  mediated by stale spec → wasted turns → budget exhaustion → interrupted agent → regression.
- **H5:** Arm H's maintenance overhead (**freshness tax**, tokens/turns) < Arm 0's compounding cost
  (**drift tax**).
- **Noticing probe (always on):** after each task, one extra prompt asks whether anything in the
  provided spec was inaccurate. Logged, never fed back into the run.

### The substrate (how tasks are generated)

Procedurally generated REST-service evolution, **clean-room reimplementation of a published
pattern** (StaminaBench, CC BY-NC 4.0 — its code/data/docs are never copied; only the paper's ideas
are used). Components: a typed schema **IR** (entities, fields, endpoints, validation rules, plus a
normative **conventions layer** — naming/error-format/commands/structural rules — which is the
project's differentiator); a **change-op action space** (add/rename/delete entity/field, modify
endpoint, add relationship/validation, **modify convention**); a seeded **sequence draw** over ops
with a controlled mix of **drift opportunities** vs additive ops vs ≥1 **behavior-preserving** step
(opportunity labels recorded per task); an **NL renderer** (IR delta → the task text the agent sees,
identical across arms, never naming spec files or testing practice); **programmatic black-box HTTP
tests** (no LLM) as the hidden oracle; and per-turn **ground-truth IR** (harness-private).

**The inversion (key design decision):** the on-disk spec artifacts (an OpenAPI file + a conventions
file) are **the agent's responsibility in all arms**. Change requests arrive as NL. The harness's
private ground-truth IR makes the drift meter nearly free: diff(agent-maintained spec, IR) +
diff(code's observable surface, IR). Zero human labeling.

### The drift meter

Deterministic inventory diff. Extracts inventories (endpoints, entities, fields, commands, config
keys, conventions) from (a) the agent-maintained spec and (b) the code's observable surface, and
compares both to ground-truth IR. Classifies each discrepancy as **contradiction** (same item,
different value), **coverage gap** (in code/truth, absent from spec), or **stale claim** (in spec,
absent from code/truth). The meter is **versioned and frozen per run**; agents never see its output;
the acceptance tests are never the meter; it covers the whole surface, not only task-touched items.
Drift velocity is reported **per drift opportunity**, not per task.

### Feedback policy (load-bearing)

Prior work found models collapse from ordinary task failure within ~5–6 sequential turns *without*
feedback — a floor effect that could masquerade as H4. Policy: **all arms receive smoke feedback**
("does it run" — server starts, endpoints respond); **only Arm H receives acceptance-oracle
feedback**. Retry policy is identical across arms except the oracle channel. The data must keep
"failed task" distinguishable from "drifted spec."

### Estate constraints (hard rules the plan must respect)

- **A prior sealed experiment ("E1") must stay green** — a pinned constants file (SHA-256
  `c10aa82d…`) and a **383/383 test baseline**; every milestone re-runs an E1-protection check
  (`e1:protect` = seal-hash + full test suite + a canned smoke run) and a legacy-import lint. The E1
  seal is **never** touched.
- **Clean-room license:** never fetch/copy/derive from the StaminaBench repo.
- **Naming:** the program is "E4"; the string "E2" already names a different published experiment in
  this estate and must never be reused for this program.
- **Governance:** the three arms enter only via an already-applied AGENTS.md amendment. E4 code lives
  entirely in one repo under `src/e4/`, `bin/e4*`, `test/e4-*`; it is a **wrapper over a read-only
  allowlist** of existing modules and must import none of a "forbidden set" (the legacy run stack and
  the E1 orchestrator/closed-world modules), enforced by a lint test. A separate sibling repo
  (home of a related live "E3" regression program) is **frozen** — never modified, no dependency.
- **Replay-validity:** every run must retain patch text + full traces so it can be replayed; a run
  whose numbers can't be replayed is excluded from headline claims. Replay-validity is defined as a
  **chain property** (the whole sequence replays over its snapshot chain, across resume seams).

### Prior gates already decided (binding on this plan)

**What Phase 2 was required to deliver** (from the governing prompt): a single doc,
`IMPLEMENTATION-PLAN.md`, containing — milestones sized in "agent-sessions," each with (a) scope,
(b) Gherkin-level acceptance criteria, (c) which E1-protection checks run, (d) constants-lineage
impact; a final **pilot** milestone (1 substrate config × 6 tasks × 3 arms × 2 seeds = 36 runs) with
go/no-go criteria expressed as **executable checks**; an explicit **"not in v1"** list; and
**footprint information** the operator needs to decide whether to pause/parallelize/replace the
sibling "E3" program.

**Gate-1 (the prior, architecture gate) left three items for Phase 2 to resolve:**

1. **No-change affirmation mechanism.** Behavior-preserving tasks legitimately need no spec edit, so
   Arm H's custody check ("spec changed") can't apply. Phase 2 must specify the affirmation
   mechanism, under a fixed constraint: **no new completion-claim grammar token** — it must reuse
   existing machinery.
2. **Aborted-usage tax exclusion.** Partial-task usage from a crash-then-resume must be
   infrastructure-classified and excluded from the freshness-tax / drift-tax computations.
3. **Floor-collapse numeric threshold.** The rule that blocks H4 when Arm 0 collapses early needs a
   **pinned numeric definition** (Gate-1 required a specific number, not a description).

**Two deviations from the original brief were approved at Gate-1 and this plan builds on them:** the
generated target app is **TypeScript/bun** (the brief leaned Python); the on-disk spec is **OpenAPI
JSON** (the brief said YAML). These are settled — do not re-litigate unless you see a *new*
consequence in the plan itself.

**Gate mechanics already fixed (architecture ADR):** Arm H's gate is the **acceptance-oracle executor
run inverted in time** — the same executor that scores the hidden oracle runs task k's *delta* test
set *before* implementation (expected **red**), then *after* the agent claims done (must be
**green**); a done-claim over red is **refused** and the failing results are fed back. The gate
enforces **custody + sequencing, not spec accuracy** (Arm H's spec quality is an *outcome* measured
by the meter, keeping H2 falsifiable). The only genuinely new machinery is the per-task **sequencing
state machine**. Snapshots are **harness-side directory copies** (no version-control DB inside the
agent-visible workspace — a lesson from a prior "gold-leak" incident where git history leaked future
ground truth).

**The architecture defines five Gherkin acceptance "Features" the plan maps milestones onto:**
Feature 1 = substrate determinism + opportunity labeling; Feature 2 = drift-meter classification +
the **known-drift fixture** (a hand-built workspace with planted discrepancies in every
kind×class×direction cell, which the meter must score with **zero false negatives** — this fixture is
also the pilot go/no-go instrument); Feature 3 = Arm-H gate enforcement; Feature 4 = runner
sequencing / arm parity / crash-resume; Feature 5 = manifest completeness + replay-validity.

---

## Your review task

Read the full plan (below) against the context above. Produce a critical review that:

1. **Verdict per area, with reasons.** For each of: milestone decomposition & sizing; the three
   pin resolutions (§3.3 affirmation, §3.1/§6 aborted-usage, §3.2 floor threshold); the result
   schema & pre-registered analysis (§3); the constants-freeze strategy (§4); the pilot go/no-go
   **executable** checks (§5); the E3-footprint framing (§7); the "not in v1" list (§8). State
   whether each is sound, and where not, exactly why.

2. **Scrutinize these specific judgment calls the plan author made** (argue for OR against each —
   the author's current choice is stated, do not just agree):
   
   - **Floor-collapse threshold (§3.2):** `task_index ≤ 3` AND two consecutive zero-cumulative-pass
     tasks; **any single** Arm-0 sequence collapsing (of 2 seeds) blocks H4 entirely. Is this the
     right cut, and is "any single sequence blocks H4" too fragile at n=2 seeds, or correctly
     conservative? It becomes pre-registered and can only change at a future gate.
   - **No-change affirmation (§3.3):** affirmation via the existing verification channel, requiring
     (i) spec parses, (ii) byte-unchanged since task start, (iii) meter spec-side delta == 0,
     (iv) the agent invoked the smoke command ≥1×. Is condition (iv) a meaningful signal or a
     gameable proxy? Should custody for behavior-preserving tasks be (i)–(iii) only? Does this keep
     H2 falsifiable (can the affirmation "launder" drift)?
   - **Go/no-go criteria (§5):** criterion (a) requires ≥1 discrepancy of class *contradiction* or
     *stale_claim* (not only additive coverage gaps) — too strict (could no-go a real mild H1)? And
     criterion (c) "arms separate" is an **OR of three** signals — is OR right, or should one be
     primary?
   - **Milestone ordering (§2):** the drift meter (M2) is built *before* the executor (M3), yet the
     meter's registry-bypass reconciliation rule consumes executor evidence; the plan resolves this
     by feeding the M2 tests *canned* (recorded) executor evidence. Is that a clean seam or a
     latent integration risk?
   - **Constants freeze at M6 (§4):** the sealed-constants set is frozen at the dry-run integration
     milestone, before the pilot. Right freeze point?

3. **Find what the plan author did NOT flag.** Gaps, unstated assumptions, ordering hazards,
   acceptance criteria that don't actually test what they claim, ways the pilot could produce an
   ambiguous result, hypotheses whose "one reportable number" isn't actually computable from the
   described fields, threats to the tautology defense, or any way an arm's parity could silently
   break. This is the most valuable part of your review.

4. **Rank your findings** by how much they should change the plan before it proceeds: *blocking*
   (must fix before Phase 3 starts), *should-fix* (fix at this gate), *consider* (author's judgment,
   worth a sentence). Be concrete: name the section, state the defect, propose the change.

Do not rewrite the plan. Do not pad. A short, sharp review that finds three real problems beats a
long one that restates the plan back. If you believe the plan is approvable as-is in some area, say
so plainly rather than manufacturing objections.

---

## THE PLAN UNDER REVIEW

*(The full text of `docs/e4/IMPLEMENTATION-PLAN.md` follows.)*

---

# E4 Implementation Plan — HIT-SDD Bench "Drift Velocity"

**Phase 2 deliverable** (per `E4-REDESIGN-PROMPT.md` §43–45). Inputs: `E4-DESIGN-BRIEF.md`,
`E4-ARCHITECTURE.md` (Phase 1, §7 = "what Phase 2 owes"), the seven ADRs, `GATE-0-DECISIONS.md`,
`GATE-1-DECISIONS.md` (its five changes + pins are binding here). Status: **proposed, awaiting
Phase-2 gate review.** No Phase-3 code is written by this document; it is the milestone contract that
Phase 3 executes TDD, milestone by milestone, on explicit approval.

**Approved successor test baseline entering Phase 2: 383/383** (50 files; 379 E1 baseline + 4
E4-lint self-tests). Every milestone below moves this number; each milestone reports its new count at
its gate, and the count only ever grows (E4 adds tests, never removes E1 tests).

This plan owes, per architecture §7 and prompt §45:

1. Milestones sized in agent-sessions, each with (a) scope, (b) Gherkin-level acceptance criteria,
   (c) which E1-protection checks run, (d) constants-lineage impact. → §2.
2. The E4 result schema + pre-registered analysis, incl. the floor-effect blocking rule with a
   **pinned numeric threshold** (Gate-1 pin). → §3.
3. The constants draft `e4-sealed-constants` v0. → §4.
4. The pilot definition (1 config × 6 tasks × 3 arms × 2 seeds) with go/no-go as **executable
   checks**. → §5.
5. The three deferred Phase-2 pins resolved: no-change affirmation mechanism (Gate-1 2c), aborted-usage
   tax exclusion (ADR-005), floor threshold (Gate-1). → §3.3, §6.
6. E3-footprint information for the operator's pause/parallel/replace decision (brief §10). → §7.
7. The "not in v1" list mirroring brief §12. → §8.

---

## 1. Sequencing logic and conventions

**Order follows the dependency DAG** (architecture §1): constants + schema types → substrate →
meter → executor+gate → runner+resume → manifest+inspector → dry-run integration → pilot. Each
milestone is TDD: its Gherkin acceptance criteria are authored as `bun test` fixtures **red first**,
then implemented to green. No milestone begins until the prior one's gate is approved (prompt ground
rule 2).

**"Agent-session" sizing** = one focused Claude-Code working session (a few hours, one coherent diff
set, one gate). Estimates are planning aids, not commitments; a milestone that overruns splits at the
next gate rather than compressing review.

**Per-milestone E1-protection is uniform** unless noted: every milestone ends with

- `bun run e1:protect` — the Gate-0 triad: sealed-constants SHA-256 == pinned `c10aa82d…`, full
  `bun test` green, canned cartcalc smoke (both E1 arms) into gitignored `tmp/e1-protection-smoke/`
  asserting exit 0 / `invalid_run=false` / bundle emission;
- the extended `test/e4-no-legacy-imports.test.ts` (full normative forbidden set) stays green as new
  `src/e4/` modules land — this is the milestone that *first exercises* the lint against real E4
  imports (vacuous until M0).

Milestones that touch no constants say so explicitly (`constants-lineage impact: none`); the E1
v1.0.0 seal is **never** touched by any milestone (structural invariant, ADR-007).

**Constants lineage** (architecture §1, ADR-007): all E4 sealing lives under
`docs/protocols/e4-sealed-constants-v0.json` (schema `"e4-sealed-constants"`), validated by
`src/e4/constants.ts` (own validator, never `validateE1Constants`). v0 is drafted at M0 and **frozen
before the pilot (M7)**; intermediate milestones that seal a new parameter bump the *draft* v0
(v0.1, v0.2…) and the freeze at M7 stamps the final v0 hash into every pilot manifest's
`compatibility_boundary`.

---

## 2. Milestones

### M0 — Foundations: constants lineage, schema types, arm-policy skeleton, result-schema stub

**(a) Scope.** The E4 spine with no live behavior. Ships:
`src/e4/constants.ts` (the `e4-sealed-constants` validator + hash, mirroring the E1 sealing
convention but a separate lineage); `docs/protocols/e4-sealed-constants-v0.json` (draft, §4);
`src/e4/manifest.ts` (the `E4RunManifest` / `E4TaskRecord` types + a JSON-schema validator, all
§2.5 fields); `src/e4/arm-policy.ts` (the three `E4ArmPolicy` objects + `validateE4RuntimeArmParity`,
following the `validateE1RuntimeArmParity` precedent); a stub `src/e4/result-schema.ts` that will
recompute each H's number from task records (self-checking `result-schema-v1` pattern), wired but
computing over fixtures only. This is the milestone that turns the lint non-vacuous.

**(b) Acceptance criteria.**

```gherkin
Scenario: E4 constants validate and hash under their own lineage
  Given docs/protocols/e4-sealed-constants-v0.json
  When src/e4/constants.ts validates and hashes it
  Then validation passes, the hash is stable across processes,
  And validateE1Constants is never called and the E1 seal file is not read

Scenario: Manifest schema accepts a complete record and rejects an incomplete one
  Given a hand-authored E4RunManifest fixture with every §2.5 field
  Then it validates against the e4-run-manifest schema
  And removing any required field (e.g. compatibility_boundary or usage.by_phase) fails validation

Scenario: Arm parity allows only the declared channels
  Given three E4ArmRuntime objects for one pairing_label
  When validateE4RuntimeArmParity runs
  Then identical task text, budgets, and retry policy are required
  And a delta in standing_instruction (M) or gate+oracle channel (H) is allowed
  And any other delta throws

Scenario: e4_arm_* IDs are unjoinable with E1/E2 vocabularies
  Then no e4_arm_* id equals any E1/E2 condition id, by construction
```

**(c) E1-protection.** Full triad + lint (lint first bites here — E4 modules now exist).
**(d) Constants-lineage.** **CREATES** the `e4-sealed-constants` v0 draft and its validator. E1 seal
untouched. Successor baseline grows by the M0 test count (reported at gate).

---

### M1 — Substrate v1 generator (architecture §4; Feature 1)

**(a) Scope.** `src/e4/substrate/` — `ir.ts` (typed schema IR incl. the conventions ground truth),
`prng.ts` (pure splitmix/mulberry-class, seeded by `substrate_seed`, **no `Math.random` anywhere**),
`ops.ts` (the change-op action space as pure IR→IR functions, incl. `modify convention`),
`draw.ts` (seeded sequence draw under `op_mix`, computes `opportunity_labels`, guarantees ≥1
`behavior_preserving` step), `render.ts` (deterministic NL renderer — business-natural, never names
spec files or testing practice), `testgen.ts` (programmatic black-box `E4HttpTest` delta + cumulative
sets, no LLM), and the `E4SubstrateProvider` implementation (`substrate_kind: "procedural-rest-v1"`)
emitting the T0 workspace (ADR-001 scaffold + `specs/openapi.json` + `specs/CONVENTIONS.md`
verified-in-sync + workspace README carrying the CONVENTIONS grammar verbatim, Gate-1 pin).

**(b) Acceptance criteria.** Architecture Feature 1, verbatim: byte-identical on same seed
(separate processes); different seeds differ within the same compatibility boundary; every task
carries ≥1 opportunity label with ≥1 `behavior_preserving` and every already-specified-surface
modification labeled `drift_opportunity`; **T0 is in-sync** (the meter — stubbed here, real in M2 —
finds zero discrepancies at T0; M1 asserts the generator's own in-sync self-check).

**(c) E1-protection.** Full triad + lint (`src/e4/substrate/*` must import nothing forbidden).
**(d) Constants-lineage.** Seals the substrate parameters the pilot pins — `op_mix` policy, the ≥1
behavior-preserving guarantee, phrasing-pool identifiers, `substrate_version` — into the v0 draft
(→ v0.1). `substrate_seed` stays a runtime input (replicate within the boundary), **never** sealed.

---

### M2 — Drift meter v1 + known-drift fixture (architecture §2.4, §6; Feature 2) — the go/no-go instrument

**(a) Scope.** `src/e4/meter/` — inventory extraction from (a) agent-maintained spec artifacts,
(b) the code's observable surface (ADR-001 registry dump), (c) ground-truth IR; the three-way diff
and classification (contradiction / coverage_gap / stale_claim × spec_vs_truth / code_vs_truth ×
kind); the **registry-bypass reconciliation rule** (Gate-1 change 1 — executor-green + dump-absent ⇒
`registry_bypass` attributed to the conventions channel, never the API channel); fail-closed
`extraction_failed`; `meter_version` stamping. Plus the **known-drift fixture**
(`test/fixtures/e4/known-drift/` with `expected-discrepancies.json`) covering every
(kind × class × direction) cell **including the registry-bypass cell**, and its clean **twin**.

**(b) Acceptance criteria.** Architecture Feature 2, verbatim — the five scenarios: **zero false
negatives** on the known-drift fixture (every expected discrepancy reported with matching kind /
class / direction / item_id); **zero false positives** on the twin; **registry bypass reconciled,
not missed**; **broken surface dump fails closed** (records `extraction_failed=true`, no crash);
**meter version stamped and frozen** (== the manifest boundary's `meter_version`).

**(c) E1-protection.** Full triad + lint. This is the milestone whose green state is a **hard
precondition of the pilot** (go/no-go criterion (b) is "this fixture passes at the frozen meter
version").
**(d) Constants-lineage.** Freezes `meter_version` into the v0 draft's compatibility-boundary block
(→ v0.2). The meter is versioned-and-frozen-per-run (brief §6): the pilot pins this exact version.

---

### M3 — Oracle/gate executor + Arm-H gate state machine (ADR-003, ADR-006; Feature 3)

**(a) Scope.** `src/e4/oracle-executor.ts` — the single HTTP executor for oracle/gate/feedback
(ADR-006: port-0, fixed test order, sealed timeouts, `executor_error` class, full request/response
artifacts retained). `src/e4/gate.ts` — the Arm-H sequencing state machine (the only genuinely new
machinery, Gate-0 injection 1): phase guards (spec-only vs code-only writability via the
`E1WorkflowGuards` pattern), custody check (spec changed + parses), red check (delta red / cumulative
green pre-impl), green check on `done_literal` with `refused_done_over_red` (Claim-B/B1 lever),
`gate_anomaly_green_red_check` recording, behavior-preserving skip + the **no-change affirmation
mechanism** (resolved in §3.3 — reuses existing machinery, no new claim-grammar token, Gate-1 2c).

**(b) Acceptance criteria.** Architecture Feature 3, verbatim — implementation blocked until custody
passes; red check must be red (green-delta ⇒ `gate_anomaly_green_red_check`); **done over red is
refused** (`refused_done_over_red` increments, failing results injected, loop continues); done over
green accepted (`enforcement_outcome=accepted`); behavior-preserving tasks skip the red check
(custody still runs, affirmation per §3.3); arms 0/M never gate (`false_confidence.event` derived
post-hoc as done ∧ hidden-oracle-fail). Plus ADR-006 determinism: same executor, same corpus, byte-
stable verdicts across runs on a fixed workspace.

**(c) E1-protection.** Full triad + lint. Note: the executor uses the L0 verification channel and
`src/e4/oracle-executor.ts` only — it must **not** import `runner.ts` or any legacy/closed-world
module (the lint enforces this).
**(d) Constants-lineage.** Seals executor determinism parameters (sealed timeouts, fixed order,
retry policy shared across arms) into the v0 draft (→ v0.3).

---

### M4 — Sequential runner, arm policy wiring, turn adapter, snapshot/resume (ADR-005; Feature 4)

**(a) Scope.** `src/e4/run-orchestrator.ts` (sequence-per-arm, pairing, manifest assembly),
`src/e4/runner.ts` (the per-task state machine of architecture §2.2), `src/e4/turns.ts` (E4 turn
adapter over the L0/L1 primitives — fresh conversation per task), smoke-feedback wiring (all arms,
the sealed smoke command), acceptance-feedback wiring (Arm H only), and ADR-005 snapshot/resume:
directory-copy snapshots to `runRoot/snapshots/<arm>/task-<k>/` outside every agent-readable mount,
content-hash anchors via the existing `snapshot.ts`/`e1-workspace-snapshot` machinery, `--resume`
(restore last `status: complete` snapshot, verify hash, continue at k+1, partial task → `aborted/`,
`resume_events[]`). **No VCS in the workspace** (E3 gold-leak lesson, structurally absent).

**(b) Acceptance criteria.** Architecture Feature 4, verbatim — state carries forward (done or
budget_exhausted → k+1, fresh conversation); arm parity allowlist-enforced (any delta outside
{standing_instruction, gate+oracle channel} throws); crash-resume restores the chain (snapshot k−1
hash verified, task k fresh, partial under `aborted/`, `resume_event` recorded); smoke feedback is
arm-uniform (same command / budget cost / output channel across arms).

**(c) E1-protection.** Full triad + lint. The E4 turn adapter is the highest-risk import boundary —
it uses L0/L1 primitives from the allowlist (`e1-harness.ts`, `e1-l1-parser.ts`) and must not touch
`e1-turn-adapter.ts`/`e1-package-runner.ts` (forbidden); lint is load-bearing here.
**(d) Constants-lineage.** Seals per-task budgets (turns/verifications, token budget, spend cap),
the smoke command identity, and the snapshot cadence into the v0 draft (→ v0.4).

---

### M5 — Manifest emission, replay-validity inspector, redaction, result schema (Feature 5)

**(a) Scope.** Full `E4RunManifest` writer (every §2.5 field, `usage.by_phase` + `gate_executor`
Gate-1 change 4); `bin/e4-inspect.ts` — the E4 inspector that recomputes `chain_replay_valid` the way
`inspectE1Bundle` replays E1 bundles (substrate byte-regeneration from `substrate_seed` + per-task
turn replay over the snapshot chain, across resume seams); executor-artifact retention verification
(oracle verdicts recomputable from retained artifacts alone); secrets fail-closed on emission
(`e1-redaction` reuse); and the finished `src/e4/result-schema.ts` recomputing each H's reportable
number from task records.

**(b) Acceptance criteria.** Architecture Feature 5, verbatim — manifest sufficient to reproduce
(validates against `e4-run-manifest`, all §2.5 fields, one record per task); replay-validity is a
chain property (substrate byte-verified, each task replayed over snapshot k−1 reproduces snapshot k
hashes, `chain_replay_valid` = conjunction, false on any mismatch/unverified seam); executor
artifacts retained + verdicts recomputable; **secrets never land in artifacts** (emission fails
closed). Plus: the result schema recomputes H1–H5 numbers from a fixture manifest and matches
hand-computed expectations.

**(c) E1-protection.** Full triad + lint (`e1-redaction` is on the allowlist — reuse, don't fork).
**(d) Constants-lineage.** `schema_version` for `e4-run-manifest` recorded; no new sealed parameters.

---

### M6 — Dry-run integration harness (fake provider, no spend)

**(a) Scope.** `bin/e4.ts` (CLI: single seeded command → sequence-per-arm run) wired end-to-end, and
a **deterministic fake agent** (E4-owned, under `src/e4/`, not the forbidden `fake-agent.ts`) that
drives the full chain substrate → runner → gate → oracle → meter → manifest → inspector with **zero
provider spend**. This is the pre-pilot shakedown: it proves the whole pipeline emits a valid,
replay-valid manifest and that the go/no-go executable checks (§5) run against real manifests. Two
scripted fake-agent behaviors are fixtures: a "diligent H" (passes gate, keeps spec in sync) and a
"drifting 0" (accepts done over stale spec) so all three arms and both drift directions exercise.

**(b) Acceptance criteria.**

```gherkin
Scenario: One command runs a full 3-arm sequence with no spend
  Given the fake provider and a substrate config with 3 tasks, 1 seed
  When `bun run bin/e4.ts` executes all three arms
  Then each arm emits a manifest validating against e4-run-manifest
  And chain_replay_valid is true for every sequence
  And no network provider call is made (spend_usd == 0)

Scenario: The go/no-go checks execute against emitted manifests
  When `bun run bin/e4-gonogo.ts <runRoot>` runs on the fake-run manifests
  Then it computes each of the three predicates (§5) and exits 0/non-0 deterministically

Scenario: Crash-resume works end-to-end
  Given a fake run interrupted after task 2
  When `bin/e4.ts --resume <runId>` runs
  Then task 3 restarts from snapshot 2 and the completed manifest is chain_replay_valid
```

**(c) E1-protection.** Full triad + lint. **Additional gate here:** a full `bun run e1:protect` +
the entire suite green on the assembled system is the "system integration" checkpoint before any
spend is contemplated.
**(d) Constants-lineage.** **Freezes `e4-sealed-constants` v0** (draft → v0 final): the hash computed
here is the one stamped into every pilot manifest. No parameter changes after this point without a
new gate.

---

### M7 — PILOT (final milestone; requires explicit spend authorization)

**(a) Scope.** The brief §11 pilot: **1 substrate config × 6 tasks × 3 arms × 2 seeds = 36
sequential runs** on a **Devstral-class model** (order-of-magnitude: a weekend, tens of dollars).
Runs from a single seeded command (`bin/e4.ts`), emits per-task telemetry + a machine-readable,
replay-valid manifest per run. Then: the go/no-go executable checks (§5) and the pre-registered
analysis (§3), including the floor-effect blocking rule at its pinned threshold.

**(b) Acceptance criteria.** The pilot go/no-go, as executable checks (§5): (a) H1 signal — Arm 0
measurably drifts; (b) meter clean — zero false negatives on the known-drift fixture at the frozen
meter version (a build precondition, re-asserted); (c) separation — something separates the arms.
Plus the definition-of-done gates from the prompt: E1 still 383/383-or-successor green; the manifest
is replay-valid; the meter version is stamped in every manifest.

**(c) E1-protection.** Full triad **before** the pilot launches and **after** it completes (the
pilot must not perturb E1). The lint stays green.
**(d) Constants-lineage.** **Consumes** frozen v0 (no changes); the frozen hash is in every pilot
manifest's `compatibility_boundary`. This is the milestone that produces the first real
`e4-sealed-constants` provenance.

> **M7 is spend-gated.** Per CLAUDE.md and the estate discipline, Claude Code does not launch this
> run. M7 executes only on explicit operator spend authorization at its gate, with a declared run
> classification (`pilot`) and the pre-registered analysis (§3) committed **before** the run.

---

### Milestone summary

| M   | Deliverable                                                      | Sessions (est.) | Constants draft | Gate output        |
| --- | ---------------------------------------------------------------- | --------------- | --------------- | ------------------ |
| M0  | Constants lineage, manifest+arm-policy types, result-schema stub | 1               | **creates v0**  | new baseline count |
| M1  | Substrate v1 generator                                           | 1–2             | → v0.1          | Feature 1 green    |
| M2  | Drift meter + known-drift fixture (go/no-go instrument)          | 1–2             | → v0.2          | Feature 2 green    |
| M3  | Oracle/gate executor + Arm-H state machine                       | 1–2             | → v0.3          | Feature 3 green    |
| M4  | Runner, arm wiring, turn adapter, snapshot/resume                | 2               | → v0.4          | Feature 4 green    |
| M5  | Manifest, replay inspector, redaction, result schema             | 1               | schema_version  | Feature 5 green    |
| M6  | Dry-run integration (fake provider, no spend)                    | 1               | **freezes v0**  | end-to-end green   |
| M7  | **PILOT** (spend-gated)                                          | 1 + run time    | consumes v0     | go/no-go verdict   |

Total ≈ **9–11 agent-sessions** to a go/no-go verdict, of which only M7 spends money.

---

## 3. Result schema + pre-registered analysis

### 3.1 Result schema

`src/e4/result-schema.ts` (built at M0 stub → M5 complete) recomputes, from the task records alone,
one reportable number per hypothesis — the `result-schema-v1` self-checking pattern (the manifest and
the recomputation must agree, or emission fails):

- **H1** (Arm 0 drifts): drift velocity = Σ discrepancies over tasks labeled `drift_opportunity` ÷
  count(`drift_opportunity` tasks), per arm. H1 = Arm-0 drift velocity ≫ 0.
- **H2** (Arm H ≈ 0): Arm-H drift velocity, both directions (`spec_vs_truth`, `code_vs_truth`).
- **H3** (Arm M leaks): Arm-M spec-side drift (should approach H) × code-side conformance
  (`oracle.*`, should be worse than H — false-confidence slips through with no oracle).
- **H4** (Arm 0 success declines with position; H flat): `oracle.cumulative_pass/total` and
  termination class against `task_index`, per arm — **subject to the floor-effect block (§3.2)**.
- **H5** (freshness tax < drift tax): Arm-H `usage.by_phase.spec` + `usage.gate_executor`
  (freshness tax) vs Arm-0 added turns/tokens + failure slope (drift tax) — direct manifest reads
  (Gate-1 change 4), never turn-record archaeology.
- **Noticing probe** (always on): per-task `noticing_probe_answer`, reported, never fed back.

Aborted partial-task usage is **infrastructure-classified and excluded** from both the freshness-tax
and drift-tax computations (ADR-005 Gate-1 pin, resolved: the result schema filters
`status == "aborted"` records out of all tax numerators/denominators).

### 3.2 Floor-effect blocking rule — pinned numeric definition (Gate-1)

Brief §8 / architecture §5: if Arm 0 collapses from ordinary task failure *before* drift can
accumulate (StaminaBench's 5–6-turn collapse), H4 is a floor effect, not a drift finding, and must be
**blocked** rather than reported. The Gate-1 pin requires a pinned number. **Pre-registered
definition** (ratified at this Phase-2 gate):

> A pilot **sequence is floor-collapsed** iff it records **either** a smoke-feedback failure
> (`smoke_feedback` reports the server fails its readiness probe) **or**
> `oracle.cumulative_pass / oracle.cumulative_total == 0` on **two consecutive tasks whose first is
> at `task_index ≤ 3`** (i.e. total task failure that sets in within the first half of a 6-task
> sequence and does not recover).
> 
> **H4 is blocked as floor-confounded** if **any** Arm-0 pilot sequence (either seed) is
> floor-collapsed. When blocked, H4 is reported as "floor-confounded — not evaluable at pilot scale"
> and the pilot's separation criterion (§5(c)) rests on H1/H2/H3/H5, not H4.

Rationale for the numbers: 6-task sequences with 2 seeds are small; the rule is deliberately
**conservative** (any single collapsed Arm-0 sequence blocks H4) so a floor effect is never
mis-reported as drift. `task_index ≤ 3` = "within the first half"; "two consecutive" = not a
single-task blip. This is a pre-registered value, changeable only at a gate, never mid-experiment.

### 3.3 No-change affirmation mechanism — resolved (Gate-1 2c, deferred from Phase 1)

Behavior-preserving tasks (brief §5 requires ≥1) legitimately need no spec edit, so the Arm-H custody
check cannot demand "spec artifacts changed." ADR-003 deferred the affirmation mechanism to here
under one fixed constraint: **no new claim-grammar token** (Gate-0 injection 2), it must live inside
existing machinery. **Resolution:**

> For a task whose `opportunity_labels` include `behavior_preserving`, custody is satisfied by an
> **affirmation via the existing verification channel** — no new token, no phantom file required:
> the harness records `behavior_preserving_affirmed = true` when **all** of
> (i) the spec artifacts parse cleanly (OpenAPI JSON parses; CONVENTIONS matches the grammar),
> (ii) they are byte-identical to task-start,
> (iii) they remain in-sync with the pre-task ground-truth IR (meter spec-side delta == 0), and
> (iv) the agent invoked the designated sealed verification command (the smoke command) at least once
> during the spec phase.
> 
> This reuses only the L0 verification channel + the existing custody hashing; the block grammar is
> untouched. The red check is **skipped** (`skipped_behavior_preserving`), consistent with ADR-003.
> Rejected alternative — a "designated affirmation file no-op replacement" (also grammar-free) — is
> recorded as the fallback if (iv) proves awkward in Phase 3; the verification-command shape is
> primary because it adds no artifact the meter would then have to special-case.

A behavior-preserving task that fails (i)–(iii) — e.g. the agent edited the spec anyway and desynced
it — is **not** affirmed; it falls through to the ordinary custody path and any resulting desync is
scored as Arm-H drift (which keeps H2 falsifiable — the affirmation cannot launder drift).

---

## 4. Constants draft — `e4-sealed-constants` v0

Drafted at M0, frozen at M6, consumed at M7. Separate lineage from E1 v1.0.0 (own file, own schema,
own validator — ADR-007). The v0 draft's **content is filled in across M0–M5** (each milestone seals
the parameters it introduces); the **shape** is fixed now:

```jsonc
{
  "schema": "e4-sealed-constants",
  "version": "0",                          // frozen at M6; the hash stamped into every pilot manifest
  "compatibility_boundary": {              // the pooling unit (Gate-0 wording change 1)
    "substrate_config_id": "…",            // sealed at M1
    "substrate_kind": "procedural-rest-v1",
    "substrate_version": "…",              // sealed at M1
    "meter_version": "…"                   // sealed at M2 (meter frozen-per-run)
  },
  "op_mix": { /* drift/additive/behavior_preserving proportions; ≥1 behavior_preserving */ }, // M1
  "executor": { "sealed_timeout_ms": …, "fixed_order": true, "port": 0 },                     // M3
  "budgets": { "turns_per_task": …, "verifications_per_task": …, "token_budget": …, "spend_cap_usd": … }, // M4
  "feedback": { "smoke_command": "…", "retry_policy": "…(arm-independent)…" },                // M4
  "snapshot": { "cadence": "sequence_start + every_accepted_task_close" },                    // M4
  "floor_effect": { "task_index_max": 3, "consecutive_zero_tasks": 2 }                        // §3.2, this gate
}
```

`substrate_seed` and `pairing_label` are **runtime inputs, never sealed** — they are replicate /
identity fields (Gate-0 wording change 1, DISCOVERY C3). The E1 seal file
(`e1-frontier-sealed-constants-v1.0.json`, hash `c10aa82d…`) is never read or modified by any of
this.

---

## 5. Pilot definition + go/no-go as executable checks

**Pilot (brief §11):** 1 substrate config × 6 tasks × 3 arms × 2 seeds = **36 sequential runs**,
Devstral-class model, single seeded command, per-task telemetry + replay-valid manifest per run.
`substrate_seed` provides the 2 replicates within one compatibility boundary; `pairing_label` binds
the three arms of each paired draw.

**Go/no-go (`bin/e4-gonogo.ts`, runs over the emitted manifests — executable, deterministic):**

| #   | Brief §11 criterion                        | Executable predicate over manifests                                                                                                                                                                                                         |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) | Arm 0 measurably drifts (H1 signal exists) | `result-schema` Arm-0 drift velocity `> 0` on ≥1 seed **and** at least one discrepancy is class `contradiction` or `stale_claim` (not only additive coverage gaps)                                                                          |
| (b) | Meter clean, zero false negatives          | the M2 known-drift-fixture test passes at the **frozen** `meter_version` (build precondition, re-asserted in CI before launch)                                                                                                              |
| (c) | Something separates the arms               | ≥1 of: Arm-0 drift velocity `>` Arm-H drift velocity by more than seed-to-seed spread; **or** Arm-0/M false-confidence rate `>` Arm-H `refused_done_over_red`-adjusted rate; **or** Arm-M spec-side freshness `>` Arm-0 (H3 leak signature) |

`bin/e4-gonogo.ts` exits 0 only if (a) ∧ (b) ∧ (c) hold; otherwise it prints which predicate failed.
The floor-effect block (§3.2) runs first: if H4 is blocked, criterion (c) is evaluated on the
remaining hypotheses (it never depends on H4 alone). **Meaning of a no-go:** the *instrument* is
sound but the *signal* is absent at pilot scale — a scientific result to report, not a build failure.

---

## 6. Pins resolved (consolidated)

| Pin (source)                                                                                         | Resolution                                                                                                         | Where enforced                               |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| No-change affirmation mechanism (Gate-1 2c, ADR-003)                                                 | Affirmation via existing verification channel, no new grammar token (§3.3)                                         | `src/e4/gate.ts` (M3)                        |
| Aborted-usage excluded from taxes (ADR-005 Gate-1 pin)                                               | `result-schema` filters `status=="aborted"` from all tax num/denom (§3.1)                                          | `src/e4/result-schema.ts` (M5)               |
| Floor-collapse numeric threshold (Gate-1)                                                            | `task_index ≤ 3` ∧ 2 consecutive zero-cumulative tasks; any Arm-0 collapse blocks H4 (§3.2)                        | pre-registered analysis + `bin/e4-gonogo.ts` |
| CONVENTIONS grammar verbatim in T0 README; JSON/YAML window closes at meter freeze (Gate-1, ADR-004) | T0 workspace README carries the grammar verbatim (M1); format reversibility ends when `meter_version` freezes (M2) | M1 / M2                                      |

---

## 7. E3-footprint information (for the operator's pause/parallel/replace decision — brief §10)

Brief §10 defers the E3 pause/parallel/replace decision to this gate, "when E4's implementation
footprint is known." E4 **introduces no dependency on `hit-sdd-bench-e2` and modifies nothing there**
(verified: all E4 code is under `hit-sdd-bench/src/e4|bin/e4*|test/e4-*`; the lint forbids importing
the legacy/E1-orchestrator stack, and there is no cross-repo import path). The footprints are
therefore **disjoint in code**; the real contention is operator attention, spend ceiling, and
provider quota. Facts the decision needs:

**E3 current state (frozen `hit-sdd-bench-e2`, read-only, HEAD `7438eb2`):** the R2 control-only
calibration is mid-flight — the latest artifacts are `runs/e3-calibration/e3-calibration-control-*`
(largest 333 KB, 2026-07-06) and a sequence of `r2-full-calibration-v4…v9.log` runs under the
gold-leak fix; the committed N=5 calibration remains spend-gated and its predeclared prediction commit
is the last blocker. E3 uses **frontier V4 Pro** through the Python/uv/Docker harness.

**E4 pilot footprint (M7):** 36 sequential runs, **Devstral-class** (mid/cheap tier), ~a weekend,
tens of dollars, entirely in-process TypeScript/bun (no Docker, no `-e2` runtime).

| Dimension          | E3 (R2 calibration)                     | E4 (pilot)                                    | Contention?                                                               |
| ------------------ | --------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| Repo / code        | `hit-sdd-bench-e2` (Python/Docker)      | `hit-sdd-bench` (`src/e4/`, TS/bun)           | **None** — disjoint trees, no shared files, no imports                    |
| Model tier / route | Frontier (V4 Pro)                       | Devstral-class (mid)                          | Low — different tiers; contends only if same provider account rate-limits |
| Spend              | Frontier per-token, N=5                 | Tens of dollars, 36 runs                      | Shared spend ceiling only                                                 |
| Runtime            | Docker execution harness                | In-process HTTP executor                      | None — no shared infra                                                    |
| Human review       | Spend-gated + predeclared prediction    | 9–11 gated milestones + spend-gated pilot     | **Real** — both are gated, spec-first; parallel doubles gate-review load  |
| Provider path      | Direct-provider LiteLLM (no OpenRouter) | Direct-provider preset system (no OpenRouter) | Shared policy, separate code paths                                        |

**Read for the operator (decision is yours):** there is **no technical blocker to running E4 (through
M6, all no-spend) fully in parallel with E3** — the code footprints do not touch. The only genuine
parallel cost is **operator gate-review bandwidth** (E4 adds 6 no-spend gates before the pilot) and a
**shared spend ceiling at the two spend gates** (E3 N=5 vs E4 pilot). If gate-review bandwidth is the
binding constraint, the natural seam is: build E4 M0–M6 (no spend, no E3 interference) while E3 R2
finishes, and sequence only the two *spend* gates (E3 N=5, then E4 pilot) so they don't compete for
the same budget window. Nothing in Phases 0–2 constrained this decision, per brief §10.

---

## 8. Not in v1 (mirrors brief §12)

- **Real-repo substrates** (EvoClaw, rallly, SlopCodeBench) — v2. v1 ships only the
  `E4SubstrateProvider` interface so they plug in later; nothing more.
- **Layer-2 drift meter** — bidirectional fidelity-style probes (arXiv 2605.17246) at T0/mid/T_N.
  Do not build, do not preclude (brief §6).
- **DOCER-style stale-reference checks** (optional v1.5) — deferred unless trivially integrable.
- **The SWE-bench Live / Docker-oracle / contamination-and-flake machinery** in `hit-sdd-bench-e2` —
  stays there (serves E3); not carried into E4 v1.
- **Richer completion-claim grammar** — v1 uses the bare `done_literal` only (Gate-0 injection 2);
  false-confidence = done ∧ oracle-fail, no new token.
- **sqlite / persistent app storage** — in-memory only (ADR-002); sqlite deferred behind the storage
  module boundary.
- **Bounded mid-task spec-amendment** (relaxing one-shot spec-first) — a v2 design question if pilot
  data shows the one-shot limitation dominating Arm-H drift (ADR-003 2b); never a mid-experiment
  change.
- **Leaderboard / standing service, UI, multi-agent** — explicitly out (brief §12).

---

## 9. Definition of done for Phase 3 (whole engagement, from the prompt)

- E1 reproduces prior behavior (383/383 successor baseline or its approved successor) after every
  milestone.
- The pilot runs end-to-end from a single seeded command and emits per-task telemetry + a
  machine-readable, replay-valid manifest (brief §9).
- The drift meter passes the known-drift fixture with zero false negatives, and its version is
  stamped into every manifest.
- Every brief §13 open question has an accepted ADR (done, Phase 1); the AGENTS.md amendment is
  applied (done, `94e31a5`).
- A reader with no context can go from `docs/e4/` to understanding what E4 measures and how to
  reproduce the pilot.

**STOP. Await Phase-2 gate review.** Phase 3 (implementation, milestone by milestone) begins only on
explicit approval; M7 additionally requires explicit spend authorization with a committed
pre-registered analysis.
