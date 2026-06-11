## Why
Finance needs a dispute-resolution artifact for every discount allocation: which line got the leftover cents and why.

## What Changes
- Generalize the largest-remainder allocator in the money module into a weighted primitive that returns its full trace, and add the allocation_trace query reporting per positive line the weight, floor share, raw remainder, leftover cents received, and final share.
- FROZEN through the restructure: the numeric shares of every existing allocation (discounts and refunds), all rounding behavior, and all invoice totals are byte-frozen. The trace must agree exactly with the discount_cents already on the lines.
- No registry delta: the trace is computed on demand; no new state.
