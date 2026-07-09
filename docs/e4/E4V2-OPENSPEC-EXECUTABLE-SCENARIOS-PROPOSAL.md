# E4 v2 design — OpenSpec workspace with executable scenarios

**Status: FULL DESIGN, awaiting operator gate review before any implementation milestone.**
Drafted 2026-07-09 at operator direction; anti-cheat design frozen from the adjudicated
deep-research backlog (`E4V2-ANTICHEAT-ADJUDICATION.md`, items A1–A10; rejections R1–R8 are
recorded there and not re-litigated here). Supersedes the earlier proposal draft in this file.

## 1. Motivation (from the v1 pilots)

The v1 program (M0–M7b) validated every instrument and produced the finding that motivates this
redesign. In the qwen-plus pilot (verdict `go`, pre-registered): under enforcement the agent's
*code* stayed honest (false done-claims refused; oracle end-states near-green on tasks within
its ability) while its *spec drifted nearly as fast as the ungated arms'* (velocity 6.17 vs
6.33) — because the spec is prose, nothing executes it, and the gate enforces custody (the spec
changed) rather than truth (the spec is right). Meanwhile the purest observed cell — perfect
24/24 code with drift burden 10 after one task — shows drift decoupled from failure, and the
standing-instruction arm was behaviorally inert (point-identical trajectory to no-instruction).

The fix is the HIT-SDD thesis the estate has measured around but never tested: **make the spec
itself executable.** A stale scenario stops being silent documentation debt and becomes a red
check.

## 2. The design in one paragraph

Both arms work in the **same real OpenSpec workspace** (pinned CLI 1.4.1, real
`openspec/specs/**` + `openspec/changes/**` layout, per-task propose→implement→archive cycle
with the archive step run by the harness identically in both arms — profile
`e4-openspec-workflow-v1`, following the blessed `e1-openspec-workflow-v0` shared-environment
shape). The spec's `#### Scenario:` blocks are written in a **sealed WHEN/THEN grammar** whose
steps map 1:1 onto a **harness-owned step-pattern table** (§5). In the **prose arm** the
scenarios are never executed. In the **executed arm** they are the acceptance gate: new
scenarios must fail before implementation (discriminating red, §6) and the full scenario set
must pass to accept "done". The framework, artifacts, workflow, budgets, and provider are
identical in both arms; *whether the spec runs* is the only difference. Hidden, harness-side and
unchanged in both arms: the ground-truth suite (true correctness), the drift meter (spec
freshness), and the new **scenario-strength instrument** (adversarial-implementation kill score,
§7) — so gaming the executed gate is measured, never silently rewarded.

Operator decisions already taken: **two arms** (the instruction arm is dropped as observed
inert) and **frontier model (deepseek-v4-pro)** for the evidence run, dry-run fake agent as the
only shakedown, budgets re-ratified on that model at the calibration milestone.

## 3. What each v1 piece becomes

| v1 piece | v2 disposition |
| --- | --- |
| Spec artifacts (`specs/openapi.json`, `specs/CONVENTIONS.md`) | Replaced as the agent-facing spec by OpenSpec requirement files with scenario blocks; typed ground-truth IR stays harness-side |
| Gate custody (spec changed + parses) | Custody + `openspec validate` (new wiring through the existing generic CLI runner) + step-grammar check + static floors (A8) |
| Gate red/green (harness tests) | The agent's own scenarios, executed per §5–§6 |
| Hidden oracle | Unchanged referee, runs exactly once per task close (A9) |
| Drift meter | Re-pointed at requirement/scenario blocks: coverage + staleness vs truth; MODIFIED-replace archive semantics become a first-class measured rot channel |
| — (new) | Scenario-strength instrument: IR-generated adversarial bank + kill score (§7) |
| Fake agent, snapshots, replay, budgets, manifest/inspector, verdict tool, live provider | Carry over; field additions only |

## 4. Workspace, CLI, and reuse decisions

- Real OpenSpec layout: spec-of-record at `openspec/specs/<capability>/spec.md`, change deltas
  at `openspec/changes/<change-name>/`, archive to `openspec/changes/archive/`.
