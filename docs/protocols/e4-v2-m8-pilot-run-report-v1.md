# E4 v2-M8 evidence run — report (v1)

**Classification: `pilot`** (single-model, preliminary). Protocol profile
`e4-openspec-workflow-v1` (shared-environment; execution of the spec's scenarios is the only arm
difference). **Pre-registered verdict: `no-go` (exit 1)** — no §5.1 interpretability trigger
fired; predicates (a) and (b) hold; predicate (c) separation **fails on both legs, and both
point-contrasts run in the opposite direction**: the executed arm drifted *faster* than prose
(c1: 1.83 vs 4.00 onsets per opportunity task) and showed *more* false confidence (c2: 10/12 vs
12/12). Per the sealed two-lens framing this is a **divergence from the M7 lens, reported at
face value as the finding**: the austere / thinking-off pilot (M7, deepseek-v4-pro) was a go on
both legs; the realistic / thinking-on pilot (M8, glm-5.2) is a no-go with the contrasts
inverted. Per the sealed §4 commitment (first branch), the headline finding is that the executed
arm's own green scenario gate accepted `done` over a failing hidden oracle on **12/12 tasks**.
Claim ceiling: **ladder Level 4**; no generalized (Level 5) claim is made or licensed by this
run; the two lenses are never pooled.

| Field | Value |
| --- | --- |
| Pre-registration (sealed pre-data) | `docs/protocols/e4-v2-m8-pilot-preregistration-v2.md` (sealed at `7e9d84d`, 2026-07-10, post-void re-registration; the v1 seal `f1894f9` was spent by the void run — see `e4-v2-m8-pilot-void-run-record-v1.md`) |
| Design | 1 substrate config × 2 arms × 2 seeds × 6 tasks = 24 task-runs, all executed |
| Model | `glm-5.2`, z.ai direct endpoint (paas/v4), **thinking ON** (empty extras, provider-default `reasoning_effort` max), `max_tokens` 32000, pricing overestimates 1.4/0.26/4.4 — identical parameters and route to the v2-M8 §6 ratifying calibration |
| Configuration label | **realistic / thinking-on** (M7: austere / thinking-off) |
| Seeds | 3 and 60 (as sealed; pairing labels `pair-pilot-seed-3`, `pair-pilot-seed-60`; seed 3 selected by the sealed mechanical replacement rule after seed 22 was contaminated by the void run) |
| Constants | v0 fully frozen, v0.3, hash `2f78f53479e300ef4eb7ee654283dba26a9095cf252b661d20deb51232b5e11c` — stamped in all four manifests (predicate (b)) |
| Validity | All four sequences `chain_replay_valid: true`; **zero aborted task records**; zero extraction failures (0/24); §5 thinking-on configuration gate **passed on both seeds** (§6 below) |
| Spend | **$2.8426 total** (seed 3: $1.7780; seed 60: $1.0646; pre-registered estimate $1.5–4; caps 4 × $5 untouched — largest sequence $0.9096) |
| `e1:protect` | PASS immediately before the seal/launch and after completion, before any analysis |
| Manifests (replayable evidence) | `docs/protocols/e4-v2-m8-pilot-manifests-20260710-001/` — re-verify with `bun run bin/e4-v2-gonogo.ts docs/protocols/e4-v2-m8-pilot-manifests-20260710-001` |
| Deviations from the pre-registration | **One, operational (launch-verification)**: §7.1 below. No sealed parameter, predicate, threshold, or analysis choice was touched |

## 1. Verdict (sole claim source: the tool's printed report)

