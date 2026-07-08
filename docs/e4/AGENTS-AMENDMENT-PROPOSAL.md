# AGENTS.md Amendment Proposal — E4 Experiment Boundary ("Drift Velocity")

**Status: APPROVED at the Phase-0 gate (2026-07-08), with two mandatory wording changes — both
incorporated in the diff below** (the no-pooling clause and the gate-parity clause; see
`GATE-0-DECISIONS.md` Q1 for the operator's exact wording and rationale). Applied to AGENTS.md as its
own commit immediately after the Phase-0 docs commit, per §5.

Date: 2026-07-08. Author: E4 Phase-0 discovery agent. Companion deliverable: `docs/e4/DISCOVERY.md`.

---

## 1. Why an amendment is required (and why it is additive-only)

AGENTS.md currently forbids the E4 design in three places:

1. **"Experiment Boundary"** — "The active pilot has exactly two condition IDs" (`context_only_spec`,
   `feedback_capable_spec`) and "Do not introduce HIT-SDD, OpenSpec, BDD, Gherkin, Three Amigos, or
   ordinary-test names as condition IDs or arms in active protocol code."
2. **"Scientific Protocol Guardrails"** — "The primary experiment is the two-arm comparison…" and
   "Do not add new arms without protocol tests for condition rendering, feedback gating, budget
   fairness, compatibility, and result schema behavior."
3. **"Current Scientific Direction"** — names E1 (and the E2/E3 programs) as the active paths; E4 does
   not exist in the record.

E4 needs three arms (0/M/H), one of which mechanically enforces a HIT-SDD-style gate. The estate's own
precedent for this situation is the E2 boundary paragraph already inside "Current Scientific
Direction": *"The E1 'do not add new arms' guardrail is scoped to E1; E2 conditions are recorded
here."* The amendment follows that precedent exactly: **no existing sentence is modified or deleted**
— the E1/E2/E3 freezes stay verbatim-intact — and a new, self-contained E4 boundary section is added,
plus one bullet registering E4 in "Current Scientific Direction".

Two deliberate naming choices keep the letter of the existing bans intact:

- E4 condition IDs are `e4_arm_0`, `e4_arm_m`, `e4_arm_h` — the strings "HIT-SDD", "OpenSpec", "BDD",
  "Gherkin" are still never used as condition IDs or arm names, in any program. The existing ban
  sentence remains true after the amendment, unmodified and unscoped.
- The two-condition freeze sentence ("The active pilot has exactly two condition IDs") is left
  untouched; the new E4 section states explicitly that the freeze refers to the E1 pilot and that E4's
  vocabulary exists only inside the E4 boundary.

## 2. Exact diff

Unified diff against AGENTS.md at `6b1bbb5` (current working tree; the file has no uncommitted
changes). Two hunks: a new section inserted between "Experiment Boundary" and "Scientific Protocol
Guardrails", and one bullet appended to "Current Scientific Direction".

```diff
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -47,6 +47,49 @@ The OpenSpec workflow is permitted as a shared task-environment property under t

 The archived sibling repository is read-only salvage material. Active runtime code must not import modules from it by relative path.

+## E4 Experiment Boundary — Drift Velocity
+
+E4 ("HIT-SDD Bench — Drift Velocity") is a separate longitudinal program in this repo: one agent
+executes a seeded sequence of tasks on one evolving procedurally-generated codebase, one fork per arm,
+measuring how fast agent-maintained spec artifacts and code diverge ("drift velocity") and whether
+mechanical enforcement holds them together. E4 is governed by this section plus the shared
+scientific-discipline rules below; nothing in this section alters E1, E2, or E3.
+
+- E4 has exactly three condition IDs, valid only within the E4 boundary:
+  - `e4_arm_0` — control: spec artifacts present and in sync at T0; no instruction to maintain them.
+  - `e4_arm_m` — prompt-only discipline: identical to `e4_arm_0` plus a standing instruction to keep
+    spec artifacts current; no gate, no acceptance oracle.
+  - `e4_arm_h` — mechanically enforced gate + acceptance oracle (enforcement mechanics fixed by ADR
+    before any evidence-generating run).
+- The two-condition freeze above ("The active pilot has exactly two condition IDs") is the E1 pilot
+  freeze and remains in force for E1. E4 condition IDs never appear in E1 protocol code, and
+  `context_only_spec` / `feedback_capable_spec` never appear as E4 arms.
+- The strings HIT-SDD, OpenSpec, BDD, Gherkin, Three Amigos, and ordinary-test names remain banned as
+  condition IDs or arm names in E4 as everywhere else; E4 arms are referred to only as
+  `e4_arm_0` / `e4_arm_m` / `e4_arm_h` (short form: arms 0/M/H).
+- E4 runs are never pooled with E1, E2, or E3 runs, nor across E4 meter versions or constants
+  versions. The E4 compatibility boundary is (constants version, meter version, substrate config);
+  `substrate_seed` values are replicates *within* a boundary, aggregated per the pre-registered
+  analysis. Cross-config aggregation is permitted only as a pre-registered secondary analysis. Each
+  E4 run's manifest records its compatibility boundary.
+- E4 uses its own sealed-constants lineage (`e4-sealed-constants`, starting at a 0.x draft and sealed
+  before evidence-generating runs). The E1 seal
+  (`docs/protocols/e1-frontier-sealed-constants-v1.0.json`, v1.0.0) is never modified, and E1 must
+  remain runnable and reproduce its sealed behavior after every E4 change.
+- Adding the E4 arms is permitted only with the protocol tests the guardrails below already require:
+  condition rendering, feedback gating, budget fairness, compatibility, and result schema behavior —
+  extended for E4 with meter isolation (agents never see drift-meter output; the acceptance oracle is
+  never the meter) and gate-parity tests: identical task text, budgets, and retry policy across arms;
+  arms differ only through their declared policy channel (`e4_arm_m`: the standing spec-maintenance
+  instruction; `e4_arm_h`: gate + oracle feedback), each arm's declared delta pinned by an allowlist
+  parity validator (follow the `validateE1RuntimeArmParity` precedent).
+- Replay-validity rule (stricter than E1): every E4 run retains patch text, full traces, and all
+  artifacts needed to replay it. A run missing any of these is classified non-replay-valid and is
+  excluded from headline claims. No E4 headline may rest on a non-replay-valid run.
+- The sibling repo `hit-sdd-bench-e2` is frozen for E4 purposes: readable as reference, never
+  modified, never a runtime or path dependency of E4 code.
+- All E4 evidence-generating runs are operator-authorized, per the same rule as E1/E2/E3.
+
 ## Scientific Protocol Guardrails

 - The primary experiment is the two-arm comparison between `context_only_spec` and `feedback_capable_spec`.
@@ -136,6 +179,7 @@ Public communication rules:
 - `regression_free_auc` is primary only for runs whose manifest declares `protocol_profile_id=path-survival-primary-v1`; older runs may mention AUC only as retrospective secondary observations.
 - Do not run provider/model experiments unless explicitly authorized.
 - Do not change primary metrics after observing outcomes, and preserve compatibility boundaries for task, provider, budget, loop policy, protocol profile, and metric definition.
+- **E4 program opened (2026-07-08, Phase 0):** the drift-velocity program is designed under `docs/e4/` with its own experiment boundary (see "E4 Experiment Boundary — Drift Velocity" above), its own condition vocabulary (arms 0/M/H as `e4_arm_0`/`e4_arm_m`/`e4_arm_h`), its own sealed-constants lineage, and a strict replay-validity rule. E4 is never pooled with E1/E2/E3. The E1 "do not add new arms" guardrail is scoped to E1; E4 arms are recorded here.
 - Do not build a general benchmark platform yet.

 ## Smart TDD Policy
```

*Line numbers in the hunk headers are approximate to the current file; the amendment is applied by
content (the anchor lines shown), not by offset.*

## 3. Rationale, clause by clause

- **Three condition IDs, E4-scoped.** Brief §3 and prompt ground-rule 4(c): arms enter "only via the
  recorded amendment". Scoping them to E4 preserves AGENTS.md's pooling bans, which are keyed on
  experiment boundaries (BASE-DECISION §6.1).
- **`e4_arm_h` instead of a HIT-SDD-named ID.** Keeps the existing ban sentence true without editing
  it, and keeps condition IDs mechanism-neutral (the same reason E1 chose `feedback_capable_spec` over
  a brand name). The public name "HIT-SDD Bench — Drift Velocity" lives in docs, not condition IDs.
- **No-pooling clause.** Direct carry-over of the estate's compatibility-boundary discipline (brief §9
  "carried over from the estate — keep it"). Wording corrected at the gate: the original draft banned
  pooling across substrate seeds, which would have outlawed the pre-registered analysis itself — seeds
  are replicates *within* a compatibility boundary of (constants version, meter version, substrate
  config), aggregated into arm-level estimates.
