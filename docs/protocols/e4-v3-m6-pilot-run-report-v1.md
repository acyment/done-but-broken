# E4 v3-M6 evidence run — report (v1.1)

**v1.1 correction notice (2026-07-11, pre-push):** an adversarial review of v1 (four
independent reviewers over the committed manifests) found two factual errors, one overbroad
sentence, one arithmetic slip, and two omitted prereg-mandated diagnostics. All are corrected
in place below, each marked `[v1.1]`; §10 lists them and adds the review's composition
diagnostics. No verdict-tool output, manifest, or sealed quantity changed.

**Classification: `pilot`** (single-model, preliminary). Protocol profile
`e4-openspec-workflow-v2` (shared environment, all three arms: same OpenSpec workspace,
harness-run archive step, and the PM-brief clarification channel identical everywhere).
**Pre-registered verdict: `go` (exit 0)** — no interpretability trigger fired; predicates (a)
and (b) hold; the PRIMARY separation (c) holds **on the false-confidence leg only**: the
product arm closed fewer tasks in false confidence than prose (`[v1.1]` 15/30 vs 24/30 —
62.5% of prose's count) while
the velocity leg ran **in the opposite direction** (c1: prose 2.13 vs product 5.33 onsets per
opportunity task — the product arm drifted *faster*). Per the sealed §4 commitment (second
branch), the headline finding is that **the product loop caught false confidence that neither
prose review nor naked execution did** (d2: 24/30 naked vs 15/30 product) — and per the same
sealed commitment, the velocity inversion and every uncomfortable secondary branch are reported
at face value below. Claim ceiling: **ladder Level 4**; no generalized (Level 5) claim is made
or licensed; M7, M8, and this run are three separate compatibility boundaries, never pooled.

| Field | Value |
| --- | --- |
| Pre-registration (sealed pre-data) | `docs/protocols/e4-v3-m6-pilot-preregistration-v1.md` (sealed at `5ed1d87`, 2026-07-10; run authorized separately by the operator on 2026-07-10, verbatim "authorize run") |
| Design | 1 substrate config × 3 arms × 6 seeds × 6 tasks = 108 task-runs planned; **90 task-runs are evidence** (5 surviving seeds; seed 65 excluded per the sealed §5 configuration gate — §7 below) |
| Model | `glm-5.2`, z.ai direct endpoint (paas/v4), **thinking ON** (empty extras, provider-default `reasoning_effort` max), `max_tokens` 32000, pricing overestimates 1.4/0.26/4.4 — identical parameters and route to the v3-M5 ratifying calibration |
| Configuration label | **realistic / thinking-on** (v3 product-loop gate design) |
| Seeds | 36, 41, 62, 65, 68, 75 as sealed (mechanical rule, fixed pre-probe); pairing labels `pair-pilot-seed-<N>`; launched in sealed order 36→41→62→65→68→75, one seed fully closed and gated before the next |
| Constants | v2 v0.3 `2f78f534…` **and** v3 v0.2 `aec35e3d…` (double stamp, predicate (b)) — both verified against disk before launch; all six §5 pinned file hashes verified byte-identical |
| Validity | All 15 surviving sequences `chain_replay_valid: true`; **zero aborted task records**; zero extraction failures (0/90); §5 thinking-on configuration gate **passed on all five surviving seeds** (§6 below) and **failed on seed 65** (excluded, §7) |
| Spend | **$19.71 evidence** (seed 36: $5.61; 41: $2.09; 62: $5.26; 68: $1.52; 75: $5.23) + $0.13 sunk on excluded seed 65 + ≈$0.001 diagnostic probes ≈ **$19.83 total** — above the pre-registered ≈$9–16 estimate (stated at face value; the driver is §5-below product-arm grind), far under the sealed structural ceiling 18 × $5 = $90; largest single sequence $3.13 (cap $5) |
| `e1:protect` | PASS immediately before launch (785/785) and after completion, before any analysis (785/785) |
| Manifests (replayable evidence) | `docs/protocols/e4-v3-m6-pilot-manifests-20260711-001/` — re-verify with `bun run bin/e4-v3-gonogo.ts docs/protocols/e4-v3-m6-pilot-manifests-20260711-001`. Excluded seed 65 archived separately (never read by the tool) at `docs/protocols/e4-v3-m6-pilot-excluded-seed-65-manifests-20260711-001/` |
| Deviations from the pre-registration | **Zero sealed-parameter deviations.** The sealed setsid-shim launch verification (`pgid == pid` and `PPID == 1`) **passed on every launch** — the M8 launch-verification deviation is closed by this design. Operational incidents (seed-65 provider/balance window, diagnostic probes, watcher reaps with no effect) in §8 |

## 1. Verdict (sole claim source: the tool's printed report)

```
pairing pair-pilot-seed-36 (seed 36): surviving
pairing pair-pilot-seed-41 (seed 41): surviving
pairing pair-pilot-seed-62 (seed 62): surviving
pairing pair-pilot-seed-68 (seed 68): surviving
pairing pair-pilot-seed-75 (seed 75): surviving
trigger insufficient_valid_data: clear — 5 surviving replay-valid paired seed(s); sealed minimum 2
trigger substrate_not_validated: clear — at least one arm records drift velocity > 0
trigger instrument_degraded: clear — extraction_failed on 0/90 non-aborted records (sealed max fraction 0.1)
trigger arm_h_protocol_confusion: clear — e4_arm_h never exited the spec phase on 1/30 attempted tasks (sealed max fraction 0.5)
trigger arm_p_protocol_confusion: clear — e4_arm_p never exited the spec phase on 8/30 attempted tasks (sealed max fraction 0.5)
(a) arm-0 drifts on every surviving seed: true [seed 36: 0.3333333333333333, seed 41: 3, seed 62: 4, seed 68: 2.6666666666666665, seed 75: 0.6666666666666666]
(b) boundary stamp (v2 + v3): true — all manifests stamp v2 2f78f53479e300ef4eb7ee654283dba26a9095cf252b661d20deb51232b5e11c + v3 aec35e3d7db94e5be953b2bb5f318ab33d3fa3da96609579994633ffba8cf85a + profile e4-openspec-workflow-v2 + frozen boundary ids
(c) PRIMARY separation arm0 vs armP: true [c1 velocity false (2.1333333333333333 vs 5.333333333333333); c2 false-confidence true (0.8 [24/30] vs 0.5 [15/30])]
(d) SECONDARY armH vs armP (reported, no verdict weight): [d1 velocity false (5 vs 5.333333333333333); d2 false-confidence true (0.8 [24/30] vs 0.5 [15/30])]
(e) REPLICATION arm0 vs armH (reported, no verdict weight): [e1 velocity false (2.1333333333333333 vs 5); e2 false-confidence false (0.8 [24/30] vs 0.8 [24/30])]
diagnostic refused_done_over_red (never the predicate): e4_arm_0 0, e4_arm_h 15, e4_arm_p 0
diagnostic ASK_PM usage: e4_arm_0 6/30, e4_arm_h 8/30, e4_arm_p 11/30
diagnostic product gate (arm p): pm_review_refusals=0 reconcile_refusals=23 mutation_refusals=0 pm_review_flags=0 reconcile_unavailable=0
floor …: clear (all 15 arm-sequences)
diagnostic e4_arm_0 drift composition: endpoint/contradiction=70 endpoint/coverage_gap=10 field/contradiction=5 field/coverage_gap=9 field/stale_claim=5 validation_rule/coverage_gap=2 validation_rule/stale_claim=2
diagnostic e4_arm_h drift composition: endpoint/contradiction=65 endpoint/coverage_gap=102 endpoint/stale_claim=132 entity/coverage_gap=7 entity/stale_claim=11 field/contradiction=5 field/coverage_gap=39 field/stale_claim=55 validation_rule/contradiction=1 validation_rule/coverage_gap=9 validation_rule/stale_claim=13
diagnostic e4_arm_p drift composition: endpoint/contradiction=79 endpoint/coverage_gap=130 endpoint/stale_claim=122 entity/coverage_gap=11 entity/stale_claim=11 field/contradiction=12 field/coverage_gap=44 field/stale_claim=42 validation_rule/contradiction=2 validation_rule/coverage_gap=6 validation_rule/stale_claim=12
advisory (vi) high seed variance: max/min Arm-0 velocity ratio > 3 — recommend more seeds in any full-run pre-registration
verdict: go
```

**The Level-4 result, exactly as licensed:** in a sealed three-arm pilot on this
task/model/budget (`glm-5.2` thinking-on, procedural-rest-v2, 6-task chains, frozen budgets),
the product-grade HIT-SDD loop (executable scenarios as the acceptance gate **plus**
spec↔code reconciliation, agent-code mutation testing, scenario floors, and PM review with a
clarification channel) **reduced the false-confidence rate over attempted tasks** relative to
prose review (15/30 vs 24/30 tasks closed `done` over a failing hidden oracle — `[v1.1]` a
0.50 vs 0.80 rate, i.e. 62.5% of prose's count, not "half"; see §10 for the
conditional-on-close decomposition) and relative to naked scenario execution
(15/30 vs 24/30), but did **not** keep the spec-of-record fresher: the product arm accumulated
drift-episode onsets *faster* than prose (5.33 vs 2.13 per opportunity task). Per the sealed
predicate structure the verdict is **go** (c = c1 ∨ c2, and c2 holds); the c1 inversion is a
real finding under this task/model/budget and is reported with the same weight of visibility.
Preliminary, single-model, replay-valid pilot result — not a validation of any framework claim.

**Headline finding (sealed §4, second branch — fixed pre-data for whichever way it landed):**
arm-p false confidence is low while both control arms' is high. `[v1.1]` The mechanism is
seed-split, and stating it precisely matters: the product gate's **reconciliation check refused
done-claims 23 times — 21 on seed 36 and 2 on seed 68, zero anywhere else**. On seed 36 the
refusal→honesty story holds cleanly (fc 0/6 vs prose 4/6, refusals of real done-claims in the
implementation phase). On seed 62 the low false confidence (1/6 vs prose 5/6) came **entirely
from budget walls — the gate never refused anything there**; and on seed 68 the refusals fired
and every task still closed false-confident (6/6). So the enforcement channel demonstrably
worked on one seed, was bypassed by walls on another, and fired-without-effect on a third.
The price is equally visible and reported (proposal §3: the cost is part of the product story):
11 of the product arm's 30 tasks hit a wall (vs 4 naked, 0 prose), its wall-clock ran up to
4.2 h on one sequence, and on the hardest chains its oracle end-state fell *below* the liars'
(§3.5). **The loop did not make the model more truthful — it made false `done`s harder to
finish**, and the honest terminations it forced (`budget_exhausted` is not a false-confidence
event by the sealed identical-event definition) are labeled as such. §10's composition
diagnostics quantify how much of the c2 margin is non-closure rather than changed behavior at
a close.

**Three-boundary statement (sealed framing; three separate Level-4 claims, never pooled).**
M7 (deepseek-v4-pro, austere/thinking-off, v2 naked gate): executing the spec kept it fresher
and reduced false confidence — go. M8 (glm-5.2, realistic/thinking-on, v2 naked gate): both
contrasts inverted — no-go. **This run (glm-5.2, realistic/thinking-on, v3 product loop): go on
honesty, inverted on freshness.** The e-contrast (§3.9) replicates M8's velocity inversion on
fresh seeds at this boundary (naked-execution 5.00 vs prose 2.13) while its false-confidence
tie (24/30 vs 24/30) does not reproduce M8's directional c2; divergences stand as boundaries
disagreeing, never reconciled.

## 2. Primary metric (per §3)

Drift-episode-onset velocity per opportunity task (v1 episode semantics on the v2 meter,
unchanged; aborted records excluded — none existed). "all / spec-side" per arm; burden = whole
surface item-level discrepancies at T6 (all / spec):

| Seed | Arm 0 (prose) | Arm H (naked execution) | Arm P (product loop) | Burden at T6 (0 / H / P, all-spec) |
| --- | --- | --- | --- | --- |
| 36 | 0.33 / 0.00 | 9.00 / 2.00 | 3.00 / 2.00 | 1-0 / 26-11 / 9-6 |
| 41 | 3.00 / 2.00 | 2.67 / 2.00 | 4.67 / 3.00 | 8-6 / 8-6 / 13-9 |
| 62 | 4.00 / 2.33 | 3.67 / 2.33 | 8.00 / 3.67 | 12-7 / 11-7 / 36-16 |
| 68 | 2.67 / 2.00 | 1.33 / 1.00 | 1.33 / 1.00 | 8-6 / 4-3 / 4-3 |
| 75 | 0.67 / 0.33 | 8.33 / 2.00 | 9.67 / 2.67 | 2-1 / 35-11 / 41-14 |

Pooled (the predicate quantities): arm 0 **2.13**, arm H **5.00**, arm P **5.33**. The executed
arms' excess is concentrated in two seeds (36 and 75 — both open with `rename_entity`) where
both executed arms blew up while prose stayed near zero; on seed 68 the executed arms were
*fresher* than prose, and on seed 41/62 the three arms are within ~2× of each other. Advisory
(vi) fired accordingly (arm-0 seed ratio 4.00/0.33 = 12 > 3): seed variance is high, more seeds
required for any full-run claim.

## 3. Pre-registered secondaries (§3, reported regardless of verdict)

**1. False confidence + gate-vs-oracle gap** (`false_confidence.event`, the identical per-task
binary event in every arm, over attempted tasks):

| Seed | Arm 0 | Arm H | Arm P |
| --- | --- | --- | --- |
| 36 | 4/6 | 3/6 | **0/6** |
| 41 | 6/6 | 6/6 | 6/6 |
| 62 | 5/6 | 4/6 | **1/6** |
| 68 | 6/6 | 6/6 | 6/6 |
| 75 | 3/6 | 5/6 | 2/6 |
| pooled | 24/30 (0.80) | 24/30 (0.80) | **15/30 (0.50)** |

The split is bimodal: `[v1.1]` on seeds 41 and 68 all three arms were false-confident on every
task (green-and-weak, the M8 signature — on 41 the product gate never fired; on 68 it refused
twice and both tasks still closed false); on seeds 36, 62 and 75 most false closes were
suppressed — by reconcile refusals on 36, and on 62/75 by **shared-custody spec-phase walls
the product gate never touched** (§3.5, §10). Naked execution's gate-vs-oracle gap remains total where it
closed green (its 24 false `done`s all rode fully green cumulative scenario sets); the product
arm's 15 did too — reconciliation caught embellishment and archive rot, not divergence from
hidden truth (its sealed scope: internal adequacy only).

**2. Workspace-breakage rate.** `drift.extraction_failed`: **0/90**. Nothing censored.

**3. Kill score (measured, hidden, never a gate).** 1.0 at every task close in all executed-arm
sequences and nearly all prose sequences; the **only sub-1.0 kill of the program to date** is
the prose arm on seed 75, tasks 2–4 (0.83 = 5/6 — the `wrong-filter` class variant survived its
spec set until task 5 restored 1.0). Read jointly with the contradiction channel (M5 insight):
executed-arm kill 1.0 pairs with 65–79 endpoint contradictions — true-but-diverging coverage
again, not vacuousness. The pre-committed vacuous-spec signature (high fc + low kill + coverage
gaps) appears **nowhere**.

**4. Taxes in tokens per attempted task** (aborted excluded — none; freshness tax = executed
arm spec-phase + gate/oracle feedback + PM-brief components; drift tax = arm-0 total − executed
arm implementation):

| Seed | Arm H freshness / drift tax | Arm P freshness / drift tax | Verdict (H, P) | Pass rates (0 / H / P) |
| --- | --- | --- | --- | --- |
| 36 | 142.9k / +40.5k | 106.9k / −152.1k | not supported, not supported | 0.924 / 0.829 / 0.905 |
| 41 | 42.2k / +95.5k | 40.4k / +98.0k | **supported, supported** | 0.897 / 0.952 / 0.927 |
| 62 | 114.7k / −1.9k | 289.0k / +103.7k | not supported, not supported | 0.918 / 0.918 / 0.745 |
| 68 | 29.8k / +10.5k | 55.5k / +9.9k | not supported, not supported | 0.943 / 0.949 / 0.949 |
| 75 | 127.3k / +102.9k | 359.6k / +102.8k | not supported, not supported | 0.980 / 0.441 / 0.414 |

The product arm's gate-interaction cost lands in its freshness tax as sealed — up to 359.6k
tokens per task (seed 75), an order of magnitude above the naked arm's spec cost on easy seeds.
The H5-analog is supported on exactly one seed (41) for both executed arms. PM-brief component
itself is negligible (≤62 tokens/task); the cost is the refusal-rework loop, not the channel.

**5. Product-gate mechanism diagnostics (arm p).** `reconcile_refusals` **23** (seed 36: 21;
seed 68: 2; zero elsewhere), `pm_review_refusals` 0, `mutation_refusals` 0,
`pm_review_flags_total` 0, `reconcile_unavailable` 0; mutation kill score at every reached
done-claim **1.0 (6/6 mutants)**. Reconciliation is the only product component that fired live;
the mutation floor and PM review never refused (the model never submitted a scenario set weak
enough to trip the 5/6 kill floor, and never contradicted a communicated requirement at spec
exit). `[v1.1 — v1 misstated this as "implementation grind"]` On seeds 62/75 the walls were
**spec-phase custody walls with the product gate fully inert**: all eight of those
terminations have `phase_at_termination: "spec"` with 10–17 custody failures per task and
zero product-gate refusals of any kind — the model never produced a valid change to refuse
(per-turn records show validate/archive rejection loops on the rename tasks). The v1 §3.1
attribution of those walls to "the budget wall it [the product loop] drove tasks into"
over-credits the product machinery: the shared v2 custody bar produced them, in the arm that
also carries the product protocol text.

**6. ASK_PM usage** (shared channel, all arms): arm 0 **6/30**, arm H **8/30**, arm P
**11/30**. `[v1.1 — first-turn indices, the §3.6 readout v1 omitted]` First request turns:
arm 0 all six at turn 1; arm H turns 1×6, 2, 6; arm P turns 1×5, 5, 6, 7, 9, 10, 18 — the
product arm not only asks most, it is the only arm that *returns* to the channel mid-task
(late first-asks up to turn 18, on tasks already deep in custody trouble). The product arm
asks most (its gate makes underdetermined closes expensive); on seed 41 arm P never asked and
closed 6/6 false-confident — asking correlates with the enforced regime, not with the
channel's availability. Read against v3-M5 (asked 2/6) with no pull.

**7. Ambiguity split (standing diagnostic, sealed determinacy module over the drawn chains):**
19/30 tasks underdetermined. Onsets: arm 0 — 14 determined / 18 underdetermined; arm H — **63
determined / 12 underdetermined**; arm P — **56 determined / 24 underdetermined**. The executed
arms' velocity excess concentrates on **determined** tasks (the rename cascades, §3.8) — this
boundary's inversion is **real rot, not the M8 ambiguity penalty**. False confidence splits
mildly the other way (arm P: 5/11 determined vs 10/19 underdetermined).

**8. Mandatory diagnostics.**
- *Class composition* (verdict block): arm 0's drift is contradiction-shaped (70 endpoint
  contradictions, few gaps); both executed arms carry huge coverage_gap + stale_claim blocks
  (H: 102+132; P: 130+122) — archive hygiene did not hold on this lens, in either executed arm.