- Pinned `@fission-ai/openspec@1.4.1` (already in devDependencies); binary resolved from
  node_modules; sealed env (telemetry off, CI, no color). Known quirks already solved in
  `src/e1-openspec-workflow.ts`: abort detected via output text + change-dir persistence (never
  exit code), archive dirs renamed date-independently for replay.
- **ADR-007 allowlist gate question (decide at review):** extend the import allowlist to
  `e1-openspec-workflow.ts`/`e1-openspec-harness.ts` (largely generic per exploration) with a
  thin E4-owned wrapper parameterizing the E1-bound pieces (constants loader, profile id,
  snapshot roots) — recommended — versus a full port.
- The archive step is run by the HARNESS at task close, identically in both arms (shared
  environment discipline; drift through MODIFIED-replace is thereby measured, not arm-specific).

## 5. Scenario grammar and step-to-executable semantics (the sealed core)

### 5.1 Scenario surface (what the agent writes)

OpenSpec requirement files containing `#### Scenario: <title>` blocks with bolded keyword
bullets — exactly the shape the proven `openspec-gherkin-v1` converter parses:

```markdown
#### Scenario: Creating a widget returns the stored entity
- **WHEN** I send a POST request to "/widgets" with body {"id": "w9", "name": "anvil", "price": 12.5}
- **THEN** the response status is 201
- **AND** the response field "name" equals "anvil"
- **WHEN** I send a GET request to "/widgets/w9"
- **THEN** the response status is 200
- **AND** the response field "price" equals 12.5
```

### 5.2 Pipeline: text → executable verdict

1. **Parse** (`e4-openspec-gherkin-v1`, TS port of the Python converter, byte-cross-tested on
   shared fixtures; converter id sealed in constants and stamped in every manifest): extract
   scenario blocks → ordered `(keyword, text)` steps; And/But bind to the preceding concrete
   keyword. A `.feature` rendering is emitted into the workspace as a derived byproduct (never
   hand-maintained; never parsed back).
2. **Bind** (`e4-step-table-v1`, sealed): each step's text must FULLY match exactly one pattern
   in the harness-owned step-pattern table (§5.3), yielding a typed step AST node. Any unmatched
   step is a grammar violation → custody failure quoting the offending line. The table is
   anchored-regex over fully-quoted literals; a fuzz test over the parser ships with the freeze
   (A3).
3. **Execute** (per scenario, hermetic — A4): spawn a FRESH workspace server process
   (harness-allocated port, v1 executor's readiness/timeout/canonicalized-JSON machinery
   reused); run the scenario's steps in order; kill the process. Scenarios run in fixed
   (document) order for replay determinism; isolation, not randomization, removes
   order-dependence. Verdicts and full request/response transcripts are byte-stable and retained
   exactly as v1 executor artifacts are.

### 5.3 Step-pattern table v1 (sealed; the complete executable vocabulary)

Request steps (WHEN / AND after a WHEN):
| Pattern (anchored; `<...>` = typed capture) | Executable semantics |
| --- | --- |
| `I send a GET request to "<path>"` | `fetch(base+path, {method:"GET"})`; response becomes the current response |
| `I send a DELETE request to "<path>"` | ditto, DELETE |
| `I send a POST request to "<path>" with body <json>` | POST with `content-type: application/json`, body = the inline JSON literal (must parse; single line) |
| `I send a PUT request to "<path>" with body <json>` | ditto, PUT |
| `I remember the response field "<json.path>" as "<name>"` | binds a scenario-local variable from the current response body; subsequent `<path>`/`<json>` captures may reference `{<name>}` (exact substitution) — enables create→fetch chains without seed overfitting |

Assertion steps (THEN / AND after a THEN):
| Pattern | Executable semantics | Strength class |
| --- | --- | --- |
| `the response status is <int>` | exact integer compare (no status classes — A3) | weak |
| `the response field "<json.path>" equals <json-literal>` | canonicalized-JSON equality at the path | **value-binding** |
| `the response field "<json.path>" equals the remembered "<name>"` | equality against a bound variable | **value-binding** |
| `the response body equals <json-literal>` | canonicalized whole-body equality (exact-object) | **value-binding** |
| `the response has no field "<json.path>"` | forbidden-field (absence) | value-binding (negative space) |
| `the response list has length <int>` | array length exact | value-binding |
| `the response field "<json.path>" is a <string\|number\|boolean\|array\|object>` | type/existence only | weak |

