# E4 v2-M7 evidence run — pre-registration (v1)

**Status: SEALED before launch.** Committed before any v2 evidence data exists; nothing below
changes after launch. Deviations, if any, are recorded in the run report as deviations — never
edited in here. Naming and discipline follow the v1 precedents
(`e4-m7-pilot-preregistration-v1.md`, `e4-m7-pilot-preregistration-v2.md`): seeds, predicates,
and interpretation are fixed here, pre-data, and the verdict tool is the only claim source.

**Authorization record.** Operator directive (2026-07-09, this session): "Implement E4 v2-M7
pre-registration (docs only, no spend, no code) … STOP after the pre-registration is committed
and ask me to review and explicitly authorize the run." This document is therefore the SEAL, not
the spend authorization. **The run itself is NOT yet authorized.** The `bin/e4-v2.ts`
pilot-classification refusal stays in force until the operator explicitly authorizes execution;
lifting that refusal is the gate action of the authorized execution commit (v1 precedent, where
guard removal accompanied the pre-registration, adapted to this two-step gate on operator
instruction).

## 1. Run identity

| Field | Value |
| --- | --- |
| Design | 1 substrate config × 2 arms × 2 seeds × 6 tasks = **24 task-runs** |
| `run_classification` | `pilot` (the program's frontier evidence run; claim ceiling per §7) |
| Protocol profile | `e4-openspec-workflow-v1` (shared-environment: both arms in the same OpenSpec workspace, harness-run archive step identical in both arms; never a condition ID) |
| Substrate | `procedural-rest-v2` / `v2-default` |
| Constants | **v0, FULLY FROZEN at v2-M6**: version 0.2, full-file sha256 `d762bacc126618d086cea6416b1ec4d8f87d561a5bb366e4a0a8149d0e06836b` — every manifest must stamp this hash |
| Compatibility boundary (frozen ids, stamped per manifest) | meter `e4-drift-meter-v2`, converter `e4-openspec-gherkin-v1`, step table `e4-step-table-v1`, T0 gold spec `e4-t0-gold-spec-v1`, bank `e4-adversarial-bank-v1` |
| Budgets (ratified v2-M6 Part B) | 27 turns / 12 verifications / 490,000 tokens per task; $5 spend cap per sequence |
| Model | `deepseek-v4-pro`, direct endpoint `https://api.deepseek.com/chat/completions` (`direct-openai-compatible` / `direct-deepseek-api-key`), thinking disabled, `max_tokens` 16000, conservative pricing overestimates for the cap guardrail (in/cached/out 0.5/0.05/2.0 USD/M) — **identical parameters to the v2-M6 Part B calibration** |
| Seeds | **22 and 60** (declared here, before launch; selection and exclusions below) |
| Pairing labels | `pair-pilot-seed-22`, `pair-pilot-seed-60` |
| Arms | `e4_arm_0` (prose: scenarios never executed), `e4_arm_h` (executed: scenarios are the gate) — one shared budget set; the arm delta flows only through the declared policy channel (`src/e4/v2/arm-policy.ts`: scenario execution as feedback), identical workspace, custody floors, archive step, and provider in both arms |
| Expected spend | ≈ $0.5–1.5 total (M6 observed $0.128 for one full Arm-H sequence; 4 sequences here). Hard ceiling: 4 × the sealed $5 per-sequence cap |

**Model-id decision.** The v2-M6-frozen budgets were ratified from `deepseek-v4-pro`'s observed
appetite and transfer only to that exact model id on the same direct-endpoint route (M6 Part B
pin). This run uses exactly that model and route. It is the operator-designated frontier model
for the v2 evidence run (design §2, operator decision recorded there).

**Seed decision.** Seeds 22 and 60 were selected before launch by deterministic composition
probe (zero spend: substrate generation only, seeds 1–120 at `task_count=6` under the sealed
op-mix weights), using the same health criteria as the M6 calibration probe — balanced draw
(≥2 drift-opportunity, ≥1 additive, exactly 1 behavior-preserving task), maximal distinct op
kinds — plus the qwen-precedent criterion that the two seeds place the behavior-preserving task
differently (end vs mid-chain affirmation):

- seed 22: add_field (additive) | modify_convention (drift) | add_validation_rule (additive) |
  rename_entity (drift) | delete_field (drift) | noop_maintenance (**BP, task 6**) — drift 3 /
  additive 2 / BP 1, six distinct op kinds, exercises the rename-lineage path.
- seed 60: rename_field (drift) | add_validation_rule (additive) | noop_maintenance (**BP,
  task 3**) | add_entity (additive) | retype_field (drift) | delete_entity (drift) — drift 3 /
  additive 2 / BP 1, six distinct op kinds, exercises the §5.5 retirement-tombstone path
  (delete_entity) under a live model.

Together the pair covers ten distinct op kinds; not covered are `add_endpoint`,
`add_relationship`, and `modify_endpoint` (all three were exercised live on this model in the
M6 calibration sequence — recorded as coverage context, not evidence).

**Excluded seeds, with rationale.** (i) **37** — the M6 calibration seed: the budget walls were
observed and the frozen values ratified on its exact draw; reusing it would flavor the evidence
run with budget overfitting (excluded by designation in the M6 notes). (ii) **45 and 50** —
touched by the v2 dry-run fixtures (45 is the `bin/e4-v2.ts` dry-run default; 50 is the
`test/e4-v2-dryrun.test.ts` integration seed). They carry no tuning bias — nothing was adjusted
to them — but fresh seeds cost nothing and remove any "observed before sealing" critique
surface. (iii) **0, 42, 43** — v2 unit-test fixture seeds (workspace/gold-spec/live-calibration
tests), same cleanliness rationale. (iv) **46, 49, 52** — the v1 pilot seeds (flash and
qwen-plus). They index a different substrate (`procedural-rest-v1`), so their draws do not
transfer, but cross-version seed reuse invites a pooling/familiarity critique at zero cost to
avoid.

## 2. Pre-registered analysis and decision rule

**Analysis layer.** Drift velocity is the committed v1 episode-onset semantics operating
unchanged on the v2 meter's discrepancy lists (`src/e4/result-schema.ts`: episodes keyed
`(semantic_item_uid, direction)`, onset transitions, rename-lineage merge, convention
aggregation; velocity = onsets per opportunity task; design §7.5 pins that these semantics carry
over). Aborted task records are excluded from every numerator and denominator (ADR-005 pin).

