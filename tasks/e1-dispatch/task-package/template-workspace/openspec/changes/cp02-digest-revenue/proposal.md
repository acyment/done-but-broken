## Why
The operations dashboard needs to see money at risk per lifecycle stage, not just order counts.

## What Changes
- Each status digest bucket also reports total_cents: the summed order totals of the bucket's orders.
- Buckets keep appearing in lifecycle order and empty buckets stay omitted.
