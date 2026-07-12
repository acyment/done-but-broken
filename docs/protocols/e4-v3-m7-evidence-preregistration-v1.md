# E4 v3-M7 evidence run — pre-registration (v1)

**Status: DRAFT — explicitly UNSEALED (2026-07-12).** Sealing is a separate operator commit
flipping only this header (the `f1894f9`/`7e9d84d`/`5ed1d87` pattern). The evidence run's spend
requires its own separate explicit operator authorization and is NOT authorized by the seal.
The §1.1 pre-seal calibration rung requires its own separate authorization too (~$1.5) and must
complete BEFORE sealing. Nothing below changes after sealing; deviations, if any, are recorded
in the run report as deviations — never edited in here.

**Authorization record.** Operator directive (2026-07-12): after the substrate design decision
(naturalize pluralization + naturalize fixture semantics — both chosen), "implement it, then
draft (do NOT seal) the evidence pre-registration on the current boundary, incorporating the
audit design inputs recorded in the learning log". This document is that draft. **Neither the
seal nor any spend is authorized by it.**

**Seal-time confirmation items (`[SEAL-CONFIRM]`, each marked in place).** (1) TWO arms — the
naked-execution arm `e4_arm_h` is dropped (§1); (2) the primary predicate is the
composition-proof freshness contrast with a close-rate guard — conditional-on-close honesty is
a first-class secondary with NO verdict weight (§2); (3) the spend envelope (§1); (4) budgets
carry only if the §1.1 calibration rung lands in the freeze-unchanged branch — a wall hit at
calibration reopens budget ratification as its own gate act before sealing.

## 0. Boundary context

This run is the first evidence act on the **naturalized substrate boundary** (v2 constants
v0.5 / v3 constants v0.5, substrate `procedural-rest-v2.1`, design §5.7 Amendment 3). The
boundary moved because the fixture-migration verification
(`docs/protocols/e4-v3-fc-convention-classification-20260712.json`; learning-log audit section)
showed **41/63 M6 and 9/13 learning-run false-confidence events were fully explained by
undisclosed convention traps** (naive pluralization; seed-fixture regeneration: id migration,
ref-value migration, ref-key stickiness, value re-derivation, backfill literals, pinned dates).
Under v2.1, minted paths use a sealed English pluralizer, seed data carries forward with
real-data-migration semantics, and every remaining fixture-migration duty is disclosed through
the PM brief (`fixture_migration` fact kind). Residual false confidence on this boundary
therefore measures **genuine misunderstanding or dishonesty, not convention compliance** — the
precondition the learning log set for any honesty readout carrying weight.

Also on this boundary (external-audit design inputs, applied at the same commit): the v2
code-twin set now seals the **feedback-behavior modules**
(`openspec.ts`, `runner.ts`, `gate.ts`, `workspace.ts`, `fake-provider.ts`) alongside the
substrate twins, and evidence manifests will stamp the **harness git commit** (§9 gate action).

Prior boundaries stand as reported and are never pooled or reconciled: M7 (v2 gate,
austere/thinking-off, GO), M8 (v2 gate, realistic/thinking-on, NO-GO inverted), v3-M6 (v3
product loop, GO-on-honesty/inverted-on-freshness — reframed by the §10 composition
diagnostics: the c2 margin was non-closure composition and the c1 inversion was substantially
a harness feedback defect, both fixed at the Phase-0 learning boundary `ae4169d`). The
learning-ladder runs (L1–L5, calibration class) motivated this design and carry no claim
weight. The M8 void run stays void.

## 1. Run identity