Custody floors (A3/A8, checked at spec-exit in BOTH arms — they are spec-quality lint, not
execution): every scenario has ≥1 THEN; every scenario has ≥1 **value-binding** assertion;
statuses are integers; all string literals quoted; no other step text is legal. There are no
`contains`/substring forms, no disjunctions, no negations of status, no optional parameters, and
no default credentials (v1's substrate has no auth surface; if v2+ adds one, auth headers are
explicit step arguments — A3).

### 5.4 Sealing

`e4-openspec-gherkin-v1` (converter), `e4-step-table-v1` (patterns + their executable
semantics), and the floors are sealed in the v2 constants lineage and protocol-tested verbatim —
the exact regex table is a constants-adjacent code twin with a pinned hash, same discipline as
v1's block grammar.

## 6. Gate mechanics (executed arm)

Per task: spec phase → implementation phase, as v1, with these changes:

1. **Custody** = spec changed + `openspec validate` passes + all scenarios parse and bind + A8
   floors pass.
2. **Discriminating red (A2/A10)**: every scenario NEW in this task's change must FAIL when
   executed against the current (pre-implementation) workspace; the failure mode per scenario
   (assertion-level vs route-absent) is recorded in the manifest. Any already-green new scenario
   → custody-class refusal with feedback ("this scenario does not describe the requested
   change"). Prior spec-of-record scenarios must remain green at red-check time (no-regression,
   mirrors v1's prior-cumulative check).
3. **Green** on done-claim: the FULL cumulative scenario set (spec-of-record + this change)
   passes. Refusal returns the failing scenario titles + fixed-vocabulary failure strings.
4. Behavior-preserving tasks keep the v1 §3.3 no-change affirmation (byte-unchanged spec + ≥1
   smoke + done), unchanged.
5. The hidden GT oracle runs once at close in both arms (A9); false-confidence = done accepted
   by the agent's own gate while GT fails — in v2 this is a HEADLINE outcome, since it is
   exactly "the executable spec was too weak to catch the lie."

Prose arm: identical workspace, identical custody floors (spec must change, parse, floors pass —
keeping authoring effort symmetric), but scenarios are never executed; done is accepted as in
v1's ungated arms.

## 7. Scenario-strength instrument (A1/A5 — measured, hidden, never a gate)

Per task, harness-side after close (order: oracle → meter → strength → snapshot → probe):

1. Generate the **adversarial bank** from the task's gold IR deterministically: fixed variant
   set v1 = {validation-dropped, status-swapped (201→200 class-adjacent), no-op-write (mutations
   don't persist), seed-echo (returns fixtures regardless of input), field-leak (extra internal
   field in responses), wrong-filter (list ignores query params)}. Each variant = generated
   workspace via the scaffold with a mutated IR/data file; bank ids and generation rules sealed.
2. Execute the agent's cumulative scenario set against each variant (hermetic, as §5.2).
3. **Kill score** = fraction of variants with ≥1 failing scenario. Recorded per task in the
   manifest with per-variant verdicts; never fed back to the agent.
4. Reported alongside: GT-vs-self-spec gap (tasks where the agent's gate was green but GT red)
   and spec-surface coverage (diagnostic only — A5). Together these make gaming a measured
   outcome: a vacuous-but-passing spec = high false-confidence + low kill score + coverage gap.

Ecological-validity pin (from adjudication A1): the bank uses gold knowledge only the harness
has, so it must never gate or feed back — it is the v2 analog of the hidden oracle, and the
one-causal-variable discipline (execution of the spec is the only arm difference) is preserved.

## 8. Prior art and reuse

Live JIT OpenSpec→Gherkin converter:
`hit-sdd-bench-e2/src/hit_sdd_e2/authored_spec/openspec.py` (`openspec-gherkin-v1`, proven live;
commits `5e85e56`, `48ebfd9`, `2ab6ad2`, `5e50865` — converter version folded into the sealed
spec hash there, the same discipline §5.4 adopts). E2's per-scenario step *bindings* are
replaced here by the global sealed step table — harness-owned, not per-scenario — which is what
the adjudication's R5 (no agent step code) requires. E1's OpenSpec CLI wrapper and its quirk
handling are reused per §4.

## 9. Milestones (each on explicit approval; spend only at the end)

Model assignments (operator request, 2026-07-09): chosen for value-per-dollar with minimal
tier-switching. Rationale: this design doc freezes the judgment-heavy decisions to regex-level
detail, so the BUILD milestones are spec-execution — Opus-tier with the doc as anchor — while
the tier switches land at natural phase boundaries (build → operations → evidence). Two
switches total. If a milestone surfaces a genuine design ambiguity, it stops and escalates
rather than improvising (the same rule as v1's recorded-divergence discipline).

| Phase | Milestones | Model | Why |
| --- | --- | --- | --- |
| Build | v2-M1 … v2-M5 | **Opus** (one continuous arc) | Implementation against a frozen spec; the two riskiest cells have executable guards baked in (M2's parser fuzz test + byte-cross-test vs the Python converter; M5's freeze-pin tests). Fable here would buy little over the doc+guards. |
| Operations | v2-M6 | **Sonnet** | The calibration procedure has now been executed twice and is fully documented (launch → monitor → pinned adjust-once formula → freeze + hash-pin test). Judgment is pre-committed; the run is mechanical. |
| Evidence | v2-M7 + verdict/report + any post-run adjudication + the public post | **Fable** | Pre-registration seals interpretation; the report carries the claim discipline the LinkedIn/CTO goal depends on; wrong-but-plausible here corrupts the program's only public output. |

Standing exceptions: any GATE REVIEW response, design amendment, or unexpected-result
adjudication is Fable regardless of phase (that is judgment work, not execution); if Opus hits a
sealed-surface ambiguity in M2's step table it escalates rather than deciding.

- **v2-M1** OpenSpec workspace generator + CLI integration + allowlist gate decision. *(Opus)*
- **v2-M2** Converter port (fixture cross-test vs Python original) + step table + hermetic
  scenario executor (+ parser fuzz test). *(Opus — escalate step-table ambiguities)*
- **v2-M3** Gate rework (custody floors, discriminating red, green on cumulative scenarios;
  validate wired); runner adjustments; red failure-mode capture. *(Opus)*
- **v2-M4** Meter re-pointing (coverage/staleness over scenario blocks; episode semantics kept)
  + adversarial bank + kill-score instrument. *(Opus)*
- **v2-M5** Fake-agent behaviors (diligent / drifting / **vacuous-scenario gamer** — must land
  as high false-confidence + low kill score + coverage gap, the live anti-cheat fixture) +
  dry-run integration + non-budget v2 constants freeze + inspector/replay across the archive
  seam. *(Opus)*
- **v2-M6** Budget calibration on deepseek-v4-pro (spend-gated) → budget freeze. *(Sonnet)*
- **v2-M7** Pre-registered frontier evidence run (spend-gated; seeds/interpretation sealed
  pre-data; spec_touch trigger split, breakage-rate secondary, and kill-score reporting all
  carried; claim language per the framing standard). *(Fable, incl. report and public post)*

## 10. Verification

- Every milestone: full e1:protect triad + E4 import lint; test count grows from the current
  baseline, never shrinks.
- v2-M2: byte-identical parse vs the Python converter on shared fixtures; fuzz test green.
- v2-M5 dry run: both drift directions + the vacuous-scenario gamer measured (not blocked) + a
  seed-echo bank variant killed by the diligent agent's scenarios and NOT killed by the gamer's;
  chain replay valid across the archive seam; oracle runs exactly once per close (A9 test).
- v2-M7 only after: pre-registration sealed pre-data, e1:protect before/after, verdict tool is
  the only claim source.
