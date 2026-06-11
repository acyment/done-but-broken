## Why
Accounting locks invoices at close; corrections must produce new documents instead of editing locked ones.

## What Changes
- Add invoice_finalized and invoice_recomputed events: recomputing an open invoice reprices it in place, recomputing a finalized invoice writes a new document at new_invoice_id and leaves the original byte-for-byte untouched.
- This MODIFIES the existing invoice generation requirement: restate it in full with finalization added.
- Canonical state registry delta (append-only): append `finalized` to the invoice registry list (after `refunded_cents`); as a boolean it is omitted while false.
