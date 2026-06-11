## Why
Webhook providers redeliver events; every duplicate delivery must be harmless for every event type.

## What Changes
- Generalize duplicate-event-id handling to all event types: a duplicate is a complete no-op with no state change, no audit entry, and no feed entry.
- This MODIFIES the existing idempotent payment capture requirement: restate it in full, generalized to every event type, keeping every capture scenario that remains in force.
