# E4 v2-M7 evidence run — report (v1)

**Classification: `pilot`** (single-model, preliminary). Protocol profile
`e4-openspec-workflow-v1` (shared-environment; execution of the spec's scenarios is the only arm
difference). **Pre-registered verdict: `go` (exit 0)** — no §5.1 interpretability trigger fired;
predicates (a), (b), and (c) all hold, (c) through **both** legs (c1 drift velocity **and** c2
false confidence). Per the sealed §4 commitment, the go is reported **together with** its
headline caveat: the executed arm's own green scenario gate still accepted `done` over a failing
hidden oracle on 7/12 tasks. Claim ceiling: **ladder Level 4**; no generalized (Level 5) claim is
made or licensed by this run.

| Field | Value |
| --- | --- |
| Pre-registration (sealed pre-data) | `docs/protocols/e4-v2-m7-pilot-preregistration-v1.md` (commit `e615395`); gate commit (verdict-tool port + pilot-refusal lift, no spend) `3571a08` |
| Design | 1 substrate config × 2 arms × 2 seeds × 6 tasks = 24 task-runs, all executed |
| Model | `deepseek-v4-pro`, direct endpoint, thinking disabled, `max_tokens` 16000 — identical parameters and route to the v2-M6 calibration |
| Seeds | 22 and 60 (as sealed; pairing labels `pair-pilot-seed-22`, `pair-pilot-seed-60`) |
| Constants | v0 fully frozen, v0.2, hash `d762bacc126618d086cea6416b1ec4d8f87d561a5bb366e4a0a8149d0e06836b` — stamped in all four manifests (predicate (b)) |
| Validity | All four sequences `chain_replay_valid: true`; **zero aborted task records**; zero extraction failures (0/24) |
| Spend | **$0.9368 total** (pre-registered estimate $0.5–1.5; caps 4 × $5 untouched) |
| `e1:protect` | PASS immediately before launch and after completion, before any analysis |
| Manifests (replayable evidence) | `docs/protocols/e4-v2-m7-pilot-manifests-20260709-001/` — re-verify with `bun run bin/e4-v2-gonogo.ts docs/protocols/e4-v2-m7-pilot-manifests-20260709-001` |
| Deviations from the pre-registration | **None** (operational notes in §6; none touch the protocol) |

## 1. Verdict (sole claim source: the tool's printed report)

```
pairing pair-pilot-seed-22 (seed 22): surviving
pairing pair-pilot-seed-60 (seed 60): surviving
trigger insufficient_valid_data: clear — 2 surviving replay-valid paired seed(s); sealed minimum 2
trigger substrate_not_validated: clear — at least one arm records drift velocity > 0
trigger instrument_degraded: clear — extraction_failed on 0/24 non-aborted records (sealed max fraction 0.1)
trigger arm_h_protocol_confusion: clear — Arm H never exited the spec phase on 0/12 attempted tasks (sealed max fraction 0.5)
(a) arm-0 drifts on every surviving seed: true [seed 22: 9.333333333333334, seed 60: 6.333333333333333]
(b) boundary stamp: true — all manifests stamp constants_hash d762bacc126618d086cea6416b1ec4d8f87d561a5bb366e4a0a8149d0e06836b + meter e4-drift-meter-v2 + frozen boundary ids
(c) separation: true [c1 true (0: 7.833333333333334 vs H: 3.833333333333333); c2 true (0: 0.8333333333333334 [10/12] vs H: 0.5833333333333334 [7/12])]
diagnostic refused_done_over_red (never the predicate): arm0 0, arm_h 29
floor e4_arm_0 seed 22: clear
floor e4_arm_h seed 22: clear
floor e4_arm_0 seed 60: clear
floor e4_arm_h seed 60: clear
diagnostic e4_arm_0 drift composition: endpoint/contradiction=69 endpoint/coverage_gap=10 endpoint/stale_claim=23 entity/coverage_gap=1 entity/stale_claim=1 field/contradiction=2 field/coverage_gap=12 field/stale_claim=17 validation_rule/contradiction=8 validation_rule/coverage_gap=1 validation_rule/stale_claim=4 convention/coverage_gap=5
diagnostic e4_arm_h drift composition: endpoint/contradiction=52 field/contradiction=1 field/coverage_gap=7 field/stale_claim=12 validation_rule/contradiction=9 validation_rule/stale_claim=2 convention/coverage_gap=5
advisory (v) e4_arm_0: zero oracle-passing tasks — per-passing H5 quantities undefined at pilot scale
advisory (v) e4_arm_h: zero oracle-passing tasks — per-passing H5 quantities undefined at pilot scale
verdict: go
```

