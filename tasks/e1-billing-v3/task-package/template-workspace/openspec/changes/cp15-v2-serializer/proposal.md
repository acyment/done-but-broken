## Why
Integrators need richer invoice exports, but the legacy v1 byte format is contractually frozen.

## What Changes
- Restructure the serializer module into a versioned registry of formats and add the v2 invoice serializer with explicit fields including finalized, captured, and refunded.
- FROZEN through the restructure: the v1 output stays byte-identical for every invoice it could already serialize — exact field order, omits-zero style, and no new fields, ever.
- This MODIFIES the existing v1 serialization requirement: restate it in full (including its byte-stability scenarios) with the v2 format added.
