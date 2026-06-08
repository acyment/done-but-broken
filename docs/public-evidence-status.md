# Public Evidence Status

This page summarizes the current evidence state for industry-facing communication. Claims must track run classification, validity flags, replayability, and compatibility boundaries.

For the compact cross-run table, see `docs/public-evidence-matrix.md`. For the public narrative draft, see `docs/pricing-discount-public-narrative.md`.

## Current Claim

Current evidence is not generalized validation that executable feedback works across tasks or models. It does support one bounded, replayable pricing-lifecycle story under `mistralai/mistral-small-2603` with a 2-turn / 1-feedback budget:

- `pricing-discount-demo-v1` showed that executable, example-bearing BDD-style specs beat prose-only specs on a sealed pricing task: mean regression-free AUC delta `+0.4444`, positive in `3/3`, mean final-pass delta `+0.5926`.
- Artifact review found that this v0 result bundled runnability with interface/worked-example disclosure. The prose-only arm did not receive concrete event API examples and often guessed the wrong interface.
- `pricing-discount-content-controlled-demo-v1` removed that confound by giving both arms the same event API and worked examples. The executable run-loop still helped: mean AUC delta `+0.1852`, positive in `3/3`, mean final-pass delta `+0.2222`, no provider flags, complete feedback opportunity.

Bounded public claim: under this sealed pricing task/model/budget, executable specs helped agents implement and preserve more behavior. Part of the original win was contract/example clarification; a smaller but clean run-loop effect remained after content parity.

The earlier subscription and inventory pilots were clean but mostly flat/easy. They are important calibration context and should not be hidden, but they are not the headline.

## Current Status

| Area | Status | Public claim level |
| --- | --- | --- |
| Harness and provenance | Replay validation, artifact hashes, hidden-oracle isolation, compatibility profiles, provider validity flags, run summaries, and feedback-opportunity checks are implemented. | Level 0 harness claim |
| Subscription task package | `subscription-entitlements-lifecycle-v0` is implemented, locally validated, and documented with task/run cards. Clean causal pilots are flat on primary final-pass delta. | Level 1 and task-specific Level 4 flat claim |
| Inventory task package | `inventory-reservations-lifecycle-v0` is implemented, locally validated, and documented with task/run cards. Clean causal pilot is flat. | Level 1, Level 3, and task-specific Level 4 flat claim |
| Pricing v0 executable-spec contrast | 3 clean Mistral causal pilots under `path-survival-primary-v1`: mean AUC delta `+0.4444`, mean final-pass delta `+0.5926`. Caveat: interface/worked examples were also disclosed through runnable specs. | Level 4 positive condition-contrast claim |
| Pricing content-controlled run-loop | 3 clean Mistral causal pilots under `path-survival-primary-v1`: both arms received identical event API and worked examples; mean AUC delta `+0.1852`, mean final-pass delta `+0.2222`, positive AUC direction `3/3`. | Level 4 preliminary run-loop causal pilot claim |
| Generalized benchmark claim | Not allowed. | No Level 5 claim |

## Clean Causal Runs

| Run | Task version | Model/profile | Primary interpretation |
| --- | --- | --- | --- |
| `docs/run-cards/subscription-entitlements-causal-pilot-20260605-002.md` | `subscription-entitlements-lifecycle-v0` | Sonnet structured-output retry profile | Flat final-pass and AUC result: both arms 9/9. |
| `docs/run-cards/subscription-entitlements-causal-pilot-20260605-003.md` | `subscription-entitlements-lifecycle-v0` | Mistral structured-output retry profile | Flat primary final-pass result; secondary AUC +0.1111. |
| `docs/run-cards/inventory-reservations-causal-pilot-20260605-001.md` | `inventory-reservations-lifecycle-v0` | Mistral structured-output retry profile | Flat final-pass and AUC result: both arms 9/9. |
| `docs/run-cards/pricing-discount-demo-v1-mistral-20260608.md` | `pricing-discount-lifecycle-v0` | Mistral structured-output retry profile | Positive executable/example-bearing spec contrast; not isolated run-loop evidence. |
| `docs/run-cards/pricing-discount-content-controlled-demo-v1-mistral-20260608.md` | `pricing-discount-lifecycle-content-controlled-v1` | Mistral structured-output retry profile | Positive run-loop result after interface and worked-example parity. |

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
| Level 4: causal pilot claim | Yes, bounded | Subscription/inventory were flat/easy. Pricing v0 showed executable/example-bearing specs beat prose-only specs. Pricing content-controlled showed a smaller but clean run-loop benefit after content parity. |
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

Package the public narrative around the two pricing experiments and keep the claim bounded. Optional future strengtheners are a strong-model ceiling run and a second content-controlled task family, but neither is required for the current industry-facing statement.