**Verdict tool.** No v2 verdict tool exists at sealing time. It will be a port of
`src/e4/gonogo.ts` (`computeE4GoNoGo`) onto the v2 manifest — the disposition the design pins
for the verdict layer ("carry over; field additions only", §3) — with the two-arm predicates
**exactly as pinned below**, leaving the port zero interpretive freedom. It must be built and
tested against existing fake-agent dry-run manifests **before any live manifest exists**, in the
same operator-authorized gate commit that lifts the `bin/e4-v2.ts` pilot refusal. Exit semantics
carry over unchanged: interpretability triggers run first; exit 0 = **go**, 1 = **no-go**
(prints which predicate), 2 = **`inconclusive_uninterpretable`** (prints which trigger;
predicates still printed for diagnosis but carrying no claim). No claim beyond the printed
report is made from this run.

**Predicates (two-arm form).** The v1 predicates with the Arm-M leg retired (the instruction
arm was dropped as observed-inert; design §2):

- **(a) Arm-0 drifts:** prose-arm drift velocity > 0 on **every** surviving seed.
- **(b) Boundary stamp:** every manifest stamps constants hash
  `d762bacc126618d086cea6416b1ec4d8f87d561a5bb366e4a0a8149d0e06836b`, meter
  `e4-drift-meter-v2`, and the §1 compatibility-boundary ids.