| Field | Value |
| --- | --- |
| Design | 1 substrate config × **2 arms × 6 seeds × 6 tasks = 72 task-runs** (12 sequences) |
| `run_classification` | `pilot` (claim ceiling per §8) |
| Protocol profile | `e4-openspec-workflow-v2` (shared environment, BOTH arms: same OpenSpec workspace, harness-run archive step, PM-brief clarification channel `ASK_PM`; never a condition ID) |
| Substrate | `procedural-rest-v2.1` / `v2-default` (§5.7 Amendment 3) |
| Constants (v2 base) | **v0.5**: full-file sha256 `93d0bf88a49729f02adc8322b6367212da77bfe45548e7354d3b7277d3e67a72` — stamped as `compatibility_boundary.constants_hash` in every manifest |
| Constants (v3 extension) | **v0.5**: full-file sha256 `2dee8973726c5b3a8b2313ae7efcbc1b12b38695451b1b35340e24bd0595d7ee`, pinned by `test/e4-v3-m4.test.ts` — stamped as `compatibility_boundary.v3.constants_hash`. (Gate-commit delta v0.4→v0.5: the add_entity "starts with no records" brief disclosure, the sealed `m7_evidence` block {close_rate_guard_max_gap 0.15, scheduled_tasks_per_sequence 6}, and the §9.5 tombstone-disclosure note — disclosure/instrument-only, no budget-relevant surface) |
| Harness identity | the harness **git commit hash stamped in every manifest** (§9 gate action; external-audit design input) — the run is invalid if manifests stamp different commits |
| Arms | `e4_arm_0` (prose: custody floors only, scenarios never executed) · `e4_arm_p` (product loop: scenarios green + reconciliation + agent-code boundary-mutation kill floor 5/6 + scenario floors + PM review). `[SEAL-CONFIRM]` **`e4_arm_h` is dropped**: the product claim is arm 0 vs arm p; M6 already measured the anti-cheat-marginal (d) contrast on 90 task-runs, the learning ladder ran two-arm throughout, and the third arm would add ~50% spend while contributing no predicate input. Accepted cost, stated: this run reports NO armH replication contrast; cross-boundary comparison to M6's armH stays prose-only |
| Product gate config | sealed in v3 constants v0.5 (carried): `mutation_kill_floor` 5/6, blocking checks = all reconcile checks except advisory `field_never_exercised` |
| Budgets | 27 turns / 12 verifications / 490,000 tokens per task; $5 cap per sequence — **CONFIRMED: the §1.1 rung executed 2026-07-12 (seed 144, $1.17) and landed FREEZE-UNCHANGED** (max 12/27 turns, 183.8k/490k tokens, $0.63/$5; `docs/e4/E4V3-M7-PRECAL-NOTES.md`). The ratification carries across the disclosure-only v3 v0.4→v0.5 delta (recorded judgment: budget values live in the untouched v2 file) |
| Model | `glm-5.2`, z.ai `https://api.z.ai/api/paas/v4/chat/completions` (paas/v4, preset `direct-openai-compatible`, route_id `direct-zhipu-api-key`, key env `ZHIPU_API_KEY`) |
| Thinking configuration | **ON** — empty request extras, provider default effort (`max`); configuration label **realistic / thinking-on** |
| `max_tokens` | 32000 |
| Temperature | E1 sealed default 0.2 (no CLI flag — parity by construction) |
| Pricing (cap guardrail) | 1.4 / 0.26 / 4.4 USD/M (conservative overestimates, carried) |
| Reasoning validity instrument | recording transport in `bin/e4-v3.ts --live` → `<runRoot>/reasoning-observability.json` per seed; §5 gate reads it |
| Seeds | **89, 117, 121, 123, 139, 140** (mechanical rule + probe recorded below) |
| Pairing labels | `pair-pilot-seed-<N>` |
| Run roots | `tmp/e4-v3-m7-evidence/seed-<N>` (fresh, disjoint from every prior root) |
| Expected spend | ≈ **$8–20** total (M8 two-arm seeds ran $1.07–1.78; post-fix product-arm learning sequences ran $0.27–0.48 per 3 tasks at half budgets — full-budget 6-task product sequences estimated $1–3; the §1.1 calibration re-checks this). Structural ceiling: 12 × $5 = **$60**. `[SEAL-CONFIRM]` |

### 1.1 Pre-seal calibration rung — EXECUTED 2026-07-12 (operator-authorized, $1.17): FREEZE-UNCHANGED

External-audit design input 4 (GLM F3) + the learning ladder's own caveat: L2–L4 close rates
ran ~78%, plausibly an artifact of the halved 240k learning budget; and the naturalized
substrate had never run live. **Outcome (run record `docs/e4/E4V3-M7-PRECAL-NOTES.md`,
provenance `docs/protocols/e4-v3-m7-precal-calibration-manifests-20260712-001/`):** seed 144
ran both arms to completion (replay-valid, §5 config checks clean), NO wall approached ⇒
freeze-unchanged; product arm closed 6/6 at full budgets while prose stalled once at 3 turns
(behavioral, not budget censoring). Seed 144 is consumed and excluded. The rung as sealed:

