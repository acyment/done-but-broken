# E2 Authored-Spec Design — Addendum C: Feature-Spec Authoring (gold as cross-check, reference-stub as green proof)

Status: **DESIGN PROPOSAL — not executed, not sealed, no run authorized.** Read with the base design
(`e2-authored-spec-hitsdd-design-v1.md`), Addendum A (hardening), Addendum B (detection-only reframe — which
governs where they conflict), and the offline-pilot findings (`e2-authored-spec-offline-pilot-findings-v1.md`).
Date: 2026-07-01. Classification of any run it eventually authorizes is still to be set by a fresh sealed
profile; this document authorizes nothing.

## 1. Motivation
The offline pilot + observability screen showed feature-ADDITION tasks fail the `gold-passes-spec` gate and
resist the base-validation loop, because the new API is **absent at base** (findings doc, Addendum). But
**feature authoring is the product's primary use case** (Gherkin-centric build-to-spec). Retreating to
behavior-change bug tasks — where base-validation and gold both work — optimizes the benchmark away from the
thing the product is for. So we instead fix feature authoring directly.

## 2. Diagnosis: the feature difficulty is largely a benchmark artifact
- A **bug** spec is *descriptive*: the code exists; the spec describes correct behavior. Gold is a natural
  oracle; base-validation works.
- A **feature** spec is *generative*: it must **define a contract that does not exist yet** — new names,
  arities, return types, semantics. Blind, generative, and (in the current gate) required to match a *hidden
  gold's arbitrary choices*. The observed residual — asserting a tuple where casbin returns a list — is not a
  reasoning failure; it is the author picking a convention the hidden gold happened to pick differently.
- **In the product there is no hidden gold.** The Gherkin spec *is* the contract; the implementation follows
  it. "Returns a list, not a tuple" is a decision the implementation honors, not an error. The current
  `gold-passes` gate **penalizes valid design choices as failures**. That is the artifact.

## 3. The reframe (this re-aligns the pilot with the base design)
The base design already states **"single oracle = authored spec; gold = secondary fidelity cross-check."**
The pilot over-strengthened `gold-passes-spec` into a hard eligibility GATE. Addendum C restores gold to a
**cross-check** and introduces the missing piece that made the gate feel necessary — an independent **green
proof** the spec is satisfiable.

Every eligible spec needs, symmetrically:
- a **RED proof** — it fails on the no-op / unimplemented code (already `non-triviality`); and
- a **GREEN proof** — some independent reference implementation makes it pass.

The green proof by task kind:
- **Bug / behavior-change:** green = gold (or a base+fix); RED via base-validation. Gold naturally doubles as
  green because the fix space is narrow.
- **Feature-addition:** green = a **minimal REFERENCE STUB** the non-participant author writes for the new
  API, blind to gold. Gold **may legitimately diverge** (different valid API) → gold is demoted to a bonus
  external cross-check, not the green proof.

Unified per-spec eligibility: **RED ∧ GREEN ∧ non-vacuous (tautology audit) ∧ publicly-observable (surface
guard) ∧ issue-faithful (human audit).** Gold-passing is an additional external-validity signal, strongest
when it agrees.

## 4. The reference-stub mechanism (feature green proof)
The non-participant author (A4, currently GLM-5.2) produces, **blind to gold**, two artifacts:
1. the executable acceptance spec (as now), and
2. a **minimal reference implementation** of the new public API.

Validation: the spec **PASSES on base+stub** and **FAILS on base alone** → executable, satisfiable, and
discriminating **without any gold**. The stub is a **sealed author artifact** (hashed like the spec) and is
**never shown to the agent-under-test**. This is red-green for the spec author — write the failing acceptance
test plus a minimal green implementation, prove they agree — exactly the BDD feature workflow.

## 5. The central risk, stated plainly: fidelity leans harder on human audit
Removing `gold-passes` as a gate removes an *automated* fidelity check. A feature spec that misreads the
issue could still pass RED + GREEN(author's own stub) + non-vacuous, because the author wrote both the spec
and the stub to its own (possibly wrong) reading. **Issue-fidelity therefore becomes load-bearing on the
human audit.** This is the real cost of the reframe and must not be hand-waved. Compensations:
- **Gold as cross-check is still automated signal:** if the independent gold passes the spec, that is strong
  evidence the spec captures the real feature (two independent implementations agree). Gold-passing stays a
  first-class positive signal; only gold-*failing* is downgraded from disqualifying to triage.
- **Multi-author convergence (optional):** two independent authors' specs agreeing on the contract is an
  automated fidelity signal that does not need gold.
- **Rigorous human-audit protocol:** the auditor checks the spec against the issue's *stated* acceptance
  criteria (not against gold), on a fixed rubric, recorded in the transcript.

## 6. Collusion / vacuity guards (author writes both spec and stub)
Risk: a vacuous spec+stub pair gamed to agree. Guards, in layers:
- `non-triviality` (fails on no-op) — kills "passes on everything".
- tautology audit (concrete-literal assertions) — kills "assert True".
- **stub-quality check** — the stub must implement logic, not return the asserted literals verbatim; a
  structural check (stub output not a constant equal to the then_reference) + human audit.
- the **agent-under-test's independent implementation** (from the spec alone; never sees the stub).
- **Fail-safe property:** a vacuous/colluded spec makes *both* study arms trivially pass, **collapsing the
  HIT-SDD-vs-plain-SDD contrast** — it produces a null/degenerate result, **not a false-positive win**.
  Collusion fails safe.

## 7. Effect on the HIT-SDD vs plain-SDD measurement
- **Primary outcome unchanged:** does the agent-under-test's implementation pass the AUTHORED SPEC? The spec
  was always the single oracle; that does not move.
- **Gold-test-passing becomes a secondary external-validity signal.** For features it *may diverge* from
  spec-passing (agent implements the author's API, not gold's) — expected and honest.
- **Claim scope tightens accordingly:** the defensible claim is *"executable acceptance feedback helps agents
  build to a faithful spec,"* **not** *"solves the SWE-bench gold tests."* Any public artifact must state this
  scope explicitly. (Consistent with the standing rule: no public claim that executable feedback wins for
  frontier models without a reviewed profile.)

## 8. Gold-divergence triage (when gold fails the author's spec)
Human-audited, recorded: (a) author error / over-specification → revise or drop; (b) a valid different API →
keep, note the divergence and why. Never auto-disqualifying; never silently kept.

## 9. Status & supersession
Design proposal only. It **supersedes** `gold-passes-spec`-as-hard-gate for feature / behavior tasks (Section
3) and adds the reference-stub green proof (Section 4). It changes no code and authorizes no run. Before any
execution it needs: the stub mechanism + stub-quality check implemented, a rigorous issue-fidelity audit
rubric, a fresh sealed protocol profile naming these gates, and operator authorization. The offline-pilot v1
seal stays immutable at harness `31e6450`; this is a different, later profile.
