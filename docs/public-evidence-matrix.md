# Public Evidence Matrix

This matrix is for public communication hygiene. It summarizes clean, replay-valid evidence without pooling incompatible task, model, provider-profile, protocol, or run-classification boundaries.

## Headline Pricing Evidence

The current positive evidence is a two-step pricing decomposition under `mistralai/mistral-small-2603`, `path-survival-primary-v1`, and a 2-turn / 1-feedback budget.

| Boundary | What was controlled | Mean AUC delta | Direction | Mean final delta | Public interpretation |
| --- | --- | ---: | --- | ---: | --- |
| `pricing-discount-demo-v1` | Executable/example-bearing specs vs prose-only specs. Event API and examples were also exposed through runnable specs. | +0.4444 | 3/3 positive | +0.5926 | Strong bounded evidence that executable, example-bearing BDD-style specs beat prose-only specs under this task/model/budget. |
| `pricing-discount-content-controlled-demo-v1` | Both arms received identical event API and worked examples; only runnability differed. | +0.1852 | 3/3 positive | +0.2222 | Smaller but clean evidence that the executable run-loop itself helped under this task/model/budget. |

Allowed summary:

> On a sealed pricing-lifecycle task under `mistral-small` with a 2-turn / 1-feedback budget, executable specs helped in two ways. First, executable, example-bearing BDD-style checks beat prose-only specs by clarifying the contract and giving the agent runnable examples. Second, after the interface and worked examples were equalized across both arms, the executable feedback loop still improved regression-free path survival in three clean pilots. Preliminary, task/model/budget-specific, not generalized.

Disallowed summary:

> Feedback proves BDD works.

> Feedback always reduces regressions.

> These pricing results generalize across models or tasks.

## Clean Final-Pass-Primary Causal Pilots

These historical subscription/inventory runs used final checkpoint pass-rate delta as the primary metric. Their regression-free AUC values are secondary or retrospective observations.

| Run card | Task version | Model/profile boundary | Primary final delta | Secondary AUC delta | Public interpretation |
| --- | --- | --- | ---: | ---: | --- |
| `docs/run-cards/subscription-entitlements-causal-pilot-20260605-002.md` | `subscription-entitlements-lifecycle-v0` | Sonnet structured-output retry profile | 0 | 0 | Flat primary and secondary result; both arms reached 9/9. |
| `docs/run-cards/subscription-entitlements-causal-pilot-20260605-003.md` | `subscription-entitlements-lifecycle-v0` | Mistral structured-output retry profile | 0 | +0.1111 | Flat primary result; feedback-capable arm had better secondary checkpoint survival. |
| `docs/run-cards/inventory-reservations-causal-pilot-20260605-001.md` | `inventory-reservations-lifecycle-v0` | Mistral structured-output retry profile | 0 | 0 | Flat primary and secondary result; both arms reached 9/9. |

Allowed summary:

> Earlier subscription and inventory lifecycle pilots were clean but mostly flat/easy. They are calibration and boundary evidence, not the headline positive result.

## Clean Path-Survival Causal Pilots

### Pricing v0: executable/example-bearing specs vs prose-only specs

Boundary: `pricing-discount-lifecycle-v0`, matrix `pricing-discount-demo-v1`. Run card: `docs/run-cards/pricing-discount-demo-v1-mistral-20260608.md`.

| Run | Primary AUC delta | Final delta | Feedback regressions | Public interpretation |
| --- | ---: | ---: | ---: | --- |
| `pricing-discount-demo-v1-causal-pilot-20260608-002` | +0.5556 | +0.5556 | 0 | Feedback implemented and preserved more of the spec. |
| `pricing-discount-demo-v1-causal-pilot-20260608-003` | +0.2222 | +0.4444 | 2 | Feedback progressed further but regressed two coupon rules at I07. |
| `pricing-discount-demo-v1-causal-pilot-20260608-004` | +0.5556 | +0.7778 | 0 | Feedback reached 9/9. |

Aggregate: mean AUC delta `+0.4444`, mean final delta `+0.5926`, positive AUC direction `3/3`, regression-count deltas (feedback minus context) `0 / +2 / 0`.

Caveat: this is not isolated run-loop evidence because runnable specs also disclosed concrete event API and worked examples.

### Pricing content-controlled: run-loop after content parity

Boundary: `pricing-discount-lifecycle-content-controlled-v1`, matrix `pricing-discount-content-controlled-demo-v1`. Run card: `docs/run-cards/pricing-discount-content-controlled-demo-v1-mistral-20260608.md`.

| Run | Primary AUC delta | Final delta | Regression delta (F-C) | Public interpretation |
| --- | ---: | ---: | ---: | --- |
| `pricing-discount-content-controlled-demo-v1-causal-pilot-20260608-001` | +0.3333 | 0.0000 | 0 | Same final score, better feedback path survival. |
| `pricing-discount-content-controlled-demo-v1-causal-pilot-20260608-002` | +0.1111 | +0.3333 | 0 | Feedback final score higher. |
| `pricing-discount-content-controlled-demo-v1-causal-pilot-20260608-003` | +0.1111 | +0.3333 | -1 | Feedback final score higher; only true regression was context-side. |

Aggregate: mean AUC delta `+0.1852`, mean final delta `+0.2222`, positive AUC direction `3/3`, regression-count deltas (feedback minus context) `0 / 0 / -1`.

