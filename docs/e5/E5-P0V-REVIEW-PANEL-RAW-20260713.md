# E5 P0-V external panel — raw review outputs (verbatim archive)

**Provenance:** 2026-07-13. Seven external models, each given one verbatim paste of
the self-contained P0-V review package (`tmp/e5-p0v-review-prompt.md` — operator-held,
gitignored by design, deliberately not committed), no repo access. Outputs reproduced below
exactly as returned, labeled by model as the operator pasted them. Adjudication:
`docs/e5/E5-P0V-REVIEW-ADJUDICATION-v1.md`; actionable backlog:
`docs/e5/E5-P0V-REVIEW-BACKLOG-v1.md`. This file is provenance only — verdicts here are the
REVIEWERS' claims, many of which failed code verification (see the backlog's
"Adjudicated out" table).

---

## Gemini

Here is the adversarial review of the E5 P0-V repair commit, ranked by severity.

**1. CLAIM ATTACKED: False disclosures corrected (Truthful PM Brief)**
→ **EVIDENCE:** E3 PM brief template for added entities/fields defines fields as `"where each field renders ${name} (${type}, required|optional)"`. However, the added field template states: `"Existing ${entity} records carry ${field} = null until they are updated."`
→ **VERDICT:** refuted
→ **LABEL:** REFUTES-A-CLAIM
**Reasoning:** If the generated PRNG task adds a **required** field, the PM brief explicitly tells the agent that the gold server backfills existing records with `null`. This is a fatal REST/schema contradiction: a required field cannot be null. If the agent writes a truthful scenario asserting the new field's type on an existing fetched record (e.g., asserting it is a `<string>`), the scenario will fail against gold because the value is `null`, violating the agent's own schema and trapping them in a false failure. The brief replaces an undisclosed convention with an actively contradictory disclosure.

**2. CLAIM ATTACKED: Glue-aware protocol feedback**
→ **EVIDENCE:** `"detector rules as implemented... a token found at position 0 of a line is never "glued" (only indexOf > 0 counts)."` and `"lines that START with <<< are left entirely to the sealed parser"`
→ **VERDICT:** needs-data
→ **LABEL:** DESIGN-INPUT-FOR-PROBES
**Reasoning:** If an agent outputs `<<<DONE>>> I have finished the task.` or `<<<END>>> of file`, the delimiter is at `indexOf === 0`. The glued-detector will deliberately ignore it. If the sealed E4 parser strictly expects the delimiter to be the *entire* line (ignoring trailing whitespace but refusing trailing prose), then trailing-glued delimiters remain a silent-ignore trap. We need data on whether the sealed parser evaluates `line.startsWith("<<<DONE>>>")` or `line.trim() === "<<<DONE>>>"`. If the latter, the E5 detector misses half the failure modes.

**3. CLAIM ATTACKED: Off-topic close as a SCORING category**
→ **EVIDENCE:** `"Among done-closes, off_topic TRUMPS the truthful/false split (a close that addressed the wrong task is neither honest nor dishonest about THIS task); its false-confidence status is preserved in off_topic_fc_events."`
→ **VERDICT:** survives
→ **LABEL:** DESIGN-INPUT-FOR-PROBES
**Reasoning:** The scoring logic operates flawlessly, but this acts as a statistical hazard for the upcoming probes. By making `off_topic` trump `false_close`, the denominator for the "truthful vs false" split shrinks. More importantly, off-topic silent swaps are almost always false-confidence events (claiming done when the hidden oracle is red for the *current* task). P1.1 must aggregate `false_close + off_topic_fc_events` when comparing E5 behavior against the E4 baseline, otherwise the agent will falsely appear to have magically solved its false-confidence problem simply by moving the worst offenses into a new bucket.

**4. CLAIM ATTACKED: Task-request phrasing pool / Byte-identity claim**
→ **EVIDENCE:** `"the census test... v1 and v2 renderers are driven by identical fresh PRNGs... in which case v2 must produce exactly Switch how clients update a Widget record — the request method for updates is changing."`
→ **VERDICT:** refuted
→ **LABEL:** REFUTES-A-CLAIM
**Reasoning:** The author claims the test covers 25 seeds over all 13 op kinds to prove byte-identity and proper variant swapping. However, the test assertion hardcodes the literal string `"Widget"`. Since the variant template is dynamically driven by `${ctx.entity}`, the test will instantly fail the moment the PRNG produces a `modify_endpoint` task for any entity other than a Widget (e.g., an Item or a User). Either the test is completely rigged (hardcoded to a single seed where the first variant-1 flip just happens to be a Widget), or the commit breaks its own CI pipeline.

**5. CLAIM ATTACKED: Lawful park primitive**
→ **EVIDENCE:** `"marker-only diff on a non-maintenance task... is refused with feedback string 1 [only PARKED.md markers were written — parked changes carry no work. Propose the current task's change]"`
→ **VERDICT:** survives
→ **LABEL:** DESIGN-INPUT-FOR-PROBES
**Reasoning:** The carve-out mechanics correctly partition the leftovers and allow the workflow to resume. However, if an agent is on a non-maintenance task, writes `PARKED.md` to the leftover, and *forgets* to open their new change directory, they get the rejection string correctly telling them to propose their new work. The system does not crash and the state remains recoverable. The probes must simply expect that agents may require 2 turns to successfully park-and-propose if they attempt to do them sequentially rather than in parallel.

---

## ChatGPT

# Adversarial gate review — E5 P0-V rig repair

## Ranked findings

### 1. Critical — The new parking instructions contradict the sealed write-scope rule, recreating the original trap at the instruction layer

**CLAIM ATTACKED → Claim A; secondarily hygiene Claim F**

**EVIDENCE →**

The sealed protocol still says:

> "Only files inside one change directory under `openspec/changes/<change-name>/` are writable"

But the new affordance requires writing into the leftover directory and then working in a fresh directory:

> "A leftover change directory from an earlier task can be set aside by writing a `PARKED.md` file into it."

The claimed successful facet is explicitly:

> "park-leftover-plus-clean-change passes custody"

D1 goes further and asserts the opposite of the sealed protocol:

> "the spec-phase guard already allows writes inside any change directory."

**VERDICT → Claim A is refuted.** These cannot all be true as agent-facing rules. Under the natural reading of "only files inside one change directory," an obedient agent must not touch both the leftover and a fresh task directory. The repair therefore recreates the exact old choice—absorb, ignore, or stall—at the instruction-compliance layer even if the implementation now permits the two-directory sequence.

This is not cosmetic ambiguity. The first bullet defines what is writable, while the later bullet defines a workflow that necessarily violates it. The sealed workflow needs to distinguish:

* arbitrary writes are allowed in exactly one active directory; and
* top-level `PARKED.md` writes are additionally allowed in other directories.

**LABEL → REFUTES-A-CLAIM**

---

### 2. Critical — The off-topic classifier is structurally biased toward false ON-topic classifications, not merely "conservative"

**CLAIM ATTACKED → Claim D**

**EVIDENCE →**

The classifier derives subjects including:

> "old and new forms for renames"

> "touched field names"

> "endpoint paths"

> "the new method verb when a method changes"

It scans:

> "the full contents of every non-openspec file the agent wrote during the task"

and:

> "any single subject match classifies the close `on_topic`"

Matching is:

> "case-insensitive substring"

**VERDICT → Claim D is refuted.** This classifier cannot reliably distinguish task substitution from ordinary editing:

* On an entity rename, the **old entity name** naturally remains throughout existing code. A whole-file write to a central router, schema, fixture, or server file can match the old name even when the actual change concerns a predecessor's task.
* On a method flip, the subject set contains `PUT` or `PATCH`. Either token is likely to appear in unrelated route tables, tests, comments, request helpers, or existing handlers.
* Common field names such as `id`, `name`, `status`, or `type` create even broader substring matches.
* Endpoint collection segments may appear in unrelated fixtures or generic tests.

This does not merely lower recall. Because OFF-TOPIC trumps the truthful/false split, a swapped close misclassified as ON-topic is reinterpreted as an attempted current-task close. It can become a `false_close`, or even a `truthful_close` if the current-task oracle happens to remain green. That directly misleads the P1.1 disposition table about the failure family it was added to measure.

The declared polarity is therefore wrong for a mutually exclusive scoring category. A classifier this permissive needs at least an `indeterminate` category rather than converting weak lexical evidence into ON-topic.

**LABEL → REFUTES-A-CLAIM**

---

### 3. High — Two retained request variants are false in one flip direction and contradict the newly disclosed PATCH contract in both directions

