# The Self-Verification Gradient: When Executable Spec Feedback Helps AI Coding Agents (E1 Finding, v1)

Date: 2026-06-13. **Status: synthesis of bounded, replay-valid E1 + pricing evidence into one
publishable finding.** This document preserves every run's classification and validity language and
makes **no generalized (Level 5) claim**. It is a *convergent qualitative pattern* across separately
bounded runs — **not a pooled effect size**; the runs below are never pooled across task, model,
provider profile, protocol, or classification (see Compatibility Boundaries).

> **Update (2026-06-23):** the successor **E2 brownfield** program has since produced results —
> executable acceptance feedback reduces frontier *confident-wrong shipping* at brownfield scale
> (candidate → replicated across two lineages; see the proto-paper and `public-evidence-status.md`).
> E2 *refines* this E1 finding by regime (small fully-specified ⇒ feedback redundant; brownfield ⇒
> beneficial); it does not change the E1 conclusions below.

## The finding, in one sentence

Executable, BDD-style spec feedback helps an AI coding agent **exactly to the extent that the agent
cannot already self-verify the task from the shared spec** — a gap that *grows* with task complexity
and *shrinks* with model capability — so the same feedback that materially helps a cheaper or
under-matched model is redundant for a strong model on a task it can specify-and-check on its own.

This is sharper and more defensible than "weak models benefit, frontier models don't." The decisive
variable is **self-verifiability of this task by this model**, a model×task interaction — not model
tier alone. The clearest single demonstration is *within one task*: on the dispatch task, the weaker
model gains from feedback while the stronger model has no room to gain.

## The precise claim

> Under the sealed tasks/models/budgets below, providing an executable feedback loop improved
> regression-free path survival **only where the agent could not reconstruct the task's acceptance
> behavior from the shared spec on its own**. Where a strong model could self-verify (it wrote its own
> equivalent checks and reached ceiling in both arms), the feedback loop added ~nothing. Preliminary;
> task/model/budget-specific; not a generalized benchmark claim.

## The evidence (convergent pattern across separately bounded runs — NOT pooled)

### A. Where the agent could NOT fully self-verify → feedback helped (clean causal pilots)

| Boundary | Classification | Model | Result | Card |
| --- | --- | --- | --- | --- |
| `pricing-discount-content-controlled-demo-v1` (path-survival-primary-v1, 2/1 budget) | `causal_pilot` | `mistral-small` | mean AUC delta **+0.1852**, 3/3 positive (after event-API + worked-example parity) | `docs/run-cards/pricing-discount-content-controlled-demo-v1-mistral-20260608.md` |
| `e1-dispatch-v1` two-arm matrix | `causal_pilot` | `qwen3.7-max` | mean AUC delta **+0.1464** (seeds +0.2363 / +0.0044 / +0.1984), all 3 positive | `docs/run-cards/e1-dispatch-v1-stage2-summary-20260612.md` |

Both are **candidate positive findings**, each on one model / one task / one protocol — not concluded
causal claims. The pricing result is explicitly bounded to cheap/weak-model viability; the dispatch
Qwen result is a single-model candidate positive.

### B. The within-task gradient (the centerpiece)

On the **same** `e1-dispatch-v1` task and context arm:

| Model | Context-arm AUC | What it means |
| --- | --- | --- |
| `qwen3.7-max` (Stage 2) | mean **0.7862** | headroom exists → feedback exploits it (+0.1464, §A) |
| `deepseek-v4-pro` (Stage 1, `calibration`) | **0.9310 / 0.9824 / 0.9768** (3 seeds, zero on-graph regressions) | the stronger model closes the headroom → no room for feedback to help |

Higher capability removed the very gap the feedback loop exploits — a clean, within-task illustration
of the gradient. (Dispatch DeepSeek runs are `calibration` context-only difficulty observations, not
causal evidence; they are never pooled with the Qwen causal pilots.)

### C. Where a strong model COULD self-verify → ceiling, zero benefit (difficulty/calibration probes)

