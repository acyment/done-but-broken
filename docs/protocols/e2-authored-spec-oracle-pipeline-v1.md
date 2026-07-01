# E2 Authored-Spec — Acceptance-Oracle Pipeline: OpenSpec → (JIT) Gherkin → pytest-bdd (v1)

Status: **ARCHITECTURE RECORD.** Documents an already-made decision that was under-documented (it lived
scattered across the base design and drifted in implementation). This doc is now the **single authority**
on how the authored acceptance oracle is represented, converted, and executed. It authorizes no run.

Date: 2026-06-30. Program: E2 authored-spec / HIT-SDD. Read with `e2-authored-spec-hitsdd-design-v1.md`
(§"Spec authoring") and its Addenda A/B. Where any older text implies the executable form is plain pytest
or a separately hand-maintained `.feature`, **this doc governs.**

## The decision, stated once

**OpenSpec is the canonical artifact. Gherkin is a just-in-time execution view of it. pytest-bdd runs it.**

```
OpenSpec change proposal            ← CANONICAL, sealed, `openspec validate`-clean
  (requirements + "almost-Gherkin" scenarios)
        │
        │  [JIT OpenSpec→Gherkin converter]   deterministic; runs at execution time; NOT hand-maintained
        ▼
  .feature (real Gherkin)           ← DERIVED / ephemeral (reproducible from OpenSpec + converter)
        │
        │  + step definitions        ← the executable bindings (authored + sealed alongside OpenSpec)
        ▼
  [pytest-bdd]                      ← real BDD runner
        ▼
  per-scenario pass/fail            → run_spec (treatment) / gates / scoring
```

## Why each piece is the way it is

- **OpenSpec is canonical** because the base design's credibility lever is "authored in OpenSpec, an
  industry-standard SDD format" (validated by `openspec validate --strict`). It is also what the eventual
  **product** curates: a shared knowledge base whose source of truth is OpenSpec. Everything downstream is
  derived from it.
- **"Almost-Gherkin"**: OpenSpec scenarios are written as `#### Scenario:` with `- **WHEN**` / `- **THEN**`
  / `- **AND**` **bolded bullets** — Gherkin-*style* prose, but NOT a valid `.feature` (which uses bare
  `Scenario:` / `When` / `Then` / `And` lines). They are close enough to convert deterministically, and
  far enough that a converter is required.
- **Just-in-time conversion** (not a pre-baked, separately-sealed `.feature`): the `.feature` is generated
  from the OpenSpec at execution time. This keeps **one source of truth** — you edit/curate OpenSpec, and
  the Gherkin is always freshly derived, so the two **cannot drift**. What is sealed is the OpenSpec + the
  converter + the step-definition bindings; the `.feature` is a reproducible by-product, not a maintained
  file.
- **Real Gherkin + pytest-bdd** (not plain pytest) because the product is a **Gherkin-centric** shared
  knowledge base, so the experiment must execute genuine Gherkin through a real BDD runner — that is the
  mechanism being de-risked. (This reverses the interim plain-pytest compiler; see "Supersedes".)

## What is sealed vs. derived

| Artifact | Role | Sealed? |
| --- | --- | --- |
| OpenSpec change proposal (requirements + almost-Gherkin scenarios) | canonical spec | **sealed (hashed)** |
| Step-definition bindings (per scenario: step code, surface, then_reference) | executable binding | **sealed (hashed)** |
| OpenSpec→Gherkin converter (+ its version) | derivation logic | **sealed (pinned)** |
| `.feature` (real Gherkin) | JIT execution view | **derived** — reproducible, not maintained |
| pytest-bdd step modules | JIT glue (feature ↔ bindings) | **derived** |

`spec_hash` must cover the OpenSpec proposal **and** the step-definition bindings **and** the pinned
converter version (so a sealed oracle fully determines the executable checks). It need not hash the
`.feature`/step modules — they are reproducible from the sealed inputs.

## The stages (and where each lives in the harness)

1. **Author (blind, GLM-5.2)** → the OpenSpec proposal (requirements + almost-Gherkin scenarios) **and**
   the step-definition bindings (per scenario). — `authored_spec/authoring.py`.
2. **Validate** → `openspec validate --strict` on the OpenSpec (structural gate the base design requires).
3. **JIT convert** → OpenSpec scenarios → real `.feature`. — **OpenSpec→Gherkin converter (to build).**
4. **Render** → `.feature` (canonical KB unit view) + per-scenario pytest-bdd step modules from the
   bindings. — `authored_spec/gherkin.py` (`render_feature`, `render_step_module`).
5. **Execute** → pytest-bdd runs each scenario in-container (`network=none`); exit code → PASS/FAIL. —
   `authored_spec/execution.py` + a **vendored pytest-bdd** (pure-python deps: parse, parse_type, Mako)
   on `PYTHONPATH`, version-matched to the container's pytest (pytest-bdd 8.1.0 needs pytest<9).
6. **Score / gate** → gold-passes-spec, non-triviality, tautology, flake-cert, self-verification gap. —
   `authored_spec/gates.py`, `scoring.py`.

## Supersedes / corrects

- The interim compiler that emitted **per-scenario plain-pytest scripts** (`compiler.py`, commit
  `a58f5f3`) is **superseded**: plain pytest is not the executable form. The compiler is to be rebuilt to
  emit `.feature` + pytest-bdd step modules per this pipeline.
- Any note claiming "finding-2 refined to plain pytest, not pytest-bdd" is **withdrawn** — the pytest-bdd
  path stands; plain pytest was a wrong turn taken while this decision was under-documented.
- The base design §"Spec authoring" "Execution path" note is aligned to this doc: replace "a deterministic
  generator emits a hashed `.feature` build product" with "a **just-in-time** OpenSpec→Gherkin converter
  derives the `.feature` at execution time (the `.feature` is reproducible, not separately sealed)."

## Status

**ARCHITECTURE RECORD — authoritative for the oracle pipeline.** No run, no seal. Open build items:
the OpenSpec→Gherkin JIT converter, the compiler rebuild onto `.feature`/pytest-bdd, and the vendored
pytest-bdd for the `network=none` container run.
