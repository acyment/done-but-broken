## Why
A fully shipped order with some lines on their way back is neither cleanly shipped nor fully returned; support and operations need to see the difference.

## What Changes
- A fully shipped order with at least one returned line, but not all lines returned, is now reported as partially_returned everywhere a status is shown; such orders previously appeared as shipped.
- In lifecycle order, partially_returned sits between shipped and returned.
- Orders that still have unshipped lines keep their existing status rules.