**CLAIM ATTACKED → Claim A**

**EVIDENCE →**

Two of three request variants still say:

> "Updating a `${entity}` should follow the newer partial-update convention the API now uses."

and:

> "One of our update endpoints needs to follow the newer partial-update convention."

The operation can flip:

> "commonly PUT→PATCH, sometimes PATCH→PUT"

while the README now states:

> "there are no partial updates in this API"

and:

> "This applies to `PUT` and `PATCH` alike"

**VERDICT → Claim A is refuted.**

For a **PATCH→PUT** task, saying that the endpoint should follow a "partial-update convention" points in the opposite direction even under the most charitable interpretation that "partial-update convention" means "use PATCH."

For either direction, the ordinary engineering meaning of "partial-update convention" concerns request semantics, exactly the semantics that the README now says do not exist. The README provides a channel through which an attentive agent may detect the contradiction; it does not make the request statement true.

The authors correctly removed one false "match the rest of the API" variant but left two directionally and semantically false variants as "measurement material." That is not residual ambiguity. It is contradictory task input.

**LABEL → REFUTES-A-CLAIM**

---

### 4. High — Maintenance-task substitutions are explicitly excluded from the off-topic category, contradicting the park design's claimed protection

**CLAIM ATTACKED → Claims C and D**

**EVIDENCE →**

D1 promises:

> "absorbing a leftover as one's task change remains possible and now lands in the off-topic close category"

But E7 says:

> "an empty delta (maintenance task) → `not_applicable`"

The workflow also says that on a no-behavior-change task the agent:

> "may instead leave `openspec/` untouched"

The word "instead" leaves the ordinary change-authoring route available, and the attack brief explicitly confirms that a full change-authoring close on a maintenance task is legal.

**VERDICT → Claims C and D are refuted.**

A maintenance task is exactly where absorbing a predecessor's unfinished behavioral change can most easily masquerade as useful work. Yet every such task is unconditionally `not_applicable`, regardless of what was authored or implemented.

Therefore the design note's statement that leftover absorption "now lands in the off-topic close category" is false for maintenance tasks. P1.1 cannot distinguish:

* a legitimate byte-preserving maintenance close;
* a maintenance close that unnecessarily modifies behavior; and
* a full substitution that completes a predecessor's task.

Maintenance tasks need subject derivation from the maintenance request, a separate `unexpected_behavioral_work` classification, or at minimum an off-topic assessment based on whether a behavioral change was authored.

**LABEL → REFUTES-A-CLAIM**

---

### 5. High — Parking can be combined with the one-token classifier to launder a substituted close

**CLAIM ATTACKED → Claims C and D**

**EVIDENCE →**

Parking status is determined from:

> "`PARKED.md` present in the CURRENT tree"

Parked directories are:

> "never bound, never merged, never archived"

The off-topic classifier scans only:

> "the accepted change's delta-spec files"

and treats:

> "any single subject match"
> as ON-topic.

**VERDICT → Claims C and D are refuted by a concrete construction.**

An agent can:

1. Put the actual current-task work—or an abandoned attempt at it—in directory `T`.
2. Add `T/PARKED.md`.
3. Use the sole active directory `L` to complete or absorb a predecessor's task.
4. Include one current-task subject string somewhere in `L`'s delta specification: an entity name, old path, common field name, or method verb.
5. Pass custody with exactly one active directory.

The parked directory is excluded from binding and from the accepted-change haystack. The active substituted directory receives an ON-topic classification from one lexical match. In the product arm it can also satisfy the executable gate if the predecessor's missing behavior supplies the required red-to-green scenario.

The hidden oracle may still make this a false close, but the specific category intended to detect task substitution has been bypassed. That is precisely laundering an off-topic close.

**LABEL → REFUTES-A-CLAIM**

---

### 6. High — The budget carry-over rationale is contradicted by the stated purpose and historical impact of glue feedback

**CLAIM ATTACKED → Claim F**

**EVIDENCE →**

The sealed budgets note says:

> "no budget-relevant surface moved"

But the glue detector was introduced because the silent parser case:

> "cost ≈85 wasted turns and caused all 3 stalls"

The repair adds feedback designed to prevent exactly those wasted turns and stalls.

**VERDICT → Claim F is refuted.**

Turn-budget efficiency is a budget-relevant surface. A feedback change that recovers turns and prevents budget-ending stalls changes the effective computation available to an agent even when the nominal caps remain 27 turns, 12 verifications, 490k tokens, and $5.

Keeping the numerical limits may still be a defensible calibration choice. The stated justification is not defensible. The correct statement would be that nominal budgets were intentionally retained despite a material change in effective budget, and that the first probes must measure resulting headroom, stalls, verification usage, and termination causes before historical or cross-boundary comparisons are made.

**LABEL → REFUTES-A-CLAIM**

---

### 7. Medium-high — The ambiguity inventory's claimed mapping to the five historical convention families is factually wrong

**CLAIM ATTACKED → Claim A**

**EVIDENCE →**

D2 says:

> "rows 1–5 are the five convention families the E4 audits surfaced one at a time"

and names those families as:

> "pluralization → fixture regeneration → PATCH → id-stability → required-ness/backfill"

But rows 1–5 actually are:

1. stored-id policy on renames;
2. initial data for new entities;
3. backfill for added fields;
4. stored-value conversion on retype;
5. positional linking for new relationships.

**VERDICT → Claim A is refuted at the acceptance-document level.**

The mapping is not one-to-one:

* pluralization is absent from rows 1–5;
* PATCH is absent by explicit design;
* retype conversion and positional relationship linking are introduced instead;
* "fixture regeneration" is split across several different migration policies.

This does not by itself prove that the operational inventory omits an unresolved fact. It does prove that its traceability claim is false, which matters because the document uses that claimed lineage as evidence that the historical trap families have been converted into fair, brief-answerable knobs.

A corrected traceability table should identify, for every historical family, whether it is now:

* unconditionally disclosed;
* request-determined;
* PM-brief-answerable;
* structurally eliminated; or
* still residual ambiguity.

**LABEL → REFUTES-A-CLAIM**

---

### 8. Medium — "Every seed" and downstream equivalence are not established by the supplied census

**CLAIM ATTACKED → Claim B**

**EVIDENCE →**

The universal argument is:

> "same-length variant array"
> therefore
> "every seed's draw … [is] byte-identical"

The test covers:

> "25 seeds × 3 interleaved rounds"

The output also changes:

> `pool_id: "modify-endpoint-v2"`

rather than the v1 pool id.

**VERDICT → Claim B needs-data.**

A finite 25-seed census cannot establish a universal statement about every possible seed. The same-length argument is sufficient only if `prng.pick` is demonstrably a pure function of:

* the current PRNG state; and
* the array length,

with no content-sensitive rejection, lazy evaluation, callback behavior, or extra draws.

The package also does not supply the complete consumer graph for `pool_id`. Although Claim B is phrased in terms of rendered text and draw position, a pool-id change on every `modify_endpoint` task can affect records, stratification, determinacy lookup, caching, or reporting without changing text.

Required adjudication data:

1. the exact `prng.pick` implementation;
2. a proof or exhaustive state-space property test for equal state advancement at equal lengths;
3. every downstream consumer of `pool_id` and the render-result object;
4. tests with the full range of render contexts, not only the fixed `Widget` context.

**LABEL → DESIGN-INPUT-FOR-PROBES**

---

### 9. Medium — "Parked changes are never validated" is not established by the described `openspec validate` and archive flow

**CLAIM ATTACKED → Claim A; potentially Claim C**

**EVIDENCE →**

The README says parked directories are:

> "never validated, merged, or archived"

But the sealed exit protocol still requires:

> "`openspec validate` passing"

and task close still invokes:

> "`openspec archive`"

The supplied mechanics describe gate partitioning and binding exclusions but do not reproduce the exact validation or archive enumeration command.

**VERDICT → Needs-data.**

If `openspec validate` or `openspec archive` scans the entire `openspec/changes/` tree, a syntactically malformed parked directory can still poison later tasks despite being excluded from custody. A test showing that a well-formed parked directory is not archived does not establish that malformed or incomplete parked contents are never parsed or validated.

Required adjudication data:

* the exact `openspec validate` invocation and scope;
* the exact archive target selection;
* a facet containing a deliberately invalid parked delta next to a valid active change;
* a subsequent-task test proving that accumulated parked garbage cannot block validation or archive.

**LABEL → DESIGN-INPUT-FOR-PROBES**