- *Op-type onset attribution* (sealed velocity function over prefixes): arm 0 — add_endpoint 8,
  rename_entity 8, add_relationship 5, retype_field 5, modify_endpoint 4, rename_field 2;
  arm H — **rename_entity 58** of 75; arm P — **rename_entity 43** of 80. This boundary's
  dominant channel is the **rename cascade** (paths follow entity renames in
  procedural-rest-v2), not M8's add_entity: when an executed arm mishandles a rename, every
  scenario touching the old paths becomes a stale claim or gap at once. Seeds 36/62/75 (the
  rename-lineage seeds) carry the whole inversion; on rename-free seed 68 the executed arms
  beat prose.
- *Red checks and refusals*: `refused_done_over_red` fired **15×** on arm H (2 on seed 36, 13
  on seed 62 — the naked gate's enforcement channel was live at this boundary, unlike M8's
  0/24) and **0×** on arm P (reconciliation refused earlier in the funnel, or the wall hit
  first). Discriminating-red refusals 0 everywhere; unbindable scenarios **0 everywhere** (the
  sealed grammar held again). `[v1.1 — the §3.8 green_novel counts v1 omitted]` `green_novel`
  scenario titles (recorded, never gating): arm 0 **0** (restatement deltas, legal under prose
  custody), arm H **45**, arm P **38** — both executed arms routinely authored novel scenarios
  that were already green pre-implementation, consistent with the M8 observation that forced
  novel authorship expands spec surface beyond what the red-check demands.
