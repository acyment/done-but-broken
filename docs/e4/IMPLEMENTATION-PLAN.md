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

**Revision R1 (2026-07-08) — independent gate-review incorporation.** An independent adversarial
review of R0 returned two blocking and several should-fix findings; the accepted ones are folded in
and marked `[R1: …]` at the point of change. Summary: **B-1** — the executor-error/agent-broken-server
classification boundary is pinned (§3.2, M3) so an agent that breaks the server scores as task failure,
not infrastructure; **B-2** — drift velocity is redefined as a *flow* (distinct item_ids first
observed per opportunity), with terminal whole-surface count reported separately as "drift burden"
(§3.1, §5); **S-1** floor rule made per-arm and symmetric (§3.2); **S-2/S-4** sealed *text* surfaces
added to the constants shape (§4); **S-3** a spend-gated micro-calibration (M6.5) is a **required**
pre-pilot step (operator decision 2026-07-08) that precedes the budget freeze; **S-5** H5 taxes pinned to one commensurable
formula (§3.1); **S-6** registry-bypass exercised live pre-pilot (M6); **S-7/S-8** go/no-go criteria
(a) and (c) tightened for falsifiability (§5). Consider-items C-1–C-4 folded as noted.

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
`[R1-B2]` the result-schema stub pins **drift velocity as a flow** — count of distinct `item_id`s
*first observed* per drift opportunity, not a sum of whole-surface per-task counts (§3.1); the
terminal whole-surface count is a separate field ("drift burden at T_N"). `[R1-S6]` the M0 type set
**pins `E4ExecutorEvidence`** (consumed by the meter's registry-bypass rule) so M2 tests against a
canned instance of the real type, never an M2-invented shape.

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
`[R1-B1]` **executor-classification boundary, pinned here:** a server that fails to become ready
because of *workspace/agent code* is scored as a task failure (`oracle.cumulative_pass = 0` for that
task; the sequence continues; it feeds the floor rule §3.2 and stays in agent-behavior accounting).
`executor_error` is reserved strictly for *harness/infrastructure* faults (port-bind failure,
executor crash, transport fault) — those abort the sequence and are excluded from taxes. The M3
executor implements this split and it is reflected in the termination taxonomy; the architecture doc
(ADR-006 §2.2 taxonomy) is updated at M3 per the "update the doc if reality diverged" rule.

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
retry policy shared across arms) into the v0 draft (→ v0.3). `[R1-S2/S4]` also seals the **Arm-H gate
protocol text**, including the §3.3 **affirmation handshake verbatim** — the agent must be able to
read how to exit the spec phase, or its confusion turns inflate the freshness tax as a fake H5
penalty (see §4 `protocol_text`).

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
the smoke command identity, and the snapshot cadence into the v0 draft (→ v0.4). `[R1-S2]` also seals
the remaining **condition-rendering text surfaces**: the E4 `block_grammar`/`turn_protocol` id,
**Arm-M's standing-instruction wording**, and the **noticing-probe prompt** — a one-word edit to any
of these changes results, so they are sealed and protocol-tested (§4 `protocol_text`).
> **Budget caveat (see M6.5):** the token/turn/spend-cap *values* sealed here are provisional until
> the M6.5 micro-calibration; only their *schema slots* are load-bearing at M4.

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
replay-valid manifest and that the go/no-go executable checks (§5) run against real manifests.
`[R1-S6]` **three** scripted fake-agent behaviors are fixtures: a "diligent H" (passes gate, keeps
spec in sync), a "drifting 0" (accepts done over stale spec), and a **"registry-bypassing" behavior**
that serves a ground-truth route by directly-wired code absent from the registry — so the *live*
executor→meter `registry_bypass` reconciliation path (Gate-1 change 1) is exercised end-to-end before
the pilot, not first during it. All three arms and both drift directions plus the bypass path
exercise.

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

Scenario: Registry bypass is classified live end-to-end          # [R1-S6]
  Given the registry-bypassing fake behavior serves a ground-truth route absent from the registry
  When the run completes and the meter classifies with live executor evidence
  Then a registry_bypass event is recorded and attributed to the conventions channel
  And no API-channel discrepancy is reported for that route
