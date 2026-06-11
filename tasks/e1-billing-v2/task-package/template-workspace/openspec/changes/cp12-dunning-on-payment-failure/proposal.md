## Why
Failed payments must move subscriptions into a recoverable collections state instead of cutting customers off immediately.

## What Changes
- Add payment_failed events that move the subscription to past_due and count dunning attempts; a capture that pays the invoice in full recovers the subscription to active.