- *Oracle end-states* (cumulative at T6): seed 36 — 24/27, 24/27, 23/27; seed 41 — 23/27,
  25/27, 23/27; seed 62 — 24/27, 24/27, **15/27**; seed 68 — 25/28, 26/28, 26/28; seed 75 —
  26/27, **12/27**, **10/27**. On the two hardest chains the *prose* arm ended objectively
  closest to truth while the product arm ground to walls far from it — freshness enforcement
  is not competence (the M7b "competence band" observation, reproduced under the product gate).
- *Archive outcomes across the MODIFIED-replace seam*: every attempted archive succeeded
  (0/H/P: 25/23/19 attempts pooled); the executed arms attempted fewer late-chain archives on
  seeds 62/75 because walled tasks never reach an accepted change.
- *Scenario census*: spec-of-record grew in every completed sequence (e.g. seed 36 arm P
  17→32); no census anomalies.
- *Noticing probes*: "drift noticed" answers — arm 0 7/30, arm H 5/30, arm P **10/30**. The
  product arm noticed most, including 4/6 on seed 36 where it also refused to lie. On seed 75,
  both executed arms answered "No — spec and code were consistent with each other" at T6 over
  burdens of 35–41: **self-consistency masks divergence from truth** (ADR-003's custody ≠
  accuracy, verbatim in the probe text).
