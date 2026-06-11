## Why
Customers upgrade mid-period and must be charged fairly for the remainder of the period without waiting for renewal.

## What Changes
- Apply plan upgrades immediately and queue a prorated credit for unused time on the old plan and a prorated charge for remaining time on the new plan onto the next generated invoice, rounding each line half-even.
- Canonical state registry delta (append-only): append the section `pending_prorations` to the section registry (after `audit`); entries are line records keyed by subscription id, rendered with the existing line registry. All earlier worked replay hashes must still reproduce.
