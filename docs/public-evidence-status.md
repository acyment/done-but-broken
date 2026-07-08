# Public Evidence Status

This page summarizes the current evidence state for industry-facing communication. Claims must track run classification, validity flags, replayability, and compatibility boundaries.

For the compact cross-run table, see `docs/public-evidence-matrix.md`. For the public narrative draft, see `docs/pricing-discount-public-narrative.md`.

## Current Claim

The current **headline is the E2 brownfield result**: executable **acceptance feedback** reduces a
frontier coding agent's *confidently-wrong shipping* — it declares a task done while the hidden
acceptance tests would fail — on real, post-cutoff brownfield bugs (SWE-bench Live). It is a
**candidate finding, now replicated across two independent model lineages**, and **bounded** to this
task family / substrate / scaffold / budget (classification `causal_pilot`; not a Level-5 claim):

- **DeepSeek V4 Pro** (n=9): self-verification gap **79% → 13%**, fix rate ~doubled 19% → 38%; 8/9
  tasks significant, family-wise null *p* ≈ 3×10⁻¹⁰.
- **Qwen 3.7 Max** (n=9, second-lineage replication): gap **50% → 0%** (resolve ~flat — diagnostic
  here); 5/9 tasks significant, *p* ≈ 3×10⁻⁵.
- Production CLIs (**Codex GPT-5.5**, **Claude Code Opus 4.8**) show the same failure mode on the hard
  tasks (~67–73%) — `calibration` corroboration, **not** a controlled arm.

We measured executable **acceptance feedback** (running pre-existing acceptance tests), **not** full
HIT-SDD / authored specs — see the proto-paper.

This **refines, not contradicts**, the earlier E1 finding — it is a *regime* split:

- **Small, fully-specified tasks (E1):** frontier models self-verify well enough that executable
  feedback is **redundant** (they ceiling from the spec alone, zero on-graph regressions).
- **Brownfield scale beyond self-verification (E2):** the same feedback **near-eliminates**
  confident-wrong shipping (above).

So the honest one-liner is: **no** frontier benefit on small fully-specified tasks; a **bounded,
candidate→replicated** frontier benefit at brownfield scale.

### Prior bounded story (still valid, different boundary)

On a sealed single-file **pricing** task, executable BDD-style feedback made a **cheap/weak** model
materially more reliable; frontier models ceilinged the well-specified pricing/payroll tasks from the
shared spec alone. Detail:

- `pricing-discount-demo-v1`: executable example-bearing specs beat prose-only — mean AUC delta
  `+0.4444`, `3/3`, final-pass `+0.5926` (but v0 bundled runnability with interface/worked-example
  disclosure).
- `pricing-discount-content-controlled-demo-v1` removed that confound (same event API + examples both
  arms); the run-loop still helped: mean AUC delta `+0.1852`, `3/3`, final-pass `+0.2222`, no flags.
- Strong-model ceilings: pricing content-controlled — Sonnet 4.6 and Qwen 3.7 Max both 9/9 both arms;
  payroll skeleton-seed — Sonnet 4.6 18/18 both arms.

The earlier subscription and inventory pilots were clean but mostly flat/easy — calibration context,
not headline, not hidden.

## Current Status