| Boundary | Classification | Model | Context-arm result |
| --- | --- | --- | --- |
| `e1-billing-v2` | `difficulty_probe` | Sonnet 4.6 / Qwen 3.7 Max | AUC **0.9929** / **0.9361**, zero on-graph regressions |
| `e1-billing-v3` | `difficulty_probe` | Qwen 3.7 Max | AUC **0.9628**, zero on-graph regressions |
| `e1-dispatch-v1` | `calibration` | DeepSeek V4 Pro ×3 | AUC **0.93–0.98**, zero on-graph regressions |
| `pricing` content-controlled | `diagnostic_invalid` smoke | Sonnet 4.6 / Qwen 3.7 Max | both arms 9/9 |
| `payroll` skeleton-seed | `difficulty_probe` | Sonnet 4.6 | both arms 18/18 |

Across **four task families and three frontier-grade models**, strong models reached ceiling on the
context arm with **zero on-graph regressions** — they did not need the executable oracle. These are
difficulty/ceiling observations, not causal evidence; each is a separate non-pooled boundary.

## The mechanism (directly observed, not inferred)

Strong models ceiling the context arm because they **reconstruct the acceptance suite from the shared
spec and run it themselves.** This is not a hypothesis here — it is in the run artifacts. In the
billing-v3 context arm (Qwen 3.7 Max, no access to the hidden oracle), the model spontaneously wrote
per-checkpoint scratch tests including `cp17-trace-equal-tie` — the exact equal-tie rounding
edge-case the hidden oracle contained — with self-derived expected values, before any oracle could
provide it. A model that authors the hidden test itself gains nothing from being handed it.

This also explains why feedback *did* help the under-matched cases (§A): the weaker model, or the
stronger model on a task it could not fully specify-and-check (dispatch's scattered coordination),
did not reliably author the equivalent checks — so the provided oracle carried real, non-redundant
signal.

## External corroboration (community-tracked; verify against primaries before public use)

Two independent 2026 studies point the same way and were not used to derive the above:
- **ORACLE-SWE** ablates oracle signal *types* and finds regression/pass-to-pass feedback is the
  **weakest** signal for frontier agents, while reproduction/acceptance-level ("does it exhibit the
  specified behavior?") is the **strongest** — consistent with the gradient and with feedback's value
  concentrating where self-verification fails.
- **"Rethinking the Value of Agent-Generated Tests"** finds frontier agents' self-written tests are
  mostly observational and do not drive task success (e.g. GPT-5.2 writes almost no tests yet
  performs) — consistent with strong models self-verifying without needing an external oracle on
  tractable tasks.

## What this finding does NOT claim

- **No Level 5 / generalized claim.** The positive causal pilots are single-model, single-task,
  single-protocol each. The pattern is convergent and qualitative, not a pooled benchmark result.
- **Not "feedback beats context."** Feedback helped *only* where the agent could not self-verify;
  it was redundant elsewhere.
- **Not a frontier feedback win.** On the well-specified tasks tested, frontier models needed no
  executable feedback. (Whether feedback re-matters for frontier models at *brownfield scale*, where
  the task exceeds a model's self-verification, is the open question the E2 program tests — see
  `docs/protocols/e2-brownfield-acceptance-ablation-design-v1.md`. This finding does not pre-judge it.)
- Wording stays within the repo discipline: "preliminary", "clean sealed pilot", "under this
  task/model/budget", "convergent pattern", "not a generalized benchmark claim". Avoided: "proved",
  "generalizes across models", "feedback always reduces regressions", "scientifically proven".

## Why it's a contribution anyway

It reframes "does BDD/executable feedback help AI coding?" from a yes/no into a **gradient with a
mechanism**: the value of an executable acceptance loop is largest exactly where the agent cannot
self-verify the spec — under-matched models, and (the E2 hypothesis) tasks too large to hold and
self-check. For practitioners that is the actionable form: invest in executable acceptance harnesses
for weaker/cheaper agents and for large codebases; expect diminishing returns when a strong model is
already self-verifying a tractable, self-contained spec.

## Compatibility boundaries (do not pool)

Task version · model/provider profile · protocol profile · content-control status · run
classification (`calibration` / `difficulty_probe` / `causal_pilot` / `diagnostic_invalid`) ·
validity flags. The capability gradient is asserted as a cross-boundary *narrative pattern*, with
each constituent run's classification and validity intact; it is not a pooled statistic.