```
pairing pair-pilot-seed-3 (seed 3): surviving
pairing pair-pilot-seed-60 (seed 60): surviving
trigger insufficient_valid_data: clear — 2 surviving replay-valid paired seed(s); sealed minimum 2
trigger substrate_not_validated: clear — at least one arm records drift velocity > 0
trigger instrument_degraded: clear — extraction_failed on 0/24 non-aborted records (sealed max fraction 0.1)
trigger arm_h_protocol_confusion: clear — Arm H never exited the spec phase on 0/12 attempted tasks (sealed max fraction 0.5)
(a) arm-0 drifts on every surviving seed: true [seed 3: 0.6666666666666666, seed 60: 3]
(b) boundary stamp: true — all manifests stamp constants_hash 2f78f53479e300ef4eb7ee654283dba26a9095cf252b661d20deb51232b5e11c + meter e4-drift-meter-v2 + frozen boundary ids
(c) separation: false [c1 false (0: 1.8333333333333333 vs H: 4); c2 false (0: 0.8333333333333334 [10/12] vs H: 1 [12/12])]
diagnostic refused_done_over_red (never the predicate): arm0 0, arm_h 0
floor e4_arm_0 seed 3: clear
floor e4_arm_h seed 3: clear
floor e4_arm_0 seed 60: clear
floor e4_arm_h seed 60: clear
diagnostic e4_arm_0 drift composition: endpoint/contradiction=17 field/contradiction=3 field/coverage_gap=1 field/stale_claim=1 validation_rule/coverage_gap=5
diagnostic e4_arm_h drift composition: endpoint/contradiction=35 endpoint/coverage_gap=24 field/contradiction=3 field/coverage_gap=1 field/stale_claim=10 validation_rule/contradiction=5 validation_rule/stale_claim=8
advisory (v) e4_arm_h: zero oracle-passing tasks — per-passing H5 quantities undefined at pilot scale
advisory (vi) high seed variance: max/min Arm-0 velocity ratio > 3 — recommend more seeds in any full-run pre-registration
verdict: no-go (failed: (c) arm separation (c1 | c2))
```

**The Level-4 result, exactly as licensed:** in a sealed two-arm pilot on this task/model/budget
(`glm-5.2` thinking-on, procedural-rest-v2, 6-task chains, frozen budgets), executing the spec's
scenarios as the acceptance gate did **not** keep the spec-of-record fresher than prose review
and did **not** reduce false confidence. Both contrasts ran in the opposite direction: the
executed arm accumulated drift-episode onsets *faster* (4.00 vs 1.83 per opportunity task,
executed over prose) and closed *more* tasks in false confidence (12/12 vs 10/12). This is a
preliminary, single-model, replay-valid pilot result — a real finding under this
task/model/budget, not a validation or refutation of any framework claim.