| Area | Status | Public claim level |
| --- | --- | --- |
| Harness and provenance | Replay validation, artifact hashes, hidden-oracle isolation, compatibility profiles, provider validity flags, run summaries, and feedback-opportunity checks are implemented. | Level 0 harness claim |
| Subscription task package | `subscription-entitlements-lifecycle-v0` is implemented, locally validated, and documented with task/run cards. Clean causal pilots are flat on primary final-pass delta. | Level 1 and task-specific Level 4 flat claim |
| Inventory task package | `inventory-reservations-lifecycle-v0` is implemented, locally validated, and documented with task/run cards. Clean causal pilot is flat. | Level 1, Level 3, and task-specific Level 4 flat claim |
| Pricing v0 executable-spec contrast | 3 clean Mistral causal pilots under `path-survival-primary-v1`: mean AUC delta `+0.4444`, mean final-pass delta `+0.5926`. Caveat: interface/worked examples were also disclosed through runnable specs. | Level 4 positive condition-contrast claim |
| Pricing content-controlled run-loop | 3 clean Mistral causal pilots under `path-survival-primary-v1`: both arms received identical event API and worked examples; mean AUC delta `+0.1852`, mean final-pass delta `+0.2222`, positive AUC direction `3/3`. | Level 4 preliminary run-loop causal pilot claim |
| Strong-model ceiling checks | Pricing content-controlled ceilinged under Sonnet 4.6 and Qwen 3.7 Max; payroll skeleton-seed ceilinged under Sonnet 4.6 at 18/18 in both arms. | Level 3 difficulty/diagnostic ceiling evidence |
| E2 brownfield acceptance feedback (DeepSeek V4 Pro) | n=9 `causal_pilot`: self-verification gap 79%→13%, fix rate 19%→38%, 8/9 tasks significant, family-wise *p*≈3×10⁻¹⁰. | Level 4 candidate frontier-positive |
| E2 brownfield acceptance feedback (Qwen 3.7 Max) | n=9 `causal_pilot`, second independent lineage: gap 50%→0%, 5/9 significant, *p*≈3×10⁻⁵. | Level 4 replicated (bounded) |
| Generalized benchmark claim | Not allowed (single substrate/scaffold/budget). | No Level 5 claim |

## Clean Causal Runs

| Run | Task version | Model/profile | Primary interpretation |
| --- | --- | --- | --- |
| `docs/run-cards/subscription-entitlements-causal-pilot-20260605-002.md` | `subscription-entitlements-lifecycle-v0` | Sonnet structured-output retry profile | Flat final-pass and AUC result: both arms 9/9. |
| `docs/run-cards/subscription-entitlements-causal-pilot-20260605-003.md` | `subscription-entitlements-lifecycle-v0` | Mistral structured-output retry profile | Flat primary final-pass result; secondary AUC +0.1111. |
| `docs/run-cards/inventory-reservations-causal-pilot-20260605-001.md` | `inventory-reservations-lifecycle-v0` | Mistral structured-output retry profile | Flat final-pass and AUC result: both arms 9/9. |
| `docs/run-cards/pricing-discount-demo-v1-mistral-20260608.md` | `pricing-discount-lifecycle-v0` | Mistral structured-output retry profile | Positive executable/example-bearing spec contrast; not isolated run-loop evidence. |
| `docs/run-cards/pricing-discount-content-controlled-demo-v1-mistral-20260608.md` | `pricing-discount-lifecycle-content-controlled-v1` | Mistral structured-output retry profile | Positive run-loop result after interface and worked-example parity. |
| `docs/run-cards/e2-phase1-5-causal-pilot-deepseek-v4-pro-20260617-001.md` | E2 brownfield (SWE-bench Live, n=9) | DeepSeek V4 Pro / OpenHands | Candidate frontier-positive: self-verification gap 79%→13% (8/9 significant). |
| `docs/run-cards/e2-phase1-5-causal-pilot-qwen3.7-max-20260623.md` | E2 brownfield (SWE-bench Live, n=9) | Qwen 3.7 Max / OpenHands | Second-lineage replication: gap 50%→0% (5/9 significant). |

Clean causal pilots are task/model/profile-specific. They should not be pooled into a generalized claim.

## Pricing Result Decomposition

### v0 executable-spec contrast

Boundary: `pricing-discount-lifecycle-v0`, `pricing-discount-demo-v1`, `path-survival-primary-v1`, Mistral, budget `2/1`.

| Run | Context AUC | Feedback AUC | AUC delta | Final delta | Feedback regressions |
| --- | ---: | ---: | ---: | ---: | ---: |
| `pricing-discount-demo-v1-causal-pilot-20260608-002` | 0.2222 | 0.7778 | +0.5556 | +0.5556 | 0 |
| `pricing-discount-demo-v1-causal-pilot-20260608-003` | 0.2222 | 0.4444 | +0.2222 | +0.4444 | 2 |
| `pricing-discount-demo-v1-causal-pilot-20260608-004` | 0.2222 | 0.7778 | +0.5556 | +0.7778 | 0 |

