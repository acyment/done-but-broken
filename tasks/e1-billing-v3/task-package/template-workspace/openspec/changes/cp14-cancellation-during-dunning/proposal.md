## Why
Customers in collections still have the right to cancel, immediately or at the period boundary.

## What Changes
- Add subscription_canceled events with immediate and at_period_end modes, including cancellation while past_due; immediate cancellation clears dunning and scheduled changes.
- This MODIFIES the subscription lifecycle requirement again: restate it in full with the cancellation paths added.
- Canonical state registry delta (append-only): append the field `cancel_at_period_end` to the subscription registry list (after `dunning`); as a boolean it is omitted while false.