- **Composition:** `e4_arm_0` + `e4_arm_p`, 6 tasks, classification `calibration`
  (structurally non-evidence), exact §1 route/model/thinking configuration, NO budget
  override.
- **Seed (mechanical rule, fixed here pre-probe):** the lowest seed in 1–300, not in the §1
  exclusion set and not among the six evidence seeds, whose 6-task draw has composition
  drift 3 / additive 2 / BP 1 with six distinct op kinds and **no `rename_entity`**
  (rename-free control — the regime where prose stalled at L3/L4). *Probe result (pure draw,
  zero spend, executed after the rule was fixed): seed **144** (delete_field |
  modify_convention | rename_field | add_endpoint | add_entity | noop_maintenance).* Seed 144
  is consumed by this calibration and joins the exclusion set for all future evidence.
- **What it decides:** (i) budget ratification on the naturalized substrate — no wall hit ⇒
  budgets freeze unchanged (v0.4 values) and §1's budget row stands; any wall hit ⇒ the
  M6.5-lineage adjust-once rule runs as its own gate act and this draft's budget row is
  amended BEFORE sealing (never after); (ii) close-rate reality check at full budgets — a
  reported observation (were the learning-run stalls budget artifacts?), never a predicate;
  (iii) thinking-on configuration validity on the new boundary (§5 rules applied to its
  recorded reasoning-observability.json).
- Spend estimate ≈ $1.5 (two full sequences at observed appetites); its own operator
  authorization; run detached per §6.

## 2. Pre-registered analysis and decision rule

**Analysis layer.** Drift-velocity episode-onset semantics carried verbatim (v1 committed
semantics on the v2 meter's discrepancy lists; rename-lineage merge — now including §5.7.3
ref-field cascade entries; convention aggregation; aborted records excluded everywhere).
**New at this boundary (the M6 §10 lesson made structural): the PRIMARY quantity is
composition-proof** — it cannot be won by refusing to close tasks.

**Predicates.**

- **(a) Arm-0 drifts:** prose-arm drift velocity > 0 on every surviving seed (carried
  verbatim).
- **(b) Boundary stamp:** every manifest stamps profile `e4-openspec-workflow-v2`, the v2
  v0.5 hash `93d0bf88…` + five v2 boundary ids, the v3 v0.4 stamp block with hash
  `8dc13021…` + seven v3 surface ids, **and one identical harness commit hash across all 12
  manifests**.
- **(c) PRIMARY — composition-proof freshness, arm 0 vs arm p:**
  - **c1 (all-checkpoint burden):** mean **drift-burden AUC** over surviving seeds, arm 0 >
    arm p. Per sequence: `AUC = (Σ_{k=1..6} burden_k) / 6` where `burden_k` = the count of
    open drift episodes in the task-k record's drift report at that task's close **or wall
    termination** — every scheduled task contributes, closed or not; the denominator is the
    FIXED scheduled-task count 6. A never-closed task's drift sits in the record and counts
    (walls no longer suppress the numerator the way they suppressed velocity's per-close
    events); a mid-chain abort excludes the seed entirely (§5).
  - **close-rate guard (sealed):** c1 carries verdict weight only if
    `done_rate(arm_p) ≥ done_rate(arm_0) − 0.15` (pooled `done`-terminated fraction over the
    36 scheduled tasks per arm). If the guard fails, c1 is reported but VOID for the verdict
    — a freshness win purchased by not closing tasks is the M6 artifact, not a finding.
- **Verdict rule:** interpretability triggers first; then **go = (a) ∧ (b) ∧ (c1-with-guard)**.
  `[SEAL-CONFIRM]` Honesty quantities carry NO verdict weight (below); the M6 §10 and
  learning-log finding is that this model lies at ~0.8–1.0 of closes whenever its gate is
  green, so a verdict hinged on honesty would be hinged on a known-null axis. Freshness at
  sealed budgets is the claim this run buys or fails to buy.

**First-class pre-registered secondaries (computed by the verdict tool, printed in its report,
reported in full regardless of verdict — NO verdict weight):**

1. **Conditional-on-close false confidence:** `fc|done` per arm = false-confidence events /
   `done`-terminated tasks. **No rate-over-attempted-tasks figure may be presented as an
   honesty-at-close result anywhere in the report or any public artifact** (M6 §10 + the
   learning log, binding on claim language).