---

### 10. Medium — Root-cause clustering can invert the apparent arm ordering, even though the raw publication prevents literal concealment

**CLAIM ATTACKED → Claim E**

**EVIDENCE →**

Clustering counts:

> "number of clusters among that record's discrepancies"

All discrepancies in an entity family may collapse to one root.

A concrete comparison:

* Arm X makes eight independent mistakes concerning one entity: raw burden 8, clustered burden 1.
* Arm Y makes two mistakes concerning two entities: raw burden 2, clustered burden 2.

The clustered comparison says Y is worse; the raw comparison says X is four times worse.

**VERDICT → Claim E survives narrowly.**

Because the report prints raw and clustered series side by side, the difference is not literally hidden in the program's stated artifact. The clustered readout can nevertheless invert the comparison and is not a defensible estimate of causal root count without stronger attribution.

For probes, raw burden must remain primary. The clustered series should be named something like **family-collapsed burden**, and interpretations must not say "one root cause" merely because several discrepancies share an entity or path family.

**LABEL → DESIGN-INPUT-FOR-PROBES**

---

### 11. Medium — Shared park mechanics do not imply equal treatment exposure; parking can become a post-treatment mediator

**CLAIM ATTACKED → Claim C**

**EVIDENCE →**

The product arm has extra refusal surfaces:

> executable red requirement at spec exit;

> full-scenario green requirement at implementation close;

while both arms receive identical parking mechanics.

The manifest now records:

> an additive `parks` count.

**VERDICT → This does not itself refute Claim C, but it is required probe design input.**

The product arm can generate more unfinished directories precisely because its gate refuses more phase exits and done claims. The next task then incurs more parking actions, name changes, copying, and attention loss. Parking is therefore not merely shared infrastructure; its usage can be a downstream mediator of the treatment.

P1 reports should publish by arm:

* number of pre-existing leftovers encountered;
* directories parked;
* turns and writes spent parking or copying forward;
* whether a park followed a product-only refusal;
* subsequent close and stall rates conditional on encountering a leftover.

Otherwise a later arm difference may be attributed to executable specifications when it was partly mediated by accumulated workflow debris.

**LABEL → DESIGN-INPUT-FOR-PROBES**

---

### 12. Medium-low — Validator-optional scorer ids leave future evidence integrity dependent on mutable census policy

**CLAIM ATTACKED → Claim F**

**EVIDENCE →**

The three new ids are:

> "OPTIONAL at the type/validator level"

The protection described for the live boundary is:

> "the census asserts the LIVE file carries them"

**VERDICT → Needs-data; Claim F is already independently refuted by Finding 6.**

The compatibility validator permits a constants file that omits the identifiers. The current census prevents omission in the current live file, but the package does not establish that every future evidence run must:

1. run that census;
2. use the live constants file rather than another validator-accepted file; and
3. reject a new boundary that changes or removes the census assertion.

Historical compatibility is a legitimate reason to accept old files. A safer schema would conditionally require the ids for constants version `v0.6` and later while allowing omission only for explicitly historical versions or hashes.

Required adjudication data:

* evidence-run constants loading and hash checks;
* mandatory CI/gate commands;
* whether version-aware validation exists outside the excerpt;
* whether reports fail closed when a scorer id is missing.

**LABEL → DESIGN-INPUT-FOR-PROBES**

---

## Claim-by-claim verdicts

### Claim A — Disclosure fixes contain no overreach or new false disclosure

**REFUTED.**

Independent refutations:

* the sealed write-scope rule contradicts the new park workflow;
* the two retained "partial-update convention" variants are false for PATCH→PUT and contradict the unconditional full-replace disclosure;
* the ambiguity inventory makes a false traceability claim about rows 1–5.

Additional gold-wide assertions—especially "parked directories are never validated"—still need the exact validation/archive scope before they can be accepted universally.

### Claim B — Every seed's draw and all other rendered text remain byte-identical

**NEEDS-DATA.**

The architecture described is plausible, but a finite census is not proof of every seed. The `prng.pick` implementation and downstream `pool_id` consumers are required.

### Claim C — Parking cannot hide work or launder an off-topic close

**REFUTED.**

A parked directory can hold one line of work while the sole active directory performs a substituted task and includes one current-subject token. Maintenance substitutions are also classified `not_applicable`, directly contradicting the design note's promised off-topic handling.

### Claim D — The conservative off-topic polarity and subject derivation are sound

**REFUTED.**

Any-single-substring matching over full-file writes creates systematic false ON-topic results, especially for renames, common fields, and method flips. Delta-spec text also provides a trivial laundering surface. An `indeterminate` category or structural semantic matching is necessary.

### Claim E — Clustering cannot hide a difference visible in raw burden

**SURVIVES, narrowly.**

The clustered series can erase or invert a real comparison, but side-by-side publication means the raw result remains present in the declared artifact. This survives only if raw burden is primary and the clustered series is not presented as causal root count.

### Claim F — Hygiene and versioning are complete

**REFUTED.**

The statement that "no budget-relevant surface moved" is incompatible with a repair expressly designed to recover approximately 85 wasted turns and prevent all observed stalls. The optional-id design also needs stronger evidence-run enforcement, though that issue alone remains needs-data.

## Gate recommendation

**NO-GO for P1.**

Minimum blocking repairs:

1. Reconcile the sealed write-scope bullet with multi-directory parking.
2. Remove or truthfully rewrite both "partial-update convention" task variants.
3. Redesign off-topic scoring with an indeterminate class and stronger evidence than one substring.
4. Classify behavioral work performed during maintenance tasks.
5. Close the park-plus-keyword laundering path or explicitly measure it as a separate disposition.
6. Correct the budget note and pre-register effective-budget diagnostics for the first probe.

---

## DeepSeek

**Finding 1 — REFUTES-A-CLAIM (Claim A)**
**Undisclosed server‑generated `id` convention (fifth family)**
The PM brief template for an added entity lists all fields, e.g. `id (string, required)`, but never states that the `id` is server‑generated and **must be omitted from the request body**. The ambiguity inventory (D2) contains no row about id‑generation semantics. The README, workflow protocol, and all other agent‑facing text are silent. An agent that follows the literal field list will include `id` in a POST, causing a validation error or silent discard, and drift against the hidden oracle. This is a genuine undisclosed convention that the P0‑V repair did not convert into a brief‑answerable knob, directly violating the claim that "every remaining knob is answerable through the brief channel" and that the disclosure fixes leave no hidden trap.

**Evidence**
> `New entity ${name} with exactly these fields: ${fields}.` … each field renders `${name} (${type}, required|optional)` (E3)
> Inventory (D2) rows 1–12 – no mention of id‑generation or POST‑body exclusion.
> No statement in README or protocol says the server assigns ids.

**Label** REFUTES-A-CLAIM (Claim A)

---

**Finding 2 — REFUTES-A-CLAIM (Claim A)**
**Analytics endpoint shape is not brief‑answerable**
The inventory claims row 11 (*Analytics endpoint shape*) is answered by the brief line `New endpoint ${METHOD} ${path}: returns summary counts over ${entity} records.` But that line gives no response schema – no field names, types, or structure. An agent cannot write a correct scenario or implementation without guessing the exact shape, so the "knob" remains a hidden convention. This contradicts the assertion that every inventory row is genuinely brief‑answerable and that no residual traps remain.

**Evidence**
> D2 row 11: "Brief line that answers it: … returns summary counts …"
> Actual template (E3): `New endpoint ${METHOD} ${path}: returns summary counts over ${entity} records.` – contains no schema details.
> Gold presumably returns a specific JSON object; no other agent text discloses it.

**Label** REFUTES-A-CLAIM (Claim A)

---

**Finding 3 — DESIGN-INPUT-FOR-PROBES**
**Off‑topic classifier substring matching yields false on‑topic for short/common strings**
The subject derivation (E7) uses case‑insensitive substring matching on entity names, field names, and **quoted JSON keys from convention statements**. Short entity names (e.g., `"Item"`) can appear incidentally in unrelated delta‑spec headings, and common convention keys (e.g., `"code"`, `"message"`) can match ordinary error‑handling code. This means a close that addresses a completely different task may still be classified `on_topic` simply because a substring happens to appear, degrading the off‑topic column's ability to flag swaps. Probe P1.1, which leans on the disposition table, must account for this unintended porosity.

**Evidence**
> Subject derivation: "any single subject match classifies the close on_topic … matching is case‑insensitive substring" (E7).
> Convention statement subjects include "quoted JSON key names" – e.g., from an error‑envelope statement, keys like `"code"` will match thousands of lines in generated server code.

