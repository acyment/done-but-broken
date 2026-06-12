## Why
When a customer has made a partial payment then cancels, the business is still owed money. Plain cancellations of never-paid orders are different from cancellations that leave an outstanding balance, and the distinction must be visible everywhere a status is shown.

## What Changes
- Everywhere a status is shown, a cancelled order that had at least one partial payment recorded but was never fully paid is now reported as cancelled_owing; an exported order in this status also carries outstanding_owing:true.
- Plain cancellation of an order that never received any payment remains cancelled.
- Full-payment-then-cancellation (with or without prior shipment) is unchanged: cancelled or cancelled_partial as applicable.
- cancelled_owing takes precedence over cancelled_partial when both conditions apply; the combination is forbidden in earlier corpora and first appears here.
- cancelled_owing sits after cancelled_partial in lifecycle order.