# E1 First Evidence Task — Precommitted Design Gates (v0)

Date: 2026-06-10. Status: precommitted before any task design begins. This document fixes the design checklist and acceptance gates for the first E1 evidence-grade task, so the task cannot be quietly shaped around observed outcomes. The candidate domain is Billing v2 (`docs/protocols/billing-v2-frontier-branch-proposal-v0.md`).

## Purpose

The current evidence boundary stops at cheap/weak models: frontier models ceiling every tested single-file task (pricing content-controlled 9/9 both arms under Sonnet 4.6 and Qwen 3.7-Max; payroll skeleton-seed 18/18 both arms under Sonnet 4.6). The first E1 evidence task must create genuine regression surface for frontier models: multi-file scope, scattered cross-file invariants, and long-horizon spec evolution. Difficulty must come from drift pressure, never from ambiguity, missing interfaces, or hidden gotchas.

## Design checklist (all required before seal)

1. **Multi-file**: 5–10 source files, each under ~450 LOC (sealed full-file-replacement constraint), with a written interaction graph of which invariants span which files.
2. **Long horizon**: 12–18 checkpoints. Later checkpoints must perturb invariants established by earlier checkpoints **across file boundaries** — the payroll lesson is that single-file rule-stacking does not defeat the ceiling.
3. **Partial seed + hidden reference**: the template workspace implements only the early checkpoints; the full correct reference implementation lives only in the oracle package and is never mounted (pattern proven by `pricing-discount-lifecycle`).
4. **Content-controlled**: both arms receive identical API contracts, event/structure examples, and worked examples (the content-controlled pricing lesson). The only arm difference is executable-feedback availability.
5. **Business-natural framing**: merchant/billing-policy language with cent-precise worked examples; deterministic; fixed `virtual_now`; no reachable real-clock APIs (`validateNoReachableRealClock`).
6. **OpenSpec profile compatibility** (if built under `e1-openspec-workflow-v0`, which is the recommended target): scenario authoring restricted to canonicalizable Given/When/Then prose — no tables or docstrings that have no clean prose equivalent.
7. **Oracle**: cumulative hidden assertions per checkpoint, derived from a sealed reference implementation, testing only behavior implied by the visible semantic spec; private case data sealed in the oracle package so the oracle hash covers oracle behavior.

## Acceptance gates before seal (all local, in order)

1. **Package validity**: task and oracle packages load and validate; prompt parity diff passes on every checkpoint (and canonical scenario parity under the OpenSpec profile); lockfile boundary valid.
2. **Reference proof**: a scripted reference agent scores 100% on all checkpoints with zero regressions — the task is solvable as specified.
3. **Naive-agent discrimination proof**: a scripted plausible-but-careless fixture produces **at least 2 true cross-checkpoint regressions**, with the exact regression set asserted in tests (the pricing naive-agent pattern). No naive-agent proof, no seal. This is the gate that prevents another ceiling task.
4. **Measured cost projection**: worst-case full-matrix cost computed from post-A1 CartCalc calibration constants (`bun run e1:stats`) is within the operator ceiling, including the worst-case Stage B reserve. Sealed precondition: if worst-case Stage B is unfundable, do not start Stage A.
5. **Predeclared frontier-probe interpretation rule** (the payroll A2 pattern): written before the probe, defining what counts as ceiling-defeat (early invariants preserved, failures concentrated in cross-file drift) versus structural failure (early invariants broken, protocol non-compliance, stalls). A structural failure triggers task revision under a new version, not reinterpretation.

## Provider gates (operator authorization required for each)

- **Frontier difficulty probe** (the expensive go/no-go): run only after all local gates pass, under a sealed analysis plan naming model, route, budgets, and the interpretation rule from gate 5. If the frontier model ceilings the task in the context arm, the boundary is closed as ceiling evidence and the task is not used for causal pilots.
- **Evidence matrix**: sealed and predeclared only after a non-ceiling probe; it is the successor slot for the superseded Stage 1 matrix (`docs/protocols/path-survival-primary-v1-validation-matrix-supersession-v1.md`).

## Boundaries

- Runs under this task form their own compatibility boundary; never pooled with CartCalc, pricing, payroll, subscription, or inventory runs.
- The base-profile and OpenSpec-profile versions of this task, if both exist, are separate non-pooled boundaries.
- Changing checkpoints, visible specs, feedback assets, or oracle behavior after observing arm-level outcomes requires a new task version.