- *Per-seed reasoning summary*: §6 table.

## 4. Interpretability notes

All five triggers clear. Trigger 4's product-arm row is the closest approach: arm P exhausted
its budget while still spec-phase-gated on 8/30 attempted tasks (0.27 vs sealed max 0.50) —
the PM-review-keeps-phase-at-spec failure mode the trigger was built for is present but under
threshold. Floor rule: no arm-sequence collapsed (all 15 clear). Advisory (v) did not fire (no
zero-denominator per-passing quantities pooled); advisory (vi) fired (arm-0 seed ratio 12 > 3).

## 5. Observation outside the predicates (diagnostic narrative, no claim weight)

The run reproduces both M7/M8 regimes *within one boundary, split by seed*: green-and-weak
(seeds 41/68 — near-total false confidence in all arms; `[v1.2]` on 41 the product gate never
fired, on 68 it refused twice and both tasks still closed false — fired-without-effect, not
inert) and enforced-and-expensive (seeds 36/62/75 — refusals or walls, honesty up, spend and
wall-clock up 3–10×, oracle end-state down on the hardest chains). Which regime a seed lands in
tracks its op draw (rename-cascade seeds enforce; rename-free seeds sail), not the gate design
alone. The product loop's honesty effect operated through *termination relabeling* as much as
through behavior change: it rarely made the model fix the truth gap (oracle end-states are flat
or worse vs prose), but it reliably refused to let the gap close as `done`. Whether a stronger
model converts those refusals into truth-repair instead of budget exhaustion is not decidable
from this design — noted for the next gate, carrying no claim.

