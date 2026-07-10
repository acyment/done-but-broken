# E4 v3 — Product-grade HIT-SDD loop vs naked execution vs prose (proposal)

**Status: DRAFT PROPOSAL — operator direction received 2026-07-10, not yet gate-approved.
Docs-only; no code, no runs, no spend authorized by this document.**

Direction decided by the operator (recorded verbatim from the design session): the executed
arm's gate is upgraded to the product-faithful HIT-SDD loop — **mutation testing on the agent's
own code + spec↔code reconciliation heuristics + scenario-quality floors + an operationalized
human review step**; the ambiguity confound is fixed with a **clarification channel**; the next
iteration runs **3 arms (prose / weak-executed / product-executed)** on **glm-5.2 thinking-on
only**.

## 1. Motivation: what M8 actually exposed (diagnostics, no claim weight)

The M8 no-go (`docs/protocols/e4-v2-m8-pilot-run-report-v1.md`) is taken at face value and is
not relitigated here. Its *diagnostics*, examined post-hoc on the committed manifests, expose
two distinct mechanisms that the v3 design addresses. These are design inputs, not claims.

**Mechanism 1 — the ambiguity penalty (construct validity).** Several op kinds render
business-natural requests that radically underdetermine the hidden ground truth, which then
scores all defensible interpretations as drift and false confidence:

- Seed 60 task 2 (`add_validation_rule`): the full request is *"Tighten up what counts as a
  valid details on Widget."* The hidden truth is the exact pattern `^[\w -]{1,80}$`. Both arms
  implemented defensible readings (whitespace-rejection; length-floor), both were scored
  drifted, and the 2 persistently-failing hidden tests then made every later `done` in both
  arms count as false confidence. Both arms' entire seed-60 T6 drift burden traces to this.
- Seed 3 task 1 (`add_entity`): *"Product wants a Promotion list added so the team can start
  recording them."* — no fields, no operations named. The hidden truth pins full CRUD+list and
  an exact field set. The executed arm invented `discount_percent` (0–100) and built
  create/read/list; that one divergence cascades into 9 discrepancies. The prose arm matched
  the hidden truth 35/35 — by imitating the house style already visible in the workspace code,
  not by any spec discipline.

Consequence: the executed arm is *forced* to be explicit (novel-scenario custody), explicitness
under ambiguity means making choices, and choices differing from a hidden generator are scored
as drift and lies, while the prose arm is structurally rewarded for vagueness. Determined tasks
(rename/delete/retype: *"Rename the name detail on Widget to summary"*) do not have this
problem — drift there is real rot.

**Mechanism 2 — the weakest possible executable gate.** The v2 executed arm's gate is only
"the agent's own scenarios are green". Nothing in the loop pushes those scenarios to be strong.
M8's signature is the direct result: green-and-weak on all 12 tasks, zero
`refused_done_over_red`, 24 endpoint coverage gaps, 18 stale claims, false confidence 12/12 —
with kill score 1.0 (the scenarios were real, just insufficient and divergent). M7/M8 therefore
tested a strawman of HIT-SDD: the product the program is aimed at would ship anti-cheat
instruments *inside* the loop, not leave them outside as hidden measurement.

## 2. Goal and claim structure (unchanged goal, upgraded contrast)

Goal unchanged: frontier models on SOTA SDD workflows produce spec drift, and the HIT-SDD loop
is the countermeasure — publishable at claim ladder Level 4 per run, LinkedIn/CTO framing.

v3's causal structure is a **three-level dose** of the same environment:

| Arm | Gate at done-claim | Corresponds to |
| --- | --- | --- |
| `e4_arm_0` (prose) | custody floors only; scenarios never executed | v2 arm 0, unchanged |
| `e4_arm_x` (naked execution) | agent's own scenarios green — **byte-identical to v2 arm H** | v2 arm H, unchanged (cross-version comparability) |
| `e4_arm_p` (product loop) | scenarios green **+ §3 product gate** | the HIT-SDD product |

Pre-registered contrasts (exact predicates fixed at the v3 pre-registration, not here):
primary = arm 0 vs arm p (the product claim); secondary = arm x vs arm p (does the anti-cheat
loop cause the difference — the operator's musing, isolated); the v2-lineage arm 0 vs arm x
contrast is retained as a replication readout. Never pooled with M7/M8 (new compatibility
boundary; new constants).

## 3. The product gate (arm p) — all four components operator-selected

All components are computable **without the hidden truth** (no oracle leak); they read only the
agent's own spec, code, and scenarios. Each becomes gate feedback the agent must clear before
`done` is accepted, and each is also recorded per task for analysis.

1. **Mutation testing on the agent's code.** A sealed set of deterministic mutation operators
   over the workspace server code (e.g. negate a validation guard, drop a single route
   registration, swap a status code, blank a response field). Gate rule: the agent's cumulative
   scenario suite must kill ≥ a sealed fraction of generated mutants; survivors are reported to
   the agent as feedback (mutant description, not fix instructions). Threshold and operator set
   are calibration outputs, sealed before the run. *Note:* the v2 adjudication rejected
   Stryker/mutation for the hidden measurement instrument; using agent-side mutation as **arm
   feedback** is a different role and gets its own adjudication entry — the hidden bank and
   oracle remain the untouched measurement.
2. **Spec↔code reconciliation heuristics.** Deterministic checks: every route registered in
   code has ≥1 scenario exercising it; every scenario route exists in code; every validation
   rule present in either spec or code has a rejection scenario and an enforcing code path.
   Unreconciled items are gate feedback. (Would have flagged M8's missing update/delete
   coverage and several stale claims at task time.)
3. **Scenario-quality floors, gate-enforced.** The T0 template disciplines (value-binding
   assertions, negative case per endpoint kind, round-trip for creates) promoted from
   T0-generation-only to floors on *novel* scenarios at the gate.
4. **Operationalized human review (the HIT in HIT-SDD).** Two parts:
   - **PM brief (clarification channel — shared environment, ALL arms):** one workspace command
     per task that returns the task's determined requirements detail (fields, exact rules,
     operation surface) rendered from the generator IR — operationalizing "ask the PM".
     Free-text Q&A is rejected (nondeterministic matching, parity risk); the brief is a pure
     function of the task, its usage is recorded per arm (who bothers to ask is itself a
     measurement), and its content never includes hidden-oracle tests or whole-surface truth
     beyond the current task's delta. Because it is available identically in all three arms, it
     is a shared-environment property (profile bump: `e4-openspec-workflow-v2`), not an arm
     delta — and it kills Mechanism 1: post-brief, remaining drift is negligence, rot, or
     invention-without-asking.
   - **PM spec review (arm p only, treatment):** at spec-exit the harness flags proposed
     scenarios that contradict *previously communicated* requirements (the request text plus
     any delivered brief — the determined surface only; never volunteering new information).
     This is what a real reviewer catches. It is deliberately part of the product bundle: v3's
     treatment is the loop, not naked execution, and the claim language must say so.

