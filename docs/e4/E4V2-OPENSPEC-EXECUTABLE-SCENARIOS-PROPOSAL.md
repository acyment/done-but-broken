# E4 v2 design — OpenSpec workspace with executable scenarios

**Status: FULL DESIGN, awaiting operator gate review before any implementation milestone.**
Drafted 2026-07-09 at operator direction; anti-cheat design frozen from the adjudicated
deep-research backlog (`E4V2-ANTICHEAT-ADJUDICATION.md`, items A1–A10; rejections R1–R8 are
recorded there and not re-litigated here). Supersedes the earlier proposal draft in this file.

**Amendment 2026-07-09 (Fable session, post-approval):** the v2-M1 build arc stopped cleanly on
a design silence — the T0 gold spec-of-record generation policy — recorded in
`E4V2-M1-ESCALATION-t0-gold-spec-generator.md`. Resolved here by adding **§5.5**
(`e4-t0-gold-spec-v1`, sealed) and one clarifying sentence in §7.5 (spec-side convention
coverage scope). §9/§10 gain the corresponding per-milestone verification split. No previously
frozen surface is altered.

**Amendment 2 (2026-07-09, Fable session):** the restarted build arc stopped cleanly a second
time, before any code, on a systemic interaction recorded in
`E4V2-M1-ESCALATION-2-red-rule-vs-op-space.md`: most v1 substrate ops are behaviorally
invisible at the HTTP surface (the generated server enforced only required-fields; renames
never moved paths), so §6's discriminating-red rule was unsatisfiable on the majority of the
task distribution, the §5.5 template derivation dead-ended on more, the vocabulary could not
express PATCH, and the §7 wrong-filter bank variant was unkillable at T0 under uniform seed
references. Resolved here by: **§5.6** (`procedural-rest-v2`, the substrate observability
revision — every non-behavior-preserving op now has an observable HTTP consequence, with an
executable per-op census guard at the new milestone v2-M0), a **PATCH request form** in §5.3,
**field/rule-level rejection templates + sealed violating-value tables** in §5.5, a
**change-level red rule** replacing scenario-level all-red in §6, a sealed **retirement
tombstone** convention for capability removals (forced by a CLI fact probed at this
amendment: the pinned `openspec archive` refuses to rebuild a spec to zero requirements and
aborts the whole archive — so remove-all changes are mechanically un-archivable),
and corrections to the §5.5 kill-score rationale and the §7.5
"identical code shape" wording. A2 of the anti-cheat adjudication is superseded **in part**
(scenario-level → change-level strictness; recorded there). A new milestone **v2-M0** is
prepended; the build arc becomes v2-M0…v2-M5, milestone names otherwise unchanged.

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
scenarios are never executed. In the **executed arm** they are the acceptance gate: each
change's new scenarios must include a pre-implementation failure (discriminating red, §6) and
the full scenario set must pass to accept "done". The framework, artifacts, workflow, budgets, and provider are
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
| Drift meter | Re-pointed per the pinned §7.5 mapping: code-side channel UNCHANGED from v1; spec-side channel re-based on scenario execution against gold |
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
| `I send a PATCH request to "<path>" with body <json>` | ditto, PATCH (Amendment 2 — makes the `modify_endpoint` op's post-state expressible; without it the update endpoint's truth is un-specifiable after a PUT→PATCH flip) |
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

### 5.5 T0 gold spec-of-record generation (`e4-t0-gold-spec-v1`, sealed — 2026-07-09 amendment)

The T0 workspace must ship a populated, in-sync spec-of-record: the pinned CLI's own validator
requires `## Purpose` + `## Requirements` and **≥1 `#### Scenario:` per requirement**
(`REQUIREMENT_NO_SCENARIOS`), the drift construct presupposes pre-existing scenarios that can go
stale, and whatever T0 says is the sealed baseline for the §7.5 meter, the coverage denominator,
and the §7 kill-score context. This section pins the generation policy: a deterministic pure
function of a ground-truth IR snapshot (normally the fixed T0 baseline; M5's diligent fake agent
reuses the same templates on post-op IRs to derive its gold change deltas by diffing against the
pre-task spec-of-record).

**Workspace shape.** The OpenSpec tree is THE agent-facing spec in v2: `specs/openapi.json` and
`specs/CONVENTIONS.md` are not emitted (operationalizing §3 "replaced"; the code-side meter
channel reads the registry/schema dump and is unaffected). One capability per entity; folder
name = the first path segment of the entity's first endpoint in IR order, lowercased (e.g.
`openspec/specs/widgets/spec.md`). `## Purpose` = one deterministic template sentence per
entity. `## Requirements` = one `### Requirement:` per endpoint of that entity, in IR order.
The workspace README is re-authored for v2: it documents the OpenSpec layout and per-task
propose→implement→archive workflow and carries the §5.3 step-pattern vocabulary (patterns, not
implementations) plus the A8 floors **verbatim** — the v1 Gate-1 "README carries the grammar
verbatim" pin, transferred. README text seals under `protocol_text` at the M5 freeze.