## 6. Thinking-on configuration validity (sealed §5 gate — per seed, five survivors PASS)

| Seed | Live calls | Reasoning absent (rule i, ≤0.10) | Accounting (rule ii, all `folded`) | Truncation (diagnostic) | Reasoning burn per call |
| --- | --- | --- | --- | --- | --- |
| 36 | 184 | 1 (0.005) — pass | folded 184/184 — pass | 0 | 0–22,568 tok |
| 41 | 130 | 0 (0.000) — pass | folded 130/130 — pass | 0 | 14–12,045 tok |
| 62 | 180 | 0 (0.000) — pass | folded 180/180 — pass | 2 | 9–31,999 tok |
| 68 | 122 | 0 (0.000) — pass | folded 122/122 — pass | 0 | 16–11,316 tok |
| 75 | 186 | 1 (0.005) — pass | folded 186/186 — pass | 1 | 0–31,997 tok |
| **65** | **34** | **26 (0.76) — FAIL** | **indeterminate present — FAIL** | 0 | — |

Three truncated reasoning calls (seeds 62/75, burn at the 32k ceiling) are the sealed
diagnostic, not a gate; the affected turns were retried/continued under the sealed protocol.

## 7. Seed-65 exclusion (sealed §5 consequence, taken at face value)

Roughly 54 minutes into seed 65 (launched 09:16 local, 2026-07-11), the provider began
returning **empty response bodies** (no content, no usage) and continued for ~40 minutes —
long enough to exhaust the sealed retry ladder in all three arms; each arm recorded a
`provider_error` task and closed early ($0.126 spent). The recorded calls fail both sealed
configuration rules (reasoning absent 26/34 = 0.76 > 0.10; accounting `indeterminate` present),
so **seed 65 is invalid for the stated configuration: all three sequences excluded, never rerun
under this seal**. `[v1.1]` The exclusion is **outcome-blind**: it was forced by the sealed
configuration rules over transport-level signals (empty bodies), not by any drift or
false-confidence readout, and the compliance audit verified the verdict is invariant to it
(the pinned tool self-excludes the incomplete seed even when pointed at it; its one completed
prose task would, if anything, have *broken* predicate (a) — the exclusion did not manufacture
the go). Root cause per the operator: the z.ai account balance had reached zero
(recharged the same morning); the incident is an account/provider event, not a model or harness
behavior, and is flagged rather than narrated away. Sunk manifests are archived as
non-evidence at `docs/protocols/e4-v3-m6-pilot-excluded-seed-65-manifests-20260711-001/`; the
verdict tool is never pointed at that folder. Survivors (5) remain above the sealed minimum
(2); predicates ran over survivors only, as sealed.

