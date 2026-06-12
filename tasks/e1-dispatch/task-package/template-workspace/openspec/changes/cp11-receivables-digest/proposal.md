## Why
Finance needs a view of how much money is still outstanding across all orders, grouped by status, to prioritise collections and settlements.

## What Changes
- Add a new receivables_digest query kind; it returns one entry per status bucket where any order has outstanding amounts, with outstanding_cents equal to total order value minus payments received minus refunded line amounts; buckets where all orders are fully settled are omitted.
- The existing status_digest query is unchanged.