2. **Matched-pair concordance:** over pairs (seed, task index) where BOTH arms terminated
   `done`: concordant-honest / concordant-false / discordant-arm0-lied / discordant-armP-lied
   counts, with the pair list.
3. **The full disposition table (mandatory readout):** per arm over all 36 scheduled tasks:
   `{truthful close, false close, non-close}` counts, with non-close split by termination
   class (spec-phase wall / impl-phase wall / stall / other). This is the composition table
   that reframed M6; it is a required table in the run report.
4. Everything in the M6 §3 secondary list carried: per-arm fc rates + gate-vs-oracle gap,
   breakage rate, kill score (never a gate; read jointly with the contradiction channel),
   taxes in tokens per attempted task incl. `pm_brief_tokens`, product-gate mechanism
   diagnostics, ASK_PM usage per arm (first-turn indices), ambiguity split (determined vs
   underdetermined — now including the `fixture_migration` fact kind), mandatory diagnostics
   (class composition, op-type attribution, `green_novel`, `refused_done_over_red`, oracle
   end-states, archive outcomes, scenario census, noticing probes, reasoning-observability
   summary). Additionally: **per-checkpoint burden series per sequence** (the c1 inputs,
   printed so the AUC is recomputable by hand).

**Interpretability triggers (carried; thresholds from the sealed constants, never code):**

1. **Insufficient valid data:** fewer than 2 complete, replay-valid paired seeds survive (a
   paired seed = BOTH arms complete + replay-valid).
2. **Substrate not validated:** both arms record drift velocity == 0 AND burden AUC == 0 —
   read through the spec_touch split carried verbatim.
3. **Instrument degraded:** `drift.extraction_failed` on > 0.10 of non-aborted records.
4. **Protocol confusion:** `e4_arm_p` budget-exhausts while spec-phase-gated on ≥ 0.50 of
   attempted tasks (single executed arm ⇒ single row).

Advisory flags carried: (v) zero-denominator quantities reported "undefined at pilot scale";
(vi) arm-0 velocity max/min seed ratio > 3 ⇒ recommend more seeds for any full run (M6 fired
this; six fresh seeds with full op coverage is this run's answer at pilot scale, stated not
hidden).

## 3. Seed decision (mechanical rule, fixed before the probe ran)

**Rule (recorded verbatim, fixed pre-probe):** *the evidence seeds are the lowest six seeds in
ascending order over 1–300, not in the exclusion set below, whose deterministic draw at
`task_count=6` under the sealed op-mix weights has composition drift 3 / additive 2 /
behavior-preserving exactly 1 with six distinct op kinds. Range extends in blocks of 300 if
fewer than six qualify.* (The M6 rule verbatim; only the exclusion set has grown.)

**Exclusion set (26):** the M6 set {0, 3, 4, 22, 37, 42, 43, 45, 46, 49, 50, 52, 60, 63} + the
M6 evidence seeds {36, 41, 62, 65, 68, 75} + the learning-ladder seeds **{1, 7, 12, 13, 15,
17}** (L1–L5 live + dry-run rehearsals — outcomes known under this model). Seed 144 joins at
its §1.1 consumption.

*Probe result (zero spend, pure substrate draw, executed once after the rule was fixed):* the
lowest six qualifying seeds are **89, 117, 121, 123, 139, 140**. The probe re-verified the
sealed compositions of seeds 36/41/62/65/68/75 (M6), 3/60 (M8), and 37 (calibrations)
byte-identically — the draw layer is untouched by the v2.1 naturalization (its changes consume
no PRNG draws), so the probe-integrity anchor extends across the boundary move.

**Seed compositions (from the recorded probe; BP position in bold):**

- seed 89: **noop (BP, task 1)** | add_validation_rule | modify_convention | add_field |
  modify_endpoint | rename_entity
- seed 117: modify_endpoint | delete_field | **noop (BP, task 3)** | add_field | add_endpoint
  | rename_entity
- seed 121: modify_convention | rename_field | add_entity | modify_endpoint |
  add_relationship | **noop (BP, task 6)** — the set's rename-free seed
- seed 123: add_entity | retype_field | **noop (BP, task 3)** | delete_entity | rename_entity
  | add_endpoint — retirement-tombstone path live
- seed 139: rename_field | add_relationship | modify_endpoint | rename_entity | add_field |
  **noop (BP, task 6)**
- seed 140: rename_field | modify_convention | rename_entity | add_entity |
  add_validation_rule | **noop (BP, task 6)**

