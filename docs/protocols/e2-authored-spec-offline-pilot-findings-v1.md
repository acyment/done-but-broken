# E2 Authored-Spec — Offline Pilot + Observability Screen Findings (v1)

Date: 2026-07-01. Classification: **`calibration`** (feasibility + gate validation). **Not** causal
evidence, **no public claim**, **zero agent-under-test rollouts** (every spec was run only against the gold
and no-op patches). Read with the design (`e2-authored-spec-hitsdd-design-v1.md` + Addenda A/B), the
offline-pilot protocol, and the sealed-commitments doc (`...-sealed-commitments-v1.md`).

## Bottom line
**The harness is sound and the authored-spec method works.** With accurate author inputs, GLM-5.2 authored
**blind, gold-passing, discriminating** executable acceptance checks (passes on the fixed/gold code, fails
on the unfixed no-op) on a cleanly-observable task. The binding constraint was **author-input fidelity**,
not the harness or the method — addressed by three validated levers. **No task reached full multi-scenario
eligibility this session**, so per the §9 rule we do **not** proceed to seal the main study on these tasks;
the residual gap is fine-grained semantic fidelity, whose identified next step is an author-time
base-validation loop.

## What ran
- **Sealed offline pilot** (v1 seal; harness `31e6450`): `mlco2__codecarbon-831` (bug) + `celery__kombu-2300`
  (mixed) — the two hardest-to-observe by design. **Both ineligible.**
- **Observability screen** (deterministic gates; flake-cert deferred via `flake_n=None`): the three
  more-observable feature candidates — `casbin__pycasbin-392` (clean), `koxudaxi__datamodel-code-generator-2408`
  and `django-json-api__...-1283`.
- **Controlled probes on pycasbin** (isolating one variable at a time): GLM+hand-surface → gpt-5.4+hand-surface
  → GLM+corrected-surface → GLM+restraint → GLM+isolation.

## Findings
1. **Harness sound.** Ran flawlessly across 4 repos — per-container pytest-bdd vendoring (py3.8/3.9/3.11),
   blind authoring, OpenSpec→Gherkin JIT conversion, gates in the real SWE-bench images, blindness attested.
2. **"Observable" is two properties:** the acceptance criterion must be (a) checkable at the public surface
   AND (b) reproducible in an accessible test environment. `codecarbon` fails (a→b): its `TypeError` only
   fires in a no-RAPL CPU-load fallback the container never hits. `datamodel-cg` / `drf` fail (b):
   `datamodel_code_generator` isn't importable in the container's default env / has no console script;
   `drf` needs Django settings configured. Only `pycasbin` was cleanly accessible.
3. **The dominant failure was author-INPUT fidelity, not the method** — three distinct modes, three fixes:
   - **Surface accuracy.** A hand-written surface signature was wrong (`add_named_policies_ex(sec, ptype,
     rules)` vs the real `(ptype, rules)`). It propagated **verbatim** into the spec and sank every scenario
     sharing that call. Decisively, **both GLM and gpt-5.4 made the identical error** — the stronger model
     did not help, because the defect was garbage-in. Fix: `surface.introspect_public_api` generates the
     surface from the repo's **real** signatures (`inspect.signature` + docstrings). → the core scenario then
     discriminated.
   - **Over-specification.** The QA role's adversarial "add malformed/empty/boundary cases" mandate invented
     robustness a *feature* never promised (e.g. malformed rules must "fail atomically") → those assertions
     fail on the correct/gold code. Fix: a QA restraint clause (assert only issue/contract-guaranteed
     behavior). → 4 scenarios ⇒ 2; `empty_batch` then passed gold **and** discriminated.
   - **Step-code isolation.** The DEV role crammed several calls into one step on a shared object, so an
     earlier call's side effect turned a later call's input into a pre-existing duplicate, flipping its
     return value → gold fail. Fix: an isolation clause (fresh object per independent call). → per-method
     scenarios; the `grouping` scenario then passed gold **and** discriminated.
4. **Positive result.** Across iterations, **multiple** clean, blind, gold-passing, discriminating acceptance
   checks emerged (`non-duplicate-succeeds`, `empty_batch`, `grouping-ignores-duplicates`). The method
   demonstrably produces valid executable oracles once its inputs are accurate.
5. **Residual gap.** Full task-eligibility (all scenarios pass gold) kept being blocked by 1–2 scenarios
   where the author guessed a **fine semantic** wrong — e.g. the exact duplicate-handling return contract of
   the *pre-existing* `add_policies_ex` (which also cannot discriminate the fix and should not have been
   tested). **Identified next lever: an author-time BASE-validation loop** — the author runs its draft spec
   against the *base* code (blind to gold; base ≠ gold), sees real errors/semantics, and self-corrects. This
   is not teaching-to-the-test (never touches gold) and directly targets both remaining classes (wrong
   pre-existing-method semantics; testing non-discriminating existing methods). Per-scenario **gold**-based
   curation is explicitly rejected (that would be teaching-to-the-test — the `gap_gold` concern).

## Levers built + validated (harness `done-but-broken-harness`)
- `authored_spec/surface.py` — `introspect_public_api` (auto surface from real signatures). `28810eb`.
- `authored_spec/authoring.py` — QA restraint clause `28810eb`; DEV isolation clause `cdf6b3e`.
- `authored_spec/pilot.py` — `flake_n=None` deterministic-screen mode. `28810eb`.
- Screen bundles: `runs/authored-spec-screen*/` (git-ignored).

## Status
Calibration finding, no causal claim. **Do NOT proceed to seal the main study on the current task set.** The
method is validated as *capable*; the next work is (1) the author-time base-validation loop, (2) a
feature-observable, environment-accessible task pool, then (3) re-measure the A3 eligibility yield. Note the
QA/DEV prompt changes **supersede** the offline-pilot v1 seal's author inputs — that seal stays immutable at
harness `31e6450` for the codecarbon/kombu run; any future study run takes a fresh seal.
