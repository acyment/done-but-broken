## Why
Webhook providers redeliver events; every duplicate delivery must be harmless for every event type.

## What Changes
- Generalize duplicate-event-id handling to all event types: a duplicate is a complete no-op with no state change and no audit entry.
