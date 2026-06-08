# Run Card: pricing-discount-provider-triage-smoke-v1 20260608

Status: provider triage completed; no candidate passed the clean provider smoke gate.

## Boundary

- Matrix profile: `pricing-discount-provider-triage-smoke-v1`
- Freeze commit: `62165f6`
- Task: `pricing-discount-lifecycle-v0`
- Protocol profile: `path-survival-primary-v1`
- Conditions: `context_only_spec`, `feedback_capable_spec`
- Budget: `max_model_turns=2`, `max_feedback_runs=1`
- Response format: `model-loop-response-json-schema-v1`
- Provider: OpenRouter, `openrouter-loop`
- Run classification: `diagnostic_invalid`

The matrix authorized one smoke each for:

- `minimax/minimax-m2.7`
- `z-ai/glm-4.7`
- `moonshotai/kimi-k2.5`

These are provider reliability diagnostics only. They are not causal evidence, not difficulty evidence, and not strong-control evidence.

## Inspection Summary

All three manifests passed local replay/provenance inspection, but all three recorded provider validity flags. Therefore none is a clean smoke.

| Model | Run ID | Inspect valid | Replay steps | Mismatches | Validity flags | Timeout details | Provider carry-forward checkpoints |
| --- | --- | --- | ---: | ---: | --- | ---: | ---: |
| `minimax/minimax-m2.7` | `pricing-discount-provider-triage-smoke-v1-minimax-m2.7-20260608-001` | yes | 18 | 0 | `provider_malformed_response`, `provider_timeout` | 1 | 1 |
| `z-ai/glm-4.7` | `pricing-discount-provider-triage-smoke-v1-glm-4.7-20260608-001` | yes | 18 | 0 | `provider_malformed_response`, `provider_timeout` | 1 | 18 |
| `moonshotai/kimi-k2.5` | `pricing-discount-provider-triage-smoke-v1-kimi-k2.5-20260608-001` | yes | 18 | 0 | `provider_timeout`, `provider_malformed_response` | 18 | 9 |

All three runs recorded:

- `run_classification=diagnostic_invalid`
- `protocol_profile_id=path-survival-primary-v1`
- budget `2/1`
- `clean_primary_evidence_eligible=false`
- exact sealed provider profile shape with only the model slug substituted
- `feedback_opportunity_integrity=not_applicable (0/0)`

## Provider Validity Details

| Model | Validity detail count | Malformed-response details | Timeout details | Timeout phases |
| --- | ---: | ---: | ---: | --- |
| `minimax/minimax-m2.7` | 6 | 5 | 1 | `retry_recovered_timeout` |
| `z-ai/glm-4.7` | 37 | 36 | 1 | `pre_model_action_timeout` |
| `moonshotai/kimi-k2.5` | 27 | 9 | 18 | `pre_model_action_timeout`, `retry_recovered_timeout`, `repair_turn_timeout` |

The common malformed-response message was:

```text
OpenRouter response message content must be a string or text content array.
```

Kimi also recorded repeated 120000ms provider timeouts. GLM carried workspaces forward due to provider failure across all 18 checkpoints.

## Diagnostic Outcomes

These outcome numbers are reported only for transparency. Because every run is provider-flagged and classified `diagnostic_invalid`, they must not be interpreted as treatment effects.

| Model | Context final | Feedback final | Final delta | Context AUC | Feedback AUC | AUC delta | Context regressions | Feedback regressions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `minimax/minimax-m2.7` | 2/9 | 9/9 | +0.7778 | 0.2222 | 0.8889 | +0.6667 | 0 | 0 |
| `z-ai/glm-4.7` | 2/9 | 2/9 | 0.0000 | 0.2222 | 0.2222 | 0.0000 | 0 | 0 |
| `moonshotai/kimi-k2.5` | 2/9 | 4/9 | +0.2222 | 0.2222 | 0.4444 | +0.2222 | 0 | 0 |

## Gate Decision

No model passed the clean provider smoke gate under `pricing-discount-provider-triage-smoke-v1`.

Do not promote MiniMax M2.7, GLM 4.7, or Kimi K2.5 from this matrix into a difficulty probe, strong-control pilot, or causal pilot. A downstream run would require a new predeclared boundary and a different provider/profile decision.

## Interpretation

Under this sealed pricing task and exact OpenRouter structured-output profile, all three alternatives were replay-valid locally but provider-flagged operationally. The result is useful as a negative provider-reliability screen: these OpenRouter routes are not clean enough for the next evidence-generating pricing control under the current `120000ms` timeout, JSON-schema response format, 4000-token output cap, and one-retry policy.

This does not say the underlying models are incapable. It says this OpenRouter structured-output integration profile did not produce clean smoke evidence for them.
