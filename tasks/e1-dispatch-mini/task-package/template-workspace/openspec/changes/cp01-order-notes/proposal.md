## Why
Support agents need free-text notes on orders, and partners need those notes to survive the export/import round-trip.

## What Changes
- Accept a note_added event that appends a free-text note to an order; notes never change an order's status.
- Exported orders include their notes when any exist; orders without notes export exactly as before.
- Re-importing an exported order preserves its notes.
