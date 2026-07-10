# E4 v2-M8 evidence run — pre-registration (v1)

**Status: SEALED 2026-07-10 (operator-reviewed and approved as-is; this commit is the sealing
act).** This document was drafted before any v2-M8 evidence data exists; it is now SEALED and
nothing below changes after launch. Deviations, if any, are recorded in the run
report as deviations — never edited in here. Naming and discipline follow the M7 precedent
(`e4-v2-m7-pilot-preregistration-v1.md`, itself following `e4-m7-pilot-preregistration-v1/v2`):
seeds, predicates, and interpretation are fixed here, pre-data, and the verdict tool is the only
claim source.

**Authorization record.** Operator directive (2026-07-10, this session): "E4 v2-M8 step 5:
draft the §7 pre-registration for the GLM 5.2 thinking-on pilot. Docs-only — no live calls, no
spend … The evidence run is NOT authorized by this step; sealing the prereg is a separate
operator act after my review." This document is therefore neither the seal (until the operator
commits it) nor the spend authorization. **The run itself is NOT authorized.** Unlike M7, no
code accompanies the seal: the `bin/e4-v2.ts` pilot refusal was already lifted at the M7 gate
commit (`3571a08` — pilot is now gated like calibration, `--live` required) and the v2 verdict
tool already exists and is tested (§2). The only remaining gate before launch is the operator's
explicit run authorization.

**Two-lens framing (binding, from the scoping doc §1).** M8 is deliberately **not** a strict
replication of M7. M7 is the **austere / thinking-off** lens (deepseek-v4-pro, thinking
disabled); M8 is the **realistic / thinking-on** lens (glm-5.2 in its default reasoning
configuration — how a frontier coding agent is actually run). They are two separate Level-4
single-model pilots under their own task/model/budget boundaries, **never pooled** (the verdict
tool refuses cross-boundary pooling). If both show the same pattern, that is stated as two
Level-4 claims side by side; if they **diverge**, the divergence is itself a clean, publishable
Level-4 finding and is reported at face value.

## 1. Run identity

