## Why
Failed payments must move subscriptions into a recoverable collections state instead of cutting customers off immediately, and product access during collections must follow the documented grace policy.

## What Changes
- Add payment_failed events that move the subscription to past_due and count dunning attempts; a capture that pays the invoice in full recovers the subscription to active.
- Add the entitlement query: full while trialing or active, grace while past_due through the second failed attempt, none from the third attempt or when canceled.
- This MODIFIES the existing subscription lifecycle requirement: restate it in full (every scenario that remains in force) with the past_due transitions added.
- Canonical state registry delta (append-only): append the field `dunning` to the subscription registry list (after `scheduled_change`); it renders as a nested record with registry [`attempts`, `entered_at`] and is omitted while null.
