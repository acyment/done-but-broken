# v3-M7 pre-seal calibration rung — notes (seed 144, 2026-07-12)

**Classification `calibration` — structurally non-evidence, no claim weight.** The prereg
§1.1 rung (`docs/protocols/e4-v3-m7-evidence-preregistration-v1.md`), operator-authorized
2026-07-12 ("Authorized" + explicit ~$1.5 spend confirmation). First live run on the
naturalized substrate boundary (`procedural-rest-v2.1`, v2 constants v0.5 `93d0bf88…` / v3
v0.4 `8dc13021…`, commit `4467ad6`).

## Run identity

- Seed **144** (mechanical rule, rename-free control: delete_field | modify_convention |
  rename_field | add_endpoint | add_entity | noop_maintenance), 6 tasks, arms
  `e4_arm_0` + `e4_arm_p`, glm-5.2 thinking-on on the exact M6/M8 route, **NO budget
  override — full sealed budgets 27/12/490k/$5**.
- Launched detached via the sealed shim; pgid == pid and PPID == 1 verified from a separate
  call; file-based polling only. Both sequences complete, **chain_replay_valid: true**.
- Spend **$1.1727** total ($0.5421 prose / $0.6306 product) — inside the ~$1.5 estimate.
- Provenance: `docs/protocols/e4-v3-m7-precal-calibration-manifests-20260712-001/`
  (both manifests + reasoning-observability.json). Seed 144 is consumed and joins the
  exclusion set.

## §5 thinking-on configuration checks — PASS

Reasoning active **82/82** calls; token accounting **folded** on every call (adjustment seam
stays inert); **zero truncation** at max_tokens 32000. Burn up to ~3.4k reasoning tokens per
call observed.

## Budget ratification — FREEZE-UNCHANGED branch

No wall approached in either arm: max turns/task **12/27** (product t1), max tokens/task
**183,805/490,000**, verifications **0/12**, max sequence spend **$0.63/$5**. Per the
prereg §1.1 rule, the v3 v0.4 budget values (27 / 12 / 490,000 / $5) **ratify unchanged on
the naturalized substrate**; the prereg §1 budget row stands as drafted and sealing is
unblocked on this axis.

## Close-rate observation (the GLM F3 question) — answered

- **Product arm 6/6 closes** at full budgets (learning-ladder product close rate was 10/12
  at the halved 240k cap) — consistent with the halved-budget-artifact explanation.
- **Prose arm 5/6**: one `agent_stalled` (task 4, add_endpoint) at **3 turns / 46k tokens**
  — nowhere near any wall, so this residual prose stall class is behavioral, not
  budget-censoring. Learning-run prose stalls were plausibly budget artifacts only in part.

## Mechanism observations (calibration class — recorded, no claim weight)

- **Product arm: zero false confidence anywhere, hidden oracle fully green at every close**
  (25/25 → 36/36), drift burden per checkpoint [0,0,0,0,2,2] (AUC 0.67). One product-gate
  refusal fired at t1 (revision, then accepted close); ASK_PM used 2/6 tasks.
- **The tail burden (both arms) is a known residual-ambiguity diagnostic, not a trap:** after
  add_entity (t5, Supplier) BOTH arms seeded their own demo rows for the new entity
  (house-style imitation) and authored "creating increases the list count" scenarios grounded
  in that data; against gold's empty Supplier store the scenario's expected count fails ⇒ 2
  `spec_vs_truth` endpoint contradictions per arm (arm 0 adds 2 coverage_gaps on top). The
  hidden ORACLE is agnostic (no seed-row expectations for added entities under §5.7), so this
  produces zero false confidence; exposure is arm-symmetric. **Flag for the seal gate:**
  either add a one-line PM-brief disclosure for add_entity ("the new entity starts with no
  records") as a §5.7.4-style residual — a v3-twin re-pin — or accept it as genuine
  invented-data behavior the meter correctly surfaces; the drafted prereg's burden-AUC
  primary counts it symmetrically either way.
- **Prose arm: fc|done 4/5** (t2 modify_convention and t3 rename_field closed with oracle
  12/25; t5/t6 closed at 35/36), drift burden [0,0,0,2,4,4] (AUC 1.67).
- Net (single seed, rename-free, calibration): on the naturalized substrate the product loop
  produced *truthful, fresh* closes where prose produced false ones — the direction the
  learning ladder predicted, now without the convention-trap channel. The evidence run
  decides whether this holds at n=6 under the sealed predicates.

## Consequences

1. Prereg §1.1 is discharged; §1's budget row stands; the freeze-unchanged branch is the
   recorded outcome (no constants edit needed — v3 v0.4 values confirmed).
2. Sealing remains a separate operator act, preceded by the §9 gate commit (evidence verdict
   tool + harness-commit stamp + tombstone-disclosure note + tool-hash pins).
3. The evidence run remains separately spend-gated (~$8–20, ceiling $60).
