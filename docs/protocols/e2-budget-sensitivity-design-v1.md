# E2 Budget-Sensitivity Follow-up — Design Draft (v1)

Status: **DESIGN DRAFT — not authorized, not run, not sealed.** No provider/Docker run fires from
this document. Sealing (hash + operator authorization + spend cap) is a separate step, only after the
main qwen replication (`e2-phase1-pilot-commitments-v1-addendum-c.md`) completes and this design is
reviewed. This is a *new compatibility boundary* — never pooled with the n=13 replication, the
DeepSeek pilot, E1, or across budget levels except as the manipulated factor defined here.

Date: 2026-06-21. Program: E2 (`e2-brownfield-acceptance-ablation-design-v1.md`).

## Motivating observation (why this is worth running)

In the qwen 3.7 max replication (Addendum C, in flight), on `django-guardian-899` at the frozen
budget of `max_iterations = 60`:

| arm (budget 60) | self-verification gap | resolve |
| --- | ---: | ---: |
| control | 2/10 | **8/10** |
| treatment | 0/10 | **4/10** |

Treatment **eliminated false-confidence shipping (gap 2→0) but resolved *fewer*** (8→4). The
mechanism: `run_tests` consumes turns from a fixed budget, so the treatment arm more often exhausts
its budget and ends *correctly-uncertain-but-unfinished* rather than *confidently-wrong*. This is
direct evidence that **iteration budget moderates the feedback effect** — and it suggests the
benefit's *character* shifts with budget: at low budget feedback is **diagnostic** (stops false
confidence), and with more budget it may become **generative** (converts honest non-finishes into
solves). The main-pilot difficulty gradient (redundant → generative → diagnostic) may be, in part, a
*budget* gradient. The main pilot cannot answer this — its budget is frozen by design.

## Question

For a strong self-verifier (qwen 3.7 max), how does the executable-acceptance-feedback effect scale
with the agent's iteration budget — on both the **self-verification gap** and the **resolve rate**?

## Boundary

| Field | Value |
| --- | --- |
| Program | E2 (brownfield acceptance-feedback) |
| Substrate | SWE-bench Live; the certified, contamination-screened tasks (Addendum B; qwen GATE-B clean per Addendum C) |
| Model / route | `qwen3.7-max` (the strong self-verifier where budget binds), frozen route per Addendum C |
| Manipulated factors | (1) **arm** ∈ {control, treatment}; (2) **budget** ∈ {B₁, B₂, B₃} (e.g. 60 / 120 / 200 `max_iterations`) |
| Classification | `causal_pilot` (mechanism/interaction study) |

## The inviolable constraint (do not relax)