- **(c) Separation — ≥1 of, each empirically falsifiable:**
  - **(c1)** Arm-0 drift velocity `>` Arm-H drift velocity (at n=2 seeds a heuristic screen —
    no interval/CI claims).
  - **(c2)** Arm-0 false-confidence rate `>` Arm-H false-confidence rate, the **identical
    per-task binary event in both arms** (`false_confidence.event`: a `done` accepted by the
    arm's own acceptance procedure while the hidden ground-truth oracle fails), as rates over
    attempted tasks. *Recorded rationale for the adaptation:* v1's c2 compared ungated
    false-confidence against Arm-H **refusals** because a v1 Arm-H acceptance was near-oracle by
    construction; in v2 the executed arm's gate is the agent's own scenarios, so false
    confidence is well-defined and live in **both** arms (the M6 calibration observed it in
    Arm H), making the symmetric comparison both fairer and falsifiable in either direction.
    `refused_done_over_red` counts are retained as a reported diagnostic, never part of the
    predicate. v1's c3 (Arm-M spec-freshness leak) is retired with the arm.
- The per-arm floor-effect rule carries over at its sealed constants (`floor_effect`:
  task_index ≤ 3, 2 consecutive zero-cumulative tasks, per arm): if the H4-analog slope is
  floor-blocked, (c) is evaluated on the remaining comparisons.

**Interpretability triggers (§5.1 carried; thresholds sealed in constants v0.2
`interpretability`).** Any fired trigger ⇒ `inconclusive_uninterpretable`; a no-go may be
claimed only when none fired:

1. **Insufficient valid data:** fewer than 2 complete, replay-valid paired seeds survive
   exclusions — at this scale (2 seeds), **any** excluded paired seed fires it.
2. **Substrate not validated:** all arms record drift velocity == 0 — read through the
   **spec_touch split** (carried from the qwen pre-registration §2.1, v2-adapted): universal
   zero **with Arm-0 completing its spec phases normally** (spec_touch on ≥ half its complete
   tasks) = "the model keeps even an unexecuted spec truthful under this workflow" — a real,
   claim-safe finding about this model class on this substrate, not an instrument failure;
   universal zero **with widespread Arm-0 spec-phase stalls / low spec_touch** = the original
   reading (H1 untested; substrate/workflow mismatch). *v2 note, sealed now:* v2 custody floors
   force spec changes in both arms on non-behavior-preserving tasks, so high Arm-0 `spec_touch`
   is expected by construction on complete tasks; the split therefore discriminates on whether
   the zero-velocity arm actually flowed through the workflow, not on voluntary spec upkeep as
   in v1. The report must state which branch obtained and why.
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

**Pre-registered secondaries — reported per arm regardless of verdict:**

1. **False-confidence rate** per arm and the executed arm's gate-vs-oracle gap (tasks where the
   agent's own gate was green while the hidden oracle failed), with the §4 reporting commitment.
2. **Workspace-breakage rate** (carried from the qwen pre-registration §2.2): arm-level
   fraction of complete tasks with `drift.extraction_failed == true` — directly observed, never
   censored.
3. **Kill score** (design §7 — measured, hidden, **never a gate**): per task per arm, with
   per-variant verdicts and the sequence trajectory. The pre-committed vacuous-spec signature is
   high false-confidence + low kill score + coverage-gap onsets appearing together; kill score
   alone carries no verdict weight in either direction.
4. **Taxes in tokens per attempted task** (v1 §3.1 semantics; aborted excluded), using the v2
   per-phase component split (spec-authoring / gate-protocol-interaction / oracle-feedback
   tokens), with pass rates alongside.
5. **Mandatory diagnostics:** class-composition and op-type attribution of drift; `green_novel`
   counts and red-check refusal outcomes; `refused_done_over_red` counts; oracle end-states;
   archive outcomes across the MODIFIED-replace seam; scenario census (spec-of-record size,
   unbindable count); noticing-probe answers.

## 4. False-confidence reporting commitment (sealed upfront)

The v2-M6 calibration run (non-evidence: single arm, single seed, `calibration` classification,
structurally excluded from this run's verdict) observed `false_confidence.event == true` on all
6 tasks with kill score 1.0 — the executed arm's own gate accepted `done` on a green scenario
set while the hidden oracle failed. The design pre-declared this pattern a **headline outcome**
(§6.5: "the executable spec was too weak to catch the lie"). To remove any post-hoc framing
freedom, the report's treatment of this axis is fixed now, before data, for **whichever way it
lands**:

- **If Arm-H false confidence is high** (calibration-like): the headline finding is that
  executable scenarios as authored by this model were too weak to catch its own failures —
  reported with the kill-score and coverage-gap corroboration, and reported **even if** (c1)
  simultaneously favors a go on drift velocity. A go on freshness does not license silence on
  weakness.
- **If Arm-H false confidence is low while Arm-0's is high:** the finding is that executing the
  spec caught false confidence that prose review did not — reported with the same corroborating
  instruments.
- In both cases the M6 observation is cited only as a calibration-run observation (never pooled,
  never described as causal evidence), and the false-confidence contrast (c2) carries verdict
  weight only through the §2 predicate as pinned.

## 5. Validity gates

- Headline-eligible sequences require `chain_replay_valid: true` (recomputed at sequence close;
  re-verifiable via the v2 inspector).
- `bun run e1:protect` (full triad) green **before and after** the run.
- The hidden oracle runs exactly once per task close in both arms (A9); the adversarial bank
  never gates and never feeds back (A1 ecological-validity pin).
- The M6 calibration run is non-evidence and excluded from the verdict structurally (by
  classification); it shares no seed with this run.
- Aborted (infrastructure-classified) records stay excluded per the ADR-005 pin. The v2 harness
  has no sequence-resume path (v1's `--resume` was not ported): a sequence that crashes
  mid-chain is not rerun or patched — its paired seed is excluded, which at this scale fires
  interpretability trigger 1 and the run lands `inconclusive_uninterpretable`. That outcome is
  accepted rather than engineered around.
- The verdict tool port (§2) lands tested before launch; the constants file, code twins, meter,
  converter, step table, gold spec, and bank are all hash-pinned and may not change between this
  seal and the run.

## 6. Program discipline (carried from the qwen pre-registration §2.3)

No model-shopping and no seed-shopping: `deepseek-v4-pro` on seeds 22 and 60 is the run. An
`inconclusive_uninterpretable` verdict — any trigger — halts E4 for design reassessment at a
gate rather than rerunning with different draws. A **no-go** (the frontier model keeps its spec
fresh even in the prose arm, or no separation) is taken at face value and reported as a real
finding under this task/model/budget.

## 7. Claim language (AGENTS.md Industry-Facing Credibility, binding on the report and any public post)

- Classification is stated everywhere: **pilot**. The claim ceiling is ladder **Level 4**: "in a
  sealed two-arm pilot, executing the spec's scenarios as the acceptance gate did / did not
  [keep the spec fresher | reduce false confidence] **under this task/model/budget**." No
  Level 5 (generalized) claims; single-model results stay labeled single-model and preliminary.
- Preferred wording: "preliminary", "sealed task", "replay-valid", "under this
  task/model/budget", "calibration" (for M6 context), "not clean primary evidence" (for
  anything flagged). Avoided wording: "proved", "validated" (strong sense), "solved",
  "benchmark shows feedback works", any unqualified "executable specs beat prose".
- The M6 calibration and the v2 dry-runs are never described as causal evidence. Provider
  anomalies, if any, flag the run rather than being narrated away; flat or null results are
  reported, not hidden.
- Every public artifact points to replayable evidence: the manifests (committed under
  `docs/protocols/` per M6 precedent), the constants hash, and the verdict tool's printed
  report as the sole claim source.
- Per the operator's public-claim target, the public post frames the mechanism as executable
  acceptance feedback on an agent-authored spec inside a real OpenSpec workspace (shared-
  environment profile, both arms) — not as a spec-format or framework-vs-framework comparison.
