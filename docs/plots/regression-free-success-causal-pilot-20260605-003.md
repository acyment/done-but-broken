# Regression-Free Success: subscription-entitlements-causal-pilot-20260605-003

Run classification: `causal_pilot`

This plot is a public communication artifact for the clean Mistral causal pilot. It shows a flat primary result and positive secondary regression-free AUC result under this task/model/budget.

## Source Run

- Run ID: `subscription-entitlements-causal-pilot-20260605-003`
- Task version: `subscription-entitlements-lifecycle-v0`
- Provider/model: OpenRouter `mistralai/mistral-small-2603`
- Budget: `max_model_turns=2`, `max_feedback_runs=1`
- Validity flags: none
- Replay mismatches: 0
- Feedback opportunity integrity: complete, 9/9

## Regression-Free Success By Checkpoint

Regression-free success is `1` when all behavior accumulated through that checkpoint still passes hidden-oracle checks.

```mermaid
xychart-beta
  title "Regression-free success by checkpoint"
  x-axis ["I01", "I02", "I03", "I04", "I05", "I06", "I07", "I08", "I09"]
  y-axis "success" 0 --> 1
  line "context_only_spec" [0, 1, 1, 1, 1, 1, 1, 1, 1]
  line "feedback_capable_spec" [1, 1, 1, 1, 1, 1, 1, 1, 1]
```

## Values

| Condition | I01 | I02 | I03 | I04 | I05 | I06 | I07 | I08 | I09 | AUC |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `context_only_spec` | 0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0.8889 |
| `feedback_capable_spec` | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1.00 |

Regression-free AUC delta, feedback minus context: `0.1111`.

## Interpretation

Both arms reached 9/9 by the final checkpoint, but the context-only arm missed the first checkpoint before recovering. The feedback-capable arm preserved all accumulated behavior from the start.