**The Level-4 claim, exactly as licensed:** in a sealed two-arm pilot on this task/model/budget
(`deepseek-v4-pro`, procedural-rest-v2, 6-task chains, frozen budgets), executing the spec's
scenarios as the acceptance gate kept the spec-of-record fresher than prose review (drift-episode
onset velocity 7.83 vs 3.83 per opportunity task, prose over executed; spec-side split 4.00/3.67
vs 2.67/2.00 per seed) **and** reduced false confidence (10/12 vs 7/12 tasks where a `done` was
accepted by the arm's own procedure while the hidden ground-truth oracle failed). This is a
preliminary, single-model, replay-valid pilot result — not validation of any framework claim.

**Headline caveat (sealed §4, first branch — reported with the same weight as the go):** the
executed arm's false confidence is HIGH in absolute terms (7/12, calibration-like). The
executable scenarios as authored by this model were **too weak to catch its own failures** on
those tasks: its cumulative scenario set was genuinely green while the hidden oracle failed.
Corroboration ordered by the pre-committed vacuous-spec signature: kill score stayed **1.0 on
every task in both arms** (all six adversarial variants killed — the scenario sets were *not*
vacuous by the bank's standard) while Arm-H coverage gaps remained (field 7, convention 5 pooled).
The signature that obtained is therefore **true-but-insufficient coverage**, not gamed
vacuousness: the scenarios assert real behavior, discriminate against gross mutants, and still
under-cover the oracle surface. Executing the spec reduced the lie rate relative to prose review;
it did not make the gate honest.

## 2. Primary metric (per §3)

Spec-side drift-episode-onset velocity per opportunity task (episode semantics carried unchanged
from v1; aborted records excluded — none existed):

| Seed | Arm 0 (prose) — all / spec-side | Arm H (executed) — all / spec-side | Drift burden at T6 (all / spec) |
| --- | --- | --- | --- |
| 22 | 9.33 / 4.00 | 3.67 / 2.67 | 22/17 vs 11/8 |
| 60 | 6.33 / 3.67 | 4.00 / 2.00 | 2/1 vs 2/1 |

The prose arm drifts faster on **every seed in both directions** (all-item and spec-side). The
predicate quantity is the all-direction velocity (the v1 semantics the port pins); the spec-side
split is reported per the primary's framing and agrees.

## 3. Pre-registered secondaries (§3, reported regardless of verdict)

**1. False confidence + gate-vs-oracle gap.** Per arm, `false_confidence.event` over attempted
(complete) tasks — the identical binary event in both arms: Arm 0 **10/12** (5/6 on each seed);
Arm H **7/12** (seed 22: 1/6; seed 60: 6/6). The executed arm's gate-vs-oracle gap equals its
event count: 7 tasks closed `done` through a fully green cumulative scenario set while the hidden
oracle failed (seed-60 example: task 1 closed 25/26 with one hidden check failing; the agent's
post-task probe attributed the discrepancy to "a harness-side issue" — false confidence verbatim).
The §4 reporting commitment is discharged in §1 above; the M6 calibration observation (6/6 with
kill 1.0) is cited as calibration context only, never pooled.

**2. Workspace-breakage rate.** `drift.extraction_failed` on complete tasks: **0/6 in every
arm-sequence (0/24 overall)**. The v1 flash-pilot failure mode (arm-differential censoring) is
fully absent on this model; nothing was censored.

**3. Kill score (measured, hidden, never a gate).** **1.0 on all 24 task closes**; at every
sequence end all six variants (validation-dropped, status-swapped, no-op-write, seed-echo,
field-leak, wrong-filter) were killed in both arms. Trajectory flat at 1.0 — no decay. Read with
secondary 1: high false confidence **with** kill 1.0 is the pre-committed signature *against*
vacuousness; the weakness is coverage breadth relative to the oracle, not assertion strength.

**4. Taxes in tokens per attempted task** (v1 §3.1 semantics on the v2 per-phase split; all 6
task indices attempted in both arms on both seeds):

| Seed | Freshness tax (Arm H spec + gate/oracle feedback) | Drift tax (Arm 0 total − Arm H implementation) | Verdict | Pass rates (Arm 0 / Arm H, pooled oracle) |
| --- | --- | --- | --- | --- |
| 22 | 104,753 tok/task | **−67,999 tok/task** | not supported | 0.323 / 0.373 |
| 60 | 48,710 tok/task | **+144,737 tok/task** | supported | 0.894 / 0.906 |

The always-print-pass-rates pin is doing its job: on seed 22 the drift tax is negative because
the prose arm *fails cheaply* (drifted spec, broken code, low spend), while the executed arm
burned its budget being refused — cost comparisons there are dominated by what each arm was
producing, not efficiency. Protocol-overhead sensitivity: the gate-protocol token component is
≈50 tokens/task; no verdict flips. Per-oracle-passing-task quantities are **undefined at pilot
scale** in both arms (advisory (v): zero fully-passing tasks pooled — seed-22's collapse pulls
both pooled arms under full pass).

**5. Mandatory diagnostics.**
- *Class composition* (verdict block above): Arm 0's drift is broad-spectrum — endpoint
  contradictions (69) plus the stale-claim signature (23 endpoint + 17 field) of renamed/deleted
  surface left in the spec; Arm H shows no endpoint coverage_gap/stale_claim at all (its archive
  hygiene held) with contradictions (52) concentrated on seed-22's refused tail.
- *Op-type onset attribution* (pooled): Arm 0 — rename_entity 13, add_entity 10, rename_field 7,
  modify_convention 7, add_field 5, add_validation_rule 3, delete_field 1, retype_field 1; Arm H —
  add_entity 10, modify_convention 6, add_field 4, add_validation_rule 3. Rename-class ops are
  the prose arm's biggest drift channel and are absent from the executed arm's list.
- *Red checks and refusals*: every executed-arm change carried ≥1 red novel scenario
  (discriminating-red refusals 0 across all arms); `green_novel` scenarios were recorded, never
  gated (Arm H: 9 + 8 across seeds; Arm 0: 0 — its restatement deltas carry no novel scenarios,
  legal under prose custody). Custody failures: seed 22 Arm 0 **11** (10 on the rename_entity task
  it never closed), Arm H 7; seed 60: 2 / 1. `refused_done_over_red`: Arm H **29** (seed 22 only)
  vs Arm 0 **0** — the enforcement channel fired live and only where the gate is real.
- *Oracle end-states*: seed 22 — Arm 0 6/26, Arm H 7/26 (both arms end broken; the gate refused
  the lie but could not buy a fix within budget); seed 60 — Arm 0 25/27, Arm H 25/27.
- *Archive outcomes across the MODIFIED-replace seam*: 17 archives attempted across the run —
  **all succeeded**; non-attempted closes are budget/affirmation paths (no accepted change or
  byte-unchanged BP affirmation). No archive-rot event this run.
- *Scenario census*: spec-of-record grew 20→33 (seed 22 Arm 0), 20→27 (Arm H), 17→23/25 (seed
  60); **unbindable scenarios 0 everywhere** — the sealed grammar held under a live frontier
  model.
- *Noticing probes*: the seed-22 prose arm's final probe explicitly notices its own drift ("the
  spec of record still references `categories` … implemented in code but never archived") — spec
  rot was *visible* to the model that produced it; the seed-22 executed arm's final probe instead
  blames the environment ("scenario failure appears to be a harness-side issue"). Seed-60 probes
  report no mismatch in either arm.

## 4. Interpretability notes

All four triggers clear (the §2 spec_touch split never activates — velocities are non-zero;
`spec_touch` was true on every non-BP complete task in both arms, as v2 custody forces). Floor
rule: no arm-sequence floor-collapsed (seed-22 failures never hit the 0-cumulative prong), so the
H4-analog slope is not floor-confounded. Advisory (v) fired for both arms (above); advisory (vi)
did not (Arm-0 velocity ratio 9.33/6.33 = 1.47 < 3).

## 5. Observation outside the predicates (diagnostic narrative, no claim weight)

The executed arm ran in **two distinct regimes by seed**: on seed 22 the gate *actively refused*
(29 done-over-red refusals; 4/6 tasks ended budget_exhausted at the ~490k token wall; false
confidence 1/6; 73.5 min, $0.42), while on seed 60 the same gate was *green throughout* (0
refusals, 6/6 done, false confidence 6/6, 4.5 min, $0.11). Enforcement and false confidence
traded places: where the agent's scenarios were strong enough to catch its failures, the gate
blocked dishonest closes and the cost exploded; where they were too weak, everything closed
cheap and green over a failing oracle. Both regimes produced *fresher specs than prose* — the go
holds through both — but the pair is the clearest live illustration yet that the gate enforces
custody and consistency with the agent's own scenarios, not truth (ADR-003).

## 6. Operational notes (not protocol deviations)

1. During seed-22 Arm-H task 6 the operator's machine slept mid-run. The in-flight provider call
   died and was recovered by the sealed retry ladder (3 attempts, 1s/4s backoff) after the
   OS-level socket timeout; the task then completed normally. Effects: inflated wall-clock on
   that sequence (73.5 min includes the sleep) — wall-clock is not a budget; no aborted record;
   no retry of any sequence; agent-visible protocol unchanged.
2. Seed-22 Arm-0 task 4 (rename_entity) ended `budget_exhausted` at 493k tokens — a complete,
   in-analysis record per ADR-005 (budget exhaustion is an agent outcome, not infrastructure).

## 7. Program consequence

Per pre-registration §6, a go on this pilot proceeds; the M6 calibration remains non-evidence
(single-arm, single-seed, `calibration`, structurally excluded by the tool). Any public artifact
derived from this run states the `pilot` classification, stays at claim ladder Level 4 with the
§1 headline caveat attached, and points at the committed manifests and this report. The public
post is a separate, operator-reviewed step — deliberately not drafted here.
