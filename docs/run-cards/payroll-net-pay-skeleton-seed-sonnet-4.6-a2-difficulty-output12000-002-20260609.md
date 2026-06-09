# Run Card: payroll-net-pay-skeleton-seed Sonnet 4.6 A2 rerun 20260609

Status: clean A2 difficulty probe. The task ceilings Sonnet 4.6 under this skeleton-seed/profile/budget boundary, so causal pilots are blocked.

## Boundary

- Protocol: `payroll-net-pay-skeleton-seed-ceiling-test-v1`
- Provider-profile freeze commit: `e87457e`
- Task: `payroll-net-pay-lifecycle-skeleton-seed`
- Task version: `payroll-net-pay-lifecycle-skeleton-seed-v1`
- Run ID: `payroll-net-pay-skeleton-seed-sonnet-4.6-a2-difficulty-output12000-002`
- Run classification: `difficulty_probe`
- Protocol profile: `path-survival-primary-v1`
- Conditions: `context_only_spec`, `feedback_capable_spec`
- Model/provider: OpenRouter `anthropic/claude-sonnet-4.6`, `openrouter-loop`
- Budget: `max_model_turns=2`, `max_feedback_runs=1`, `condition_concurrency=2`
- Provider profile:

```text
openrouter-loop-v1-modelanthropic-claude-sonnet-4.6-routeopenrouter-chat-completions-parseropenrouter-response-parser-v1-requestopenrouter-chat-request-max-tokens-v1-formatmodel-loop-response-json-schema-v1-requireparams1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output12000-workspace128000-feedback4000-temp0.2-retry1
```

## Artifact Check

- Manifest: `runs/payroll-net-pay-skeleton-seed-sonnet-4.6-a2-difficulty-output12000-002/run.json`
- Result: `runs/payroll-net-pay-skeleton-seed-sonnet-4.6-a2-difficulty-output12000-002/result.json`
- Summary: `runs/payroll-net-pay-skeleton-seed-sonnet-4.6-a2-difficulty-output12000-002/summary.md`
- Inspection: `valid=true`, `replay_steps=36`, `mismatches=0`
- Run validity flags: none
- Provider timeout detail count: `0`
- Provider carry-forward checkpoints: `0`
- Feedback opportunity integrity: not applicable

## Results

| Condition | Final passed | Pass rate | Regression-free AUC | Regressions |
| --- | ---: | ---: | ---: | ---: |
| `context_only_spec` | 18/18 | 1.0000 | 1.0000 | 0 |
| `feedback_capable_spec` | 18/18 | 1.0000 | 1.0000 | 0 |

- Final checkpoint pass-rate delta: `0`
- Regression-free AUC delta: `0`
- Both arms preserved `C01` through `C06`.
- Both arms passed every hard interaction checkpoint through `C18`.

## Source Audit

The captured `workspace-code-after.json` artifacts show real model-authored source changes, not provider carry-forward:

- `context_only_spec`: all 18 checkpoint agent results `ok`, no provider carry-forward, 13 distinct code snapshots.
- `feedback_capable_spec`: all 18 checkpoint agent results `ok`, no provider carry-forward, 9 distinct code snapshots.
- Final `src/payroll.ts` in both arms removed the skeleton TODO stubs and contains implementations for YTD cap logic, garnishments, and bonus void handling.

## Gate Decision

Per the predeclared A2 interpretation rule, this is a clean ceiling result:

- `context_only_spec` did not merely preserve `C01` through `C06`; it reached `18/18`.
- Failures were not concentrated in later hard-rule drift because there were no failures.
- The task therefore does not clear the strong-model ceiling gate for Sonnet 4.6 under this profile.

Do not run causal pilots from this boundary. This result is Level 3 difficulty evidence only: under this sealed task/model/budget, Sonnet 4.6 can complete the skeleton-seed payroll task from the context-only prompt.

## Interpretation

The skeleton-seed fix successfully removed the structural-failure ambiguity from the prior invalid attempts. The resulting task is operationally clean and auditable, but not ceiling-resistant enough for Sonnet 4.6. For the project goal, this supports the broader conclusion that showing run-loop benefit on frontier-grade coding models requires a harder task than the current payroll skeleton-seed design, not simply another causal pilot on this boundary.