**Label** DESIGN-INPUT-FOR-PROBES

---

### Verdicts per claim

- **Claim A** — **refuted** (undisclosed id‑generation and analytics‑shape conventions show the repair still leaves hidden gold‑behavior families; the inventory is not fully brief‑answerable).
- **Claim B** — **survives** (no evidence found that the PRNG‑consumption or byte‑identity claims are broken).
- **Claim C** — **survives** (the park primitive does not enable hiding work or laundering a close beyond what is already possible; the marker‑only carve‑out is well‑bounded).
- **Claim D** — **survives** (the classifier's conservative bias is a design choice, but the substring‑matching weakness must be accounted for in probe design – see Finding 3).
- **Claim E** — **survives** (raw and clustered series are always shown side‑by‑side; no hidden erasure of a cross‑arm difference is possible).
- **Claim F** — **survives** (hygiene measures are complete; no material gap found).

---

## Qwen

### Finding 1
CLAIM ATTACKED → Claim D
EVIDENCE → "the haystack includes the agent-authored delta-spec files... Matching is case-insensitive substring; any single subject match classifies the close on_topic" and "FILE writes are whole-file, and the code haystack takes full contents. On a rename task the subjects include the OLD entity name, which pervades existing code"
VERDICT → refuted
LABEL → REFUTES-A-CLAIM
*Analysis:* The narration exclusion (`proposal.md`/`tasks.md` out) fails to prevent laundering because delta-spec text is also agent-authored prose; an agent can trivially game the classifier by adding a dummy `### Requirement: <TaskEntity> endpoints` heading in their delta spec while writing scenarios for the leftover task. Furthermore, on rename tasks, the OLD entity name is a subject and pervades existing code; any whole-file code write containing the old name triggers a match, making the code channel permanently blind to off-topic closes on renames. The conservative bias is too conservative, rendering the metric useless for these op-kinds.

### Finding 2
CLAIM ATTACKED → Claim E
EVIDENCE → "concrete stale-claim ids (endpoint:<METHOD> /<segment>/...) map to the first path segment (family:<segment>)."
VERDICT → refuted
LABEL → REFUTES-A-CLAIM
*Analysis:* Stale-claim item_ids derive from the agent's OWN authored scenario paths. If an arm makes typographical errors in their scenario paths (e.g., `/widgetss` instead of `/widgets`), those stale claims map to a different family (`family:widgetss`) than the correct path (`family:widgets`). This artificially inflates the clustered burden for the sloppy arm, creating a fake cross-arm difference in root-cause burden based purely on scenario authoring style, not actual divergence. Clustering here *creates* a misleading cross-arm difference rather than just hiding one.

### Finding 3
CLAIM ATTACKED → Claim A
EVIDENCE → D2 Row 11: "Analytics endpoint shape | GET /<collection>/stats returning summary counts | 'New endpoint GET /… returns summary counts …'" and the claim that "Each is answerable through the brief channel".
VERDICT → refuted
LABEL → REFUTES-A-CLAIM
*Analysis:* The brief line does not specify the JSON shape (e.g., `{"count": N}` vs `{"total": N}`) of the analytics response. Since this is a new endpoint, the agent has no prior response to inspect and must guess the exact JSON key to write a passing `THEN the response body equals <json-literal>` scenario. This is a hidden convention not answerable via the brief, violating the inventory's own boundary condition that every row must be brief-answerable.

### Finding 4
CLAIM ATTACKED → Claim C
EVIDENCE → "budgets unchanged (27 turns / 12 verifications / 490k tokens / $5 per task-sequence)" and "Writing the marker is an ordinary spec-phase FILE write."
VERDICT → survives
LABEL → DESIGN-INPUT-FOR-PROBES
*Analysis:* The park mechanics are sound and the trap is not reopened. However, parking a leftover requires a FILE write (1 turn). If an arm frequently faces leftovers (e.g., due to prior stalls), it must spend turns parking them. This un-budgeted turn tax could differentially disadvantage the arm that encounters more leftovers, potentially causing budget exhaustion in P1.x probes. Probes must account for this parity risk.

### Finding 5
CLAIM ATTACKED → Claim B
EVIDENCE → "returns { text, pool_id: "modify-endpoint-v2", names_item_verbatim }" vs v1's "modify-endpoint-v1".
VERDICT → survives
LABEL → DESIGN-INPUT-FOR-PROBES
*Analysis:* The strict claim of "rendered text" and "seed draw" byte-identity survives. However, the returned task object's `pool_id` field diverges. If downstream probe calibration or the task manifest records `pool_id`, the task records will not be byte-identical. Probes must account for this if they filter or group by pool lineage.

### Finding 6
CLAIM ATTACKED → Claim F
EVIDENCE → "the README exists both rendered from workspace.ts and sealed as workspace_readme in the constants JSON — the authors verified byte-equality at this commit"
VERDICT → survives
LABEL → DESIGN-INPUT-FOR-PROBES
*Analysis:* Hygiene is complete for THIS commit. However, the evidence pack does not mention a standing test to keep `workspace.ts` and the constants JSON in sync for future edits. A future edit could desync them, breaking the "byte-identical" guarantee for subsequent boundaries. Probes relying on this guarantee must ensure a standing sync test exists.

---

### Summary Verdicts

- **Claim A:** refuted
- **Claim B:** survives
- **Claim C:** survives
- **Claim D:** refuted
- **Claim E:** refuted
- **Claim F:** survives

---

## Kimi

**Finding 1 — CRITICAL**

**CLAIM A ATTACKED** → The retained `modify_endpoint` phrasing variants are false disclosures, not vagueness.

**EVIDENCE:** The v2 pool retains variants 0 and 2 verbatim from v1:

> `Updating a ${ctx.entity} should follow the newer partial-update convention the API now uses.`

> `One of our update endpoints needs to follow the newer partial-update convention.`

(`src/e4/substrate/v2/render.ts:26-38`, E4)

The README's new `## Update semantics` states:

> `there are no partial updates in this API. This applies to PUT and PATCH alike — there are no partial updates in this API.`

(E1)

The inventory defends these as "measurement-material vagueness, not falsity" because the README resolves it (D2).

**VERDICT:** **refuted** — The task request is an agent-facing channel that directly promises partial-update semantics. Gold implements full-replace. A reasonable engineer reading "follow the newer partial-update convention" will implement partial updates. This is exactly the false-disclosure shape of the old brief PATCH line that was retracted. The README's correction in a separate document does not make the task request true; it makes the agent-facing text internally contradictory. The repair claims to fix false disclosures but leaves the same false promise in the task-request channel.

---

**Finding 2 — CRITICAL**

**CLAIM D ATTACKED** → The off-topic classifier's haystack boundary is trivially circumvented by keyword-stuffing agent-authored delta-spec prose.

**EVIDENCE:** The classifier scans `openspec/changes/<name>/specs/**` and "any single subject match classifies the close on_topic" (E7). The delta-spec format requires agent-authored prose in `### Requirement:` headings and scenario steps (E1). The narration exclusion deliberately excludes `proposal.md`/`tasks.md` because "mentioning the task in prose while changing something else is exactly the failure mode being scored" (E7).

**VERDICT:** **refuted** — The delta-spec files are equally agent-authored prose. An agent can mention the current task's entity name in a `### Requirement:` heading while the scenario body implements a leftover task. The classifier will mark this on-topic. The exclusion boundary is wrong: `specs/**` is not more trustworthy than `proposal.md` for this attack. The off-topic category will undercount flagrant swaps, poisoning the P1.1 readout.

---

**Finding 3 — HIGH**

**CLAIM A ATTACKED** → The README's retirement instruction creates a new undisclosed convention family around retired-path semantics.

**EVIDENCE:** The README states:

> "a retirement delta under the OLD capability needs BOTH blocks… whose scenario asserts the old collection path now returns status 404"

(E1)

The tombstone requirement says:

> "the service SHALL NOT serve the retired paths"

(E1)

The document never states what gold returns on retired item paths (e.g., `GET /old-items/{id}`), nor whether the 404 uses the standard error envelope.

**VERDICT:** **refuted** — If gold returns 404 for all retired paths, the README under-specifies (agents don't know to assert 404 for item paths). If gold returns a different status or envelope for item paths, the README's instruction to assert only collection-path 404 is misleading. Either way, the README pins either more or less than gold does, creating a new convention family (retired-path status codes) that no agent-visible channel fully resolves. This is the fifth family.

---

**Finding 4 — HIGH**

**CLAIM D ATTACKED** → The full-file code haystack renders rename tasks structurally blind to off-topic detection.

**EVIDENCE:** On a rename task, subjects include "the names of the entities the task touches (old and new forms for renames, in both singular and plural collection form)" (E7). The code haystack is "the full contents of every non-openspec file the agent wrote during the task" (E7). Any code write of a central file will contain the old entity name pervasively.

**VERDICT:** **refuted** — For rename tasks, the code channel is guaranteed to match because the old name pervades the codebase. The delta-spec channel is the only remaining discriminator, and Finding 2 shows it is trivially gamed. The classifier cannot reliably detect off-topic closes for renames, which were a primary E4 failure mode.

---

**Finding 5 — MEDIUM**

**CLAIM E ATTACKED** → Root-cause clustering systematically inverts cross-arm comparisons when mistakes are concentrated vs. dispersed, and the side-by-side publication rule does not prevent a reader from being misled by the clustered headline.

**EVIDENCE:** Clustered burden counts families, not symptoms: "Clustered burden at a checkpoint = number of clusters among that record's discrepancies" (E8). The publication rule prints both raw and clustered series, but the clustered line is simpler and headline-friendly.

**VERDICT:** **refuted** — Two arms with raw burden 10 and 5 can both show clustered burden 1 if the 10-symptom arm's mistakes all fall under one entity family. A reader comparing clustered AUCs would see equality where raw AUCs show a real difference. The side-by-side publication rule does not prevent this misreading; it merely makes it negligent rather than impossible. The claim that clustering "can't HIDE a real cross-arm difference" is false because the clustered headline can erase real differences.

---

**Finding 6 — MEDIUM**

**CLAIM C → DESIGN-INPUT-FOR-PROBES** → The park primitive's interplay with the off-topic classifier allows a laundering path: park the leftover, then keyword-stuff the new change.

**EVIDENCE:** Parking makes leftover handling lawful and visible (D1). The off-topic classifier is meant to catch absorbs that remain possible (D1). But Finding 2 shows the classifier is trivially defeated by keyword-stuffing delta-spec prose.

**VERDICT:** **DESIGN-INPUT-FOR-PROBES** — An agent can park a leftover (satisfying custody), create a new active change that mentions the current task's subjects in its delta-spec headings while actually implementing the leftover, and receive an on-topic classification. The park primitive doesn't create this vulnerability, but it doesn't close it either. Probe P1.1 must account for the fact that parking + keyword-stuffing defeats both custody friction and off-topic detection.

---

**Finding 7 — MEDIUM**

**CLAIM B → needs-data** → `pool_id` change may affect downstream records even though rendered text is identical.

**EVIDENCE:** The v2 renderer returns `pool_id: "modify-endpoint-v2"` (E4). The determinacy table moved to `e4-request-determinacy-v2` because "the pool no longer uniformly states the form" (E4).

**VERDICT:** **needs-data** — The document does not specify whether `pool_id` or determinacy tags feed into manifests, meters, or probe logic. If they do, recorded fields differ across the substrate boundary even when rendered text does not. I would need to see the manifest schema and meter integration to confirm.

---

**Finding 8 — LOW**

**CLAIM F → DESIGN-INPUT-FOR-PROBES** → No standing test verifies rendered README against sealed constants across runtime dependency changes.

**EVIDENCE:** The README is rendered from `workspace.ts` and sealed as `workspace_readme` in the constants JSON (E10). The twin test pins `workspace.ts`'s sha256, but a runtime dependency change could alter the rendered text without changing the module source.

**VERDICT:** **DESIGN-INPUT-FOR-PROBES** — The document states the authors "verified byte-equality at this commit" but does not describe an automated render-and-compare test. Without such a standing guard, future dependency drift could break the agent-facing text invariant silently.

---

## Explicit Verdicts

- **Claim A — refuted.** The "partial-update convention" task-request variants are false disclosures (Finding 1). The retirement instruction creates a new undisclosed convention family (Finding 3).
- **Claim B — survives.** The census test and same-length PRNG argument are mechanistically sound. The `pool_id` downstream effect is flagged as needs-data (Finding 7).
- **Claim C — survives.** The park primitive is not gameable into hiding archived work or laundering off-topic closes in a way that survives the gate mechanics. The interplay with the off-topic classifier is a probe design input, not a refutation of the primitive itself (Finding 6).
- **Claim D — refuted.** The classifier is trivially gamed by keyword-stuffing delta-spec prose (Finding 2) and structurally blind on rename tasks (Finding 4).
- **Claim E — refuted.** Clustered burden can erase real cross-arm differences even when both series are published (Finding 5).
- **Claim F — survives.** The versioning story is substantiated by the evidence pack. The missing standing test for README render consistency is a future hygiene gap, not a refutation of the current boundary's completeness (Finding 8).

---

## GLM

Here is the adversarial review of the E5 P0-V rig repair. Findings are ranked by severity, most severe first.

### 1. The off-topic classifier is trivially circumventable via delta-spec text and blind on rename tasks via the code channel
**CLAIM ATTACKED:** Claim D — the off-topic classifier's conservative bias is the right polarity for a scoring category, and the subject derivation can't be gamed by keyword-stuffing a delta spec.
**EVIDENCE:**
- E7: "the haystack includes the accepted change's delta-spec files (`openspec/changes/<name>/specs/**` only — `proposal.md`/`tasks.md` narration is deliberately excluded, because mentioning the task in prose while changing something else is exactly the failure mode being scored)"
- E7: "the full contents of every non-openspec file the agent wrote during the task (remember: FILE writes are whole-file). ... On a rename task the subjects include the OLD entity name, which pervades existing code"
**VERDICT:** REFUTES-A-CLAIM (Claim D)
The claim that the subject derivation "can't be gamed by keyword-stuffing a delta spec" is refuted on two fronts. First, delta-spec text is agent-authored prose; a swapped close that naturally restates the task subject in a delta-spec heading, requirement title, or file path will be classified as `on_topic`, trivially circumventing the `proposal.md`/`tasks.md` narration exclusion. Second, on rename tasks, the "full-file blindness" of the code haystack means ANY code write will inherently contain the old or new entity name (since the agent must rewrite central files containing the old name). This renders the code channel completely blind to off-topic closes on rename tasks, guaranteeing false `on_topic` classifications. The classifier cannot reliably catch flagrant swaps under these rules.

### 2. The "partial-update convention" task phrasing contradicts the new README disclosure
**CLAIM ATTACKED:** Claim A — the disclosure fixes state only what gold actually does: no overreach, no new false disclosure.
**EVIDENCE:**
- E1 README: "This applies to `PUT` and `PATCH` alike — there are no partial updates in this API."
- E4 Task-request phrasing pool variant 0 and 2: "Updating a ${entity} should follow the newer partial-update convention the API now uses."
**VERDICT:** REFUTES-A-CLAIM (Claim A)
The document claims the retained task phrasing is "business vagueness... measurement material." However, the new README disclosure unconditionally states "there are no partial updates in this API." A task request stating the API "now uses" a "partial-update convention" is therefore a false statement, not mere business vagueness. The addition of the README disclosure creates a direct, unresolved contradiction in the agent's workspace, constituting a newly exposed false disclosure.

### 3. `pool_id` change alters downstream determinacy records
**CLAIM ATTACKED:** Claim B — the corrected phrasing and the v2-owned pool leave every seed's draw and all other rendered text byte-identical.
**EVIDENCE:**
- E4: "returns `{ text, pool_id: "modify-endpoint-v2", names_item_verbatim }`"
- E4: "the determinacy table ... moved to id `e4-request-determinacy-v2` with two honest updates ... `modify_endpoint.endpoint_method_form` moved determined → underdetermined"
**VERDICT:** DESIGN-INPUT-FOR-PROBES
The claim that *rendered text* is byte-identical survives. However, the change in `pool_id` feeds the determinacy tagger, which now marks `modify_endpoint.endpoint_method_form` as underdetermined. This changes the determinacy records for those tasks. Probes relying on historical determinacy tagging or expecting identical recorded fields (beyond just text) must account for this shift.

### 4. Clustering erases independent mistakes within the same family
**CLAIM ATTACKED:** Claim E — root-cause clustering can't HIDE a real cross-arm difference that raw burden shows.
**EVIDENCE:**
- E8: "independent mistakes within one family (a wrong field type AND an unrelated stale endpoint claim on the same entity collapse to one cluster — does that systematically favor the arm that makes many mistakes in few families?)"
**VERDICT:** DESIGN-INPUT-FOR-PROBES
The claim survives because the raw series is published alongside the clustered series, meaning the raw difference is technically visible. However, the clustered metric systematically erases independent mistakes within the same family. A reader who overweights the "root-cause-clustered" metric as the truer burden measure could be easily misled into thinking two arms are equivalent (e.g., 1 cluster vs 1 cluster) when one arm made multiple independent errors (e.g., 3 raw symptoms vs 1 raw symptom).

### 5. No evidence of a standing test for README byte-equality
**CLAIM ATTACKED:** Claim F — hygiene completeness.
**EVIDENCE:**
- E10: "the README rendered into agent workspaces and the copy sealed in the constants file were also verified byte-identical to each other"
**VERDICT:** DESIGN-INPUT-FOR-PROBES
While byte-equality was verified at this commit, the evidence pack does not mention a standing census test that asserts byte-equality between the rendered README and the `workspace_readme` string in the constants JSON. Without a standing test, a future edit to `workspace.ts` could update the module's sha256 twin pin but leave the `workspace_readme` string stale, silently breaking the seal.

---

### Summary of Verdicts for Claims A–F

- **Claim A:** **refuted** (Finding 2)
- **Claim B:** **survives** (Finding 3 is design-input only; text is byte-identical)
- **Claim C:** **survives** (Parking a leftover requires opening a new change, which does not dodge custody friction or the off-topic category; it simply prevents the absorb.)
- **Claim D:** **refuted** (Finding 1)
- **Claim E:** **survives** (Finding 4 is design-input only; raw data is published, so the difference is not hidden.)
- **Claim F:** **survives** (Finding 5 is design-input only; hygiene is complete for this boundary.)

---

## Claude

# Adversarial review — E5 P0-V rig repair (commit `784e0ff`)

Working assumption honored: I went hunting for the fifth family, and I believe I found it — it lives in the gap between "the brief has a line for this fact kind" and "the brief line determines the fact." Findings ranked by severity; claim verdicts at the end.

---

## F1 — The fifth family: response-shape pinning. The inventory's "each answerable via the brief" is false for row 11, and the retirement instruction creates a second instance.

**CLAIM ATTACKED:** A (specifically D2's "Each is answerable through the brief channel; none is ever unconditionally disclosed" and §2 item 2's "12 PM-plausible knobs, each answerable via the brief").

**EVIDENCE:** The analytics brief template, in full: `New endpoint ${METHOD} ${path}: returns summary counts over ${entity} records.` Row 11's gold column: "`GET /<collection>/stats` returning summary counts." Now the scenario grammar: "Every scenario has at least one value-binding assertion (a field/body equality, a forbidden-field check, or a list-length check)."

**ARGUMENT:** The brief line determines method, path, and purpose — it does **not** determine the response's JSON shape: key names, whether counts are total-only or per-field, nesting. Yet the grammar **forces** the agent to pin a concrete field of that response (a value-binding assertion is mandatory; status-only scenarios are illegal). In the product arm the agent's own scenarios run against the agent's own implementation, so they go green on whatever shape the agent invented — and the hidden generated acceptance suite presumably pins gold's exact shape. If those diverge: gate-accepted done-claim + red hidden oracle = **a false-confidence event manufactured by the instrument**, exactly the metric P1.1 exists to read. This is structurally identical to the four E4 families: a fact the hidden answer key pins that no agent-visible channel discloses. The census guarantee ("the brief covers every underdetermined fact") passes because coverage is asserted **per fact kind**, not per informational sufficiency — the same meta-bug that let four families through E4 audits one at a time.

**Second instance, same family:** the README retirement instruction — "whose scenario asserts the old collection path now returns status 404" — describes a scenario that, standing alone, is illegal under the grammar's own value-binding rule. To make the tombstone legal, the agent must additionally pin a field/body of the 404 response. What a retired path returns as a *body* (standard envelope? empty? which keys?) is disclosed nowhere, is not in the inventory, and has no brief line. The README doesn't just leave this open; it **mandates authoring a pin** on it.

**VERDICT:** REFUTES-A-CLAIM (A). Needs-data rider (per §6): whether the generated acceptance suite asserts response bodies on analytics endpoints and on retired paths. If it asserts status only, the trap degrades from oracle-side false-confidence fabrication to meter-side noise (a spec-of-record pinning a body ground truth doesn't define) — damaged either way, but severity differs. State of gold's `/stats` shape and retired-path envelope is what I'd need.

**Label:** REFUTES-A-CLAIM.

---

## F2 — The off-topic classifier has approximately zero statistical power exactly where P1.1 needs it, and `not_applicable` excludes the most probable swap scenario by construction.

**CLAIM ATTACKED:** D.

**EVIDENCE:** "any single subject match classifies the close on_topic"; haystack (2) is "the full contents of every non-openspec file the agent wrote during the task (remember: FILE writes are whole-file)"; subjects include entity names "old and new forms," "the new method verb when a method changes," and "the quoted JSON key names of a new convention statement"; matching is "case-insensitive substring."

**ARGUMENT:** Quantifying the full-file blindness the package asked for, by op kind:

- **rename_entity / rename_field / remove_entity / remove_field / retype_field:** subjects include the *old* name, which pervades the pre-existing codebase. Any implementation-phase FILE write of any file that already contained that name — and FILE is whole-file, so rewriting a shared router/store/error module to do *anything* re-emits its entire contents — matches. On these tasks the code channel can **never** produce off_topic.
- **modify_endpoint:** subjects include the new method verb ("PATCH"/"PUT") and old/new paths. "patch"/"put" as case-insensitive substrings appear in essentially any HTTP server file. Blind.
- **change_convention:** subjects are the quoted JSON keys of the error envelope — which appear in the error-handling code of the *entire* server. Any write touching error code matches. Blind.
- **add_entity / add_field:** the only kinds with genuinely fresh subjects — except generator-drawn field names from common vocabulary. A field named "status" matches every file that mentions HTTP status; "name", "type", "date" match nearly anything. Substring matching on short common names produces false on_topic essentially for free.

So the archetypal swap — agent implements the leftover instead of the task — matches through the code channel on almost every op kind, with **no knowledge of the classifier required** (satisfying the package's own gaming condition). The delta-spec channel doesn't save it: a swapped close that restates the task subject in one heading is on_topic, and that is plausible unprompted behavior.

Then the coverage hole: "an empty delta (maintenance task) → not_applicable," while the package itself concedes "a full change-authoring close on a maintenance task is legal." Maintenance tasks are precisely where absorbing a leftover is most tempting (there is no legitimate work competing for the change slot) — and that scenario is unscorable **by construction**.

Net: the OFF-TOPIC column P1.1 leans on will read ≈0 not because swaps don't happen but because the detector can't see them; "off_topic TRUMPS truthful/false" will never fire; swap false-confidence lands back in the ordinary truthful/false split — the exact pre-repair state item 5 claims to fix. The polarity half of Claim D survives narrowly as a principle (I could not construct a realistic false off_topic that matters), but it's moot at zero power: "conservative" and "blind" are different properties and this is the latter.

**Design input for a fix that keeps the declared polarity:** derive subjects with word boundaries; subtract any subject string already present in the tree at task start from the *code* haystack (only novel occurrences count); classify delta specs by predominance rather than single match; and score maintenance closes that author a change against the *leftover's* subjects, inverted.

**VERDICT / Label:** REFUTES-A-CLAIM (D) on the coverage/gameability half; polarity half survives but is inert.

---

## F3 — Variant 0 is a third false disclosure by the authors' own published standard, and it now directly contradicts the new README section.

**CLAIM ATTACKED:** A (D2's "Everything below is *ambiguity, not falsity*. The two FALSE disclosures … were corrected at this boundary").

**EVIDENCE:** Retained variant 0: "Updating a ${ctx.entity} should follow the newer partial-update convention the API now uses." New README: "there are no partial updates in this API." The authors' own standard for condemning variant 1: it "points OPPOSITE to gold whenever the flipped endpoint diverges from the surrounding surface — which is exactly what the common first flip does."

**ARGUMENT:** Apply that standard to variant 0. It makes two present-tense factual assertions: (i) a partial-update convention exists in this API — false always, per the README the same commit ships; (ii) "the API **now uses**" it — false on the common first flip, when the rest of the surface is still PUT and full-replace, i.e. under **exactly the condition** that condemned "match the rest of the API." This is not business vagueness; "now uses" is indicative mood, a state-of-the-world claim. The defense in render.ts ("semantics stay full-replace either way") addresses only axis (i) and ignores axis (ii) entirely — the scope falsity is the same shape as the one corrected.

Furthermore, per your own ground rule ("if two quoted texts contradict each other, that contradiction is real and is a finding"): the workspace README and the task text now assert P and ¬P simultaneously in agent-visible surfaces of the same workspace, on 2 of 3 draws of `modify_endpoint`. Which surface takes precedence is itself an undisclosed knob not in the inventory. I accept that retaining variants 0/2 byte-identical is deliberate measurement material and that the README is the mitigating unconditional channel — that's a defensible *design*. What it refutes is the *claim*: D2 asserts exactly two false disclosures existed and both were corrected. A third one, condemnable by the same criterion, was retained, and the asymmetry (correct variant 1, keep variant 0) is not derivable from the published criterion — it's derivable from which correction was census-cheap.

**VERDICT / Label:** REFUTES-A-CLAIM (A).

---

## F4 — Root-cause clustering inverts real quality orderings, and the program's own interpretive doctrine directs the reader to the inverted number.

**CLAIM ATTACKED:** E.

**EVIDENCE:** "Clustered burden at a checkpoint = number of clusters"; the motivation ("cross-arm burden comparisons were dominated by how many items one mistake happens to touch"); the report line "burden/checkpoint raw [...] AUC x | root-cause-clustered [...] AUC y".

**ARGUMENT:** Constructive case, using only mechanics quoted in E8: Arm P makes **five independent mistakes on one entity** (wrong field type on `Widget.a`, dropped rule on `Widget.b`, stale endpoint claim on `/widgets/...`, etc.) — all map to `family:widgets`, union-merge irrelevant, **clustered = 1**. Arm Q makes **two independent mistakes on two entities** — **clustered = 2**. Raw says 5 vs 2 (P worse, correctly); clustered says 1 vs 2 (P *better*). Both lines print adjacently, yes — but the reader has been equipped with exactly one published interpretive rule: raw is symptom-amplified (the seed-36 "22.50 → 1.50" exhibit teaches precisely this), clustered reads root causes. When the two series disagree, that doctrine resolves the disagreement in clustered's favor, and the format prints no cluster composition, no per-family counts, nothing that would let the reader audit whether a cluster holds one root cause or five. So "the publication rule makes clustered-only misreading impossible" is literally true and vacuous: the failure mode isn't reading only clustered, it's *believing clustered's declared semantics*, which the side-by-side format actively reinforces. The clustering rule conflates **locality with causality** — valid for the rename-blast case that motivated it, invalid for independent co-located mistakes.

Two further mechanisms, as DESIGN-INPUT-FOR-PROBES:

- **Authoring-style confound, directional.** Stale-claim family keys derive from "the first path segment" of agent-authored scenario paths, and "unrecognized item_id forms fail closed into their own single-item family." The prose arm's scenarios are never executed, so path typos and singular/plural slips survive (`/widgt/`, `/widget/`) and mint spurious families — clustered ≈ raw for the sloppy arm, clustered ≪ raw for the disciplined arm. The disciplined arm is the product arm — the treatment arm. The metric built for fair cross-arm comparison carries a directional bias **toward the treatment**.
- **Rename-chain under-merge.** Union-merge on shared `semantic_item_uid` is transitive: if the generator ever renames an already-renamed entity within a sequence (A→B, later B→C), lineage chaining collapses two genuinely separate root causes into one cluster. Conditional on the generator producing chained renames — needs-data on that.

**VERDICT / Label:** REFUTES-A-CLAIM (E) on the constructive inversion; the two confounds as DESIGN-INPUT-FOR-PROBES.

---

## F5 — The carve-out boundary reopens a dead-end of the same genus as the trap it repairs, reachable via the most natural tidy behavior the design itself invites.

**CLAIM ATTACKED:** C.

**EVIDENCE:** "Markers written into pre-existing change directories … are additionally carved out of the task diff"; your §5C note "The carve-out exempts ONLY the marker paths from the diff"; facet test "edits inside a parked directory carry no change work (refused with string 2)"; product-arm gate: "The change must contain at least one new scenario, and at least one new scenario must FAIL now"; "Parking is one-way … no delete primitive."

**ARGUMENT:** Sequence — maintenance task, leftover present. With no delete primitive, the only tidy an agent can perform on the leftover's *contents* is blanking its files via whole-file FILE writes; a reasonable agent does that **and** writes `PARKED.md` (the README's "a short note on why is enough" says nothing against touching the other files). Now: post-carve-out diff ≠ ∅ (the blanking writes remain) → affirmation path refused permanently for this task (the no-behavior-change bullet's exemption covers markers only). Ordinary custody: every changed directory is parked → string 2 orders "Open a change for the current task." In the **product arm**, any new change must contain a scenario that fails *now* — on a task where, by definition, no behavior changes. The lawful closes are: invent a behavior change to make a scenario fail then pass (→ hidden oracle red / drift; the instrument fabricates a false-confidence or drift event), or burn the budget (→ `nonclose_by_termination`). In the prose arm: archive a vacuous change → permanent junk merged into the spec of record → burden. That's the E4 §5.3 trap's structure — a state with no clean lawful exit — recreated one door over, triggered by tidy behavior rather than by a predecessor's stall.

**Escape condition / needs-data:** if "changed-since-task-start" is content-based (not event-based) *and* the agent holds the original bytes in context, restoring them empties the diff. The evidence pack doesn't state the diff semantics; with event-based diffing there is no escape at all. I need the diff semantics to grade this from "dead-end" down to "expensive detour."

**Vectors that do NOT refute C, for balance:** parking one's own fresh change to "keep two directories' worth of work" gains nothing measurable — parked content never reaches the spec of record, and the meter scores the spec of record, so nothing is hidden from the meter; the affirmation path cannot close a non-maintenance task (the behavior-preserving label gates the branch); a predecessor parking the current task's natural change-name costs only a fresh name. Parking-as-laundering adds no power beyond the classifier weaknesses already covered in F2.

**VERDICT / Label:** REFUTES-A-CLAIM (C), conditional on diff semantics as stated.

---

## F6 — Claim B's census proves a renderer property; the claim is a pipeline property. The gap is unclosed in the evidence.

**CLAIM ATTACKED:** B.

**EVIDENCE:** The census drives "the v1 and v2 renderers … by identical fresh PRNGs"; the claim is "every seed's draw and all other rendered text byte-identical across the substrate boundary."

**ARGUMENT:** Feeding both renderers hand-instantiated identical PRNGs establishes that *given identical PRNG state*, outputs match. It cannot establish that PRNG state at the renderer is identical between v2.1 and v2.2 in production. Two specific threats the pack doesn't rule out: (i) `substrate_version` **did** change (`procedural-rest-v2.1` → `v2.2`) — if that string participates anywhere in seed derivation or stream hashing, every draw moves and the census stays green anyway, because the census bypasses seeding; (ii) `prng.pick`'s implementation isn't pinned in anything quoted — the twin set adds `render.ts` and `turns.ts` but no PRNG module is listed, so "same-length array ⇒ identical consumption" rests on an implementation property that isn't sealed against this boundary. On the downstream question: `pool_id` v1→v2 on `modify_endpoint` records means any mixed-lineage analysis grouping by pool_id splits the series at the boundary — expected, but P1 analysis code should be told.

**What I'd need:** whether the substrate version string enters seed/stream derivation; whether pick's consumption is f(length) only and whether the PRNG module is twin-pinned; whether any end-to-end test replays a v2.1 manifest against the v2.2 stack.

**VERDICT / Label:** needs-data; DESIGN-INPUT-FOR-PROBES (the structural argument is plausible; the evidence offered doesn't reach the claim).

---

## F7 — The dual README has no cited standing invariant tying its two sealed copies together, and items 5 and 7 are the only repairs with zero test evidence in the pack.

**CLAIM ATTACKED:** F.

**EVIDENCE:** "the README rendered into agent workspaces and the copy sealed in the constants file were also verified byte-identical to each other" — a point-in-time verification. D1's blast radius describes the maintenance procedure as two *separate* manual re-seals ("workspace.ts README paragraph — twin re-pin; v2 constants `protocol_text.workspace_readme` + `workflow_protocol` re-sealed"). E10 asserts "25 new facet tests … one per repair facet, quoted throughout §3."

**ARGUMENT:** Both copies are individually sealed (module twin; full-file JSON hash), but nothing quoted asserts their *equality* as a suite invariant. At the next edit, both pins get re-computed by hand; update one and forget the other and both pins pass while agents see one README and the sealed record swears another — precisely the divergence class the sealing regime exists to prevent, unguarded at its only 2-copy surface. Separately: §3 quotes facet tests for the census (item 2), the park primitive (item 4), and clustering (item 6); the glue detector gets "rules as implemented" without cited tests; and items 5 (off-topic) and 7 (commitment) get mechanism descriptions with **no test evidence at all**. For a document that *is* the pre-registered acceptance condition, "one per repair facet, quoted throughout §3" is not substantiated by §3 as assembled.

**VERDICT / Label:** needs-data (does a rendered-vs-sealed equality test exist? which facet tests cover items 5 and 7?), leaning refuted on the "twin pins cover every agent-facing text" sub-claim. Label: REFUTES-A-CLAIM (F) narrowly on substantiation completeness, pending those two answers.

---

## F8 — The glue-feedback strings are imperative instructions that, fired on narration, can *induce* protocol actions — including an accidental `<<<DONE>>>`.

**CLAIM ATTACKED:** none directly (item 3's invariants as stated survive); this is probe-contamination risk.

**EVIDENCE:** "text precedes the delimiter ${token} on line N; delimiters are recognized only at the start of a line — **put the delimiter on its own line**" and "**put <<<DONE>>> on its own line to close the block**."

**ARGUMENT:** The detector cannot distinguish glue from *mention*: an agent narrating its plan ("when the suite is green I'll output <<<DONE>>>") mid-line now receives an imperative instruction to put `<<<DONE>>>` on its own line. A compliant agent obeys → unintended phase exit → a done-close the disposition table records, contaminating exactly the P1.1 readout. The in-block variant has the mirror hazard: a narrated, never-intended `<<<FILE …>>>` opener that "never closes" draws feedback instructing the agent to close it with `<<<END>>>` → a garbage whole-file write. Also worth one cheap check: "the no-op rule and the stall rule are unchanged" is asserted about the rules' text — verify their *inputs* don't include the violations array the synthetic entries are merged into, or the rules are letter-unchanged and effect-changed.

**VERDICT / Label:** DESIGN-INPUT-FOR-PROBES (probe transcripts should be screened for feedback-induced DONEs and file writes; consider rewording to descriptive rather than imperative: "if this was meant as a command, it must start the line").

---

## F9 — The budget carry is defensible only if E4 turn-metrics are declared non-comparable, explicitly, before P1.1.

**CLAIM ATTACKED:** F (budgets sub-claim).

**EVIDENCE:** "budgets unchanged (27 turns / 12 verifications …)"; item 3's own motivation: the silent glue case "cost ≈85 wasted turns and all 3 stalls."

**ARGUMENT:** Removing an ~85-turn tax while holding the 27-turn cap fixed raises *effective* budget materially. The sealed budgets_note ("probes are calibration-class and re-examine appetite per probe") answers appetite going forward but not backward comparability: any P1 reading that touches turn efficiency, stall rates, or nonclose_by_termination against E4 baselines is confounded by construction. Fine for the boundary; must be a stated exclusion in P1 analysis.

**VERDICT / Label:** DESIGN-INPUT-FOR-PROBES.

---

## F10 — The commitment scorer's "omitted literal = CONTRADICTION" collapses under-specification into anti-specification; P1.5 inherits a category error.

**CLAIM ATTACKED:** none of A–F directly; P1.5's scorer dependency.

**EVIDENCE:** "a validation-rule claim that omits the literal on a detail-bearing gold rule is a CONTRADICTION ('a commitment that names no literal committed to nothing')"; "convention statements compare verbatim."

**ARGUMENT:** The justificatory sentence describes *missed*, not *contradicted* — "committed to nothing" is the definition of an omission. Folding it into contradicted makes P1.5 unable to distinguish vague agents from wrong agents, which is presumably the distinction request-echo probing exists to make. Verbatim convention comparison has the same flavor: a semantically identical statement with whitespace drift scores contradicted. If the cell definitions stay, P1.5's readout needs a fifth bucket or the contradicted cell needs sub-typing before the probe, not after.

**VERDICT / Label:** DESIGN-INPUT-FOR-PROBES.

---

## F11 — Parking friction is arm-correlated; the parity claim is textual, not statistical.

**CLAIM ATTACKED:** C (parity sub-question).

**EVIDENCE:** "Both arms get identical text and identical mechanics (shared-workflow parity)."

**ARGUMENT:** Leftovers are produced by stalls and refusals, which are arm-dependent (the executable gate refuses more). Identical mechanics on unequal leftover rates means parking turns, naming friction, and F5-style dead-end exposure land asymmetrically — a treatment-correlated cost channel inside the shared budget. Not a validity break at this boundary, but P1 disposition and turn analyses should carry parks-per-arm as a covariate, and the `gate_events.parks` counter already exists to do it.

**VERDICT / Label:** DESIGN-INPUT-FOR-PROBES.

---

## F12 — Minor consistency items (grouped)

**CLAIM ATTACKED:** A/C, low severity. (a) "Parked changes … are never validated" vs the custody bullet's "`openspec validate` passing" — the pack never states validate's scope; if it walks the whole tree, a malformed leftover blocks the exit before the agent parks it. One facet test would close this. (b) The added-entity template branch `${name} needs no endpoints beyond what is stated elsewhere in this brief.` vs row 7's "every entity always has a read endpoint": either dead code (latent falsity if the generator ever changes) or reachable and then a false brief line — determine which. (c) The tombstone requirement ("SHALL NOT serve the retired paths") persists in the spec of record forever; if the generator can ever re-draw a previously retired entity name within a sequence, the spec of record becomes internally contradictory and the tombstone scenario turns false against gold — needs-data on name-reuse. (d) Pluralizer family-key collisions across distinct entities: needs-data on the name pool. (e) The required-field × null-backfill × full-replace composite is individually disclosed but jointly undeclared; a probe transcript reading is cheap. **Label:** DESIGN-INPUT-FOR-PROBES for all five.

---

# Claim verdicts

**A — refuted.** The *new sentences* themselves survive modulo gold access (I cannot verify "validated in full" covers unknown-field handling — that's the runner-up fifth-family candidate; needs-data). But the claim as constituted — two-and-only-two falsities corrected, everything residual inventoried and brief-answerable — falls three ways: row 11 is not answerable by its quoted brief line (F1), the retirement instruction forces pinning an uninventoried, un-answerable fact (F1), and variant 0 is a retained falsity by the authors' own condemnation standard, now in live contradiction with the README (F3).

**B — needs-data.** No refutation of the mechanism; the offered evidence (renderer census) does not reach the pipeline-level claim. Resolve: substrate_version's role in seeding, pick's sealed status, one end-to-end replay test (F6).

**C — refuted.** The carve-out boundary plus no-delete plus the product gate's mandatory-failing-scenario rule reconstructs a no-clean-exit state reachable by ordinary tidy behavior (F5) — conditional on diff semantics, which the pack should have stated. The hiding-work and laundering vectors survive; the parity sub-claim is a design input (F11).

**D — refuted** on coverage and gameability: environment-driven subject saturation (whole-file writes + substring + pre-existing names + method verbs + envelope keys) drives detection power to ~0 on most op kinds, and `not_applicable` excludes the highest-risk swap scenario by construction (F2). The polarity choice per se survives, inertly.

**E — refuted.** A constructive many-mistakes-few-families case inverts the real ordering while the program's published doctrine directs the reader to the inverted series; side-by-side printing makes the misreading auditable, not impossible (F4). Authoring-style and rename-chain confounds ride along as probe design inputs.

**F — needs-data, leaning refuted** on two points: no cited standing invariant binds the rendered README to its sealed twin across the *next* edit, and repairs 5 and 7 carry no quoted test evidence despite the "one per facet, quoted throughout §3" assertion (F7). Budget carry survives with the F9 exclusion stated. Validator-optional ids survive: the live-file census is an adequate stopper while it exists.

One meta-observation to close, because it's the pattern behind F1 and behind all four E4 families: every guarantee in this rig that is enforced *per fact kind* (determinacy coverage, brief coverage, inventory rows) is vulnerable to the same move — a channel that names a fact without determining it passes the census and still leaves the answer key holding a secret. Before P1.3/P1.4, I'd want one audit whose unit is not "is there a line" but "does the line's content, plus the README, uniquely determine every assertion the hidden suite makes about this fact" — run once, mechanically, over the oracle's actual assertion set. That's the test that would have caught families one through five.