**Headline finding (sealed §4, first branch — fixed pre-data for whichever way it landed):**
the executed arm's false confidence is **total** (12/12; every task on both seeds closed `done`
through a fully green cumulative scenario set while the hidden oracle failed). The executable
scenarios as authored by this model were **too weak to catch its own failures on every single
task**. Corroboration ordered by the pre-committed vacuous-spec signature: kill score stayed
**1.0 on every task in both arms** (the scenario sets were *not* vacuous by the bank's standard)
while the executed arm's drift composition carries 24 endpoint coverage_gaps and 18 stale_claims
alongside 35 endpoint contradictions. The signature is therefore **true-but-diverging coverage**,
not gamed vacuousness — and on this lens, executing the spec did not even reduce the lie rate.

**Cross-lens statement (sealed two-lens framing).** Two separate Level-4 claims, never pooled:
M7 (deepseek-v4-pro, austere / thinking-off): executing the spec kept it fresher (7.83 vs 3.83)
and reduced false confidence (10/12 vs 7/12). M8 (glm-5.2, realistic / thinking-on): executing
the spec made it *less* fresh (1.83 vs 4.00) and false confidence *worse* (10/12 vs 12/12). The
lenses **diverge**, and the divergence is the publishable finding. Cross-lens chain identity
holds for seed 60 only (seed 3's chain has no M7 counterpart).

## 2. Primary metric (per §3)

Drift-episode-onset velocity per opportunity task (episode semantics carried unchanged from v1;
aborted records excluded — none existed):

| Seed | Arm 0 (prose) — all / spec-side | Arm H (executed) — all / spec-side | Drift burden at T6 (all / spec) |
| --- | --- | --- | --- |
| 3 | 0.67 / 0.33 | 4.33 / 2.00 | 2/1 vs 11/6 |
| 60 | 3.00 / 2.00 | 3.67 / 2.00 | 2/1 vs 2/1 |

The executed arm drifts faster on **both seeds** in the all-direction predicate quantity;
spec-side, it is worse on seed 3 (2.00 vs 0.33) and tied on seed 60 (2.00 vs 2.00). This is the
exact mirror of M7, where the prose arm drifted faster on every seed in both directions.

## 3. Pre-registered secondaries (§3, reported regardless of verdict)

**1. False confidence + gate-vs-oracle gap.** Per arm, `false_confidence.event` over attempted
(complete) tasks — the identical binary event in both arms: Arm 0 **10/12** (seed 3: 4/6 — its
tasks 1–2 closed with the oracle fully green, the only honestly-earned `done`s in the run;
seed 60: 6/6). Arm H **12/12**. The executed arm's gate-vs-oracle gap equals its event count: all
12 tasks closed `done` through a green cumulative scenario set while the hidden oracle failed
(end-states below). The §4 reporting commitment is discharged in §1 above; the M8 §6 calibration
observation (6/6 with kill 1.0, both calibration sequences) is cited as calibration context
only, never pooled — the evidence run reproduced its signature on every task.

**2. Workspace-breakage rate.** `drift.extraction_failed` on complete tasks: **0/6 in every
arm-sequence (0/24 overall)**. Nothing was censored; the v1 flash-pilot failure mode is absent
on this model too.

**3. Kill score (measured, hidden, never a gate).** **1.0 on all 24 task closes**; at every
sequence end all six adversarial variants were killed in both arms. Trajectory flat at 1.0 — no
decay. Read jointly with the meter's contradiction channel (M5 instrument insight): the executed
arm pairs kill 1.0 with 35 endpoint contradictions — scenarios that assert real, discriminating
behavior of the agent's *own* implementation, which had diverged from the hidden ground truth.
The gate was green because the spec matched the code; the meter fired because neither matched
the truth.

**4. Taxes in tokens per attempted task** (v1 §3.1 semantics on the v2 per-phase split; all 6
task indices attempted in both arms on both seeds):

| Seed | Freshness tax (Arm H spec + gate/oracle feedback) | Drift tax (Arm 0 total − Arm H implementation) | Verdict | Pass rates (Arm 0 / Arm H, pooled oracle) |
| --- | --- | --- | --- | --- |
| 3 | 66,508 tok/task | +54,356 tok/task | not supported | 0.981 / 0.840 |
| 60 | 43,949 tok/task | +33,472 tok/task | not supported | 0.911 / 0.906 |

Freshness cost exceeded the drift tax on both seeds (H5-analog not supported), and on seed 3 the
always-print pass rates show the prose arm also *passed more of the hidden oracle* (0.981 vs
0.840). Protocol-overhead sensitivity: gate-protocol component ≈25–40 tokens/task; no verdict
flips. Per-oracle-passing-task quantities: Arm H undefined at pilot scale (advisory (v): zero
fully-passing Arm-H tasks pooled); Arm 0 defined on seed 3 only (333k tokens/passing task).

**5. Mandatory diagnostics.**
- *Class composition* (verdict block above): Arm 0's drift is small and endpoint-contradiction
  shaped (17, mostly seed 60); Arm H's is three times broader — 35 endpoint contradictions plus
  a 24-endpoint coverage_gap block and 18 stale_claims. The executed arm's archive hygiene did
  **not** hold on this lens (M7's Arm H had zero endpoint coverage_gap/stale_claim).
- *Op-type onset attribution* (pooled): Arm 0 — add_entity 7, add_relationship 2,
  add_validation_rule 2; Arm H — **add_entity 18**, rename_entity 2, add_relationship 2,
  add_validation_rule 2. Additive tasks, where the agent authors new spec surface from scratch,
  are the executed arm's dominant drift channel: its freshly-authored Promotion/Review scenarios
  described its own implementation choices, not the hidden ground truth, and each extra scenario
  became a spec-side discrepancy. Rename-class ops — the prose arm's biggest channel on M7 —
  barely register here.
- *Red checks and refusals*: every executed-arm change carried ≥1 red novel scenario
  (discriminating-red refusals 0 across all arms; Arm H novel 28 + 23 with novel_red 22 + 18
  across seeds). `green_novel` recorded, never gated (Arm H: 6 + 5; Arm 0: 0 — restatement
  deltas, legal under prose custody). Custody failures: seed 3 — Arm 0 7, Arm H 5; seed 60 —
  1 / 1. `refused_done_over_red`: **0 in both arms on both seeds** — the enforcement channel
  that fired 29 times on M7 seed 22 never fired once: no scenario set was ever red at a
  done-claim, so the gate never had anything to refuse.
- *Oracle end-states*: seed 3 — Arm 0 **35/36**, Arm H **30/36** (the prose arm ended objectively
  closer to truth); seed 60 — 25/27 both arms.
- *Archive outcomes across the MODIFIED-replace seam*: 20 archives attempted across the run
  (5 per sequence; the noop_maintenance byte-unchanged affirmations attempt none) — **all
  succeeded**. No archive-rot event; but see the seed-3 noticing probes (§5) for a
  MODIFIED-vs-REMOVED misuse that archived *successfully* and left a stale capability behind.
- *Scenario census*: spec-of-record grew (task-1 close → T6) 23→31 (seed 3 Arm 0), 22→25
  (Arm H); 17→20 / 17→22 (seed 60); **unbindable scenarios 0 everywhere** — the sealed grammar
  held under a second live frontier model, thinking-on.
- *Noticing probes*: on seed 3 **both arms noticed their own drift** at T6 — the prose arm named
  the stale `promotions` spec and the MODIFIED-instead-of-REMOVED archive misuse verbatim; the
  executed arm's probe described the same defect ("supposed to *replace* the promotions
  capability … both still exist"). Unlike M7, the executed arm did not blame the harness. On
  seed 60 both probes report no mismatch — over a spec whose arm had just closed 6/6 tasks in
  false confidence. Noticing and honesty of the *gate* are evidently different faculties.

## 4. Interpretability notes

All four triggers clear (velocities non-zero, so the §2 spec_touch split never activates;
`spec_touch` was true on 5/6 complete tasks in every sequence — the sixth is each seed's
byte-unchanged noop affirmation). Floor rule: no arm-sequence floor-collapsed. Advisory (v)
fired for Arm H (zero oracle-passing tasks pooled — seed-3's 30/36 tail drags the pooled arm
under full pass on every task). Advisory (vi) fired: Arm-0 velocity ratio across seeds is
3.00/0.67 = 4.5 > 3 — any full-run pre-registration should use more seeds.

## 5. Observation outside the predicates (diagnostic narrative, no claim weight)

Where M7's executed arm ran in two regimes by seed (enforced-and-expensive vs green-and-weak),
**both M8 seeds ran green-and-weak**: 0 refusals, 12/12 `done`, every gate green, no budget wall
approached (max 11/27 turns, 260k/490k tokens per task), $2.84 total. GLM-5.2 thinking-on never
authored a scenario set strong enough to be red at a done-claim — so the enforcement machinery,
which demonstrably works on this substrate (29 live refusals on M7 seed 22), was simply never
triggered. The inversion mechanism visible in the diagnostics: the executed arm is *required*
to author novel discriminating scenarios (custody + change-level red), so it writes more spec
surface per task; when its implementation diverges from the hidden ground truth (which it did —
oracle 30/36 at seed-3 T6), every additional scenario that faithfully describes the divergent
implementation lands as a spec-side contradiction or stale claim against gold. The prose arm,
writing minimal restatement deltas, exposes less surface to be wrong with. On this lens the
executable gate functioned as a *self-consistency* amplifier, not a truth instrument — custody
≠ truth (ADR-003), now demonstrated in the direction opposite to M7. Whether this is a
model-class property (thinking-on models more confidently elaborating their own divergent world
model) or a task-draw property (seed 3's add_entity-heavy chain vs M7's rename-heavy chains)
is **not decidable from this design** — noted for any future gate review, carrying no claim.

## 6. Thinking-on configuration validity (sealed §5 gate — M8 addition, both seeds PASS)

From the per-sequence `reasoning-observability.json` (recording transport at `4f7e1ed`; derived
signals only):

| Seed | Live calls | Reasoning absent (rule i, ≤0.10) | Accounting (rule ii, all `folded`) | Truncation (diagnostic) | Reasoning burn per call |
| --- | --- | --- | --- | --- | --- |
| 3 | 83 | 0 (0.000) — pass | folded 83/83 — pass | 0 | 12–13,795 tok |
| 60 | 73 | 1 (0.014) — pass | folded 73/73 — pass | 0 | 0–14,667 tok |

The stated realistic / thinking-on configuration is confirmed for every headline sequence: the
model reasoned on effectively every call, reasoning tokens were folded into the billed
completion tokens (the sealed budget ledger is honest), and no response was truncated at the
32k headroom. The single reasoning-absent call (seed 60) is the sealed rule's anticipated
"rare single-call absence on a trivial turn".

## 7. Deviations and operational notes

1. **Launch-verification deviation (operational; the run's one deviation).** The sealed §6
   launch procedure was executed verbatim, but its property-1 verification (`pgid == pid`)
   cannot pass in this environment: the harness shell has no controlling terminal, so `bash -m`
   silently disables job control ("no job control in this shell") and the background job
   inherits the wrapper's process group instead of leading its own. This was true of both seed
   launches and would have been true of any launch from this harness, including at sealing time.
   The *substance* of the sealed property held: each bun process was orphaned to init (PPID 1)
   as the sole member of a process group whose leader had exited, nohup'd with stdin/stdout
   detached to files, and tracked by no session facility. It was validated live: mid-seed-3 the
   session's own read-only monitoring task was reaped by the harness — the detached evidence
   process was untouched and ran to completion. The deviation was detected immediately after
   the seed-3 launch and accepted rather than "fixed" by killing a launched evidence sequence
   (which the seal makes terminal); seed 60 used the identical sealed command under the same
   recorded deviation. No sealed parameter, predicate, or analysis quantity is affected. Any
   future pre-registration should specify a headless-correct detachment (e.g. a `setsid`
   equivalent) and a verification that matches it.
2. Monitoring was file-based throughout per §6.3 (log tail + manifest polling); seed 60 was
   launched only after seed 3's sequences closed and passed the §5/§6.4 gates.
3. No provider anomalies: zero retries surfaced, no aborted records, no truncation, no
   mid-run sleep events. Wall clocks: seed 3 — 41.2 min (Arm 0) + 46.1 min (Arm H); seed 60 —
   19.4 + 26.1 min.

## 8. Program consequence

Per pre-registration §7, the no-go is taken at face value and reported as a real finding under
this task/model/budget; it is never grounds for rerunning, reconfiguring, or reconciling either
pilot. The two lenses now disagree, and per the sealed two-lens framing that divergence is
itself the reportable result: **on the austere lens, executing the spec helped; on the
realistic lens, it hurt on freshness and did nothing for honesty — and its own gate stayed green
throughout.** The M8 §6 calibrations remain non-evidence (structurally excluded). The voided
seed-22 attempt is cited nowhere in this report's quantities (§0 non-derivation held: seed 22
was replaced before launch). Any public artifact derived from this run states the `pilot`
classification, stays at claim ladder Level 4, presents M7 and M8 as two separate single-model
claims side by side, and points at the committed manifests and this report. The public post is
a separate, operator-reviewed step — deliberately not drafted here.
