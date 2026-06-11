## Why
Support resolves disputes with partial refunds, and refunds must never exceed what was actually captured.

## What Changes
- Add payment_refunded events with a hard refund cap at the invoice's captured amount; over-cap refunds are complete no-ops.
- Canonical state registry delta (append-only): append `refunded_cents` to the invoice registry list (after `discount_total_cents`) and `refunded_cents` to the line registry list (after `discount_cents`).