## 8. Deviations and operational notes

1. **Zero sealed-parameter deviations.** Every launch used the sealed shim command verbatim;
   the sealed detachment check (`pgid == pid`, `PPID == 1`) **passed on all six launches**,
   verified from separate calls — the M8 §7.1 launch-verification deviation is closed by the
   setsid-shim design this seal adopted. Monitoring was file-based throughout. `[v1.1 — v1
   overstated the launch precondition]` Each seed was launched only after the prior seed fully
   closed and its §5 gate was **evaluated**: seeds 41/62/65/75 followed gate-passing seeds;
   seed 68 followed seed 65, whose gate **failed** — continuing over survivors is the reading
   §2 trigger 1 and §5 require (an excluded seed "consumes headroom"), though §6 item 4's
   letter ("passes its gates") did not anticipate the failed-gate case.
2. **Diagnostic probes (non-evidence, outside the harness, disclosed):** after seed 65's
   failure, three minimal single-turn calls to the sealed route (~$0.001 total, max_tokens 8)
   were made to distinguish balance exhaustion from a transient outage before risking seed 68,
   plus a 15-minute stabilization pause. Seed order and all sealed parameters were unaffected
   (the seal fixes order, not timing).
3. **Session watcher reaps (no effect):** the interactive session's read-only poll tasks were
   reaped twice during seed 68; the detached evidence process was untouched both times — live
   validation of the sealed detachment, mirroring the M8 mid-seed-3 event.
