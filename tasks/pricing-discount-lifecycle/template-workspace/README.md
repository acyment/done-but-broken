# Pricing Discount Lifecycle

Implement the storefront pricing engine exported from `src/pricing.ts` according to
the semantic spec packet for each checkpoint.

The starting code already implements the base subtotal and per-line sale rules. Each
later checkpoint adds another pricing policy (coupons, bulk tiers, caps, tax, and
rounding) that composes with the rules already in place. Make sure new policies do not
change the totals required by earlier checkpoints.