**Requirement and scenario templates (the sealed table).** Exact strings with typed
placeholders, one requirement template per endpoint kind (title + one-sentence SHALL statement)
and the following scenario set. Scenarios appear in template order under their requirement,
entities in IR order — document order is execution order (§5.2). Every template stays inside
the §5.3 vocabulary: single-line JSON bodies, quoted strings, integer statuses,
dot-separated object paths only (no array indexing), no `remember` steps (ids are
client-supplied in this substrate; the remember form remains available to agents).

| Endpoint kind | Scenario(s) emitted |
| --- | --- |
| create | (1) *"Creating a ⟨entity⟩ returns the stored entity"*: POST ⟨collection⟩ with the fresh body → status 201 → body equals ⟨sent⟩ → GET ⟨collection⟩/⟨spec-id⟩ → status 200 → body equals ⟨sent⟩. (2) *"Creating a ⟨entity⟩ without ⟨field⟩ is rejected"*: POST the fresh body minus the first required non-id field → status 400 → field `error.⟨k1⟩` equals `"validation_error"` → field `error.⟨k2⟩` is a string. |
| read | *"Fetching a missing ⟨entity⟩ returns not found"*: GET ⟨collection⟩/⟨missing-id⟩ → status 404 → field `error.⟨k1⟩` equals `"not_found"` → field `error.⟨k2⟩` is a string. (The happy-path read is covered by create's round-trip GET; a dedicated create→get twin would duplicate it under the §6 canonicalizer.) |
| update | *"Updating a ⟨entity⟩ persists the change"*: POST fresh → 201 → ⟨update-method⟩ ⟨changed body⟩ → 200 → body equals ⟨changed⟩ → GET → 200 → body equals ⟨changed⟩. ⟨update-method⟩ = the update endpoint's IR method, PUT or PATCH (Amendment 2). |
| delete | *"Deleting a ⟨entity⟩ removes it"*: POST fresh → 201 → DELETE → 204 → GET → 404 → field `error.⟨k1⟩` equals `"not_found"`. |
| list | *"Creating a ⟨entity⟩ increases the list count"*: POST fresh → 201 → GET ⟨collection⟩ → 200 → list has length ⟨seed-count + 1⟩. Additionally, when the entity has a ref field: *"Filtering ⟨collection⟩ by ⟨ref-field⟩ returns only matching rows"*: POST fresh (ref = seed parent 1) → 201 → GET ⟨collection⟩?⟨ref-field⟩=⟨parent-id⟩ → 200 → list has length ⟨matching-seed-count + 1⟩. |
| analytics | *"Creating a ⟨entity⟩ increases the reported count"*: POST fresh → 201 → GET ⟨stats path⟩ → 200 → field `count` equals ⟨seed-count + 1⟩. |

`⟨k1⟩/⟨k2⟩` are the error-envelope keys the error_format convention statement pins (`code`/
`message` or `type`/`detail`), resolved exactly as the GT generator resolves them. Error
**values** asserted are the stable machine codes only (`validation_error`, `not_found`); message/
detail wording is never asserted (the M3 wording-overreach rule, carried over — the weak
`is a string` form pins the second envelope key's presence without freezing prose).

**Field- and rule-level rejection templates (Amendment 2 — sealed alongside the table above).**
These pin the §5.6 validation surface and give type/rule-touching ops a discriminating delta.
Both sit under the entity's **create** requirement; scenario order under that requirement is:
happy path, required-field rejection, type rejections (fields in IR order), rule rejections
(rules in IR order).

| Template | Applies to | Scenario emitted |
| --- | --- | --- |
| type rejection | every field of type `int`/`decimal`/`bool`/`date` on an entity with a create endpoint | *"Creating a ⟨entity⟩ with a non-⟨type⟩ ⟨field⟩ is rejected"*: POST the fresh body with ⟨field⟩ = ⟨type-violating literal⟩ → status 400 → field `error.⟨k1⟩` equals `"validation_error"` → field `error.⟨k2⟩` is a string. |
| rule rejection | every validation rule | *"Creating a ⟨entity⟩ with an invalid ⟨field⟩ is rejected"*: POST the fresh body with ⟨field⟩ = ⟨rule-violating literal⟩ → status 400 → field `error.⟨k1⟩` equals `"validation_error"` → field `error.⟨k2⟩` is a string. |

Sealed violating-value tables (part of the `e4-t0-gold-spec-v1` code twin; the §5.6 server
enforces the mirror checks, and the v2-M2 executed in-sync check cross-verifies the two):
type-violating literals — `int` → `1.5`, `decimal` → `"1.5"`, `bool` → `"yes"`, `date` →
`"not-a-date"` (`string`/`ref` fields get no type-rejection scenario: any JSON string is
type-valid for them, so no violating literal exists inside the vocabulary). Rule-violating
literals — `range` → `min − 1` (or `max + 1` when only a max is pinned), `format` → a sealed
non-matching literal per pattern in the substrate's pattern pool (`"^[\\w -]{1,80}$"` → `"!"`),
`enum` → `"__not_a_member__"`.

**Retirement tombstone (Amendment 2 — the delta-derivation rule for retired capabilities).**
The change-delta derivation is a function of the pair ⟨post-op IR, pre-task spec-of-record⟩;
the tombstone is the one rule where the second input contributes content rather than just the
diff. For every capability present in the pre-task spec-of-record whose folder name (= first
path segment, §5.5 workspace shape) matches the first path segment of NO post-op IR endpoint
— the `delete_entity` signature, and the old-name capability of a `rename_entity` — the
derived change REPLACES that capability's requirements with exactly one, phrased on the
capability name (the entity may no longer exist in the IR): *"### Requirement: Retired
⟨capability⟩ endpoints"* / *"The service SHALL NOT serve the retired /⟨capability⟩
endpoints."*, carrying one scenario — *"Requests to retired /⟨capability⟩ endpoints return
not found"*: GET /⟨capability⟩ → status 404 → field `error.⟨k1⟩` equals `"not_found"` →
field `error.⟨k2⟩` is a string. This exists because the pinned CLI refuses to rebuild a spec
to zero requirements (whole-archive abort, exit 0 — probed and pinned at this amendment, same
quirk class as the exit-0 abort in §4), so capability retirement must stay expressible as a
valid non-empty spec; it also gives `delete_entity` and `rename_entity` changes a NOVEL,
RED-pre-implementation scenario (the collection GET returns 200 before the routes move or
vanish), satisfies the A8 floors (the `error.⟨k1⟩` equality is value-binding), and remains
TRUE against every later gold implementation until the collection path is reused — a
re-added entity's derivation then replaces the tombstone with the full template set
(delete-then-re-add stays coherent). A tombstone that still passes against gold is not drift
(§7.5 as amended: a scenario that passes against gold is never a discrepancy).

**Fixture-value policy (A6-aligned).** Fresh bodies carry every field of the entity, values from
the GT generator's sealed field-value derivation at **spec-reserved ordinals**: fresh body n=5,
update's changed value n=6 on the first non-id field (GT reserves 1/2 for seed rows, 9/20 for
its own fixtures). Spec ids are `⟨entity⟩-spec-1`, the missing-id literal is
`⟨entity⟩-spec-missing`; both must be disjoint from seed ids (`*-seed-N`) and GT fixture ids
(`*-new-1`, `*-invalid-1`, `*-does-not-exist`) — asserted by the self-check, so agent-visible
spec values and hidden-oracle values stay decorrelated by construction. Ref-typed fields
reference seed row 1 of the referenced entity (seed rows are the only pre-existing rows at
scenario start; per-scenario hermetic execution resets state to seed — and seed refs are
themselves heterogeneous per §5.6.6, which is what makes the filtered-list template
discriminating). One fresh fixture per entity, reused across that entity's templates. The
Amendment-2 violating-value literals above are fixture policy too: sealed literals, not
ordinals.

**Design rationale (recorded, not re-litigated):** the emitted set is the minimum that (a)
covers every truth endpoint with ≥1 matching request, (b) satisfies the A8 floors with strong
forms (whole-body equality on echo responses, consequence GETs per A7's create→get /
delete→get-404 / list-count-delta shapes), and (c) achieves kill score 1.0 against the §7 bank
at T0 — variant-by-variant: validation-dropped ← the required-field, type, and rule rejections;
status-swapped ← exact integer statuses; no-op-write ← the update/delete consequence GETs;
seed-echo ← fresh-body echo + round-trip; field-leak ← whole-body equality; wrong-filter ← the
filtered-list count, whose discrimination **requires §5.6's heterogeneous seed refs** (under
v1's uniform all-rows-reference-parent-1 seeding the filtered and unfiltered counts coincide
and the wrong-filter variant is unkillable at T0 — found and corrected at Amendment 2). The
create round-trip GET is guaranteed a target by the §5.6 every-entity-has-a-read invariant.
A gold baseline that kills the full bank calibrates the instrument's ceiling: kill-score decay
under the agent's maintenance then measures spec-strength erosion, never a weak starting point.

