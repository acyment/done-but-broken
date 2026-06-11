## Why
Operations must be able to rebuild state from the event log and prove it matches, byte for byte.

## What Changes
- Add the replay_hash query: a deterministic hash of the state produced by folding the event log, stable across replays.
