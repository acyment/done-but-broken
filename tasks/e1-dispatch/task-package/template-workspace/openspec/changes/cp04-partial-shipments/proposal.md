## Why
Warehouses ship multi-line orders in waves; lumping half-shipped orders in with untouched ones hides fulfillment progress from everyone downstream.

## What Changes
- A paid order with at least one shipped line and at least one unshipped line is now reported as partially_shipped everywhere a status is shown; such orders previously appeared as processing.
- In lifecycle order, partially_shipped sits between processing and shipped.