Aggregate: mean AUC delta `+0.4444`, mean final-pass delta `+0.5926`, positive AUC direction `3/3`.

Interpretation: executable, example-bearing specs strongly outperformed prose-only specs. The honest caveat is that runnable feedback assets also showed concrete event API and worked examples, while the prose-only arm had to infer them.

### Content-controlled run-loop result

Boundary: `pricing-discount-lifecycle-content-controlled-v1`, `pricing-discount-content-controlled-demo-v1`, `path-survival-primary-v1`, Mistral, budget `2/1`.

| Run | Context AUC | Feedback AUC | AUC delta | Context final | Feedback final | Final delta | Regressions C/F |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `pricing-discount-content-controlled-demo-v1-causal-pilot-20260608-001` | 0.4444 | 0.7778 | +0.3333 | 7/9 | 7/9 | 0.0000 | 0 / 0 |
| `pricing-discount-content-controlled-demo-v1-causal-pilot-20260608-002` | 0.4444 | 0.5556 | +0.1111 | 4/9 | 7/9 | +0.3333 | 0 / 0 |
| `pricing-discount-content-controlled-demo-v1-causal-pilot-20260608-003` | 0.3333 | 0.4444 | +0.1111 | 3/9 | 6/9 | +0.3333 | 1 / 0 |

Aggregate: mean AUC delta `+0.1852`, mean final-pass delta `+0.2222`, positive AUC direction `3/3`, regression-count deltas (feedback minus context) `0 / 0 / -1`.

Interpretation: after both arms received the same event API and worked examples, the gap shrank but did not disappear. This is the cleanest current evidence that the executable run-loop itself helped under this task/model/budget.

### Strong-model ceiling (the benefit is cheap/weak-model viability)

Two independent strong-model smokes on the content-controlled pricing task both solved BOTH arms 9/9, so a capable model needs no executable feedback there — it implements the task from the shared spec and event API alone.

| Smoke (diagnostic_invalid) | Model/provider | Context final | Feedback final | AUC delta |
| --- | --- | ---: | ---: | ---: |
| `pricing-discount-content-controlled-sonnet-4.6-control-v1-smoke-20260608-001` | OpenRouter `anthropic/claude-sonnet-4.6` | 9/9 | 9/9 | 0 |
| `pricing-discount-content-controlled-alibaba-qwen3.7-max-smoke-20260609-001` | direct Alibaba/Qwen `qwen3.7-max` | 9/9 | 9/9 | 0 |

These are clean `diagnostic_invalid` smokes (provider-reliability + ceiling evidence), not causal pilots — a convergent ceiling hint across two vendors, not Level-4 evidence. A `google/gemini-3.1-pro-preview` smoke was provider-flagged and excluded. Each control is a separate non-pooled boundary.

The harder payroll skeleton-seed A2 check reached the same conclusion on a different, denser single-file task:

| Run (difficulty_probe) | Task version | Model/provider | Context final | Feedback final | AUC delta |
| --- | --- | --- | ---: | ---: | ---: |
| `payroll-net-pay-skeleton-seed-sonnet-4.6-a2-difficulty-output12000-002` | `payroll-net-pay-lifecycle-skeleton-seed-v1` | OpenRouter `anthropic/claude-sonnet-4.6` | 18/18 | 18/18 | 0 |

This payroll run is clean Level 3 difficulty evidence, not causal evidence. It blocks causal pilots on that boundary because the context-only arm already ceilinged the task.

So on **this boundary** (small, well-specified single-file tasks) the bounded claim is **cheap/weak-model viability**: executable, runnable specs let a cheaper agent implement an evolving spec much more reliably, where frontier models already ceiling. *This "no frontier benefit" statement is specific to small fully-specified tasks* — the separate **E2 brownfield** program found a bounded, candidate→replicated frontier benefit at scale (see Current Claim).

## Compatibility Boundary

Do not pool:

- `pricing-discount-lifecycle-v0` with `pricing-discount-lifecycle-content-controlled-v1`
- pricing runs with subscription or inventory runs
- Mistral, Sonnet, Gemini, Qwen, DeepSeek, and provider-triage boundaries
- difficulty probes with causal pilots
- provider-flagged or invalid runs with clean evidence
- `final-checkpoint-primary-v1` evidence with `path-survival-primary-v1` evidence
- structured-output and non-structured-output provider profiles

