# E2 Authored-Spec Study — Offline Pilot Protocol (v1)

Status: **PROTOCOL DRAFT — not authorized, not run, not sealed. No provider/Docker run fires from this
document.** It specifies the offline pilot that gates the authored-spec study; it authorizes no build
and no run (both operator-gated behind the eventual sealed commitments doc).

Date: 2026-06-29 (detection-only edits 2026-06-30). Program: E2 authored-spec / HIT-SDD
(`e2-authored-spec-hitsdd-design-v1.md`, read with `e2-authored-spec-hitsdd-design-v1-addendum-a-hardening-v1.md`
and `e2-authored-spec-hitsdd-design-v1-addendum-b-detection-only-reframe-v1.md`). Boundary: **`E2 / authored-spec /
HIT-SDD v1`** — never pooled with the prior executable-feedback pilots (DeepSeek n=9, Qwen n=9/n=13),
Protocol v2, budget-sensitivity, or E1.

Classification when executed: **`calibration`** (feasibility + gate validation). This is **not**
`causal_pilot`-grade evidence and produces no public claim.

---

## 1. Purpose & gating role

The authored-spec study is fully designed (base design) and hardened (Addendum A, commitments A1–A5),
but no executable pilot procedure exists. This offline pilot is the gate that must pass **before** the
study is sealed and authorized. It decides two things and nothing else:

1. **Does the pipeline work end-to-end** — can the blind black-box authoring → compile → gate sequence
   produce, for a hard task, an authored spec that clears every objective gate?
2. **Is the approach feasible enough to author all n=9** — if the two hardest-to-observe tasks clear the
   gates, the full authoring pass is licensed; if they fail observability, task selection / black-box
   scope is revisited before authoring the rest.

> **Detection-only scope (Addendum B, 2026-06-30):** the study is now positive-only, so the pilot
> **no longer sets or seals A2 thresholds** — that step (§8) and the corresponding exit-verdict item are
> retired. Spec fidelity is recorded descriptively only. The pilot's job is pipeline-validation +
> feasibility, nothing more.

The pilot runs authored specs **only against the gold patch and a synthetic no-op patch** — never
against agent output. It therefore requires **zero agent rollouts and zero provider calls for the
agents-under-test** (DeepSeek V4 Pro, Qwen 3.7 Max). The only model invoked here is the spec author
(§3), and only experimenter-side.

## 2. Operational sequence (do this first)

This is the timeline the base design's "Sequencing" step 1 left bundled; it threads the Addendum A
decisions onto it. Steps 0–3 are this pilot. Steps 4–5 are downstream and listed only for orientation.