- **Own constants lineage.** Brief §9: "new E4 lineage, never touching the E1 v1.0.0 seal". The
  existing sealing convention (draft 0.x → sealed 1.0.0, `supersedes` chain, status field) is reused
  under a new schema name so E1's loader and seal are never touched.
- **Meter-isolation and gate-parity test requirements.** E4-specific analogues of the E1 "protocol
  tests before new arms" rule; they encode brief §6 ("agents never see meter output; the oracle's
  acceptance tests are never the meter") and §3 (paired arms, identical sequences/seeds) as
  testable guardrails.
- **Replay-validity rule.** Brief §9's new requirement, motivated by the non-replay-valid E2 headline
  runs (brief §1 caveat). Written as a classification + exclusion rule so it composes with the
  existing run-classification vocabulary.
- **Frozen sibling repo.** Brief §10 / prompt ground-rule 4(b), recorded where future agents will see
  it.
- **One bullet in "Current Scientific Direction".** Mirrors how the E2 program was registered there in
  2026-06-13; keeps the direction section the single place a reader learns what programs exist.

## 4. What is deliberately NOT amended

- The E1 two-condition freeze, the OpenSpec-profile scoping paragraph (`e1-openspec-workflow-v0`), and
  every E1/E2/E3 sentence: verbatim-intact.
- The claim ladder and public-communication rules: they apply to E4 as written; no E4-specific claim
  language is needed until there is E4 evidence.
- The Smart TDD policy: applies to E4 as written (drift-meter classification, gate enforcement,
  manifest completeness are validity-critical invariants under "primary metric calculation" /
  "result schema" / "feedback gating").

## 5. Application procedure (on approval)

1. Apply the diff above to AGENTS.md as a standalone commit touching only AGENTS.md.
2. Commit message: `AGENTS.md: open E4 experiment boundary (Drift Velocity, arms 0/M/H) — Phase-0 gate approval <date>` with a body linking `docs/e4/E4-DESIGN-BRIEF.md`, `docs/e4/DISCOVERY.md`, and this proposal.
3. The commit SHA becomes part of E4's provenance record (brief §10); record it in the Phase-1 architecture doc.
