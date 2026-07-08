# ADR-006 — Test transport for the acceptance executor (brief §13 Q6)

**Status:** Proposed (Phase-1 gate). **Binding input:** Gate-0 injection 4 (R9 first-class):
determinism is a **primary criterion**, and request/response artifacts are retained in the bundle
for replay.

## Context

The acceptance executor is the single execution engine behind the hidden oracle, the Arm-H gate
(red and green runs, ADR-003), and Arm-H acceptance feedback. Both existing oracle kinds in the
repo are in-process module-call; **no HTTP oracle exists** (DISCOVERY §1.9). R9 names HTTP
nondeterminism (ports, timing, server lifecycle) as a threat to replay-validity.

## Options

- **A. HTTP against a running server (chosen).** The StaminaBench pattern and the brief's
  recommendation. Language-agnostic black-box boundary — the property that keeps
  `SubstrateProvider` open to v2 real-repo substrates in any stack.
- **B. Process-level CLI.** Per-request process spawn; deterministic but slow at suite scale,
  and it forces a CLI shape onto every future substrate — a worse interface commitment than HTTP.
- **C. Module-call (extend the existing oracle kind).** Most deterministic, fully proven in-repo —
  but binds the substrate interface to bun modules, closing the v2 door the brief explicitly wants
  open (§12: "expose a substrate provider interface so real-repo substrates plug in later").

## Decision

**HTTP (A), with determinism engineered in rather than hoped for:**

- **Server lifecycle per executor run:** fresh start → readiness probe (bounded, fixed timeout) →
  fixed-order request sequence → kill. Combined with in-memory storage (ADR-002), the process is
  the unit of state; no cross-run leakage is possible.
- **Ports:** the harness binds port 0, reads the assigned port, and passes it to the app via a
  single env var defined in the scaffold contract (ADR-001). No fixed ports, no collisions, no
  port values in comparison payloads.
- **Sequencing:** exactly one in-flight request; no concurrency anywhere in the executor. Request
  order is part of the generated test definition and therefore seeded and replayable.
- **Comparison:** expected vs actual compared on canonicalized JSON (key-order-insensitive,
  whitespace-normalized) + status code + selected headers named by the test definition. Timing is
  never asserted.
- **Timeouts:** readiness and per-request timeouts are sealed E4 constants (not tunables), so a
  timeout is a classified infrastructure outcome, not silent flake. Executor-level failures
  (server never ready, port bind failure) are recorded as `executor_error` — an infrastructure
  class distinct from test failure, preserving the estate's agent-behavior vs infrastructure
  separation (DISCOVERY §1.6).
- **Artifacts (injection 4, normative):** every executor run writes the full request/response
  transcript (method, path, headers-as-sent, body, status, body-as-received, canonicalized form)
  plus server stdout/stderr into the run bundle. Replay re-executes the suite against the
  regenerated substrate and compares transcripts; oracle verdicts are recomputable from retained
  artifacts alone even if re-execution is impossible.
- The module-call child-process pattern (C) is still used in E4 — but only for the **meter's
  surface-dump extractor** (ADR-001), which is not the oracle and asserts nothing about behavior.

## Consequences

- One executor, four call sites (hidden oracle, gate red, gate green, H feedback) — no divergence
  risk between what the gate enforces and what the oracle scores (the E3 gate/scorer-parity caveat,
  designed out rather than patched).
- HTTP flake risk is contained to lifecycle edges and is always *visible* (classified
  `executor_error`, never folded into pass/fail).
- Suite runtime is bounded by sequential requests; at v1 scale (tens of tests × ~4 executor runs
  per task) this is seconds, not minutes.
