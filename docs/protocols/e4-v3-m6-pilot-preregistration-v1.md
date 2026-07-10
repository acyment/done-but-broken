# E4 v3-M6 evidence run — pre-registration (v1)

**Status: DRAFT — NOT SEALED. This document was drafted before any v3 evidence data exists.
Sealing is a separate operator act (a commit flipping only this header, the `f1894f9`/`7e9d84d`
pattern); the evidence run's spend requires its own separate explicit operator authorization.
Nothing below changes after sealing; deviations, if any, are recorded in the run report as
deviations — never edited in here.** Naming and discipline follow the M7/M8 precedent
(`e4-v2-m7-pilot-preregistration-v1.md`, `e4-v2-m8-pilot-preregistration-v2.md`): seeds,
predicates, and interpretation are fixed here, pre-data, and the verdict tool is the only claim
source.

**Authorization record.** Operator directive (2026-07-10, v3-M6 step 1): "pre-registration DRAFT
+ gate-commit code. Docs and no-spend code only — NO seal, NO live calls, NO evidence run, NO
public post. Sealing is my own separate commit afterwards; the evidence run gets its own
authorization later." This document is therefore neither the seal nor the spend authorization.
**The run itself is NOT authorized.** The gate-commit code that accompanies this draft (the
v2-M7 `3571a08` pattern) is recorded in §2 and §9.

**Seal-time confirmation items (for the operator, before flipping the header).** Three points
below are interpretive choices this draft pins where the ratified proposal delegated them to the
pre-registration; each is marked `[SEAL-CONFIRM]` in place. In brief: (1) the spend envelope
(§1); (2) only the PRIMARY contrast carries verdict weight — the secondary and replication
contrasts are pre-registered reported readouts (§2); (3) interpretability trigger 1 keeps its
sealed minimum of 2 surviving paired seeds, so at six-seed scale a single excluded seed does
NOT void the run (§2). Approving the seal as-is ratifies all three.

## 0. Boundary context