| Step | Action | Addendum A tie-in |
| --- | --- | --- |
| **0** | Fix the pre-pilot decisions on paper (no build): granularity convention, author model, pilot task pair | A1, A4 (+ §3 below) |
| **1** | Build the **minimum pilot harness slice** (§4) — compiler + `run_spec` against gold/no-op only + 4 gate scripts + flake-cert of authored checks | — |
| **2** | Author + audit the **two** pilot specs under blindness (§5); run the gates (§6) | — |
| **3** | Emit the **joint gate-survival table** (§7); record the **exit verdict** (§9). *(A2 threshold-setting retired — Addendum B)* | A5 |
| 4 (later) | Full authoring pass over all n=9 → joint survival over 9 → apply the **A3 minimum-n floor** → classify (`causal_pilot` / `difficulty_probe` / don't-run) | A3 |
| 5 (later) | Seal commitments + operator authorization + spend cap → DeepSeek run → (gated) Qwen replication | base §Sequencing |

## 3. Pre-pilot decisions to fix (step 0)

Pinned before any authoring; hashed into the pilot's provenance.

- **A1 — scenario-granularity convention.** One scenario per distinct observable outcome stated or
  directly entailed by the issue; parameterized variations of the same outcome collapse to one scenario
  with a parameter table; no scenario multiplication for emphasis (Addendum A §A1). Applied identically
  to both pilot tasks.
- **A4 — spec author = GLM 5.2 (Zhipu).** A fixed **non-participant** model: not DeepSeek V4 Pro, not
  Qwen 3.7 Max, and not their lineages — removing author–solver correlation. The author identity, route,
  and pinned authoring prompts are sealed as authoring-pipeline parameters (Addendum A §A4).
- **Pilot task pair (the two hardest to observe).** `mlco2__codecarbon-831` (emissions/energy tracking —
  highest risk of internal-state-only acceptance criteria) and `celery__kombu-2300` (message-queue /
  transport internals, async). Both are confound-free n=9 members, flake-certified 60/60 (Addendum B:
  codecarbon 114 tests / 130.5 m wall; kombu 1089 tests / 42.8 m wall). Rationale: the pilot's job is to
  surface white-box-only acceptance criteria **now**, when fixing the selection is cheap; the easy tasks
  (freezegun, twine) would flatter feasibility. **Documented caveat:** both pilot tasks are libraries
  (public-API binding). The CLI-subprocess binding path is therefore *not* exercised by this pilot; it
  must be exercised once on a CLI exemplar (`twine` or `datamodel-code-generator`) during the full
  authoring pass before seal. Flagged here, not added as a third pilot task.

## 4. Minimum pilot harness slice

The smallest subset of the full authored-spec harness the pilot needs. Anything beyond this is deferred
to the (separately authorized) full build.

- **Black-box scenario→step compiler** — the deterministic OpenSpec→`.feature` generator plus
  `pytest-bdd` step definitions; public-API binding is sufficient for both pilot tasks
  (library calls); the CLI-subprocess binding path may be stubbed/deferred (see §3 caveat). Drives the
  repo **only** through its public surface; no internal/private imports.
- **`run_spec` runnable experimenter-side, gold/no-op only** — executes the compiled authored checks
  (`pytest-bdd` scenarios collected under pytest) in
  the sanitized container against (a) the gold patch and (b) a synthetic no-op patch. Returns named
  check + pass/fail only; **no** expected values, gold, or gold-test text. This is the same plumbing the
  full study's `run_spec` will use, exercised here without the agent in the loop. **No arm rollouts.**
- **Four gate scripts** — observability, gold-passes-spec, non-triviality, tautology audit (§6).
- **Flake-cert of the authored checks only** — N=60 on the **authored black-box checks** under the gold
  patch (not the full gold suite, which is already certified in Addendum B). Cheap even for slow repos,
  since the authored checks are few; black-box checks (server/subprocess) are more flake-prone than unit
  calls, so this earns its keep.

## 5. Blind authoring procedure (per pilot task)

Mirrors base design §"Author driver", run as a logged, ordered pipeline (not a free-form debate):

1. **Requirements role (GLM 5.2)** — drafts the OpenSpec requirement + its *why* and the initial
   Gherkin WHEN/THEN scenarios from **issue text + read-only repo public surface only**.
2. **QA role (GLM 5.2)** — adversarial completeness pass (missing / edge / negative cases), scoped to
   **issue-stated behavior** to keep gold-passes-spec pruning minimal (Addendum A QA-overreach caveat).
3. **Observability check (automated)** — verifies each scenario binds to a black-box step at the public
   surface; scenarios that cannot be expressed at the boundary are flagged for the human audit.
4. **Reconcile → `openspec validate` → human audit** — confirm observable requirements, nothing about
   implementation.

**Mandatory blindness:** every role and the step definitions are authored **blind to the gold patch and
gold tests** (issue text + read-only public surface only). The full per-task authoring transcript, the
pinned prompts, and the Gherkin authoring skill are versioned + hashed.

## 6. Per-gate acceptance criteria (per pilot task)

Explicit pass/fail. The first five are **per-task eligibility** gates; **`run_spec` leak-tightness is a
harness-wide precondition** (verified once in §4, identical for every task, not task-specific). A task is
**eligible** iff it clears all five per-task gates, with the leak-tightness precondition holding.

| Gate | Pass criterion | Fail action |
| --- | --- | --- |
| **Black-box observability** | Every acceptance scenario binds to a step driving only the public surface (API/HTTP/CLI); the issue's acceptance criterion is expressible at the boundary | Task **ineligible** (white-box-only) → record + (full pass) drop |
| **Gold-passes-spec** | The gold patch passes 100% of the authored checks | Spec is wrong → revise under blindness (seeing only pass/fail, never gold text), 1 bit/iteration; or drop |
| **Non-triviality** | A synthetic no-op patch **fails** ≥1 authored check (the spec discriminates) | Spec is tautological at the prose level → rewrite |
| **Tautology audit** | Each step definition: (1) contains an assertion on the public-surface call's return/state; (2) the assertion references the specific value/condition in the scenario's THEN (not `is not None`, not a constant); (3) running against the gold patch actually reaches+evaluates the assertion | Rewrite the step under blindness; re-audit |
| **Flake-cert (authored checks)** | Authored checks ≤5% patch-induced flake over N=60 on the gold patch; flaky checks quarantined | Quarantine flaky check; if too few remain, treat as observability fail |
| **`run_spec` leak-tightness** *(harness-wide precondition, not per-task)* | `run_spec` output contains no expected values, no gold, no gold-test text; canary scan clean | Fix schema before any further use |

## 7. Joint gate-survival table (A5 — primary output)

The pilot's primary reported artifact. Per task, pass/fail across the **five per-task eligibility gates**
→ a single eligible/ineligible verdict (Addendum A §A5). Two rows here; the **same template scales to the
full n=9 pass** (step 4), where the row count and `n_eligible` feed the A3 floor.

> **Harness-wide precondition (verified once, §4, not a per-task column):** `run_spec` leak-tightness
> clean. **Blindness attestation (`blind?`, per task, from the §10 authoring transcripts):** every
> authoring role + all step definitions produced blind to the gold patch and gold tests; any leak-budget
> bits spent during gold-passes-spec / tautology revision are logged. A failed attestation invalidates
> the spec (re-author), so it gates eligibility alongside the five gates.

| task | observability | gold-passes-spec | non-triviality | tautology | flake-cert | blind? | **verdict** |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `mlco2__codecarbon-831` | … | … | … | … | … | … | **eligible / ineligible** |
| `celery__kombu-2300` | … | … | … | … | … | … | **eligible / ineligible** |

## 8. Spec fidelity — descriptive only (A2 threshold-setting retired)

> **Retired by Addendum B (detection-only reframe).** The study is positive-only; there is no null to
> classify, so no fidelity/real-miss **thresholds** are set or sealed.

For descriptive context only, the pilot may still record — **without** deriving any sealed threshold —
the **authored-spec verdict vs SWE-bench gold verdict** on each pilot task's gold patch, classifying any
disagreement as a **real miss** (behavior genuinely not captured at the public surface) vs a
**granularity/level mismatch** (gold asserts on internals the public-surface spec need not see; base
design §"Read fidelity carefully under black-box"). This is reportage, not a gate.

## 9. Exit verdict

The pilot returns exactly:

1. **Pipeline works: yes/no** — did the blind authoring → compile → gate sequence produce a clearing
   spec for at least one hard task end-to-end.
2. **Per-task eligibility** — the two verdicts from §7.
3. **Blindness attestation** — per-task confirmation (from the §10 authoring transcripts) that every
   authoring role and all step definitions were produced blind to the gold patch and gold tests, with any
   leak-budget bits (gold-passes-spec / tautology revisions) logged.

*(The former item "sealed A2 thresholds" is retired — Addendum B, detection-only.)*

It explicitly does **not** produce `n_eligible` over all 9 (that comes from the full authoring pass,
step 4, and feeds the A3 floor). Honest extrapolation rule:

- **Both hard tasks eligible** ⇒ proceed to author all n=9 (the easier tasks are lower observability
  risk).
- **Both fail observability** ⇒ revisit task selection / black-box scope before authoring the rest; do
  not proceed to seal.
- **Split (one eligible, one not)** ⇒ proceed, but treat the observability gate as a live constraint on
  `n_eligible` and watch the A3 floor closely in the full pass.

## 10. Sealed-artifact outputs

The pilot emits, as hashed artifacts:

- The **pilot report** — a `calibration` run-card (`docs/run-cards/`) + `*.summary.json` carrying the §7
  survival table and §9 verdict (run-card / summary conventions per existing `e2-phase1-5-*` cards).
- The **per-task authoring transcripts** (GLM 5.2 roles, all blind), pinned prompts, Gherkin authoring
  skill.
- The **OpenSpec→`.feature` generator**, the **compiled authored checks** (generated `.feature` +
  `pytest-bdd` step definitions), and the **four gate scripts** and their per-task verdicts (incl. the
  tautology-audit script + verdicts).
- The **GLM-5.2 authoring-pipeline config** (route, params, pinned prompts).

All linked by SHA-256 into the eventual commitments doc at seal time (Addendum A §"Seal checklist
delta").

## 11. Classification, boundary, and what the pilot does NOT do

- **Classification:** `calibration` (feasibility + gate validation). Not `causal_pilot`; no causal
  language; no public claim.
- **Compatibility boundary:** `E2 / authored-spec / HIT-SDD v1`. **Never pooled** with any prior E2/E1
  run; the authored-spec contract is a different acceptance contract.
- **Does NOT:** run any agent rollout; make any provider call for the agents-under-test; produce
  `n_eligible` over n=9; apply the A3 floor; seal anything; authorize the study. Seal still requires:
  base design + Addendum A + this pilot's results reviewed → full authoring pass → hash + operator
  authorization + spend cap + sealed commitments.
