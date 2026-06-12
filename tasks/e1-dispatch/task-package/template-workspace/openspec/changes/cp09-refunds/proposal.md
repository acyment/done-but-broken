## Why
When a returned line is refunded, operations needs to track the refund and include it in partner exports and the status digest.

## What Changes
- Accept a refund_issued event with a line_id; refunds only apply to returned lines.
- Exported orders mark each refunded line with refunded:true; lines without a refund export as before.
- Re-importing an exported order preserves the refunded flag on each line.
- The status digest includes a refund_cents field per bucket when any order in that bucket has refunded lines; buckets with no refunds omit the field.
- An order's status is not changed by refunds alone; the conditions for closed status are introduced separately.