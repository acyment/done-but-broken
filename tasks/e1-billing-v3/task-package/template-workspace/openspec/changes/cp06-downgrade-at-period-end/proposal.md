## Why
Customers who downgrade keep what they paid for: the cheaper plan must only start at the next renewal.

## What Changes
- Schedule plan downgrades to take effect at the next period renewal, with no proration lines.
- Canonical state registry delta (append-only): append the field `scheduled_change` to the subscription registry list (after `period_end`); it renders as a nested record with registry [`plan_id`, `plan_price_cents`] and is omitted while null.
