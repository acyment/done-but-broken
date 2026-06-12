## Why
Some customers pay in installments. Operations needs to track orders where payment has started but is not yet complete.

## What Changes
- Accept a partial_payment_received event with an amount_cents field; multiple partial payments accumulate.
- A paid order (via payment_received) remains fully paid regardless of prior partial payments.
- Everywhere a status is shown, an order with at least one partial payment recorded but not yet fully paid is reported as partially_paid; this sits between awaiting_payment and processing in lifecycle order.
- Exported orders with partially_paid status export exactly as other orders; re-import recognises partially_paid as a valid status.