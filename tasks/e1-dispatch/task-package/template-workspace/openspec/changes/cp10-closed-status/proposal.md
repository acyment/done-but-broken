## Why
An order that has been fully returned and all lines refunded has reached its final settled state and should be distinguished from an order that is merely returned but not yet settled.

## What Changes
- Everywhere a status is shown, a fully paid order where every line has been both returned and refunded is now reported as closed; it previously appeared as returned.
- An order where every line is returned but at least one line has not been refunded remains returned.
- closed sits after returned in lifecycle order.