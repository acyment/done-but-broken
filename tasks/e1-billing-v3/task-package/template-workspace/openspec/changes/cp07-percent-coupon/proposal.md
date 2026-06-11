## Why
Marketing needs percentage promotions that apply across everything on an invoice for a fixed number of invoices.

## What Changes
- Add percent coupons with an invoice-count duration; the discount is computed half-even on the discountable base and allocated across positive lines (including three-line invoices) by the largest-remainder method.
- Canonical state registry delta (append-only): append the section `coupons` to the section registry (after `pending_prorations`) with coupon registry [`coupon_id`, `kind`, `percent_bp`, `amount_cents`, `remaining_invoices`]; append `discount_total_cents` to the invoice registry list (after `captured_cents`); append `discount_cents` to the line registry list (after `amount_cents`).