```
**(c) E1-protection.** Full triad + lint. **Additional gate here:** a full `bun run e1:protect` +
the entire suite green on the assembled system is the "system integration" checkpoint before any
spend is contemplated.
**(d) Constants-lineage.** `[R1-S3]` **Freezes all *non-budget* `e4-sealed-constants` v0 fields**
(compatibility boundary, `op_mix`, executor determinism, protocol/text surfaces, snapshot cadence,
floor-effect thresholds) here. The **budget values** (`turns_per_task`, `token_budget`,
`spend_cap_usd`) freeze one step later, at **M6.5**, after their only real-model contact — because
freezing them against a fake agent seals numbers no live model ever pressured. No non-budget change
after this point without a new gate.

---

### M6.5 — Budget micro-calibration (**required** pre-pilot step; spend-gated; `[R1-S3]`)

**(a) Scope.** The smallest run that puts the sealed budget values under real-model pressure before
they freeze: **1 arm × 1 seed × 2–3 tasks** on the Devstral-class model, `run_classification:
calibration`, **excluded from all evidence** (estate precedent: calibration runs are non-evidence).
Its sole purpose is to observe the model's actual turn/token appetite against this idiosyncratic
block-grammar turn protocol and confirm — or correct — the provisional `turns_per_task` /
`token_budget` / `spend_cap_usd`. If the observed appetite fits the provisional budgets, they freeze
unchanged; if not, they are adjusted **once** and frozen. This directly de-risks the pilot's biggest
silent-confound: budgets so tight that agents hit walls artificially and manufacture a false floor
collapse (§3.2).

**(b) Acceptance criteria.**
```gherkin
Scenario: Budget calibration is non-evidence and bounded
  Given a calibration run of 1 arm × 1 seed × ≤3 tasks
  Then its manifest carries run_classification="calibration"
  And it is excluded from every result-schema and go/no-go computation
  And it emits observed turns/tokens per task sufficient to ratify or correct the budgets

Scenario: Budgets freeze after calibration
  When the calibration completes and budgets are ratified (or adjusted once)
  Then e4-sealed-constants v0 is fully frozen (budget fields included)
  And the frozen hash is the one stamped into every pilot manifest
