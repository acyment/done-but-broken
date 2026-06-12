## Why
Customers return merchandise; the business needs returns tracked per line and reflected wherever order data is shown.

## What Changes
- Accept a line_returned event for a shipped line; returns on lines that never shipped are ignored.
- An order whose lines are all returned is shown as returned everywhere a status is shown.
- Exported orders mark returned lines, and re-importing an exported order preserves the returned marks.