4. **Token-ledger overshoot at the wall:** two seed-36 tasks recorded ~532–534k tokens against
   the 490k budget — the sealed ledger fires at turn boundaries, so a final long turn lands
   before termination (the M6.5 precedent, 203k > 200k). Recorded as `budget_exhausted`;
   semantics unchanged.
5. **Spend above estimate:** $19.83 vs the sealed ≈$9–16 expectation (ceiling $90 untouched).
   The overage is the product arm's refusal-rework grind on the three rename-cascade seeds
   (sequences up to $3.13 / 4.2 h) — the §3.4 freshness-tax story, visible in money.
6. Wall clocks (arm 0 / H / P, minutes): seed 36 — 31/54/251; 41 — 30/18/21; 62 — 31/180/93;
   68 — 12/14/20; 75 — 31/48/143. A mid-run overnight gap between seeds 41 and 62 was
   operator-schedule, not process state.

## 9. Program consequence

Per pre-registration §7 the verdict stands as printed: **go**, carried entirely by the
false-confidence leg of the primary contrast, with the velocity leg inverted and reported at
face value. The sealed §4 second branch is discharged as the headline; the d-contrast says the
anti-cheat components (not execution per se) carry the honesty effect (d2 true, d1 false); the
e-contrast replicates M8's velocity inversion on fresh seeds and boundaries. No public claim
may pool the three boundaries, generalize past `glm-5.2` thinking-on under these budgets, or
describe the go as "the product gate keeps specs fresh" — on this evidence it does the
opposite; what it does is `[v1.1]` **make false `done`s hard to finish** (§10 shows it did
not make the model less likely to lie when it could close). The v3-M5/M8/M6-deepseek
calibrations remain non-evidence; the M8 void run is cited nowhere. Any public artifact states
the `pilot` classification, stays at Level 4, presents the three boundaries side by side, and
points at the committed manifests and this report. The public post is a separate,
operator-reviewed step — deliberately not drafted here.

## 10. `[v1.1]` Post-hoc composition diagnostics and correction log (adversarial review, 2026-07-11)

Four independent adversarial reviewers examined v1 against the committed manifests before any
push; every number below was independently recomputed from the manifests (and every v1 number
reproduced to the digit). These are **post-hoc, review-driven diagnostics with no claim
weight** — the sealed predicates and the verdict stand as printed; what follows bounds their
interpretation.