The v3 product-loop redesign was ratified at `e2a0edf`
(`docs/e4/E4V3-PRODUCT-LOOP-PROPOSAL.md`) from the M8 no-go's *diagnostics* (ambiguity penalty;
weakest-gate strawman — design inputs, no claim weight). The build arc v3-M0…M4 is complete and
frozen; v3-M5 ratified the budgets unchanged on glm-5.2 thinking-on (constants v0.2). **v3 is a
new compatibility boundary**: M7 (go, austere/thinking-off) and M8 (no-go inverted,
realistic/thinking-on) stand exactly as reported, are never pooled with this run, and are never
reconciled with it. The v2-M8 void run stays void; nothing from it exerts pull here. The v2
naked-execution arm is carried **byte-identical** (id `e4_arm_h` retained for cross-version
comparability; the proposal's "arm x" is a presentation label only).

## 1. Run identity

| Field | Value |
| --- | --- |
| Design | 1 substrate config × **3 arms × 6 seeds × 6 tasks = 108 task-runs** (18 sequences) |
| `run_classification` | `pilot` (claim ceiling per §8) |
| Protocol profile | `e4-openspec-workflow-v2` (shared environment, ALL THREE arms: same OpenSpec workspace, harness-run archive step, **and the PM-brief clarification channel (`ASK_PM` turn token)** identical in every arm; never a condition ID) |
| Substrate | `procedural-rest-v2` / `v2-default` |
| Constants (v2 base) | **v0.3, FULLY FROZEN**: full-file sha256 `2f78f53479e300ef4eb7ee654283dba26a9095cf252b661d20deb51232b5e11c` — stamped as `compatibility_boundary.constants_hash` in every manifest |
| Constants (v3 extension) | **v0.2 (v3-M5 ratification event)**: full-file sha256 `aec35e3d7db94e5be953b2bb5f318ab33d3fa3da96609579994633ffba8cf85a`, pinned by `test/e4-v3-m4.test.ts` — stamped as `compatibility_boundary.v3.constants_hash` in every manifest (the v3-M5 flag-1 field, added at this gate commit) |
| Compatibility boundary (frozen ids, stamped per manifest) | v2: meter `e4-drift-meter-v2`, converter `e4-openspec-gherkin-v1`, step table `e4-step-table-v1`, T0 gold spec `e4-t0-gold-spec-v1`, bank `e4-adversarial-bank-v1`; v3: determinacy table `e4-request-determinacy-v1`, PM brief `e4-pm-brief-v1`, reconciler `e4-spec-code-reconciler-v1`, mutation harness `e4-agent-boundary-mutation-v1`, PM review `e4-pm-review-v1`, product gate `e4-product-gate-v1`, turn protocol `e4-turn-protocol-v2` |
| Arms | `e4_arm_0` (prose: custody floors only, scenarios never executed) · `e4_arm_h` (naked execution: own scenarios green — **byte-identical to the v2 arm H gate**) · `e4_arm_p` (product loop: scenarios green + product gate = spec↔code reconciliation, agent-code boundary-mutation kill floor 5/6, scenario floors, PM spec review). One shared budget set; arm deltas flow only through the declared policy channels; the PM brief is shared-environment in all three arms |
| Product gate config | sealed in v3 constants v0.2: `mutation_kill_floor` 5/6 ≈ 0.8333, blocking checks = all reconcile checks except advisory `field_never_exercised` |
| Budgets (ratified at v3-M5 on this exact model/config/route) | 27 turns / 12 verifications / 490,000 tokens per task; $5 spend cap per sequence |
| Model | `glm-5.2`, z.ai direct endpoint `https://api.z.ai/api/paas/v4/chat/completions` (general paas/v4, not the coding endpoint; preset `direct-openai-compatible`, route_id `direct-zhipu-api-key`, key env `ZHIPU_API_KEY`) |
| Thinking configuration | **ON** — empty request extras (never `thinking:{type:"disabled"}`), `reasoning_effort` at the provider default **`max`** (the M8/M5-calibration-ratified configuration) |
| `max_tokens` | **32000** (reasoning-headroom value, carried from the M8 and v3-M5 calibrations) |
| Temperature | E1 provider sealed default **0.2**, no CLI override (`bin/e4-v3.ts` exposes no temperature flag — parity by construction, as at M7/M8) |
| Pricing (cap guardrail) | conservative overestimates in/cached/out **1.4 / 0.26 / 4.4** USD/M (≥ the z.ai published prices; the exact M8/M5 values) |
| Configuration label | **realistic / thinking-on** |
| Reasoning validity instrument | the recording transport wired into `bin/e4-v3.ts --live` (derived signals only, never raw bodies) writes `<runRoot>/reasoning-observability.json` per seed invocation (all three arms' calls); the §5 configuration-validity gate reads it |
| Seeds | **36, 41, 62, 65, 68, 75** (mechanical rule + probe recorded below) |
| Pairing labels | `pair-pilot-seed-<N>` for N ∈ {36, 41, 62, 65, 68, 75} |
| Run roots | `tmp/e4-v3-m6-pilot/seed-<N>` (fresh, disjoint from every calibration/dry-run root) |
| Expected spend | ≈ **$9–16** total: observed appetite ≈ $0.5/v2-style arm sequence (M8 evidence: $1.78 and $1.07 per two-arm seed) + ≈ $0.8/product-arm sequence (v3-M5: $0.8175) ⇒ ≈ $1.6–2.5 per three-arm seed × 6 seeds. Structural ceiling: 18 sequences × the sealed $5/sequence cap = **$90** (never expected to be approached). `[SEAL-CONFIRM]` the operator confirms this envelope at seal |

All live parameters above are **identical to the v3-M5 ratifying calibration run**
(`docs/protocols/e4-v3-m5-calibration-manifest-20260710-001.json`) — the same
parameter-identity discipline as M7/M8 with their calibrations.

**Model-id decision.** The budgets were ratified at v3-M5 from `glm-5.2`'s observed appetite
thinking-ON on this exact route **under the product gate** (the v2 v0.3 freeze alone was ruled
insufficient across the gate redesign — proposal §4). They transfer only to that exact model id
in that exact thinking configuration on that route. This run uses exactly that model,
configuration, and route. No fallback model exists at any stage (the M8 discipline: a sealed
pre-registration names one model; substitution is a new gate act).

**Seed decision (mechanical rule, fixed before the probe ran).** The rule, recorded verbatim
as fixed pre-probe: *the evidence seeds are the lowest **six** seeds in ascending order over
1–300, not in the exclusion set below, whose deterministic draw at `task_count=6` under the
sealed op-mix weights (drift_opportunity 0.5 / additive 0.4 / behavior_preserving 0.1) has
composition **drift 3 / additive 2 / behavior-preserving exactly 1** with **six distinct op
kinds**. If fewer than six qualify in 1–300, the range extends in blocks of 300 (301–600, …)
until six are found.* Composition criteria are carried verbatim from the M7/M8 seed decisions;
the count (six) is the proposal §5 "≥6 fresh seeds" minimum; the M8-v2 replacement rule's
positional and op-membership constraints (BP-at-task-6, rename_entity-present) are **not**
carried — they were single-replacement pair-repair constraints, not composition criteria, and
imposing them on a six-seed draw would be discretion masquerading as rule.

*Probe result (zero spend: pure substrate draw, the same `createE4Prng` + `drawE4V2TaskSequence`
code path `bin/e4-v3.ts` regenerates from; executed once, after the rule was fixed):* exactly
six seeds qualify in 1–300 — **36, 41, 62, 65, 68, 75**. The probe also re-verified the sealed
compositions of seeds 3, 60 (M8 evidence) and 37 (calibration) byte-identically — the
probe-integrity anchor the M8-v2 probe established.

**Seed compositions (from the recorded probe):**

- seed 36: noop_maintenance (**BP, task 1**) | rename_entity (drift) | add_relationship
  (additive) | delete_field (drift) | modify_convention (drift) | add_validation_rule (additive)
- seed 41: add_endpoint (additive) | add_relationship (additive) | noop_maintenance (**BP,
  task 3**) | modify_endpoint (drift) | retype_field (drift) | rename_field (drift)
- seed 62: add_entity (additive) | rename_entity (drift) | noop_maintenance (**BP, task 3**) |
  delete_entity (drift) | rename_field (drift) | add_relationship (additive)
- seed 65: retype_field (drift) | rename_field (drift) | add_entity (additive) |
  noop_maintenance (**BP, task 4**) | modify_convention (drift) | add_relationship (additive)
- seed 68: rename_field (drift) | delete_field (drift) | noop_maintenance (**BP, task 3**) |
  add_validation_rule (additive) | add_endpoint (additive) | retype_field (drift)
- seed 75: rename_entity (drift) | delete_field (drift) | noop_maintenance (**BP, task 3**) |
  retype_field (drift) | add_relationship (additive) | add_validation_rule (additive)

Together the six seeds cover **12 of the 13 op kinds** (all except `add_field` — an accepted
coverage cost of the mechanical rule, stated so the report never overclaims full op coverage);
BP positions span task 1 / 3 / 4 (start, mid-chain ×4, late-mid). Seeds 62 covers the
retirement-tombstone path (`delete_entity`) and 36/62/75 the rename-lineage paths under a live
model.

**Excluded seeds, with rationale (the v2-M8 v2 list carried; three additions).**
(i) **3 and 60** — the v2-M8 evidence seeds: their same-model, same-configuration outcomes are
fully known (the M8 report); reusing either would not be pre-data. (ii) **22** — contaminated by
the M8 void run (same-model Arm-0 outcome fully known). (iii) **37** — the calibration seed for
the M6 deepseek, M8 GLM, and v3-M5 product-arm ratifications: the budgets were ratified on its
exact draw; reuse would flavor the evidence run with budget overfitting. (iv) **45 and 50** —
dry-run fixture seeds (`bin/e4-v2.ts`/`bin/e4-v3.ts` defaults and the v2/v3 dry-run + verdict-
tool test fixtures). (v) **0, 42, 43** — v2 unit-test fixture seeds. (vi) **4 and 63** — the
verdict-tool no-go fixture seeds (v2-M7 gate commit, reused by the v3 gate commit's tests).
(vii) **46, 49, 52** — the v1 pilot seeds (different substrate; cross-version reuse invites a
pooling/familiarity critique at zero cost to avoid). Full set:
**{0, 3, 4, 22, 37, 42, 43, 45, 46, 49, 50, 52, 60, 63}**. Each chosen seed was verified against
this list and against the test suite, dry-run tooling, and calibration records: none appears as
a fixture and none has ever been drawn live. (The v3-M0 census test *scans* seeds 1–300 as a
pure IR-delta function — the same class of pure-function probe as the seed probe itself, not a
fixture use; it contaminates nothing.)

## 2. Pre-registered analysis and decision rule

**Analysis layer (carried verbatim from the M7/M8 seals).** Drift velocity is the committed v1
episode-onset semantics operating unchanged on the v2 meter's discrepancy lists
(`src/e4/result-schema.ts`: episodes keyed `(semantic_item_uid, direction)`, onset transitions,
rename-lineage merge, convention aggregation; velocity = onsets per opportunity task). Aborted
task records are excluded from every numerator and denominator (ADR-005 pin).

**Verdict tool (the gate-commit act, v2-M7 `3571a08` pattern).** The v3 verdict tool
(`src/e4/v3/gonogo.ts` / `bin/e4-v3-gonogo.ts`) is built at this gate commit and tested against
fake-agent dry-run manifests **before any live evidence manifest exists**
(`test/e4-v3-gonogo.test.ts`: go / no-go / inconclusive / stamp-tamper / calibration-exclusion /
three-arm-pairing fixtures). The v2 tool is left byte-untouched as the M7/M8 instrument. The v3
tool runs over the evidence manifest folder with its default constants paths (which resolve to
the frozen v2 v0.3 and v3 v0.2 files); no edits, zero interpretive freedom. Exit semantics
carried: interpretability triggers run first; exit 0 = **go**, 1 = **no-go** (prints which
predicate), 2 = **`inconclusive_uninterpretable`** (prints which trigger; predicates still
printed for diagnosis but carrying no claim), 3 = operational error. No claim beyond the printed
report is made from this run. The same gate commit adds the v3 constants stamp to evidence
manifests (`compatibility_boundary.v3`; pilot manifests refuse to validate without it — the
v3-M5 flag-1 action) and lifts the `bin/e4-v3.ts` pilot refusal (pilot is now `--live`-gated
exactly like calibration; the v2-M7 lift pattern).

**Predicates (three-arm form; contrasts exactly as `E4V3-PRODUCT-LOOP-PROPOSAL.md` §2
delegates to this pre-registration).**

- **(a) Arm-0 drifts:** prose-arm drift velocity > 0 on **every** surviving seed (carried
  verbatim).
- **(b) Boundary stamp:** every manifest stamps profile `e4-openspec-workflow-v2`, the v2
  constants hash `2f78f534…` + the five v2 boundary ids, **and** the v3 stamp block
  (`compatibility_boundary.v3`) with the v3 constants hash `aec35e3d…`, version `0.2`, and the
  seven v3 surface ids — all against the sealed constants identities.
- **(c) PRIMARY separation — the product claim, arm 0 vs arm p; ≥1 of, each empirically
  falsifiable:**
  - **(c1)** Arm-0 drift velocity `>` Arm-P drift velocity (means over surviving seeds; at
    n=6 a heuristic screen — no interval/CI claims).
  - **(c2)** Arm-0 false-confidence rate `>` Arm-P false-confidence rate — the **identical
    per-task binary event in every arm** (`false_confidence.event`: a `done` accepted by the
    arm's own acceptance procedure while the hidden ground-truth oracle fails), as rates over
    attempted tasks. `refused_done_over_red` and the product-gate refusal counts are reported
    diagnostics, never part of the predicate.
- **Verdict rule:** triggers first; then **go = (a) ∧ (b) ∧ (c)**. `[SEAL-CONFIRM]` The two
  remaining pre-registered contrasts are computed, printed, and reported but carry **no verdict
  weight** (the proposal names arm0-vs-armp "the product claim" — primary; making the verdict
  conjunctive across claims would conflate the product claim with the mechanism-isolation
  question):
  - **(d) SECONDARY — does the anti-cheat loop cause the difference, arm h vs arm p:** d1
    velocity contrast (armH > armP) and d2 false-confidence contrast (armH > armP), same forms
    as c1/c2.
  - **(e) REPLICATION readout of the v2 lineage, arm 0 vs arm h:** e1 velocity and e2
    false-confidence contrasts, same forms — read against M7/M8 in prose only (two-lens
    discipline; never pooled, divergence reported at face value).
- The per-arm floor-effect rule carries over at its sealed constants (task_index ≤ 3, 2
  consecutive zero-cumulative tasks, per arm, both prongs): a floor collapse blocks the
  H4-analog slope as floor-confounded; (c) is evaluated on the remaining comparisons (c1/c2
  never read that slope, so neither is removed by it).

**Interpretability triggers (§5.1 lineage carried; thresholds from the sealed v2 constants
`interpretability` block, never from code).** Any fired trigger ⇒
`inconclusive_uninterpretable`; a no-go may be claimed only when none fired:

1. **Insufficient valid data:** fewer than **2** complete, replay-valid paired seeds survive
   exclusions (a "paired seed" now requires all **three** arms complete + replay-valid).
   `[SEAL-CONFIRM]` At six-seed scale a single excluded seed no longer voids the run (unlike
   the 2-seed pilots, where any exclusion fired this trigger arithmetically). The sealed
   minimum (2) is carried unchanged from the frozen constants rather than invented anew; the
   report must state every exclusion and its reason, and predicates run over survivors only.
   The operator may demand a stricter floor at seal; approving as-is carries the sealed 2.
2. **Substrate not validated:** all three arms record drift velocity == 0 — read through the
   **spec_touch split** carried verbatim (universal zero with Arm-0 completing its spec phases
   normally = claim-safe "model keeps even an unexecuted spec truthful" branch; universal zero
   with widespread Arm-0 spec-phase stalls = H1-untested branch). The report must state which
   branch obtained.
3. **Instrument degraded:** `drift.extraction_failed == true` on more than 0.10 of non-aborted
   task records (pooled across all manifests).
4. **Protocol confusion, per executed arm:** `e4_arm_h` or `e4_arm_p` exhausts its budget while
   still spec-phase-gated on ≥ 0.50 of attempted tasks (the sealed
   `arm_h_spec_stall_max_fraction`, applied to each executed arm separately — the product
   gate's PM-review refusals keep the phase at spec, which is exactly this trigger's failure
   mode; two trigger rows, either fires the class).

Advisory flags carry over: (v) zero-denominator per-passing-task quantities reported as
"undefined at pilot scale", never coerced, per arm; (vi) max/min Arm-0 velocity ratio across
seeds > 3 ⇒ recommend more seeds in any full-run pre-registration.

## 3. Primary and secondary metrics

**Primary:** spec-side drift-episode-onset velocity per opportunity task, **arm 0 vs arm p** —
the quantity predicate (c1) reads.

**Pre-registered secondaries — reported per arm regardless of verdict:**

1. **False-confidence rate** per arm (all three) and each executed arm's gate-vs-oracle gap,
   with the §4 reporting commitment.
2. **Workspace-breakage rate**: arm-level fraction of complete tasks with
   `drift.extraction_failed == true` — directly observed, never censored.
3. **Kill score** (hidden bank — measured, **never a gate**, never fed back): per task per arm,
   read JOINTLY with the meter's contradiction channel (M5 instrument insight, carried). The
   pre-committed vacuous-spec signature stays: high false confidence + low kill + coverage-gap
   onsets together.
4. **Taxes in tokens per attempted task** (aborted excluded), with the v2 per-phase component
   split plus the v3 `pm_brief_tokens` component; **arm p's product-gate interaction cost lands
   in its freshness tax and is reported, not hidden** (proposal §3: that cost is part of the
   product story).
5. **Product-gate mechanism diagnostics (arm p):** per-task and totalled `pm_review_refusals`,
   `reconcile_refusals`, `mutation_refusals`, `pm_review_flags_total`,
   `reconcile_unavailable_count`, final reconcile finding counts, and mutation kill scores at
   each done-claim.
6. **ASK_PM usage per arm** (`pm_brief.requested`, first-turn index): who bothers to ask is
   itself a measurement (proposal §3.4); read against the v3-M5 mechanism observation (asked
   2/6, not on `add_entity`) with no pull.
7. **Ambiguity split (standing diagnostic):** drift and false-confidence figures split by
   determined vs underdetermined task facts, computed at report time via the sealed
   `e4-request-determinacy-v1` module over the drawn chains (a pure function of each seed — no
   manifest field required).
8. **Mandatory diagnostics:** class-composition and op-type attribution of drift;
   `green_novel` counts and red-check refusal outcomes; `refused_done_over_red` per arm;
   oracle end-states; archive outcomes across the MODIFIED-replace seam; scenario census;
   noticing-probe answers; per-seed reasoning-observability summary (active counts, burn
   range, accounting classification, truncation counts) feeding the §5 gate.

## 4. False-confidence reporting commitment (sealed upfront, all ways)

The v3-M5 calibration (non-evidence: single arm, single seed, `calibration` classification,
structurally excluded from this run's verdict) observed `false_confidence.event == true` on all
6 product-arm tasks with kill 1.0 and zero product-gate refusals — the gate's floors were
cleared while the hidden oracle failed 26/27–32/36. As at M7/M8, the report's treatment of this
axis is fixed now, before data, for whichever way it lands:

- **If arm-p false confidence is high** (calibration-like): the headline finding is that even
  the product-grade loop as exercised by this model was too weak to catch its own failures —
  reported with kill-score, coverage-gap, and reconcile corroboration, and reported **even if**
  (c1) simultaneously favors a go on drift velocity. A go on freshness does not license silence
  on weakness.
- **If arm-p false confidence is low while arm 0's (or arm h's) is high:** the finding is that
  the product loop caught false confidence that prose review / naked execution did not —
  reported with the same corroborating instruments.
- **The d2 direction is reported at face value either way** — including the uncomfortable
  branches (product gate no better than naked execution; or worse). The M8 inversion precedent
  binds: an inverted result is the finding, never a discrepancy to explain away.
- The v3-M5 and v2-M8 calibration observations are cited only as calibration-run observations
  (never pooled, never causal evidence); M7/M8 evidence figures exert **no pull** on this run's
  reporting (two-lens discipline extended: v3 is a third boundary, not a tiebreaker between
  them).

## 5. Validity gates

- Headline-eligible sequences require `chain_replay_valid: true` (recomputed at sequence close;
  re-verifiable via the v2 inspector, which replays the archive seam).
- `bun run e1:protect` (full triad) green **before and after** the run.
- The hidden oracle runs exactly once per task close in every arm (A9); the adversarial bank
  never gates and never feeds back (A1); the boundary-mutation harness feeds back only mutant
  descriptions on the agent's own code (arm p, by design — it reads no hidden truth).
- **Configuration validity (realistic / thinking-on) — carried verbatim from the M8 §5 gate,
  per seed.** Every live seed invocation writes `<runRoot>/reasoning-observability.json`
  (derived signals only). Sealed rules: (i) a seed whose recorded calls show `reasoning_content`
  absent on **more than 0.10** of live calls fails the stated thinking-on configuration;
  (ii) **any** call whose token accounting classifies `separate` or `indeterminate` means the
  sealed budget ledger can no longer be trusted as honest for that seed. Either event makes the
  seed **invalid for its stated configuration**: all three of its sequences are excluded (at
  six-seed scale this consumes headroom rather than automatically firing trigger 1 — §2 item 1).
  A seed that dies before the recorder emits is equally unevaluable and equally excluded.
  (Calibration baseline on this route: v3-M5 reasoning active 37/37, folded 37/37, zero
  truncation at 32k.) Truncation counts are a §3.8 diagnostic, not a gate.
- The v3-M5 calibration run, both v2-M8 GLM calibration sequences, and the M6 deepseek
  calibration are non-evidence and excluded from the verdict structurally (by classification);
  none shares a seed with this run. The M8 void manifests live in a folder the verdict tool is
  never pointed at.
- **M7, M8, and this run are three separate compatibility boundaries**: manifests are never
  pooled across them (predicate (b) enforces this run's double stamp; the v2 tool remains the
  M7/M8 instrument). Cross-boundary comparison happens only in prose, as separate Level-4
  claims per §8.
- Aborted (infrastructure-classified) records stay excluded per the ADR-005 pin. The harness
  has no sequence-resume path: a seed that crashes mid-chain is not rerun or patched — its
  three sequences are excluded and the survivor count falls; if fewer than the sealed minimum
  (2) survive, trigger 1 fires and the run lands `inconclusive_uninterpretable`, accepted
  rather than engineered around.
- **Hash-pinned surfaces that may not change between this seal and the run:** the v2 constants
  file (v0.3, `2f78f534…`) and its ten code twins; the v3 constants file (v0.2, `aec35e3d…`)
  and its eight code twins; the verdict tool `src/e4/v3/gonogo.ts`
  (`c56611189c68d1843e48439e2c925c88b07b7c1a7256652c4ae1979de52630c2`) and CLI
  `bin/e4-v3-gonogo.ts` (`df6637e4594d4b306a2b88fab18edb3b266609f24260e38d6ab7ac8546bdeccb`);
  the run CLI `bin/e4-v3.ts`
  (`403145e62b22b4124ae568de0501d81bcfee907e84af98fb5f496fca32ccc5a9`); the launch shim
  `bin/e4-v3-detach-shim.py`
  (`e871bbe6b92e0adcf4f99273d6c51a7144d68a311ffdedff5ea5afd1f4f1c934`).

## 6. Launch procedure (sealed — the v3-M5-validated headless-correct detachment)

**Rule: an evidence sequence must never run as a background task of an interactive session**
(the v2-M8 void-run lesson, binding). The M8 seal's `bash -m` job-control launch could not
verify headless (its recorded §7.1 deviation); this seal replaces it with the setsid-shim
mechanism **validated live at v3-M5** (`docs/e4/E4V3-M5-BUDGET-CALIBRATION-NOTES.md`), via the
committed, hash-pinned shim `bin/e4-v3-detach-shim.py`. Per seed (seed 36 shown; the other five
identical with `36` replaced in seed, run-root, log, and PID paths):

```
mkdir -p tmp/e4-v3-m6-pilot
bash -c 'nohup python3 bin/e4-v3-detach-shim.py /Users/acyment/dev/hit-sdd-bench \
  tmp/e4-v3-m6-pilot/seed-36.pid \
  bun run bin/e4-v3.ts --seed 36 --tasks 6 --live --classification pilot \
  --model glm-5.2 \
  --endpoint https://api.z.ai/api/paas/v4/chat/completions \
  --api-key-env ZHIPU_API_KEY \
  --pricing-in 1.4 --pricing-cached 0.26 --pricing-out 4.4 \
  --max-output-tokens 32000 \
  --run-root tmp/e4-v3-m6-pilot/seed-36 \
  </dev/null >>tmp/e4-v3-m6-pilot/seed-36.log 2>&1 &'
```

(No `--arms` → all three arms; no `--extra-body` → thinking ON at provider default effort; the
key lives in `.env`, which Bun auto-loads after the shim's `chdir`.)

Sealed properties, each verified immediately after launch, from **separate** calls:

1. **The launch call contains nothing but the detached launch and returns immediately** — no
   waits, no polling, no compound commands (the v3-M5 first-attempt incident, made binding).
2. **Own session + process group, no tty needed** — the shim `setsid()`s and `execvp`s, so the
   run process is the session leader and the PID file records the run process itself. Verify:
   `ps -o pid,ppid,pgid -p $(cat tmp/e4-v3-m6-pilot/seed-36.pid)` shows **pgid == pid AND
   PPID == 1** (the headless-correct check the M8 deviation note asked for).
3. **File-based monitoring only** — liveness via `kill -0 $(cat …pid)`; progress by polling the
   log tail and the run-root manifests. No session facility (task systems, notifications,
   wrappers) ever holds the process.
4. **Completion detection** — all three arm manifests reach `status: complete` with
   `chain_replay_valid` recomputed, and the log carries the runner's final prints. Only then is
   the §5 configuration-validity gate read from `reasoning-observability.json`, and **only
   after a seed fully closes and passes its gates is the next seed launched** (order:
   36 → 41 → 62 → 65 → 68 → 75).
5. **Fresh run roots** — `tmp/e4-v3-m6-pilot/…`, disjoint from every calibration and dry-run
   root.

A mid-run machine sleep is survivable (M7 precedent: the sealed provider retry ladder recovers)
and is not a deviation; a killed process is terminal per §5 (seed excluded, never rerun under
this seal).

## 7. Program discipline

No model-shopping and no seed-shopping: `glm-5.2` thinking-on on seeds 36/41/62/65/68/75 is the
run. An `inconclusive_uninterpretable` verdict halts E4 for design reassessment at a gate rather
than rerunning with different draws. A **no-go** — including the M8-style inversion, in any
contrast — is taken at face value and reported as a real finding under this task/model/budget.
A divergence from M7 or M8 on any axis is reported as boundaries disagreeing (each under its own
configuration and gate design), never grounds for rerunning, reconfiguring, or reconciling any
of the three. The d/e contrasts are reported whichever way they land; there is no framing under
which a "wrong-direction" secondary is omitted.

## 8. Claim language (AGENTS.md Industry-Facing Credibility, binding on the report and any public post)

- Classification is stated everywhere: **pilot**. The claim ceiling is ladder **Level 4**: "in a
  sealed three-arm pilot, the product-grade HIT-SDD loop (executable scenarios as the acceptance
  gate **plus** reconciliation, agent-code mutation testing, scenario floors, and PM review with
  a clarification channel) did / did not [keep the spec fresher | reduce false confidence]
  relative to [prose | naked execution] **under this task/model/budget**." No Level 5
  (generalized) claims; single-model results stay labeled single-model and preliminary.
- **The treatment is the LOOP, not naked execution** (proposal §3.4, binding): claim language
  must attribute any arm-p effect to the product bundle as a whole; the d contrast is the only
  instrument that speaks to the anti-cheat components' marginal contribution, and it is
  reported without verdict weight.
- **Three-boundary framing (binding).** M7 (deepseek-v4-pro, austere/thinking-off, v2 gate),
  M8 (glm-5.2, realistic/thinking-on, v2 gate), and this run (glm-5.2, realistic/thinking-on,
  v3 product loop) are three separate Level-4 claims, never pooled. No v3 seed shares a chain
  with M7/M8 evidence; no cross-run chain identity may be claimed.
- Preferred wording: "preliminary", "sealed task", "replay-valid", "under this
  task/model/budget", "calibration" (for all calibration context), "void run" (for the M8
  seed-22 attempt, never cited as a finding). Avoided wording: "proved", "validated" (strong
  sense), "solved", "benchmark shows the loop works", any unqualified "the product gate beats
  prose".
- The calibrations, dry runs, and the void run are never described as causal evidence. Provider
  anomalies flag the run rather than being narrated away; flat, null, or inverted results are
  reported, not hidden.
- Every public artifact points to replayable evidence: the manifests (committed under
  `docs/protocols/` per precedent), both constants hashes, and the verdict tool's printed
  report as the sole claim source.
- Per the operator's public-claim target, the public post frames the mechanism as a
  product-grade executable-spec loop inside a real OpenSpec workspace (shared-environment
  profile, all arms, PM-brief channel included) — not as a spec-format or
  framework-vs-framework comparison.

## 9. Gate-commit record (code accompanying this draft; no spend)

Committed together with this draft (all tested on dry-run manifests only; `e1:protect` green):

1. **v3 verdict tool** `src/e4/v3/gonogo.ts` + `bin/e4-v3-gonogo.ts` — the §2 predicates,
   triggers, reported contrasts, and diagnostics; `test/e4-v3-gonogo.test.ts` (6 tests over
   fake-agent three-arm dry-run manifests).
2. **v3 constants stamp** — `compatibility_boundary.v3` on the manifest
   (`src/e4/v2/manifest.ts` type + validation, `src/e4/v2/orchestrator.ts` stamping,
   `bin/e4-v3.ts` always passes it); pilot manifests refuse to validate without it (the v3-M5
   flag-1 action).
3. **Pilot-refusal lift** in `bin/e4-v3.ts` — pilot is now `--live`-gated exactly like
   calibration (the v2-M7 `3571a08` lift pattern; `test/e4-v3-m4.test.ts` updated to pin the
   lifted form).
4. **Sealed launch shim** `bin/e4-v3-detach-shim.py` (§6; the v3-M5 flag-2 action).

The v2 verdict tool, the v2/v3 constants files, and all eighteen code twins are byte-untouched.
