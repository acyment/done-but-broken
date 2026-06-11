## Why
Finance needs per-line refund attribution that respects discounts already applied to each line.

## What Changes
- Allocate refund amounts across positive lines by remaining refundable net (amount minus discount minus already refunded) using the largest-remainder method.