## Evidence Ladder

| Level | Allowed claim now? | Current wording |
| --- | --- | --- |
| Level 0: harness claim | Yes | The harness can run two conditions, preserve workspaces, execute hidden oracles, and replay/verify artifacts. |
| Level 1: calibration claim | Yes | Subscription, inventory, and pricing task packages and feedback/oracle plumbing work locally. |
| Level 2: provider reliability claim | Yes, for clean profiles used here | The external provider path completed cleanly under the listed sealed profiles. |
| Level 3: difficulty claim | Yes, for clean difficulty probes | Difficulty probes describe task/model/budget solvability only; they are not causal evidence. |
| Level 4: causal pilot claim | Yes, bounded | E2 brownfield: executable acceptance feedback cut confident-wrong shipping (DeepSeek 79%→13%; Qwen 50%→0%, second-lineage replication) — candidate→replicated, bounded. Pricing v0/content-controlled: cheap-model run-loop benefit on a small task. Subscription/inventory flat/easy. |
| Level 5: generalized claim | No | The repo is not currently allowed to make generalized claims. |

## Known Invalid Or Non-Primary Runs

Provider-flagged and invalid runs remain part of the narrative because they explain provider reliability and validity gates. None are clean primary evidence.

| Run | Classification | Main issue | Public use |
| --- | --- | --- | --- |
| `subscription-entitlements-difficulty-probe-20260605-004` | `difficulty_probe` | Provider timeouts and carry-forward | Explains why 9/9 can still be non-clean evidence. |
| `subscription-entitlements-difficulty-probe-20260605-005` | `difficulty_probe` | Malformed provider responses and carry-forward | Provider reliability diagnostic. |
| `subscription-entitlements-difficulty-probe-20260605-006` | `difficulty_probe` | Timeouts plus malformed responses | Provider reliability diagnostic. |
| `subscription-entitlements-difficulty-probe-20260605-007` | `difficulty_probe` | One malformed response and one timeout | Provider reliability diagnostic. |
| `subscription-entitlements-difficulty-probe-20260605-008` | `difficulty_probe` | Retry-recovered malformed responses | Provider reliability diagnostic. |
| `subscription-entitlements-causal-pilot-20260605-001` | `causal_pilot` | Incomplete feedback opportunity and artifact mismatches | Invalid causal attempt, superseded by `subscription-entitlements-causal-pilot-20260605-002`. |
| `payroll-net-pay-skeleton-seed-sonnet-4.6-a2-difficulty-output12000` | `difficulty_probe` | OpenRouter 402 credit exhaustion | Invalid provider attempt, superseded by clean rerun `payroll-net-pay-skeleton-seed-sonnet-4.6-a2-difficulty-output12000-002`. |

## Public Wording

Preferred:

- "preliminary"
- "clean sealed pilot"
- "replay-valid"
- "under this task/model/budget"
- "not a generalized benchmark claim"
- "executable specs helped by clarifying the contract and by enabling a feedback loop"

Avoid:

- "proved"
- "benchmark shows feedback works"
- "feedback beats context" without qualification
- "feedback always reduces regressions"
- "scientifically proven"
- "generalizes across models"

## Next Public Step

Package the completed E2 acceptance-feedback phase as a bounded, two-lineage result: executable
acceptance feedback reduces single-task false-confidence shipping under this substrate/scaffold/budget,
but the result is not a generalized benchmark claim and not full HIT-SDD.

**Update (2026-07-04):** the immediate next research move is now the E3 sequential brownfield
regression program, drafted in
`docs/protocols/e3-brownfield-regression-after-several-changes-design-v1.md`. The goal is to measure
true regressions after several carried-forward changes in the same real repo, then, only after
control-only calibration shows the metric fires, test whether official executable feedback improves
regression-free episode survival. This is a new compatibility boundary and will not be pooled with E2,
E1, authored-spec Stage 0, or the earlier pricing/subscription/inventory results.