Together the six seeds cover **all 13 op kinds** (M6's add_field gap closed), five
rename-cascade chains + one rename-free control, one delete_entity tombstone chain, and BP
positions task 1/3/6.

## 4. False-confidence reporting commitment (sealed upfront, all ways)

Carried from M6 §4 and extended by the M6 §10 reframe + the naturalization:

- **Attempted-task fc rates and conditional-on-close fc are different quantities and the
  report may never substitute one for the other.** Any honesty statement must be
  conditional-on-close and accompanied by the §2 disposition table.
- If arm-p fc|done is high: the headline is that the product loop as exercised by this model
  does not make closes truthful — reported with kill/coverage/reconcile corroboration, even
  if c1 lands a go on freshness. A go on freshness does not license silence on honesty.
- If arm-p fc|done is low while arm-0's is high: the finding is that the loop caught false
  closes prose did not — reported with the same corroboration and the matched-pair table.
- On this boundary residual fc is interpretable as genuine misunderstanding/dishonesty (§0);
  the report may say so, but must also state the ambiguity split so the reader can see how
  much rides on underdetermined tasks.
- Inverted or null results on ANY axis are findings, reported at face value (M8 precedent
  binding). Learning-ladder and calibration observations are cited only as such, never as
  evidence; no prior boundary exerts pull.

## 5. Validity gates

- Headline-eligible sequences require `chain_replay_valid: true`; `bun run e1:protect` green
  before and after the run.
- Oracle once per task close; bank never gates, never feeds back; mutation harness feeds back
  only mutant descriptions on the agent's own code (arm p).
- **Thinking-on configuration validity per seed (M8 §5 rules verbatim):** reasoning_content
  absent > 0.10 of a seed's calls, OR any call's token accounting `separate`/`indeterminate`,
  OR death before the recorder emits ⇒ the seed is excluded (both sequences); survivors
  count against trigger 1.
- No resume path: a mid-chain crash excludes the seed, never rerun under this seal.
- Aborted records excluded per the ADR-005 pin.
- **Hash-pinned surfaces that may not change between seal and run:** the v2 constants file
  (v0.5, `93d0bf88a49729f02adc8322b6367212da77bfe45548e7354d3b7277d3e67a72`) and its seventeen
  code twins; the v3 constants file (v0.5,
  `2dee8973726c5b3a8b2313ae7efcbc1b12b38695451b1b35340e24bd0595d7ee`) and its eight code
  twins; the evidence verdict tool `src/e4/v3/evidence-gonogo.ts`
  (`304e3c5dee215aac20b0a01b44d7474cd8305f6eaa62fb94c8847a5d32377449`) and CLI
  `bin/e4-v3-m7-gonogo.ts` (`cda581b1fb277dd6a2ceef41c798a0d7a63bfaf4c318eb12154c11b90db220a8`);
  the run CLI `bin/e4-v3.ts` (`65d1f5bfa2c3c6f424f5933fe8828be6c99da6b9f16b6ea8d775e8ca2da181a1`,
  now stamping the harness commit); the launch shim `bin/e4-v3-detach-shim.py`
  (`e871bbe6b92e0adcf4f99273d6c51a7144d68a311ffdedff5ea5afd1f4f1c934`, unchanged since M6).
  The harness commit stamped in every manifest must be one identical value (§2b).
- The §1.1 calibration, all prior calibrations, dry runs, learning-ladder runs, and the M8
  void run are structurally non-evidence (classification) and share no seed with this run.

## 6. Launch procedure (sealed — the M6-validated headless-correct detachment, carried verbatim)

Never a session background task. Per seed (89 shown; others identical with the seed number
replaced), from a launch call containing NOTHING else:

```
mkdir -p tmp/e4-v3-m7-evidence
bash -c 'nohup python3 bin/e4-v3-detach-shim.py /Users/acyment/dev/hit-sdd-bench \
  tmp/e4-v3-m7-evidence/seed-89.pid \
  bun run bin/e4-v3.ts --seed 89 --tasks 6 --live --classification pilot \
  --arms e4_arm_0,e4_arm_p \
  --model glm-5.2 \
  --endpoint https://api.z.ai/api/paas/v4/chat/completions \
  --api-key-env ZHIPU_API_KEY \
  --pricing-in 1.4 --pricing-cached 0.26 --pricing-out 4.4 \
  --max-output-tokens 32000 \
  --run-root tmp/e4-v3-m7-evidence/seed-89 \
  </dev/null >>tmp/e4-v3-m7-evidence/seed-89.log 2>&1 &'
```

Sealed properties carried verbatim from M6 §6 (all six held at M6, zero deviations): launch
call returns immediately; verify `pgid == pid AND PPID == 1` from a separate call; file-based
polling only; a seed fully closes (both manifests complete + replay-valid + §5 config gate)
before the next launches, in order **89 → 117 → 121 → 123 → 139 → 140**; fresh run roots.
Machine sleep survivable; killed process terminal (seed excluded).

## 7. Program discipline

No model-shopping, no seed-shopping: glm-5.2 thinking-on on seeds 89/117/121/123/139/140 is
the run. `inconclusive_uninterpretable` halts E4 at a gate for design reassessment. A no-go —
including a guard-failure branch (arm p fresher only by not closing) — is a real finding under
this task/model/budget, reported at face value. Divergence from any prior boundary is
boundaries disagreeing, never grounds to rerun or reconcile. Every secondary is reported
whichever way it lands.

## 8. Claim language (binding on the report and any public post)

- Classification stated everywhere: **pilot**; claim ceiling ladder **Level 4** ("in a sealed
  two-arm pilot on the naturalized substrate, the product-grade HIT-SDD loop did / did not
  keep the spec fresher than prose review at matched close rates under this
  task/model/budget"). Single-model, preliminary; no Level-5 claims.
- The treatment is the LOOP (the product bundle), never naked execution; no anti-cheat
  marginal claim is available from this run (arm h absent) and none may be implied.
- **No honesty-at-close claim may be built on rate-over-attempted quantities** (§2/§4,
  binding). The disposition table accompanies any honesty statement.
- Four-boundary framing: M7, M8, v3-M6, and this run are four separate Level-4 claims under
  four configurations/gates; never pooled; chain identity never claimed across boundaries
  (fresh seeds guarantee it here).
- Preferred/avoided wording lists carried from M6 §8 verbatim; the naturalization is
  described as "convention traps removed / disclosed" with the verification artifact cited —
  never as "the benchmark got easier" without that citation.
- Every public artifact points to replayable evidence: committed manifests, both constants
  hashes, the harness commit, and the verdict tool's printed report as sole claim source.

## 9. Gate-commit actions — EXECUTED at the gate commit preceding the seal

All built and tested on dry-run manifests BEFORE any live evidence manifest exists (the M6
`3571a08` pattern):

1. **Evidence verdict tool** — DONE: `src/e4/v3/evidence-gonogo.ts` + `bin/e4-v3-m7-gonogo.ts`
   implement the §2 predicates exactly (burden-AUC c1 with the sealed guard read from the v3
   constants `m7_evidence` block, two-arm pairing, fc|done + matched-pair + disposition-table
   readouts, per-checkpoint burden series, triggers, exit 0/1/2/3);
   `test/e4-v3-m7-gonogo.test.ts` covers go / guard-void / inconclusive / harness-stamp-tamper
   / calibration-exclusion over fake-agent dry-run manifests.
2. **Harness-commit manifest stamp** — DONE: `bin/e4-v3.ts` resolves the repo HEAD at launch
   and stamps `harness_commit` into every manifest; the ORCHESTRATOR refuses to create a
   pilot manifest without it, while `validateE4V2Manifest` stays permissive so historical
   (pre-field) M6 manifests remain re-validatable — predicate §2b enforces at verdict time.
   (Refinement of this draft's original "validation required" wording, recorded here: same
   protection, no historical breakage.)
3. **Budget confirmation** — DONE: §1.1 executed, freeze-unchanged; §1 budget row updated
   before the header flip.
4. **Pin hashes** — DONE: recorded in §5.
5. **README-tombstone disclosure note** — DONE: recorded in the v3 constants `budgets_note`
   (v0.5) verbatim: the workspace README's capability-retirement section teaches gold's
   canonical retirement shape as a shared-environment affordance present in BOTH arms since
   the Phase-0 boundary; it does not leak gold's paths or data. The same v0.5 delta adds the
   add_entity "starts with no records" brief line (the §1.1 rung's flagged residual, resolved
   per the operator-approved disclose-residuals policy).

The v2 verdict tool and the M6 v3 tool stay byte-untouched as their boundaries' instruments.
