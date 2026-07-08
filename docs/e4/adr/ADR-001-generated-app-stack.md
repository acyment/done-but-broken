# ADR-001 — Generated target-app stack (brief §13 Q1)

**Status:** Proposed (Phase-1 gate). **Note:** this ADR argues **against** the brief's Python lean,
with evidence, as the brief itself invites ("recommend Python … but decide with evidence").

## Context

The harness language is settled (TypeScript/bun — base decision). The open question is the language
of the *generated* REST service the agent evolves. The brief leans Python for "simplest meter
extractors"; the black-box HTTP boundary makes the agent-side language theoretically free.

## The evidence

1. **The meter cannot be purely black-box, and that decides the question.** Coverage-gap detection
   (item in code, absent from spec) requires enumerating what the code exposes — unknown endpoints
   cannot be discovered by probing. So the meter needs a **surface-dump extractor**: enumerate the
   app's route table and entity shapes deterministically. The estate already has exactly this
   pattern: the hidden-oracle `module-call-json-v1` kind imports a workspace module in a fresh child
   process and parses a sentinel-prefixed JSON line (DISCOVERY §1.9). That machinery is bun-native.
   A TypeScript app makes the surface dump a reuse of a proven, tested pattern; a Python app makes
   it new cross-runtime plumbing.
2. **Toolchain footprint.** This repo has one runtime dependency and no Python anywhere; the Python
   harness estate is `-e2`, which is frozen for E4 with no dependencies permitted (brief §10).
   Adding Python here means a second toolchain (uv, version pinning, CI) purely for the substrate.
3. **Verification-command surface.** E4 defines its own sealed command set (smoke, server start —
   transfer map §8). A bun app keeps the command classifier single-runtime, mirroring the existing
   `bun`-shaped grammar rather than adding a second interpreter to validate and sandbox.
4. **"Simplest meter extractors" favored Python only under a source-parsing assumption.** With the
   surface-dump design, the meter never parses app source in either language; the extraction cost
   argument for Python evaporates.
5. **Agent capability is not a differentiator** at the model tiers in scope (both lineages write
   idiomatic TS and Python); and determinism (R9) is neutral to this choice given ADR-002/006.

## Decision

**The generated app is TypeScript on bun**, produced by the substrate generator with a fixed
scaffold contract:

- a `server.ts` entry that serves HTTP on a harness-supplied port (env var, ADR-006);
- an exported **route registry** (a plain data structure the server is built from), which is what
  the meter's surface-dump extractor enumerates via the child-process sentinel-JSON pattern;
- storage per ADR-002 (in-memory, seeded fixture).

The scaffold contract is part of the T0 workspace and of the conventions file's ground truth (an
agent that dismantles the registry convention is committing a measurable conventions violation).

## Consequences

- Surface-dump extractor = adaptation of the module-call oracle pattern; low build risk.
- **Failure mode to handle fail-closed:** if the agent breaks the registry export, the surface dump
  fails; the meter records `extraction_failed` for the code-side inventory that task (never a silent
  zero-discrepancy result). This is itself signal — the conventions channel scores the violation.
- **Registry bypass is measured, not blind (Gate-1 change 1):** the surface dump enumerates the
  registry, so its "code-side inventory" is really the *registry-declared* inventory. An agent that
  wires a route directly into the server — bypassing the registry — is invisible to the dump while
  potentially green in the executor. The meter therefore applies a reconciliation rule: when
  executor evidence shows a ground-truth endpoint passing while the surface dump lacks it, the
  meter records a `registry_bypass` event and attributes the discrepancy to the **conventions
  channel** as a structural-convention violation, not to the API channel (the endpoint exists and
  behaves; what drifted is the structural convention). The known-drift fixture includes a
  served-but-unregistered route as a planted cell (architecture §6, Feature 2).
- The HTTP boundary (ADR-006) still keeps `SubstrateProvider` stack-agnostic, so v2 real-repo
  substrates (any language) plug in without touching the runner; only the v1 procedural substrate
  commits to TS.
- Deviation from the brief's recommendation is hereby flagged per ground rule 1/6.
