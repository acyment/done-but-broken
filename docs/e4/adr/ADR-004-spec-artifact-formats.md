# ADR-004 — Spec artifact formats on disk (brief §13 Q4)

**Status:** Proposed (Phase-1 gate). Deviates from the brief's "OpenAPI **YAML**" recommendation on
one axis (JSON, not YAML); deviation flagged per ground rules 1/6.

## Context

In all arms, the agent owns two on-disk spec artifacts (the E4 inversion, brief §5): an API surface
spec and a normative conventions file. The drift meter must extract inventories from both
**deterministically** (brief §6: "confirm extractability"), and the gate's custody check must parse
them (ADR-003). The meter is versioned and frozen; every parsing ambiguity in the artifact format
becomes a meter-version liability.

## Decision

### 1. API surface: OpenAPI 3.1 in **JSON** — `specs/openapi.json`

- Extractability is `JSON.parse` + a schema walk: endpoints (path+method+operation), entities
  (`components.schemas`), fields (properties+types), validation rules (constraints) map 1:1 onto
  the meter's inventory item kinds. Deterministic, zero new dependencies, canonically hashable.
- **Why not YAML:** this repo has exactly one runtime dependency and no YAML parser; YAML adds a
  parser dependency and a family of parse ambiguities (norway problem, implicit typing) inside the
  frozen meter. Agents read/write OpenAPI-JSON natively. If operator review prefers YAML for
  ergonomics, the cost is one vetted dependency and a meter-version note — the inventory model is
  format-independent, so this decision is reversible until the meter freezes. **The reversibility
  window closes at meter freeze (Gate-1 pin)** — after that, a format change is a new meter version
  and a new compatibility boundary.

### 2. Conventions: Markdown with a constrained normative grammar — `specs/CONVENTIONS.md`

- Ground-truth-tracked normative items must appear as bullets of the form
  `` - `<convention-id>`: <statement> `` (stable IDs issued by the substrate generator, e.g.
  `error-format`, `naming-endpoints`, `cmd-test`). The extractor parses exactly these bullets;
  surrounding free prose is permitted and unmetered (agents may annotate; the meter only scores
  identified items).
- This is what makes the conventions channel (our differentiator, brief §5) meterable: contradiction
  = same ID, different statement value; stale claim = ID present in file, absent from ground truth;
  coverage gap = ID in ground truth, absent from file.
- The statement grammar per convention *kind* (naming rule, error-format rule, command, structural
  rule) is fixed in the substrate design so ground-truth comparison is normalization-based
  (whitespace/case canonicalization), not NL similarity. No LLM in the meter.

### 3. No third artifact in v1

No separate executable-scenario file: the gate corpus is the harness's generated acceptance tests
(ADR-003 option B rejected), so agent-authored scenarios would be unexercised surface. T0 ships both
artifacts verified in-sync (meter at T0 must read zero discrepancies — a generator self-check).

## Consequences

- Meter extractors: one JSON schema walk + one line-grammar parser; both trivially unit-testable
  against the known-drift fixture.
- Malformed artifacts are a **custody-check failure** in Arm H (feedback + retry within budget,
  ADR-003) and a recorded `spec_unparseable` meter outcome in arms 0/M (which is itself drift
  signal — a spec nobody can parse is maximally stale). Never a crash, never silently skipped.
- Agents receive the artifact conventions once, in the T0 workspace docs — identical text across
  arms (gate-parity: arms differ only via their declared policy channel). **Gate-1 pin:** the T0
  README reproduces the conventions bullet grammar **verbatim, with one example per convention
  kind** (naming, error_format, command, structural), so grammar conformance is never a guessing
  game for the agent.