**Conditional-on-close false confidence.** Over tasks that actually closed `done`: arm 0
24/30 = **0.80**, arm H 24/26 = **0.92**, arm P 15/18 = **0.83**. Conditional on being allowed
to close, the three arms lie at statistically indistinguishable rates. **Matched pairs**
(arm 0 × arm P, same task, both closed): 18 pairs, **18 concordant, 0 discordant** — on every
task the product arm managed to close, it lied exactly when prose lied. The entire c2 margin
is therefore **composition** (12 product-arm tasks never closed: 11 walls + 1 stall, 8 of
them spec-phase custody walls with the product gate inert), not changed behavior at a close.
Whether preventing closure counts as the loop *working* is a deployment-semantics question the
sealed predicate answers "yes" by construction; a reader should decide with both numbers in
view.

**Done-only velocity.** Counting only drift onsets recorded at `done`-terminated tasks (same
sealed episode semantics, same per-seed opportunity denominators): arm 0 **2.13**, arm H
**1.60**, arm P **1.40** — the c1 inversion **reverses**. The all-tasks inversion (2.13 vs
5.33) is carried by onsets at never-closed tasks (74% of arm P's onsets), i.e. the same
non-closure events that produce the c2 margin. The two verdict legs are largely one
phenomenon: *the product arm stops closing tasks on rename-cascade seeds* — walls suppress
false-confidence events while leaving the drift they were refused over sitting in the record.

**Seed-level fragility.** c2 per seed (arm 0 vs arm P): 3 wins, 2 ties, 0 losses — one-sided
sign test p = 0.125 at n = 5; the honesty effect and the velocity inversion both concentrate
in the three rename-cascade seeds (36/62/75); seeds 41/68 were 6/6 false-confident in **all
three arms** (`[v1.2]` gate inert on 41; fired-without-effect on 68).

**Harness finding (fixed post-run at the Phase-0 learning boundary, `ae4169d`).** The
spec-phase custody loops were substantially a feedback defect, arm-symmetric and therefore not
an arm confound: the pinned CLI prints validation errors to stderr while the harness relayed
only stdout (agents saw empty errors), and archive-abort teaching hints were collapsed to a
fixed string; the workspace README also never documented the capability rename/retirement
tombstone — no arm ever discovered it live (successful renames used a MODIFIED-in-place
workaround). A single unarchived rename registers as ~25 episode onsets (endpoint × direction
× channel granularity), so the velocity contrasts are driven by 2–3 task-events, amplified.
These fixes moved the compatibility boundary (v2 constants v0.4 / v3 v0.3); this run's
manifests stamp the historical v0.3/v0.2 hashes and its verdict re-runs against the archived
constants via `git show 5ed1d87:docs/protocols/e4-v2-sealed-constants-v0.json` (and the v3
counterpart).

**Correction log (v1 → v1.1, all marked `[v1.1]` in place):**

1. §1 headline: refusals attributed to seeds 36 **and 62** — seed 62 had zero refusals (walls
   only); refusals landed on 36 and 68, and on 68 they fired without preventing 6/6 false
   closes. Corrected to the seed-split mechanism statement.
2. §3.5: seeds-62/75 walls described as "implementation grind" — all eight died in the **spec
   phase** with zero product-gate activity. Corrected, with the over-crediting note.
3. §8.1: "each seed launched only after the prior passed its gates" — false for the 65→68
   transition (65 failed its gate; continuing over survivors is the sealed-coherent reading).
   Corrected.
4. Header/§1: "half as many" — 15 is 62.5% of 24. Corrected.
5. §3.6: ASK_PM first-turn indices (prereg-mandated) were omitted. Added.
6. §3.8: `green_novel` counts (prereg-mandated) were omitted. Added (arm 0: 0, arm H: 45,
   arm P: 38).
7. §7: the seed-65 exclusion is now explicitly stated as outcome-blind and
   verdict-invariant (compliance audit re-ran the pinned tool including the excluded seed).

**`[v1.2]` addendum (2026-07-12, after two external model audits — ChatGPT + GLM-5.2 — over
the committed artifacts):** two residual "gate inert on 41/68" phrasings in §5 and §10
corrected (seed 68's gate fired twice without effect — manifest seed-68 arm-p task 4); the
audits independently reproduced every §10 number, confirmed the pluralization forensic and
the seed-65 counterfactual, and root-caused their own failing-test reports to a repo-state
issue (bun test's project scan over a 10k-directory tmp/ silently emptying child pipes —
fixed at `89f898d`, not a defect in any evidence run). Their design recommendations for the
next pre-registration (non-closure gaming guards, module hash-sealing, fixture-migration
conventions in the oracle) are recorded in `docs/e4/E4V3-LEARNING-LOG.md`.