Allowed summary:

> After both arms received the same concrete event API and worked examples, the executable feedback loop still improved regression-free path survival under this task/model/budget. The effect shrank compared with v0, which shows that contract/example disclosure carried part of the original advantage.

## Strong-Model Ceiling Checks (not causal evidence)

Strong-model checks solved both arms on the content-controlled pricing task and on the denser payroll skeleton-seed task. This supports the bounded interpretation that the positive Mistral pricing result is cheap/weak-model viability, not evidence that frontier models need executable feedback on well-specified single-file tasks.

| Run | Classification | Task version | Model/provider | Context final | Feedback final | AUC delta |
| --- | --- | --- | --- | ---: | ---: | ---: |
| `pricing-discount-content-controlled-sonnet-4.6-control-v1-smoke-20260608-001` | `diagnostic_invalid` | `pricing-discount-lifecycle-content-controlled-v1` | OpenRouter `anthropic/claude-sonnet-4.6` | 9/9 | 9/9 | 0 |
| `pricing-discount-content-controlled-alibaba-qwen3.7-max-smoke-20260609-001` | `diagnostic_invalid` | `pricing-discount-lifecycle-content-controlled-v1` | direct Alibaba/Qwen `qwen3.7-max` | 9/9 | 9/9 | 0 |
| `payroll-net-pay-skeleton-seed-sonnet-4.6-a2-difficulty-output12000-002` | `difficulty_probe` | `payroll-net-pay-lifecycle-skeleton-seed-v1` | OpenRouter `anthropic/claude-sonnet-4.6` | 18/18 | 18/18 | 0 |

The pricing controls are clean `diagnostic_invalid` smokes (provider/ceiling evidence), not causal pilots. The payroll control is a clean `difficulty_probe`; because the context-only arm reached 18/18, causal pilots on that boundary are blocked. A `google/gemini-3.1-pro-preview` smoke was provider-flagged (malformed + timeout) and excluded. The first payroll A2 attempt failed due OpenRouter 402 credit exhaustion and is recorded as invalid provider context only.

Allowed summary:

> Frontier-grade models solved the tested well-specified single-file tasks in both arms: pricing content-controlled at 9/9 and payroll skeleton-seed at 18/18. The executable-spec benefit observed on Mistral-small is therefore best read as cheap/weak-model viability, not a demonstrated benefit for frontier models that already ceiling these tasks. These ceiling checks are not causal evidence.

## Clean Difficulty Probes With Public Cards

Difficulty probes are not causal evidence. They can describe provider cleanliness, task solvability under a model/budget, and checkpoint-survival behavior, but not treatment effects.

| Run card | Task version | Model/profile boundary | Primary final delta | Secondary AUC delta | Public interpretation |
| --- | --- | --- | ---: | ---: | --- |
| `docs/run-cards/subscription-entitlements-difficulty-probe-20260605-009.md` | `subscription-entitlements-lifecycle-v0` | Sonnet structured-output retry profile | 0 | 0 | Clean difficulty/provider evidence; both arms reached 9/9. |
| `docs/run-cards/inventory-reservations-difficulty-probe-20260605-001.md` | `inventory-reservations-lifecycle-v0` | Mistral structured-output retry profile | 0 | -0.2222 | Clean difficulty/provider evidence; both arms reached 9/9, feedback-capable had temporary I05/I06 misses. |
| `docs/run-cards/payroll-net-pay-skeleton-seed-sonnet-4.6-a2-difficulty-output12000-002-20260609.md` | `payroll-net-pay-lifecycle-skeleton-seed-v1` | Sonnet 4.6 output12000 profile | 0 | 0 | Clean ceiling/difficulty evidence; both arms reached 18/18, so causal pilots on this boundary are blocked. |

## Compatibility Boundaries

Do not pool across these boundaries:

| Boundary | Why it matters |
| --- | --- |
| Task version | Different visible specs, feedback assets, hidden oracle, and checkpoint semantics. |
| Model/provider profile | Different model behavior and provider execution settings. |
| Protocol profile | `final-checkpoint-primary-v1` and `path-survival-primary-v1` answer different primary questions. |
| Content-control status | `pricing-discount-lifecycle-v0` and `pricing-discount-lifecycle-content-controlled-v1` answer different mechanism questions. |
| Run classification | Difficulty probes and causal pilots answer different questions. |
| Validity flags | Provider-flagged runs are not clean primary evidence. |

## Current Claim Ceiling

The repo can currently make Level 4 task/model/profile-specific causal pilot claims:

- flat primary results on the easier subscription/inventory tasks
- positive executable/example-bearing spec contrast on pricing v0
- positive content-controlled run-loop result on pricing content-controlled

It can also make Level 3 difficulty/ceiling claims that frontier-grade models ceiling the tested well-specified single-file pricing and payroll tasks under the listed boundaries. The repo is not allowed to make a Level 5 generalized claim because the evidence set is small, intentionally bounded, and single-model on the positive pricing results.

## Recommended Public Wording

Use:

- "clean sealed pilot"
- "under this task/model/budget"
- "path-survival primary"
- "content-controlled"
- "preliminary"
- "not a generalized benchmark claim"

Avoid:

- "proved"
- "benchmark shows feedback works"
- "feedback beats context" without qualification
- "feedback always reduces regressions"
- "scientifically proven"