**Budget is raised EQUALLY for both arms at each level.** At every budget Bᵢ the comparison is
control-vs-treatment *at the same budget*; the only within-level difference remains the `run_tests`
tool. The treatment never receives extra turns to "compensate" for run_tests cost — that turn cost is
part of the treatment and is measured, not subsidised (AGENTS.md: *"the treatment is executable
feedback information, not extra model turns; both arms must receive the same maximum model-turn
budget"*). Budget level is a **scaffold parameter swept across pre-registered levels**, not a new
condition ID; the two arms stay `control` / `treatment`.

## Primary signal (predeclared) — the interaction, not a single rate

The quantity of interest is **how the feedback effect changes with budget**, not any single-level
rate. Two predeclared readouts:

- **Resolve-delta trend (primary).** Per budget level, Δ_resolve(Bᵢ) = mean(treatment resolve) −
  mean(control resolve). Hypothesis **H_gen**: Δ_resolve increases with budget (feedback becomes
  generative when given turns). Test: a permutation test on the **monotone budget×arm trend** in
  resolve (e.g. Jonckheere-style trend, or a pre-registered linear contrast across ordered levels),
  with the 2·N·levels per-task outcomes exchangeable under H0.
- **Gap stability (secondary).** Per level, gap(control,Bᵢ) − gap(treatment,Bᵢ). Hypothesis **H_diag**:
  treatment gap stays ≈ 0 at all budgets while control gap is ≥ treatment at every level (the
  diagnostic benefit persists and does not require budget).

Tertiary (logged): per-arm absolute resolve and gap at each level; turns-to-finish distribution;
fraction of treatment rollouts that hit the budget ceiling (the "honest non-finish" rate) — the direct
mechanism for H_gen.

## Hypotheses

- **H_gen:** Δ_resolve(B₃) > Δ_resolve(B₁) (feedback's generative benefit grows with budget).
- **H_diag:** treatment gap ≈ 0 across all levels; control gap > treatment at every level (diagnostic
  benefit is budget-insensitive).
- **H0:** Δ_resolve flat across budgets and gap effect flat — budget does not moderate feedback.

## Design & sizing

- **Tasks (k ≈ 4–6):** the **solvable, budget-binding** subset — tasks where, at B₁=60, at least one
  arm resolves but neither ceilings, so resolve has room to move *and* budget plausibly binds.
  Candidates from the replication: `guardian-899`, `pycasbin-392`, `datamodel-2408/2461`,
  `drf-json-api-1283`. **Exclude** `freezegun` (trivial — no budget pressure) and tasks neither arm
  resolves at any budget (e.g. `twine` — resolve cannot move; keep only if its *gap* trend is wanted).
  The final list is sealed from the replication's per-task resolve/gap profile (data-driven but fixed
  *before* this run).
- **Levels:** B₁=60 (anchors to the main pilot), B₂=120, B₃=200. Three levels give a trend, not just
  a two-point slope.
- **N = 10 runs/arm/level/task.** Cells = 2 arms × 3 levels × k tasks → 6k cells, 60k rollouts total
  (k=5 → 300 rollouts).
- **Budget-equalised within level; compute logged per rollout** (turns used, tokens) for
  budget-normalised reporting.

## Criterion (predeclared; no post-hoc reinterpretation)

- **H_gen supported** iff the resolve-delta trend test is significant (one-sided, α=0.05, family-wise
  across tasks) **and** Δ_resolve(B₃) − Δ_resolve(B₁) ≥ a predeclared MCID (≥ 0.20 absolute).
- **H_diag supported** iff treatment gap ≤ control gap at every level for every task and treatment
  mean gap ≤ 0.10 across levels.
- A result may not be driven by a single unreproduced flaky task; replay must confirm.

## Validity rules

Post-cutoff + qwen GATE-B clean (carried from Addendum C); flake-certified tasks only (carried from
Addendum B); budget frozen at the three levels **before** the run; `declared_done` from `FINISHED`;
replay-valid. **Never pooled** with the n=13 replication (budget is fixed there; here it is
manipulated → different design), with the DeepSeek pilot, with E1, or across models. Budget levels are
this study's manipulated factor and are compared only as defined above.

## Cost & feasibility (honest)

Cost scales **super-linearly with budget**: B₃=200 rollouts run far longer (and cost more reasoning
tokens) than B₁=60. qwen's ~100 s reasoning turns make the high-budget cells the binding wall-clock
cost; at k=5, 300 rollouts with a third of them at 200 iterations is a multi-day run. Mitigations
(recorded if used): small k (4), drop B₃ to 150, or stage B₁→B₂→B₃ and stop early if H_gen is already
decided. A per-run + overall spend cap is fixed at authorization.

## Harness changes required (small, both behind the equal-budget rule)

- `run_phase1_5.py` / orchestrator: accept a `max_iterations` (budget) parameter, applied identically
  to both arms; record it on every record (`budget` field) so levels are never silently pooled.
- `OpenHandsAgent`: already takes `max_iterations` (currently 60); thread it from the run config.
- Per-rollout turns-used capture (extends the `usage` capture already added) for the
  budget-ceiling-rate tertiary.
- Protocol tests: budget parity (both arms get the same `max_iterations` at each level); per-level
  record tagging (no cross-level pooling); trend-test statistic on a synthetic fixture.

## Status

**DESIGN DRAFT.** Does not authorize or affect the running qwen replication (whose budget stays frozen
at 60). Next steps, in order: (1) the n=13 replication completes and is reported; (2) this design is
reviewed and the task subset sealed from the replication's resolve/gap profile; (3) operator
authorization + spend cap; (4) sealed commitments + run.