**Verification split across milestones (executable):**
- **v2-M0 (census, Amendment 2):** the §5.6 per-op observability census passes on
  `procedural-rest-v2` — for every op kind and eligible variant, the derived delta (templates
  + retirement tombstone) contains ≥1 novel scenario red against the pre-op gold
  implementation, and the post-op derived set passes 100% against the post-op gold
  implementation.
- **v2-M1 (structural):** the emitted tree passes `openspec validate --specs --strict
  --no-interactive`; the template table is total over the endpoint-kind vocabulary; fixture-id
  disjointness holds; every scenario satisfies the A8 floors by construction (generator
  self-check — the v2 analog of v1-M1's generator in-sync self-check).
- **v2-M2 (executed):** the full T0 gold scenario set parses under the converter, binds under
  the sealed step table, and passes 100% against the T0 gold implementation via the hermetic
  executor.
- **v2-M4 (instrument calibration):** the T0 gold spec-of-record achieves kill score 1.0 against
  the T0 adversarial bank, and the re-based meter reports zero spec-side discrepancies at T0.

**Sealing.** The template table (requirement titles/SHALL statements, scenario titles, step
sequences, fixture ordinals, violating-value literals, disjointness rules, capability naming)
is `e4-t0-gold-spec-v1` — a constants-adjacent code twin with a pinned hash, same discipline
as the step table (§5.4), stamped in every manifest.

### 5.6 Substrate observability revision (`procedural-rest-v2`, sealed — Amendment 2)

The v1 substrate was built for harness-side test oracles and a text-level meter; most of its
drift/additive ops were invisible at the HTTP surface (the generated server enforced only
required-fields; renames never moved paths; validation rules were data the server never read).
That deadlocks §6's discriminating red, dead-ends the §5.5 diligent derivation, and blinds the
§7.5 spec-side channel — the executed arm would be structurally refused on most tasks while
the prose arm sails through, an arm-differential censoring channel of the class that broke the
flash pilot (full census: `E4V2-M1-ESCALATION-2-red-rule-vs-op-space.md`). v2 therefore runs
on **`procedural-rest-v2`**: same IR types, same registry/schema **dump format** (the §7.5
code channel's extraction is untouched), same op vocabulary except the pins below — and every
non-behavior-preserving op has an observable HTTP consequence:

1. **Full request validation in the generated server**, sealed check order: unknown field →
   missing required → type → validation rule; first failure wins; status 400, machine code
   `validation_error`, envelope per the error_format convention; applies to create and update
   bodies. Type checks: `string`/`ref` = JSON string (no referential-integrity check —
   recorded limitation), `int` = integer number, `decimal` = finite number (integers
   admissible), `bool` = boolean, `date` = string matching `^\d{4}-\d{2}-\d{2}$`; `null` is
   treated as absent. Enforced rules: `range` (min/max), `enum` (membership), `format`
   (pattern).
2. **Entity renames move paths**: every endpoint of the renamed entity has its collection
   segment regenerated as `lowercase(newName) + "s"` (`/widgets/{id}` → `/products/{id}`,
   `/widgets/stats` → `/products/stats`). The rename-lineage map gains one entry per affected
   endpoint (rendered id changes, `semantic_item_uid` preserved) so §7.5 identity merging is
   unchanged; the capability folder tracks the new first path segment. This is what makes the
   `stale_claim` drift signature real in the ungated arm.
3. **`add_entity` mints full CRUD + list** (create/read/update/delete/list — the baseline
   entity shape). Substrate invariant, census-asserted: **every entity has a read endpoint at
   all times**, so the create template's round-trip GET is total.
4. **`delete_field` eligibility narrows to required, non-id, non-ruled fields.** An optional
   field's removal has no observable consequence even under strict validation, and the
   template function (a pure function of the post-op IR) cannot know the removed field to
   assert its rejection.
5. **`modify_convention` targets only the `error_format` convention** in v2 sequences.
   naming/command/structural conventions are static baseline items — they have no HTTP
   consequence and no scenario-assertable surface (the §7.5 scope clarification's logic,
   applied to the op space). Code-side meter coverage of those kinds is unchanged; recorded
   limitation, same class as the field/validation_rule spec-side exclusion.
6. **Heterogeneous seed refs**: seed row *n*'s ref fields reference seed row *n* of the
   referenced entity (v1 pointed every row at parent 1, which made the filtered-list count
   equal the unfiltered count — see the corrected §5.5 rationale).
7. **GT testgen v2** adds the mirror negative tests (unknown-field, type, and rule rejections
   at the GT-reserved fixture ordinals), so the hidden oracle requires the enforcement the
   spec now describes (A6/A7 alignment), and adapts expected bodies to (6).

`substrate_version = "procedural-rest-v2"`; a fresh compatibility boundary in the v2 constants
lineage. v1 substrate modules stay untouched and their tests keep passing (the v1 seal and the
test-count-only-grows rule are unaffected).

**Executable design guard (the census test, v2-M0 — the escalation's paper census made
mechanical):** for every op kind — and every variant its eligibility admits (each retype
direction, each deletable-field class, the convention target, ref/non-ref list entities) —
applying the §5.5 delta derivation (templates over the post-op IR + the retirement-tombstone
rule, diffed against the pre-op spec-of-record) yields a delta containing ≥1 novel scenario
that FAILS against the pre-op gold implementation, and the full post-op derived scenario set
passes 100% against the post-op gold implementation. Build-time test, never a run-time gate;
it is the acceptance criterion for this amendment.

### 5.7 Substrate naturalization (`procedural-rest-v2.1`, sealed — Amendment 3, 2026-07-12)

**Motivation.** The fixture-migration verification (learning-log audit section;
`docs/protocols/e4-v3-fc-convention-classification-20260712.json`) showed 41/63 M6 and 9/13
learning-run false-confidence events were FULLY explained by undisclosed convention traps:
the hidden oracle regenerated seed fixtures from the post-op IR (id migration on renames,
values re-derived from field names, exact backfill values, a pinned date literal, ref-field
names required sticky while their values migrated) and gold paths used a naive plural that
contradicted both natural English and the T0 workspace's own visible style. Operator decision
(2026-07-12, recorded): naturalize both. M6/M7/M8 and the learning runs remain historical at
their stamped boundaries; this is a new compatibility boundary.

1. **English pluralizer (sealed).** Every minted collection segment uses: lowercase the
   entity name; consonant+`y` → `ies`; ending in `s/x/z/ch/sh` → `es`; else `+s`. Applies to
   `add_entity` CRUD+list paths, `rename_entity` path moves (supersedes §5.6.2's
   `lowercase(newName)+"s"`), and `add_endpoint` analytics paths (v2 now overrides the v1 op,
   whose naive rule could mint `/categorys/stats` beside the entity's own T0 `/categories`).
   Reproduces the T0 baseline byte-identically. All sealed name pools verified unambiguous
   under the rule (entries, listings, suppliers, warehouses, …).
2. **Seed data carries forward (data-migration semantics).** The seed fixture is generated
   once at T0 and migrated per op by sealed rules, uid-keyed against the IR delta; the
   fixture map is keyed by the current entity name:
   - `rename_entity`: rows untouched — stored ids keep their creation-time prefix
     (`category-seed-1` survives Category→Listing) and ref values elsewhere stay valid; the
     fixture key follows the entity; referencing ref-field KEYS cascade (pin 3).
   - `rename_field`: the row key renames, the stored value is unchanged (no more
     "Sample alias 1" re-derivation).
   - `add_field`: rows gain the field with value `null` (add_field mints optional fields
     only, so writes stay legal); disclosed per pin 4.
   - `add_relationship`: rows gain the ref field linked row-*n* → parent row *n* by carried
     parent ids (preserves §5.6.6 filtered-list killability); a row with no parent
     counterpart gets `null`; disclosed per pin 4.
   - `retype_field`: stored values convert by sealed rule — int→decimal identity,
     decimal→int truncation toward zero, string→date the sealed literal `2026-01-01`,
     bool→string `String(v)`, date→string identity; representation-changing conversions
     disclosed per pin 4.
   - `delete_field` / `delete_entity`: keys/rows dropped (plus whatever ref-field drops the
     IR delta itself records).
   - `add_entity`: NO seed rows — new entities start empty; GT coverage re-anchors on
     oracle-created fixtures (create `-new-1`, read/update it, create `-new-2`, delete it,
     read-after-delete 404, list ≥1) so CRUD coverage survives without inventing data the
     workspace never had.
3. **Ref-key cascade on entity rename.** Ref-typed fields named exactly
   `lowercase(oldName)+"_id"` whose `ref_entity` is the renamed entity rename to
   `lowercase(newName)+"_id"` (a field custom-renamed earlier no longer matches and keeps its
   name). Emits field-level rename-lineage entries (uid preserved) so the meter merges
   identity instead of scoring delete+add. This inverts the punished-cascade trap: the brief's
   "rename … everywhere" and gold now agree.
4. **Disclosure.** The v3 determinacy table gains a `fixture_migration` fact kind and the PM
   brief renders determined "existing records" lines for: add_field null backfill,
   add_relationship linking (first-to-first, second-to-second, null when no counterpart), and
   representation-changing retype conversions (including the string→date literal). The v3-M0
   census asserts coverage.
5. **GT testgen consumes the carried fixture** for seed-row paths, expected bodies, filter
   values, and list counts. Oracle-authored fixtures (ordinals 9/20, `-new-`/`-invalid-` ids)
   still derive from current names/types — they are writes the oracle itself makes, echoed
   back, so no hidden convention is imposed on the agent.
6. **§5.5 template derivation becomes a pure function of (post-op IR, carried fixture)** —
   list counts and filtered-list parent ids bind to carried rows. T0 output is byte-identical
   to v2.0 (T0 fixture equals the carried fixture at T0).
7. **Version/boundary.** `substrate_version = "procedural-rest-v2.1"` (`substrate_kind`
   unchanged); v2 constants v0.5, v3 constants v0.4; substrate/testgen/gold-spec twins
   re-pinned. Fixture migration is byte-deterministic (pure function of the drawn chain).
8. **Census extension (acceptance criterion of this amendment):** per-facet cases — stored
   ids stable through renames (oracle requests old-prefix ids at new paths and passes on
   gold); values stable through field renames; ref keys cascade with lineage; null backfill;
   disclosed retype literals; filtered-list killability at T0 and post-rename; add_entity
   fresh-data coverage; T0 workspace byte-identical to v2.0; plus the unchanged v2-M0
   red-pre/green-post sweep over all op variants.

## 6. Gate mechanics (executed arm)

Per task: spec phase → implementation phase, as v1, with these changes:

1. **Custody** = spec changed + `openspec validate` passes + all scenarios parse and bind + A8
   floors pass.
2. **Discriminating red (A2/A10, change-level per Amendment 2)**: every scenario NOVEL in this
   task's change is executed against the current (pre-implementation) workspace and its
   red/green status and failure mode (assertion-level vs route-absent) are recorded in the
   manifest; the CHANGE must contain at least one red novel scenario, per rule (i) below. A
   change whose novel scenarios are all already green → custody-class refusal with feedback
   ("the change adds no scenario that discriminates the requested change").

   **Novelty semantics under OpenSpec MODIFIED blocks (pinned — modified requirement blocks
   replace wholesale, so block membership cannot define "new"):** canonicalize every scenario in
   the change AND every scenario in the current spec-of-record using the estate's scenario
   canonicalizer precedent (`e1-openspec-scenario-canonicalizer-v1`: strip Gherkin keywords,
   bold markers, bullets, case, whitespace). A change scenario whose canonical form already
   exists in the spec-of-record is **carried**; one whose canonical form does not is **novel** —
   regardless of whether it sits in an ADDED or MODIFIED block. Rules: (i, **as amended at
   Amendment 2 — change-level red**) on a non-behavior-preserving task, the change must
   contain **≥1 novel scenario, of which ≥1 must be red**; a change whose novel scenarios are
   ALL green is refused ("the change adds no scenario that discriminates the requested
   change"); novel-but-green scenarios in an otherwise-discriminating change are RECORDED per
   scenario (`green_novel`, extending the A10 capture) and echoed in feedback but are NOT
   gating. There is NO pure-removal custody shape: a change with zero novel scenarios is
   always refused on a non-behavior-preserving task — capability retirement is expressed
   through the §5.5 retirement tombstone (itself a novel red scenario), and the pinned CLI
   makes remove-all changes un-archivable anyway (empty-rebuild abort, probed at this
   amendment). Wrongful scenario removals inside otherwise-valid changes remain the meter's
   business (coverage_gap onsets) and the strength instrument's (kill-score decay), never the
   gate's — the gate enforces custody, not truth (ADR-003, R2-3). *Rationale for the
   amendment (recorded): scenario-level all-red — A2 as originally adjudicated — is
   unsatisfiable even on an observable substrate, because a template-faithful delta necessarily
   bundles the replacement happy-path scenario (green whenever the new behavior's accepted set
   contains the old fixture, e.g. a decimal→int retype) with the discriminating rejection
   scenario; change-level discrimination preserves A2's anti-tautology core (all-green refusal)
   while admitting mixed deltas. A gamer padding one red scenario with green tautologies is
   measured, not blocked: `green_novel` counts, kill score, and coverage feed the §7
   diagnostics.* (ii) **carried** scenarios and the prior spec-of-record set are
   executed at red-check time and their green/red status is RECORDED (`prior_green`,
   v1-style) but is NOT gating — the agent may be mid-flight, and the done-claim's cumulative
   green is the enforcement point; (iii) behavior-preserving tasks keep v1 semantics: the red
   requirement is skipped (novel scenarios are permitted and their pre-implementation status is
   recorded), and the §3.3 byte-unchanged affirmation path stands for true no-change exits;
   (iv) REMOVED scenarios play no role in the red check — removed coverage is the drift meter's
   business, not the gate's.
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

### 7.5 Drift-meter mapping (pinned — the v2 inventory semantics)

**Code-side channel (`code_vs_truth`): UNCHANGED from v1.** The registry/schema surface-dump
extraction, all five item kinds (endpoint/entity/field/validation_rule/convention), the
registry-bypass reconciliation, and the fail-closed extraction behavior carry over verbatim —
the generated app's registry/schema **dump format** is identical in v2 (Amendment 2 wording
fix: the app itself is `procedural-rest-v2` per §5.6, behaviorally stricter, dump-compatible).

**Spec-side channel (`spec_vs_truth`): re-based on scenario EXECUTION, not static parsing.**
Statically inferring semantics from assertion text would re-implement the executor badly;
instead the meter runs the spec-of-record's scenarios (post-archive, i.e. the living spec)
against the task's GOLD implementation, harness-side and hidden (gold never touches the agent —
same isolation class as the hidden oracle). Classification, at endpoint granularity plus
conventions:

- **`contradiction`** — a scenario that FAILS against gold: the spec claims behavior that is not
  true. Attributed to the truth endpoint(s) its request steps match (dispatcher matching rules,
  literal-segment specificity), `semantic_item_uid` = the matched endpoint's IR uid.
- **`stale_claim`** — a scenario that FAILS against gold and whose request matches NO current
  truth route: the spec describes surface that no longer exists (the post-rename/post-delete
  signature). `item_id` = the rendered `endpoint:<METHOD> <path>` form of the unmatched
  request; identity resolution through the v1 rename-lineage merge (`resolveStaleClaimIdentity`)
  unchanged. **Amendment 2 clarification:** a scenario that PASSES against gold is never a
  discrepancy, matched or not — a §5.5 retirement tombstone correctly asserts negative space
  (its request matches no route and its 404 assertions hold), which is truth, not staleness.
- **`coverage_gap`** — a truth endpoint matched by NO scenario request. Uid = the endpoint's IR
  uid. (Weak-only scenarios — no value-binding assertion — cannot exist post-custody, so
  "mentioned but unpinned" is excluded by the A3 floors rather than classified here.)
- **Conventions**: a truth convention item (e.g. error-envelope shape) is covered iff ≥1
  scenario asserts on its shape (error-field paths against the sealed envelope keys); else
  `coverage_gap` on that convention item. Code-side convention measurement is unchanged.
  **Scope clarification (2026-07-09 amendment):** spec-side convention coverage applies only to
  convention kinds that are scenario-assertable under the sealed step table — in the v1
  substrate, exactly `error_format`. `naming`/`command`/`structural` conventions are
  code-side-only in v2 (recorded limitation, same class as the field/validation_rule exclusion
  below; without this scope pin, T0 in-sync would be structurally unachievable, since no step
  form can assert a naming/command/structural statement).
- **Field/validation_rule granularity is deliberately NOT measured on the spec side in v2** —
  scenario text does not carry a reliable field inventory, and endpoint + convention granularity
  is what the drift claims need. The kinds remain in the report schema with zero spec-side
  counts (recorded limitation, revisit at a full-run gate).

Episode/velocity semantics ([R2: R2-1] — onsets on `semantic_item_uid`, lineage merge,
convention aggregation) operate on the resulting discrepancy lists unchanged. The MODIFIED-
replace archive rot surface lands naturally in this mapping: scenarios silently dropped by an
archive show up as `coverage_gap` onsets at the next task's meter run.

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
| Build | v2-M0 … v2-M5 | **Opus** (one continuous arc) | Implementation against a frozen spec; the three riskiest cells have executable guards baked in (M0's per-op observability census; M2's parser fuzz test + byte-cross-test vs the Python converter; M5's freeze-pin tests). Fable here would buy little over the doc+guards. |
| Operations | v2-M6 | **Sonnet** | The calibration procedure has now been executed twice and is fully documented (launch → monitor → pinned adjust-once formula → freeze + hash-pin test). Judgment is pre-committed; the run is mechanical. |
| Evidence | v2-M7 + verdict/report + any post-run adjudication + the public post | **Fable** | Pre-registration seals interpretation; the report carries the claim discipline the LinkedIn/CTO goal depends on; wrong-but-plausible here corrupts the program's only public output. |

Standing exceptions: any GATE REVIEW response, design amendment, or unexpected-result
adjudication is Fable regardless of phase (that is judgment work, not execution); if Opus hits a
sealed-surface ambiguity in M2's step table it escalates rather than deciding.

- **v2-M0** (Amendment 2) Substrate observability revision: `procedural-rest-v2` per §5.6
  (server validation surface, paths-follow-renames + endpoint-level lineage entries, full-CRUD
  add_entity, delete_field/modify_convention eligibility pins, heterogeneous seed refs, GT
  testgen negative tests) + the per-op observability census test. v1 substrate modules
  untouched. *(Opus)*
- **v2-M1** OpenSpec workspace generator (incl. the §5.5 T0 gold spec-of-record generator with
  its structural self-checks, over the v2 substrate) + CLI integration + allowlist gate
  decision. *(Opus)*
- **v2-M2** Converter port (fixture cross-test vs Python original) + step table (incl. the
  Amendment-2 PATCH form) + hermetic scenario executor (+ parser fuzz test) + the §5.5
  executed T0 in-sync check. *(Opus — escalate step-table ambiguities)*
- **v2-M3** Gate rework (custody floors, change-level discriminating red per §6.2.i as
  amended incl. `green_novel` recording, green on cumulative scenarios; validate wired);
  runner adjustments; red failure-mode capture. *(Opus)*
- **v2-M4** Meter re-pointing (coverage/staleness over scenario blocks; episode semantics kept)
  + adversarial bank + kill-score instrument + the §5.5 calibration checks (T0 gold kill score
  1.0; zero spec-side discrepancies at T0). *(Opus)*
- **v2-M5** Fake-agent behaviors (diligent / drifting / **vacuous-scenario gamer** — must land
  as high false-confidence + low kill score + coverage gap, the live anti-cheat fixture; the
  diligent agent's retirement-tombstone path exercised on a delete_entity or rename_entity
  task when the drawn fixture sequence contains one) + dry-run integration + non-budget v2
  constants freeze + inspector/replay across the archive seam. *(Opus)*
- **v2-M6** Budget calibration on deepseek-v4-pro (spend-gated) → budget freeze. *(Sonnet)*
- **v2-M7** Pre-registered frontier evidence run (spend-gated; seeds/interpretation sealed
  pre-data; spec_touch trigger split, breakage-rate secondary, and kill-score reporting all
  carried; claim language per the framing standard). *(Fable, incl. report and public post)*

  **v2-M7 EXECUTED 2026-07-09 — PRE-REGISTERED VERDICT: `go` (exit 0), with the sealed §4
  headline caveat attached.** Seeds 22/60 × 2 arms × 6 tasks = 24/24 task-runs on
  `deepseek-v4-pro`, all four sequences `chain_replay_valid: true`, zero aborted records, zero
  extraction failures, total spend $0.94, zero deviations from the pre-registration. (a) Arm-0
  velocity 9.33/6.33 per seed; (c) via BOTH legs — c1 velocity 7.83 vs 3.83, c2 false confidence
  10/12 vs 7/12. Headline caveat (§4 first branch, pre-committed): Arm-H false confidence is
  HIGH (7/12) with kill score 1.0 throughout — true-but-insufficient scenario coverage, not
  vacuousness; executing the spec reduced the lie rate, it did not make the gate honest. Full
  report: `docs/protocols/e4-v2-m7-pilot-run-report-v1.md`; manifests:
  `docs/protocols/e4-v2-m7-pilot-manifests-20260709-001/`; verdict re-runnable via
  `bun run bin/e4-v2-gonogo.ts` on that folder. The public post remains a separate
  operator-reviewed step.

## 10. Verification

- Every milestone: full e1:protect triad + E4 import lint; test count grows from the current
  baseline, never shrinks.
- v2-M0: the §5.6 per-op observability census test green (every op kind/variant's derived
  delta contains ≥1 red novel scenario, tombstone included; post-op derived sets 100% green
  vs post-op gold); all v1 substrate tests still green.
- §5.5's per-milestone T0 checks: structural self-checks at v2-M1, executed in-sync at v2-M2,
  kill-score-1.0 + zero-discrepancy calibration at v2-M4.
- v2-M2: byte-identical parse vs the Python converter on shared fixtures; fuzz test green.
- v2-M5 dry run: both drift directions + the vacuous-scenario gamer measured (not blocked) + a
  seed-echo bank variant killed by the diligent agent's scenarios and NOT killed by the gamer's;
  chain replay valid across the archive seam; oracle runs exactly once per close (A9 test).
- v2-M7 only after: pre-registration sealed pre-data, e1:protect before/after, verdict tool is
  the only claim source.
