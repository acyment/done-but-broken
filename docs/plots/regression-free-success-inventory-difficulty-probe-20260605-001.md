# Regression-Free Success: inventory-reservations-difficulty-probe-20260605-001

Run classification: `difficulty_probe`

This plot is a text artifact for public communication. It is not a causal estimate.

| Condition | I01 | I02 | I03 | I04 | I05 | I06 | I07 | I08 | I09 | AUC |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `context_only_spec` | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1.0000 |
| `feedback_capable_spec` | 1 | 1 | 1 | 1 | 0 | 0 | 1 | 1 | 1 | 0.7778 |

Secondary AUC delta, feedback minus context: `-0.2222`.

Both arms reached 9/9 at the final checkpoint. The feedback-capable arm temporarily missed the cancellation-release hidden commitment at `I05` and `I06` before recovering at `I07`.
