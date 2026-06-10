# Why A Timeout-Flagged 9/9 Run Is Not Clean Evidence

A 9/9 final score can still be non-clean evidence when provider failures affect the run path.

The key example is `subscription-entitlements-difficulty-probe-20260605-004`. It ended with both arms at 9/9, but six checkpoints had provider timeouts:

- `context_only_spec`: `I02`, `I07`, `I09`
- `feedback_capable_spec`: `I06`, `I07`, `I08`

Every timeout was classified as `pre_model_action_timeout`. That means no usable model action occurred for those checkpoints.

## What The Harness Did

When a provider failure occurred before a usable action, the harness carried the previous workspace forward and recorded the checkpoint as provider-affected. This preserves replayability and makes the run auditable, but it also means the agent did not genuinely complete the same work sequence the task intended.

Recorded signals included:

- `validity_flags=provider_timeout`
- timeout phase: `pre_model_action_timeout`
- provider-failure workspace carry-forward checkpoints: 6
- replay-valid artifacts with 0 mismatches

Replay-valid does not mean provider-clean. It means the artifacts faithfully replay the run that happened.

## Why 9/9 Is Not Enough

The primary metric asks whether each condition preserved all required behavior by the final checkpoint. A provider timeout can let a condition carry forward a previous workspace instead of producing a new checkpoint-specific implementation. That contaminates difficulty interpretation because the final score no longer cleanly reflects model work at every checkpoint.

The correct interpretation is:

> The run is structurally valid and replay-valid, but provider-flagged. It is useful diagnostic evidence, not clean primary evidence.

The incorrect interpretation is:

> The task is easy because both arms scored 9/9.

## What Counts As Cleaner Evidence

For a provider run to be clean for public difficulty interpretation, it needs:

- no provider validity flags
- no provider timeout details
- no provider-failure workspace carry-forward
- replay-valid artifacts
- 0 replay mismatches
- a compatible predeclared provider profile

`subscription-entitlements-difficulty-probe-20260605-009` met those provider-clean requirements under `anthropic/claude-sonnet-4.6`, but it is still a `difficulty_probe`, not causal evidence.

## Public Wording

Preferred:

> The timeout-flagged 9/9 runs were replay-valid diagnostics, but provider failures contaminated the work path, so they are not clean primary evidence.

Avoid:

> The timeout-flagged 9/9 runs prove the task was too easy.
