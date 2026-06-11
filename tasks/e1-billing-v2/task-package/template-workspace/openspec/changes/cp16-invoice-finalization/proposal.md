## Why
Accounting locks invoices at close; corrections must produce new documents instead of editing locked ones.

## What Changes
- Add invoice_finalized and invoice_recomputed events: recomputing an open invoice reprices it in place, recomputing a finalized invoice writes a new document and leaves the original untouched.
