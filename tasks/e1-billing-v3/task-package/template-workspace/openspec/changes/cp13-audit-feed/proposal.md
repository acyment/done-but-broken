## Why
The customer portal needs one chronological activity stream across all aggregates, with pagination and event-type filtering.

## What Changes
- Maintain a global audit feed: every applied event appends one feed entry with a global gap-free feed_seq alongside the aggregate's own audit entry; add the audit_feed query with after_feed_seq, event_types (filter before limit), and limit.
- This restructures the audit module. FROZEN through the restructure: per-aggregate audit sequence numbers are never renumbered from the global counter (auditLog output stays byte-identical for every existing scenario), and the canonical state registry/renderer behavior is unchanged.
- This MODIFIES the existing audit log requirement: restate it in full with the feed added.
- No registry delta: the feed is derived presentation state, excluded from the canonical registry like the applied-event bookkeeping, so every earlier worked replay hash is unchanged.