```
**(c) E1-protection.** Full triad **before and after** (a spend run must not perturb E1).
**(d) Constants-lineage.** **Completes the v0 freeze** (budget fields). After M6.5 the v0 hash is
final and immutable without a new gate.

> **M6.5 is a REQUIRED pre-pilot step** (operator decision at this gate, 2026-07-08): no pilot budget
> is ever frozen without real-model contact first. It is still **spend-gated** — like M7, Claude Code
> does not launch it without explicit authorization, and it carries a declared `calibration`
> classification with non-evidence status. "Required" fixes the *sequence* (M6.5 always precedes M7);
> "spend-gated" governs *when* it is allowed to run.

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

| M | Deliverable | Sessions (est.) | Constants draft | Gate output |
| --- | --- | --- | --- | --- |
| M0 | Constants lineage, manifest+arm-policy types, result-schema stub | 1 | **creates v0** | new baseline count |
| M1 | Substrate v1 generator | 1–2 | → v0.1 | Feature 1 green |
| M2 | Drift meter + known-drift fixture (go/no-go instrument) | 1–2 | → v0.2 | Feature 2 green |
| M3 | Oracle/gate executor + Arm-H state machine | 1–2 | → v0.3 | Feature 3 green |
| M4 | Runner, arm wiring, turn adapter, snapshot/resume | 2 | → v0.4 | Feature 4 green |
| M5 | Manifest, replay inspector, redaction, result schema | 1 | schema_version | Feature 5 green |
| M6 | Dry-run integration (fake provider, no spend) | 1 | freezes v0 **non-budget** | end-to-end green |
| M6.5 | Budget micro-calibration (spend-gated, **required**) | 0.5 + short run | **completes v0 freeze** (budgets) | budgets ratified |
| M7 | **PILOT** (spend-gated) | 1 + run time | consumes v0 | go/no-go verdict |

Total ≈ **9.5–11.5 agent-sessions** to a go/no-go verdict, of which only M6.5 and M7 spend money
(both spend-gated; M6.5 is a required pre-pilot step, M7 the pilot).

---

## 3. Result schema + pre-registered analysis

### 3.1 Result schema

`src/e4/result-schema.ts` (built at M0 stub → M5 complete) recomputes, from the task records alone,
one reportable number per hypothesis — the `result-schema-v1` self-checking pattern (the manifest and
the recomputation must agree, or emission fails):

- **H1** (Arm 0 drifts): `[R1-B2]` drift velocity is a **flow** — count of **distinct `item_id`s
  first observed** as a discrepancy (i.e. new drift *incidence*), summed over tasks labeled
  `drift_opportunity` ÷ count(`drift_opportunity` tasks), per arm. This is *not* the sum of the
  meter's whole-surface per-task counts, which double-counts a persistent discrepancy once per
  remaining task and makes the headline sensitive to *when* drift happens rather than *how much*. The
  cumulative whole-surface count at the last task is reported separately as **drift burden at T_N**.
  H1 = Arm-0 drift velocity ≫ 0.
- **H2** (Arm H ≈ 0): Arm-H drift velocity (flow, as above), both directions (`spec_vs_truth`,
  `code_vs_truth`). `[R1-C1]` "≈ 0" is **descriptive** at pilot scale (report the raw number); an
  equivalence band is set in the full-run pre-registration, not here.
- **H3** (Arm M leaks): `[R1-C2]` reported as an **ordered pair**, not one scalar — (spec-side
  freshness ≈ H, code-side conformance from `oracle.*` worse than H). The leak signature is the
  conjunction *high spec-freshness ∧ low code-conformance*; a single-number reduction is deferred to
  the full-run pre-registration rather than faked here.
- **H4** (Arm 0 success declines with position; H flat): `oracle.cumulative_pass/total` and
  termination class against `task_index`, per arm — **subject to the per-arm floor-effect block
  (§3.2)**. `[R1-S1iii]` at pilot scale H4 is a **slope-difference statement only**; the mediation
  chain (stale spec → wasted turns → exhaustion → regression, brief §4) is *not* computable at n=2
  and is a full-run pre-registration item.
- **H5** (freshness tax < drift tax): `[R1-S5]` both taxes pinned in **one commensurable unit —
  tokens per oracle-passing task**. **Freshness tax** = (Arm-H `usage.by_phase.spec` tokens +
  `usage.gate_executor` tokens) ÷ (Arm-H oracle-passing tasks). **Drift tax** = (Arm-0 total tokens ÷
  Arm-0 passing tasks) − (Arm-H implementation-phase tokens ÷ Arm-H passing tasks) — i.e. Arm-0's
  per-success cost above the irreducible implementation cost that Arm H's implementation phase
  reveals. H5 = freshness tax < drift tax. Both are direct manifest reads (Gate-1 change 4), never
  turn-record archaeology.
- **Noticing probe** (always on): per-task `noticing_probe_answer`, reported, never fed back.
  `[R1-C3]` its usage is classified as a **separate arm-uniform line** and excluded from both taxes
  (net-zero across arms, but accounted explicitly rather than blended into implementation usage).

Aborted partial-task usage is **infrastructure-classified and excluded** from both the freshness-tax
and drift-tax computations (ADR-005 Gate-1 pin, resolved: the result schema filters
`status == "aborted"` records out of all tax numerators/denominators).

### 3.2 Floor-effect blocking rule — pinned numeric definition (Gate-1)

Brief §8 / architecture §5: if Arm 0 collapses from ordinary task failure *before* drift can
accumulate (StaminaBench's 5–6-turn collapse), H4 is a floor effect, not a drift finding, and must be
**blocked** rather than reported. The Gate-1 pin requires a pinned number. **Pre-registered
definition** (ratified at this Phase-2 gate):

> A pilot **sequence is floor-collapsed** iff, on **two consecutive tasks whose first is at
> `task_index ≤ 3`**, it records **either** `oracle.cumulative_pass / oracle.cumulative_total == 0`
> **or** a smoke-feedback readiness failure (`[R1-S1i]` the smoke prong is now symmetric with the
> oracle prong — a *single* readiness blip no longer flags the sequence). Both prongs encode "total
> task failure that sets in within the first half of a 6-task sequence and does not recover."
>
> `[R1-B1]` A server the *agent* broke registers on the oracle prong (its `cumulative_pass` is 0),
> not as `executor_error` — the M3 classification boundary guarantees agent-caused failure is scored,
> not silently excluded as infrastructure.
>
> `[R1-S1ii]` **The rule is evaluated per arm.** H4 is the conjunction "Arm 0 declines *and* Arm H
> stays flat," so *either* leg collapsing confounds it: **H4 is blocked as floor-confounded if any
> pilot sequence of the arm under test on either leg — Arm 0 (decline leg) or Arm H (flat leg) — is
> floor-collapsed** (an Arm-H gate-overhead budget spiral confounds the flat leg exactly as an Arm-0
> collapse confounds the decline leg). When blocked, H4 is reported as "floor-confounded — not
> evaluable at pilot scale" and the separation criterion (§5(c)) rests on H1/H2/H3/H5, not H4.

Rationale for the numbers: 6-task sequences with 2 seeds are small; the rule is deliberately
**conservative** (any single collapsed sequence on a relevant leg blocks H4) so a floor effect is
never mis-reported as drift. `task_index ≤ 3` = "within the first half"; "two consecutive" = not a
single-task blip. Per the scrutinized-call analysis: "any single sequence blocks" at n=2 is the
correct conservatism — per-seed exclusion would leave n=1, the same verdict wearing optimism. This is
a pre-registered value, changeable only at a gate, never mid-experiment.

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
scored as Arm-H drift (which keeps H2 falsifiable — the affirmation cannot launder drift, since the
meter runs post-task regardless of the affirmation).

`[R1-S4]` Condition (iv) is a **protocol handshake, not a signal** — its only job is to require a
*deliberate act* to exit the spec phase (conditions (i)–(iii) are all trivially true at task start
with zero agent action, so without (iv) the phase machine would transition on inaction). Because it
is a handshake, the affirmation shape **must appear verbatim in Arm-H's sealed protocol text** (§4
`protocol_text`, sealed at M3): an undocumented exit makes Arm-H agents stall hunting for it, and
those confusion turns land in the freshness tax as a fake H5 penalty. If Phase 3 finds the
verification-command handshake awkward, the recorded fallback (an affirmation-file no-op) is likewise
grammar-free — but whichever is chosen is sealed and documented, never latent.

---

## 4. Constants draft — `e4-sealed-constants` v0

Drafted at M0; **non-budget fields frozen at M6, budget values frozen at M6.5** (`[R1-S3]`), consumed
at M7. Separate lineage from E1 v1.0.0 (own file, own schema, own validator — ADR-007). The v0
draft's **content is filled in across M0–M6.5** (each milestone seals the parameters it introduces);
the **shape** is fixed now:

```jsonc
{
  "schema": "e4-sealed-constants",
  "version": "0",                          // non-budget frozen at M6, budgets at M6.5; hash → every pilot manifest
  "compatibility_boundary": {              // the pooling unit (Gate-0 wording change 1)
    "substrate_config_id": "…",            // sealed at M1
    "substrate_kind": "procedural-rest-v1",
    "substrate_version": "…",              // sealed at M1
    "meter_version": "…"                   // sealed at M2 (meter frozen-per-run)
  },
  "op_mix": { /* drift/additive/behavior_preserving proportions; ≥1 behavior_preserving */ }, // M1
  "executor": { "sealed_timeout_ms": …, "fixed_order": true, "port": 0 },                     // M3
  "protocol_text": {                       // [R1-S2] sealed condition-rendering TEXT surfaces
    "block_grammar_id": "…", "turn_protocol_id": "…",                                          // M4
    "arm_m_standing_instruction": "…",     // Arm-M's spec-maintenance sentence, verbatim         // M4
    "arm_h_gate_protocol": "…",            // gate protocol incl. the §3.3 affirmation handshake  // M3
    "noticing_probe_prompt": "…"           // the always-on post-task prompt, verbatim            // M4
  },
  "budgets": { "turns_per_task": …, "verifications_per_task": …, "token_budget": …, "spend_cap_usd": … }, // M4 slots, values frozen M6.5
  "feedback": { "smoke_command": "…", "retry_policy": "…(arm-independent)…" },                // M4
  "snapshot": { "cadence": "sequence_start + every_accepted_task_close" },                    // M4
  "floor_effect": { "task_index_max": 3, "consecutive_zero_tasks": 2, "per_arm": true }        // §3.2, this gate
}
```

`[R1-S2]` The `protocol_text` block is load-bearing for **replay-validity and arm parity**: these are
the exact strings a one-word edit of which would change results, and the estate's guardrails demand
protocol tests over sealed condition-rendering text. Each string is sealed at its owning milestone
(gate protocol + affirmation handshake at M3; arm/grammar/noticing text at M4) and protocol-tested.

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

| # | Brief §11 criterion | Executable predicate over manifests |
| --- | --- | --- |
| (a) | Arm 0 measurably drifts (H1 signal **exists**) | `[R1-S8]` `result-schema` Arm-0 drift **velocity (flow, §3.1) `> 0` on ≥1 seed** — *any* discrepancy class counts (coverage-gap-only drift is real drift). The **class composition is recorded as a mandatory diagnostic** feeding full-run `op_mix` tuning and external comms, but does not gate: the gate tests whether the phenomenon exists, not whether the headline is maximally sharp |
| (b) | Meter clean, zero false negatives | the M2 known-drift-fixture test passes at the **frozen** `meter_version` (build precondition, re-asserted in CI before launch) |
| (c) | Something separates the arms | `[R1-S7]` ≥1 of these **each empirically falsifiable** disjuncts: **(c1)** Arm-0 drift velocity `>` Arm-H drift velocity (at n=2, a **heuristic screen** — no interval/CI claims); **(c2)** Arm-0/M false-confidence **propensity** (`done ∧ oracle-fail` rate) `>` Arm-H's **refusal propensity** (`refused_done_over_red` per task) — compared as the *same* underlying event family (ADR-003's `enforcement_outcome: accepted\|refused`), **not** terminal accepted-event counts (which would make Arm H ≈ 0 by construction and the disjunct decorative); **(c3)** Arm-M spec-side freshness `>` Arm-0 (H3 leak signature) |

`bin/e4-gonogo.ts` exits 0 only if (a) ∧ (b) ∧ (c) hold; otherwise it prints which predicate failed.
`[R1-S7]` every disjunct of (c) must be a comparison that *could* come out either way on the data —
no disjunct that is true by the gate's construction counts. The per-arm floor-effect block (§3.2)
runs first: if H4 is blocked, criterion (c) is evaluated on the remaining hypotheses (it never
depends on H4 alone). **Meaning of a no-go:** the *instrument* is sound but the *signal* is absent at
pilot scale — a scientific result to report, not a build failure.

---

## 6. Pins resolved (consolidated)

| Pin (source) | Resolution | Where enforced |
| --- | --- | --- |
| No-change affirmation mechanism (Gate-1 2c, ADR-003) | Affirmation via existing verification channel, no new grammar token (§3.3) | `src/e4/gate.ts` (M3) |
| Aborted-usage excluded from taxes (ADR-005 Gate-1 pin) | `result-schema` filters `status=="aborted"` from all tax num/denom (§3.1) | `src/e4/result-schema.ts` (M5) |
| Floor-collapse numeric threshold (Gate-1) | `task_index ≤ 3` ∧ 2 consecutive zero-cumulative tasks; any Arm-0 collapse blocks H4 (§3.2) | pre-registered analysis + `bin/e4-gonogo.ts` |
| CONVENTIONS grammar verbatim in T0 README; JSON/YAML window closes at meter freeze (Gate-1, ADR-004) | T0 workspace README carries the grammar verbatim (M1); format reversibility ends when `meter_version` freezes (M2) | M1 / M2 |
| **B-1** executor/agent-broken-server boundary (R1) | Agent-caused readiness failure → `cumulative_pass=0` (task failure, scored, feeds floor rule); `executor_error` = harness/infra only (aborts, excluded) | `src/e4/oracle-executor.ts` (M3), §3.2 |
| **B-2** velocity is a flow not a stock (R1) | Velocity = distinct `item_id`s first observed per opportunity; whole-surface terminal count = "drift burden at T_N" | `result-schema.ts` (M0 stub → M5), §3.1/§5 |
| **S-2/S-4** sealed text surfaces (R1) | `protocol_text` block: block grammar, Arm-M instruction, Arm-H gate protocol + affirmation handshake, noticing prompt | constants v0 (M3/M4), §4 |
| **S-3** budget calibration before freeze (R1) | Spend-gated M6.5 micro-calibration ratifies budgets; non-budget freezes M6, budgets M6.5 (**required pre-pilot step**, operator decision 2026-07-08) | M6/M6.5, §4 |
| **S-5** commensurable H5 taxes (R1) | Both taxes in tokens per oracle-passing task; drift tax = Arm-0 per-success cost minus Arm-H implementation-phase per-success cost | `result-schema.ts`, §3.1 |
| **S-1** per-arm symmetric floor rule (R1) | Floor rule evaluated per arm (blocks H4 if either leg's arm collapses); smoke prong symmetric with oracle prong | §3.2, `bin/e4-gonogo.ts` |

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

| Dimension | E3 (R2 calibration) | E4 (pilot) | Contention? |
| --- | --- | --- | --- |
| Repo / code | `hit-sdd-bench-e2` (Python/Docker) | `hit-sdd-bench` (`src/e4/`, TS/bun) | **None** — disjoint trees, no shared files, no imports |
| Model tier / route | Frontier (V4 Pro) | Devstral-class (mid) | Low — different tiers; contends only if same provider account rate-limits |
| Spend | Frontier per-token, N=5 | Tens of dollars, 36 runs | Shared spend ceiling only |
| Runtime | Docker execution harness | In-process HTTP executor | None — no shared infra |
| Human review | Spend-gated + predeclared prediction | 9–11 gated milestones + spend-gated pilot | **Real** — both are gated, spec-first; parallel doubles gate-review load |
| Provider path | Direct-provider LiteLLM (no OpenRouter) | Direct-provider preset system (no OpenRouter) | Shared policy, separate code paths |

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
