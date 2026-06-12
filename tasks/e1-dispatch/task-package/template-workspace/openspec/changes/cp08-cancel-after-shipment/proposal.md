## Why
Cancelling an order after merchandise already left the warehouse creates refund work that a plain cancellation does not; finance needs these flagged.

## What Changes
- An order cancelled after at least one of its lines shipped is now reported as cancelled_partial everywhere a status is shown; such orders previously appeared as cancelled.
- In lifecycle order, cancelled_partial sits after cancelled.
- The export of a cancelled_partial order is flagged requires_refund, and re-importing preserves the flag.
