# Run Card: pricing-discount-content-controlled Alibaba/Qwen 3.7 Max smoke 20260609

Status: A1-style smoke only, run on the direct Alibaba/Qwen path after the OpenRouter Qwen/Gemini structured-output attempts failed provider-cleanliness. This was a direct-path reliability retry, not a run under a pre-sealed Alibaba/Qwen matrix. Provider reliability + ceiling evidence only; no causal pilot was run.

## Boundary

- Task: `pricing-discount-lifecycle-content-controlled`
- Task version: `pricing-discount-lifecycle-content-controlled-v1`
- Protocol profile: `path-survival-primary-v1`
- Conditions: `context_only_spec`, `feedback_capable_spec`
- Provider/model: direct Alibaba/Qwen (Frankfurt, OpenAI-compatible endpoint) `qwen3.7-max`, adapter `openai-compatible-loop`
- Budget: `max_model_turns=2`, `max_feedback_runs=1`
- Provider profile ID:

```text
openai-compatible-loop-v1-modelqwen3.7-max-routealibaba-qwen-chat-completions-parseropenai-compatible-response-parser-v1-requestopenai-compatible-chat-request-max-tokens-v1-retrypolicyprovider-retry-timeout-rate-malformed-v1-looppolicymodel-loop-feedback-continues-after-feedback-v1-timeout120000-output4000-workspace64000-feedback4000-temp0.2-retry1
```

This Alibaba/Qwen direct-path provider profile is a distinct, non-pooled boundary. It is not the OpenRouter profile used by the Mistral demos.

## Smoke

Run: `pricing-discount-content-controlled-alibaba-qwen3.7-max-smoke-20260609-001`

- Manifest: `runs/pricing-discount-content-controlled-alibaba-qwen3.7-max-smoke-20260609-001/run.json`
- Result: `runs/pricing-discount-content-controlled-alibaba-qwen3.7-max-smoke-20260609-001/result.json`
- Summary: `runs/pricing-discount-content-controlled-alibaba-qwen3.7-max-smoke-20260609-001/summary.md`
- Inspection: `valid=true`, `replay_steps=18`, `mismatches=0`
- Run classification: `diagnostic_invalid`
- Clean primary evidence eligible: no
- Validity flags: none
- Provider timeouts: 0
- Provider carry-forward checkpoints: 0

Diagnostic outcome:

| Condition | Final passed | Final pass rate | Regression-free AUC | Regressions |
| --- | ---: | ---: | ---: | ---: |
| `context_only_spec` | 9/9 | 1.0000 | 1.0000 | 0 |
| `feedback_capable_spec` | 9/9 | 1.0000 | 1.0000 | 0 |

AUC delta (feedback − context): 0.

## Interpretation

Two findings, both provider/diagnostic only:

1. **Provider path:** the direct Alibaba/Qwen Frankfurt OpenAI-compatible endpoint runs cleanly under the `openai-compatible-loop` adapter, where the OpenRouter structured-output path repeatedly failed for non-Anthropic models (malformed responses, timeouts). The direct path was, however, slow.
2. **Strong-model ceiling:** `qwen3.7-max` solves the content-controlled task in **both** arms (9/9, AUC 1) under the 2-turn / 1-feedback budget. This is a strong-model ceiling result — the context arm needs no executable feedback because the model implements the task from the shared spec and event API alone. It is **not** evidence of a feedback advantage.

Combined with the Sonnet 4.6 content-controlled smoke (also both arms 9/9), two independent vendors show this task ceilings production-grade models. The feedback-loop benefit observed on Mistral-small (`+0.1852` AUC under content parity) is therefore best read as **cheap/weak-model viability**, not a benefit for already-ceilinging frontier models.

Do not pool this run with Mistral, Sonnet, Gemini, pricing v0, subscription, inventory, or DeepSeek runs. A proper sealed Alibaba/Qwen matrix and a cost/latency decision would be required before any causal use of this provider path.
