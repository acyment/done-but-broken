## Why
Merchants need percentage discounts expressed in basis points so promotional pricing can be configured precisely without floating-point drift.

## What Changes
- Add a basis-point discount to the cart total computation, flooring the discount amount.