**Measurement unchanged:** hidden oracle once per task close, drift meter v2 semantics, sealed
adversarial bank as hidden kill score (never feeds back), false-confidence event, taxes,
replay validity. Budgets: one shared sealed budget set for all three arms (M0 parity pin);
arm p's gate work burns its own budget and lands in the freshness tax — that cost *is* part of
the product story and is reported, not hidden.

**Ambiguity tagging (cheap, orthogonal):** the generator already knows which task facts the
request rendering included; it will tag each rendered task item determined/underdetermined so
the report can split drift by channel as a standing diagnostic (the two-channel idea, retained
as reporting even though the brief is the primary fix).

## 4. Reuse inventory

Carried unchanged: procedural-rest-v2 substrate + census, workspace generator, converter, step
table, gold-spec templates, scenario executor, meter v2, bank v1, gonogo shape (extended to 3
arms), orchestrator/runner/snapshot/inspector, reasoning-observability instrument and the §5
thinking-on configuration gate (glm-5.2 pins carry), detached-launch procedure (with a
headless-correct detachment + matching verification — the M8 §7.1 deviation made sealed).

New machinery: mutation harness + operator set; reconciliation checker; gate-floor extension;
PM brief renderer + brief-usage recording; PM spec-review checker; arm registry extension to
3 arms; ambiguity tagger; constants v3 lineage (budgets re-ratified on glm-5.2 thinking-on
because arm p changes per-task appetite — the model-id pin alone is not sufficient across a
gate redesign).

## 5. Milestones (phased, gated, each no-spend unless marked)

- **v3-M0** — ambiguity tagger + PM brief renderer (pure functions of the draw; census test:
  every underdetermined op kind's brief determines it).
- **v3-M1** — reconciliation checker + gate floors (fixture tests over M8-style failure shapes:
  the seed-3 coverage gaps and stale claims must be flagged).
- **v3-M2** — mutation harness (operator set + kill evaluation; census: T0 gold code + T0
  scenarios reach the sealed threshold; a scenario-free suite fails it).
- **v3-M3** — arm p gate integration + PM spec review + 3-arm orchestrator/manifest/gonogo
  extension.
- **v3-M4** — fake-agent dry runs (diligent / drifting / gamer, extended with a
  mutant-surviving-weak-suite fixture) + non-budget constants freeze.
- **v3-M5** — budget calibration on glm-5.2 thinking-on, arm p full-length sequence
  (**spend-gated**), budgets re-ratified or adjusted-once.
- **v3-M6** — pre-registration (≥6 fresh seeds by mechanical rule; exclusion list = v2 list +
  {3, 60}; predicates for the three contrasts; thresholds sealed) → operator seal → evidence
  run (**spend-gated**, detached).

## 6. Open items for the gate review (decide before v3-M0)

1. Mutation operator set and kill threshold — proposal: calibrate on T0 (gold code + template
   scenarios define 1.0-analog), seal the floor below it.
2. PM brief cost — free command vs sealed token surcharge (realism vs simplicity); proposal:
   free, usage recorded.
3. Whether arm x carries the PM brief too (yes per shared-environment discipline — proposal:
   yes, all arms).
4. Turn/verification budget headroom for arm p (27/12 may be tight with mutation feedback
   loops — v3-M5 answers empirically; raise only via the sealed adjust-once rule).
5. Seed count vs spend: 6 seeds × 3 arms ≈ 18 sequences ≈ $8–15 at M8-observed appetite;
   confirm envelope at pre-registration.
6. Fresh adjudication entries: arm-side mutation (role change from the rejected
   measurement-side Stryker), PM review as treatment component, profile bump to
   `e4-openspec-workflow-v2`.

## 7. Discipline notes

M7 and M8 remain exactly as reported (go and no-go, two lenses, never pooled, never
reconciled); v3 is a new boundary and a new gate act motivated by M8's *diagnostics*, which
carry no claim weight. The v2-M8 void run stays void. Nothing in this proposal edits any
sealed v2 surface; v2 modules are reused by import, and the naked-execution arm stays
byte-identical to the v2 gate for comparability. Every live step (v3-M5 calibration, v3-M6
run) requires separate explicit operator authorization; sealing the v3 pre-registration is an
operator act.