| Field | Value |
| --- | --- |
| Design | 1 substrate config × 2 arms × 2 seeds × 6 tasks = **24 task-runs** |
| `run_classification` | `pilot` (the program's second frontier evidence run; claim ceiling per §7) |
| Protocol profile | `e4-openspec-workflow-v1` (shared-environment: both arms in the same OpenSpec workspace, harness-run archive step identical in both arms; never a condition ID) |
| Substrate | `procedural-rest-v2` / `v2-default` |
| Constants | **v0, FULLY FROZEN at v2-M8**: version 0.3, full-file sha256 `2f78f53479e300ef4eb7ee654283dba26a9095cf252b661d20deb51232b5e11c` — every manifest must stamp this hash. (The committed v2-M7 evidence manifests stamp the historical v0.2 hash `d762bacc…`; the two runs are separate compatibility boundaries.) |
| Compatibility boundary (frozen ids, stamped per manifest) | meter `e4-drift-meter-v2`, converter `e4-openspec-gherkin-v1`, step table `e4-step-table-v1`, T0 gold spec `e4-t0-gold-spec-v1`, bank `e4-adversarial-bank-v1` |
| Budgets (ratified v2-M8 §6 calibration, GLM's own freeze event) | 27 turns / 12 verifications / 490,000 tokens per task; $5 spend cap per sequence |
| Model | `glm-5.2`, z.ai direct endpoint `https://api.z.ai/api/paas/v4/chat/completions` (general paas/v4, not the coding endpoint; `direct-openai-compatible` / `direct-zhipu-api-key`, key env `ZHIPU_API_KEY`) |
| Thinking configuration | **ON** — empty request extras (never `thinking:{type:"disabled"}`), `reasoning_effort` at the provider default **`max`** (the §6-calibration-ratified answer to scoping open question 1) |
| `max_tokens` | **32000** (reasoning-headroom value ratified at §6 calibration; scoping open question 2) |
| Temperature | E1 provider sealed default **0.2**, no CLI override — the identical on-wire value as M7 and both calibrations (parity by construction: `bin/e4-v2.ts` exposes no temperature flag) |
| Pricing (cap guardrail) | conservative overestimates in/cached/out **1.4 / 0.26 / 4.4** USD/M (≥ the z.ai published 1.40/0.26/4.40; the M7 deepseek values 0.5/0.05/2.0 are not reused) |
| Configuration label | **realistic / thinking-on** (M7: austere / thinking-off) |
| Reasoning validity instrument | the recording transport wired at `4f7e1ed` (derived signals only, never raw bodies) writes `<runRoot>/reasoning-observability.json` per sequence; the scoping-§4 checks (reasoning active / accounting folded) become the §5 configuration-validity gate |
| Seeds | **22 and 60** (reused from the M7 seal — decision and rationale below) |
| Pairing labels | `pair-pilot-seed-22`, `pair-pilot-seed-60` |
| Arms | `e4_arm_0` (prose: scenarios never executed), `e4_arm_h` (executed: scenarios are the gate) — one shared budget set; the arm delta flows only through the declared policy channel (`src/e4/v2/arm-policy.ts`: scenario execution as feedback), identical workspace, custody floors, archive step, and provider in both arms |
| Expected spend | ≈ $1.5–4 total (M8 ratifying calibration observed $0.618 for one full Arm-H sequence thinking-on; 4 sequences here; M7's per-sequence spread was $0.11–0.42 on the cheaper model). Hard ceiling: 4 × the sealed $5 per-sequence cap |

All live parameters above are **identical to the v2-M8 §6 ratifying calibration run** (run 2,
`docs/protocols/e4-v2-m8-glm-calibration-manifest-20260710-001.json`) — the same discipline as
M7's parameter-identity with its M6 calibration.

**Model-id decision.** The v0.3 budgets were ratified from `glm-5.2`'s observed appetite
**thinking-ON** on this exact direct route, and transfer only to that exact model id in that
exact thinking configuration on that route (calibration-notes pin, same discipline as the v0.2
deepseek pin). This run uses exactly that model, configuration, and route. GLM 5.2 is the
operator-designated second-model candidate (chosen 2026-07-09 for audience recognition; the
pre-decided qwen-3.7-max fallback was never triggered and dies at sealing per §6).

**Seed decision: reuse 22 and 60.** The scoping doc (§7.2) recommended reuse and required the
decision to be recorded either way. Decided: **reuse**, for three reasons.

1. **Chain identity across the two lenses.** Substrate generation is a pure deterministic
   function of (seed, task_count, sealed op-mix weights) — the model and its thinking
   configuration play no part in the draw. Reusing 22/60 therefore gives M8 task chains
   **identical** to M7's, so any agreement or divergence between the two pilots attributes to
   the model-plus-configuration, not to chain luck. Since the pilots are never pooled,
   cross-pilot statistical independence buys nothing at this scale, while chain identity buys
   direct interpretability — exactly the two-lens purpose.
2. **The seeds are clean for this model.** Nothing was ever tuned on their draws for GLM: both
   GLM calibration sequences ran seed 37, and 22/60 are not dry-run or unit fixtures. Every
   exclusion in the M7 seal's list applies unchanged here and 22/60 remain outside it.
3. **Reuse is the only post-M7 choice that requires no new judgment.** M7's per-seed outcomes
   are now known (seed 22 produced an enforced-gate regime, seed 60 a green-and-weak regime).
   Any *fresh* selection made today would be made with that knowledge in hand and would invite
   a "picked after seeing M7" critique; verbatim reuse of the pre-M7, deterministically-probed
   selection inherits its sealed pre-data status.

The independence counter-argument (fresh seeds would give an independent draw, guarding against
idiosyncratic chains) is recorded and rejected: M8 is a complementary lens, not an independent
replication, and the claims are never pooled. Known consequence, accepted in advance: on seed 22
the M7 executed arm hit the 490k token wall on 4/6 tasks; if GLM does the same, that is data
(the calibration suggests otherwise — GLM thinking-on burned less than deepseek thinking-off).

**Seed compositions (carried verbatim from the M7 seal — identical by construction):**

- seed 22: add_field (additive) | modify_convention (drift) | add_validation_rule (additive) |
  rename_entity (drift) | delete_field (drift) | noop_maintenance (**BP, task 6**) — drift 3 /
  additive 2 / BP 1, six distinct op kinds, exercises the rename-lineage path.
- seed 60: rename_field (drift) | add_validation_rule (additive) | noop_maintenance (**BP,
  task 3**) | add_entity (additive) | retype_field (drift) | delete_entity (drift) — drift 3 /
  additive 2 / BP 1, six distinct op kinds, exercises the §5.5 retirement-tombstone path
  (delete_entity) under a live model.

Together the pair covers ten distinct op kinds; not covered are `add_endpoint`,
`add_relationship`, and `modify_endpoint` — all three were exercised live **on this model** in
the M8 §6 calibration sequence (recorded as coverage context, not evidence).

**Excluded seeds, with rationale (M7 list carried; all rationales still hold for M8).**
(i) **37** — the calibration seed for both the M6 deepseek and the M8 GLM ratifications: the
GLM budget walls were observed and the v0.3 values ratified on its exact draw; reusing it would
flavor the evidence run with budget overfitting. (ii) **45 and 50** — v2 dry-run fixtures
(`bin/e4-v2.ts` default; `test/e4-v2-dryrun.test.ts`). (iii) **0, 42, 43** — v2 unit-test
fixture seeds. (iv) **46, 49, 52** — the v1 pilot seeds (different substrate; cross-version
reuse invites a pooling/familiarity critique at zero cost to avoid).

## 2. Pre-registered analysis and decision rule

**Analysis layer (carried verbatim from the M7 seal).** Drift velocity is the committed v1
episode-onset semantics operating unchanged on the v2 meter's discrepancy lists
(`src/e4/result-schema.ts`: episodes keyed `(semantic_item_uid, direction)`, onset transitions,
rename-lineage merge, convention aggregation; velocity = onsets per opportunity task; design
§7.5 pins that these semantics carry over). Aborted task records are excluded from every
numerator and denominator (ADR-005 pin).

**Verdict tool (delta from M7: the tool now exists).** The v2 verdict tool
(`src/e4/v2/gonogo.ts` / `bin/e4-v2-gonogo.ts`) was built and tested against fake-agent dry-run
manifests before any live manifest existed (M7 gate commit `3571a08`) and produced the M7
verdict. It runs **unchanged** over the M8 manifest folder with its default constants path
(which now resolves to the frozen v0.3 file); no port, no edits, zero interpretive freedom. It
is covered by the §5 hash-pin rule: the tool and every sealed module may not change between
this seal and the run. Exit semantics unchanged: interpretability triggers run first; exit 0 =
**go**, 1 = **no-go** (prints which predicate), 2 = **`inconclusive_uninterpretable`** (prints
which trigger; predicates still printed for diagnosis but carrying no claim). No claim beyond
the printed report is made from this run. (For any historical re-run of the M7 verdict, pass
`--constants` pointing at the archived v0.2 file — the M7 boundary is not this boundary.)

**Predicates (two-arm form, carried verbatim from the M7 seal; only the (b) hash moves to the
current frozen constants).**

- **(a) Arm-0 drifts:** prose-arm drift velocity > 0 on **every** surviving seed.
- **(b) Boundary stamp:** every manifest stamps constants hash
  `2f78f53479e300ef4eb7ee654283dba26a9095cf252b661d20deb51232b5e11c`, meter
  `e4-drift-meter-v2`, and the §1 compatibility-boundary ids.
- **(c) Separation — ≥1 of, each empirically falsifiable:**
  - **(c1)** Arm-0 drift velocity `>` Arm-H drift velocity (at n=2 seeds a heuristic screen —
    no interval/CI claims).
  - **(c2)** Arm-0 false-confidence rate `>` Arm-H false-confidence rate, the **identical
    per-task binary event in both arms** (`false_confidence.event`: a `done` accepted by the
    arm's own acceptance procedure while the hidden ground-truth oracle fails), as rates over
    attempted tasks. *Recorded rationale for the adaptation (carried):* v1's c2 compared
    ungated false-confidence against Arm-H **refusals** because a v1 Arm-H acceptance was
    near-oracle by construction; in v2 the executed arm's gate is the agent's own scenarios, so
    false confidence is well-defined and live in **both** arms (observed in Arm H in every
    calibration on both models), making the symmetric comparison both fairer and falsifiable in
    either direction. `refused_done_over_red` counts are retained as a reported diagnostic,
    never part of the predicate. v1's c3 (Arm-M spec-freshness leak) is retired with the arm.
- The per-arm floor-effect rule carries over at its sealed constants (`floor_effect`:
  task_index ≤ 3, 2 consecutive zero-cumulative tasks, per arm): if the H4-analog slope is
  floor-blocked, (c) is evaluated on the remaining comparisons.

**Interpretability triggers (§5.1 carried verbatim; thresholds sealed in constants v0.3
`interpretability` — numerically identical to v0.2, only the budgets-block-adjacent version
moved).** Any fired trigger ⇒ `inconclusive_uninterpretable`; a no-go may be claimed only when
none fired:

1. **Insufficient valid data:** fewer than 2 complete, replay-valid paired seeds survive
   exclusions — at this scale (2 seeds), **any** excluded paired seed fires it.
2. **Substrate not validated:** all arms record drift velocity == 0 — read through the
   **spec_touch split** (carried from the qwen pre-registration §2.1, v2-adapted): universal
   zero **with Arm-0 completing its spec phases normally** (spec_touch on ≥ half its complete
   tasks) = "the model keeps even an unexecuted spec truthful under this workflow" — a real,
   claim-safe finding about this model class on this substrate, not an instrument failure;
   universal zero **with widespread Arm-0 spec-phase stalls / low spec_touch** = the original
   reading (H1 untested; substrate/workflow mismatch). *v2 note, sealed (carried):* v2 custody
   floors force spec changes in both arms on non-behavior-preserving tasks, so high Arm-0
   `spec_touch` is expected by construction on complete tasks; the split therefore
   discriminates on whether the zero-velocity arm actually flowed through the workflow, not on
   voluntary spec upkeep as in v1. The report must state which branch obtained and why.
3. **Instrument degraded:** `drift.extraction_failed == true` on more than 0.10 of non-aborted
   task records.
4. **Arm-H protocol confusion:** Arm H exhausts its budget while still spec-phase-gated on
   ≥ 0.50 of attempted tasks.

Advisory flags (v)/(vi) carry over (zero-denominator per-passing-task quantities reported as
"undefined at pilot scale", never coerced; max/min Arm-0 velocity ratio across seeds > 3 ⇒
recommend more seeds in any full-run pre-registration).

## 3. Primary and secondary metrics

**Primary:** spec-side drift-episode-onset velocity per opportunity task, Arm-0 vs Arm-H —
the quantity the predicates read.

**Pre-registered secondaries — reported per arm regardless of verdict (carried verbatim):**

1. **False-confidence rate** per arm and the executed arm's gate-vs-oracle gap (tasks where the
   agent's own gate was green while the hidden oracle failed), with the §4 reporting
   commitment.
2. **Workspace-breakage rate** (carried from the qwen pre-registration §2.2): arm-level
   fraction of complete tasks with `drift.extraction_failed == true` — directly observed, never
   censored.
3. **Kill score** (design §7 — measured, hidden, **never a gate**): per task per arm, with
   per-variant verdicts and the sequence trajectory. The pre-committed vacuous-spec signature is
   high false-confidence + low kill score + coverage-gap onsets appearing together; kill score
   alone carries no verdict weight in either direction, and is read jointly with the meter's
   contradiction channel (M5 instrument insight, carried).
4. **Taxes in tokens per attempted task** (v1 §3.1 semantics; aborted excluded), using the v2
   per-phase component split (spec-authoring / gate-protocol-interaction / oracle-feedback
   tokens), with pass rates alongside.
5. **Mandatory diagnostics:** class-composition and op-type attribution of drift; `green_novel`
   counts and red-check refusal outcomes; `refused_done_over_red` counts; oracle end-states;
   archive outcomes across the MODIFIED-replace seam; scenario census (spec-of-record size,
   unbindable count); noticing-probe answers; **and (M8 addition) the per-sequence
   reasoning-observability summary** — reasoning-active call counts, per-call reasoning-token
   burn range, accounting classification, truncation (`finish_reason: "length"`) counts —
   reported per arm as configuration diagnostics feeding the §5 gate.

## 4. False-confidence reporting commitment (sealed upfront, both ways)

The v2-M8 §6 calibration (non-evidence: single arm, single seed, `calibration` classification,
structurally excluded from this run's verdict) observed `false_confidence.event == true` on
**all 6 tasks in both calibration sequences** with kill score 1.0 and zero
`refused_done_over_red` — the executed arm's own gate accepted `done` on a green scenario set
while the hidden oracle failed (23/27 or 32/36) — the same signature the deepseek M6
calibration showed. The design pre-declared this pattern a **headline outcome** (§6.5: "the
executable spec was too weak to catch the lie"). To remove any post-hoc framing freedom, the
report's treatment of this axis is fixed now, before data, for **whichever way it lands**:

- **If Arm-H false confidence is high** (calibration-like): the headline finding is that
  executable scenarios as authored by this model were too weak to catch its own failures —
  reported with the kill-score and coverage-gap corroboration, and reported **even if** (c1)
  simultaneously favors a go on drift velocity. A go on freshness does not license silence on
  weakness.
- **If Arm-H false confidence is low while Arm-0's is high:** the finding is that executing the
  spec caught false confidence that prose review did not — reported with the same corroborating
  instruments.
- In both cases the M8 calibration observation is cited only as a calibration-run observation
  (never pooled, never described as causal evidence), and the false-confidence contrast (c2)
  carries verdict weight only through the §2 predicate as pinned.

*Cross-lens note, sealed now:* the M7 run discharged the first branch for the thinking-off lens
(Arm-H false confidence high, 7/12, with kill 1.0 — true-but-insufficient coverage). That
outcome exerts **no pull** on this run's reporting: whichever branch obtains here is reported at
face value, and if M8 lands on the *other* branch, that divergence is itself the finding (§6,
two-lens framing) — not a discrepancy to explain away.

## 5. Validity gates

- Headline-eligible sequences require `chain_replay_valid: true` (recomputed at sequence close;
  re-verifiable via the v2 inspector).
- `bun run e1:protect` (full triad) green **before and after** the run.
- The hidden oracle runs exactly once per task close in both arms (A9); the adversarial bank
  never gates and never feeds back (A1 ecological-validity pin).
- **Configuration validity (realistic / thinking-on) — the scoping-§4 checks as evidence-run
  gates.** Every live sequence writes `<runRoot>/reasoning-observability.json` (derived signals
  only) via the recording transport wired at `4f7e1ed`. Sealed rules: (i) a sequence whose
  recorded calls show `reasoning_content` absent on **more than 0.10** of live calls fails the
  stated thinking-on configuration (threshold mirrors the sealed instrument-degraded style; a
  rare single-call absence on a trivial turn does not falsify a request-level configuration);
  (ii) **any** call whose token accounting classifies `separate` or `indeterminate` (per
  `classifyReasoningTokenAccounting`) means the sealed budget ledger can no longer be trusted
  as honest for that sequence. Either event makes the sequence **invalid for its stated
  configuration**: its paired seed is excluded, which at this scale fires interpretability
  trigger 1 — accepted rather than engineered around, and reported, never narrated away.
  (Calibration baseline on this route: reasoning active 35/35 calls, folded 35/35, zero
  truncation at 32k.) Truncation counts are a §3.5 diagnostic, not a gate.
- The M8 §6 calibration runs (both seed-37 GLM sequences) and the M6 deepseek calibration are
  non-evidence and excluded from the verdict structurally (by classification); they share no
  seed with this run.
- **The M7 evidence run is a separate compatibility boundary** (different model, different
  constants hash): its manifests are never pooled with this run's — the verdict tool refuses
  cross-boundary pooling (exit 3). Cross-lens comparison happens only in prose, as two separate
  Level-4 claims per §7.
- Aborted (infrastructure-classified) records stay excluded per the ADR-005 pin. The v2 harness
  has no sequence-resume path: a sequence that crashes mid-chain is not rerun or patched — its
  paired seed is excluded, which at this scale fires interpretability trigger 1 and the run
  lands `inconclusive_uninterpretable`. That outcome is accepted rather than engineered around.
- The verdict tool, the constants file (v0.3), code twins, meter, converter, step table, gold
  spec, and bank are all hash-pinned and may not change between this seal and the run.

## 6. Program discipline (carried, extended for the second lens)

No model-shopping and no seed-shopping: `glm-5.2` **thinking-on** on seeds 22 and 60 is the
run. **The scoping-§8 qwen-3.7-max fallback dies at the moment of sealing** — after this seal
no substitution exists at any stage. An `inconclusive_uninterpretable` verdict — any trigger —
halts E4 for design reassessment at a gate rather than rerunning with different draws. A
**no-go** (the frontier model keeps its spec fresh even in the prose arm, or no separation) is
taken at face value and reported as a real finding under this task/model/budget. **A divergence
from the M7 result — in either direction, on any axis — is likewise taken at face value**: it
is reported as the two lenses disagreeing, which is itself the publishable finding; it is never
grounds for rerunning, reconfiguring, or reconciling either pilot.

## 7. Claim language (AGENTS.md Industry-Facing Credibility, binding on the report and any public post)

- Classification is stated everywhere: **pilot**. The claim ceiling is ladder **Level 4**: "in a
  sealed two-arm pilot, executing the spec's scenarios as the acceptance gate did / did not
  [keep the spec fresher | reduce false confidence] **under this task/model/budget**." No
  Level 5 (generalized) claims; single-model results stay labeled single-model and preliminary.
- **Two-lens framing (binding).** The M7 and M8 pilots are stated as **two separate Level-4
  claims**, each tagged with its configuration — M7: deepseek-v4-pro, austere / thinking-off;
  M8: glm-5.2, realistic / thinking-on — and never pooled. "Two frontier models, same pattern"
  is publishable only as those two claims side by side, or as an explicitly-preliminary general
  statement per AGENTS.md. If the lenses diverge, the divergence is reported at face value as a
  finding (it directly answers the "you crippled the model" critique in whichever direction it
  points).
- Preferred wording: "preliminary", "sealed task", "replay-valid", "under this
  task/model/budget", "calibration" (for M6/M8-calibration context), "not clean primary
  evidence" (for anything flagged). Avoided wording: "proved", "validated" (strong sense),
  "solved", "benchmark shows feedback works", any unqualified "executable specs beat prose".
- The calibrations and the v2 dry-runs are never described as causal evidence. Provider
  anomalies, if any, flag the run rather than being narrated away; flat or null results are
  reported, not hidden.
- Every public artifact points to replayable evidence: the manifests (committed under
  `docs/protocols/` per M6/M7 precedent), the constants hash, and the verdict tool's printed
  report as the sole claim source.
- Per the operator's public-claim target, the public post frames the mechanism as executable
  acceptance feedback on an agent-authored spec inside a real OpenSpec workspace (shared-
  environment profile, both arms) — not as a spec-format or framework-vs-framework comparison.
