## Why
Integrators need richer invoice exports, but the legacy v1 byte format is contractually frozen.

## What Changes
- Add the v2 invoice serializer with explicit fields including finalized, captured, and refunded; the v1 output must stay byte-identical.
