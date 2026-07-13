# E5 P0-V external review — adjudication record (v1, 2026-07-13)

**Inputs:** 7 external reviews (Gemini, ChatGPT, DeepSeek, Qwen, Kimi, GLM, Claude), all
text-only (no repo access), of the self-contained P0-V review package
(`tmp/e5-p0v-review-prompt.md` — operator-held, gitignored by design, deliberately not
committed); raw returns archived verbatim in
`docs/e5/E5-P0V-REVIEW-PANEL-RAW-20260713.md`. **Method:** every finding verified against
the repo at `784e0ff` before adjudication — code read, mechanics traced, nothing taken on
the reviewer's word. **Status: PROPOSED — no action candidate below is applied; each is a
gate decision for the operator. Zero spend.** Actionable form of everything here:
`docs/e5/E5-P0V-REVIEW-BACKLOG-v1.md`.

Dedup: ~40 raw findings collapse into 17 clusters. Verdict vocabulary:
**VERIFIED** (finding holds against code; action warranted), **SOFTENED** (kernel true,
severity reduced by code facts), **REFUTED-BY-CODE** (premise false; recorded so it is not
re-litigated), **DESIGN-INPUT** (no defect at this boundary; probes must account for it).

---

## Part 1 — VERIFIED findings (gate-action candidates, ranked)

### V1. Off-topic classifier: detection power ≈ 0 on most op kinds; maintenance hole; delta-spec mention suffices
**Reviewers:** ChatGPT#2/#4/#5, Qwen F1, Kimi F2/F4/F6, GLM#1, Claude F2, DeepSeek F3, Gemini#3. The panel's strongest convergent hit (6 of 7 reviews).
**Verified mechanics** (`src/e4/v3/on-topic.ts`, runner integration):
- Subjects include OLD entity names on renames; FILE writes are whole-file; matching is
  any-single case-insensitive substring ⇒ on rename/retype/delete/field-rename tasks, any
  write of a central file matches through pre-existing occurrences. On `modify_endpoint`,
  the new method verb ("PUT"/"PATCH") matches virtually any server file. On
  `modify_convention`, the new statement's envelope keys match all error-handling code.
  Genuinely fresh subjects exist only for add_entity/add_field — and short common field
  names (`status`, `name`) still match incidentally.
- One subject mention in agent-authored delta-spec text (a heading suffices) classifies
  on_topic; the proposal.md/tasks.md exclusion does not cover this equally-agent-authored
  surface.
- Empty-delta (maintenance) tasks → `not_applicable` unconditionally, even when the agent
  authors a full change (legal in the prose arm) — the highest-risk absorption scenario is
  unscorable by construction. This also falsifies one sentence of the park design note (see
  V6).
**What survives:** the polarity *choice* (prefer false-on-topic) is defensible for a
scoring category, and fc status is independently recorded (`off_topic_fc_events`), so the
honesty readout is never lost — the risk is the OFF-TOPIC column reading ≈0 and being
trusted as "no swaps happened".
**Action candidates (pick one track):**
- (a) Classifier v2: word-boundary matching; code haystack counts only occurrences of
  subjects NOT already present in the file at task start (novel-occurrence rule);
  delta-spec channel scored by predominance not single match; maintenance tasks that author
  a non-marker change get a new `unexpected_change_work` flag (scored against the
  leftover's subjects where one exists).
- (b) Keep v1, demote: P1.1 template states the column is a LOWER BOUND with the blindness
  documented per op kind, and baseline comparisons always pool
  `false_close + off_topic_fc_events` (Gemini#3's rule — adopt it in the readout template
  in either track).

### V2. `modify_endpoint` variants 0/2: direction-false on PATCH→PUT and now in direct contradiction with the README
**Reviewers:** ChatGPT#3, Kimi F1, GLM#2, Claude F3.
**Verified mechanics:** the flip is a pure toggle (`ops.ts:417`); draws can repeat within a
sequence (`draw.ts:86-101` — no repeat exclusion), so a second `modify_endpoint` on the
same endpoint yields PATCH→PUT. On that direction, variant 0 ("should follow the newer
partial-update convention the API **now uses**") points opposite to gold — the exact
criterion that condemned variant 1 at v3-M7. Additionally, on ALL `modify_endpoint` draws
of variants 0/2 (2 of 3), the task text now sits in direct contradiction with the new
README sentence "there are no partial updates in this API" — a contradiction CREATED at
this boundary by the README addition. The render.ts defense ("semantics stay full-replace
either way") answers the semantics axis only, not the direction axis.
**Action candidates:** (a) reword variants 0/2 direction-neutral in the v2-owned pool
(same one-pick PRNG discipline; substrate v2.3 + twin re-pin + census extension); (b)
accept as recorded contradiction/measurement material with an explicit note in the
ambiguity inventory (weaker — the program's own falsity standard argues for (a)).

### V3. Workflow protocol first bullet now misstates the write rule
**Reviewer:** ChatGPT#1 (their "critical" framing overreached; the wording defect is real).
**Verified:** the write guard allows writes in ANY change directory
(`gate.ts:203-223` — `CHANGE_PATH_PATTERN.test`, archive and specs excluded); custody
counts ACTIVE directories only at exit. The bullet "Only files inside one change directory
… are writable" is therefore an inaccurate statement of the enforced rule, and a
literal-obedient agent could refuse the lawful park-then-propose flow. The explicit new
parking bullet defuses the trap-recreation claim (specific permission beats the general
statement), so this is a wording repair, not a re-opened trap.
**Action candidate:** reword the bullet (e.g. "Only files inside change directories under
openspec/changes/<name>/ are writable; your task's work must end up in a single active
change …") — protocol_text re-seal rides the next boundary bump.

### V4. Ambiguity inventory row 11: the analytics brief line does not answer the shape it claims to answer
**Reviewers:** DeepSeek F2, Qwen F3, Claude F1 (first instance).
**Verified:** gold returns `{ count: table.size }` (`scaffold.ts:339-341`); the brief line
pins method/path/purpose but not the JSON key. Two mitigating code facts the reviewers
could not see: the hidden analytics test asserts **status 200 only**
(`testgen.ts:251-259`) — so no oracle-side false-confidence fabrication (Claude F1's
worst-case mechanism does not hold); and the T0 visible spec-of-record asserts
`count` on the existing analytics endpoint (`gold-spec.ts:311-324`), so a uniform-shape
channel is visible in the workspace. Residual defect: an honest agent that ignores the
visible precedent and invents `{"total": N}` passes the oracle but gets a drift
CONTRADICTION from the meter — and the inventory's own text says the BRIEF answers this
knob, which is false as written. This is the panel's real "fifth-family-shaped" find: a
per-fact-kind coverage guarantee that does not check informational sufficiency.
**Action candidates:** add the shape literal to the analytics brief template ("returns
{\"count\": <number of records>}") + correct row 11; this sits directly in the P1.3/P1.4
measurement path (the ask levers assume the brief suffices).

### V5. Inventory D2 traceability note is factually wrong
**Reviewer:** ChatGPT#7.
**Verified by text comparison:** "rows 1–5 are the five convention families the E4 audits
surfaced" is not a one-to-one mapping (pluralization was structurally eliminated at v2.1,
not inventoried; PATCH is excluded by design; retype/positional-linking are new). Doc-level
inaccuracy in a committed acceptance artifact.
**Action candidate:** rewrite the note as a per-family disposition table (disclosed /
request-determined / brief-answerable / structurally eliminated / residual).

### V6. Park design note overclaims the off-topic interplay for maintenance tasks
**Reviewers:** ChatGPT#4, Claude F2 (maintenance hole).
**Verified:** D1 says absorbing a leftover "now lands in the off-topic close category";
for empty-delta tasks the classifier returns `not_applicable` unconditionally, so the
sentence is false exactly where absorption is most tempting.
**Action candidate:** correct D1's sentence; optionally close the hole via V1(a)'s
`unexpected_change_work` flag.

### V7. Latent generator/tombstone name-recycling collision
**Reviewer:** Claude F12c.
**Verified:** `applyAddEntityV2` filters candidate names against CURRENT IR entities only
(`v2/ops.ts:78-79`; pool = Supplier/Warehouse/Promotion/Review/Tag, disjoint from baseline
and from the rename pool). add(X)→delete(X)→add(X) and add(X)→rename(X→Y)→add(X) are both
drawable; the re-add revives a tombstoned collection path, making the record's tombstone
requirement fail against gold — a contradiction charged to an agent that followed the
README exactly. Low probability, never observed in committed runs, agent-resolvable in
principle (retire the tombstone in the new change), but nothing discloses that obligation.
**Action candidates:** (a) draw-guard — exclude ever-used entity names via
`E4SequenceState` (the state plumbing already exists; `addedEntityNames` at `ops.ts:54-56`);
(b) probe-seed screening only (record as known limitation).

### V8. budgets_note sentence overreaches
**Reviewers:** ChatGPT#6, Claude F9.
**Verified as wording:** "no budget-relevant surface moved" — the glue feedback exists
precisely to recover ≈85 wasted turns and 3 stalls, i.e. it changes effective turn
economics (direction: more headroom; the frozen caps remain valid as ceilings, so the carry
itself is defensible). E4 comparability is already walled off (probes are
calibration-class; E4 verdicts closed), but the sentence as sealed is attackable.
**Action candidate:** one clarifying sentence at the next boundary ("nominal caps retained;
effective turn economics improved by design; no cross-boundary turn-metric comparisons") +
the same exclusion stated in probe templates.

---

## Part 2 — SOFTENED findings (kernel true, severity reduced by code facts)

### S1. Carve-out "dead-end" (Claude F5)
The diff is CONTENT-based (`gate.ts:564-575` — string comparison against task-start
snapshot), so an agent that edited a leftover's existing files can restore the original
bytes and reach the affirmation path; the conditional dead-end Claude flagged requires the
unstated diff semantics he asked for, and they are the favorable ones. The residual sticky
case: CREATING a new file inside a leftover on a maintenance task (irreversible without a
delete primitive; affirmation then unreachable; the executed arm has no truthful red
scenario available). Real but narrow corner requiring gratuitous behavior.
**Action candidates:** README sentence "the PARKED.md marker alone suffices — do not edit
a parked change's other files"; or extend the carve-out to all writes into pre-existing
parked directories (weakens nothing measurable — parked dirs are never bound/merged).

### S2. Park-plus-keyword laundering (ChatGPT#5, Kimi F6)
Mechanically constructible, but the load-bearing weakness is V1 (the classifier), not the
park primitive: parking adds only a lawful stash for an aborted own-task attempt; the
laundering works identically without parking. Folded into V1's fix space. Claim C itself
stands: parked content never reaches the spec of record, the meter scores the record, and
custody still demands exactly one active change.

### S3. Clustered-burden interpretive hazards (Claude F4, Kimi F5, Qwen F2, GLM#4)
Claim E survives as worded (both series + AUCs always printed adjacently; the package's
claim was about the program's own artifacts). Three verified hazards remain: (i)
independent same-family mistakes collapse (5-mistakes-1-family reads better than
2-mistakes-2-families — inversion constructible); (ii) stale-claim families derive from
agent-authored paths, so path typos mint families — and only the PROSE arm's scenarios go
unexecuted, so typos persist there: a directional confound (Qwen had the mechanism right,
the direction unproven; Claude's "favors the treatment arm" is the sharper statement);
(iii) the seed-36 exhibit teaches readers to trust clustered when the two disagree.
**Action candidates:** keep raw primary (already the program's stance — burden is
diagnostic); print per-cluster `item_count` in the report line (the data structure already
carries it); consider renaming to "family-collapsed burden" in report text.

### S4. Imperative glue feedback can induce protocol actions (Claude F8)
Verified: the prose arm accepts an implementation-phase done-claim unconditionally
(`gate.ts:508-511`), so a narrated mid-line `<<<DONE>>>` drawing the feedback "put
<<<DONE>>> on its own line" could tip a literal agent into an early accepted close. The
rider check passes: `effectiveNoOp = parsed.no_op && !prePass.ask_pm` (`runner.ts:333`) —
violations do not feed the no-op/stall rules.
**Action candidate:** conditional wording ("if this was meant as a protocol command, put
it on its own line") at the next boundary; screen probe transcripts for feedback-adjacent
DONEs either way.

---

## Part 3 — REFUTED-BY-CODE (recorded so they are not re-litigated)

| # | Finding | Refutation |
|---|---------|------------|
| R1 | Gemini#1 "required field + null backfill is a fatal contradiction" (their top finding) | `applyAddField` hardcodes `required: false` (`ops.ts:263`); v2 does not override add_field (`v2/ops.ts:334-336`). The premise — a required added field — is undrawable. The null-backfill brief line is a true statement about an always-optional field. |
| R2 | Gemini#4 "census hardcodes 'Widget', test is rigged or CI broken" | The census supplies FIXED render contexts (entity "Widget" for modify_endpoint); the PRNG picks variants only. The hardcoded assertion is correct within the fixture; suite green 841/841. |
| R3 | Gemini#2 "trailing-glued delimiters (`<<<DONE>>> extra`) remain a silent trap" | The sealed parser requires exact-line token match (`e1-l1-parser.ts:136,146`); a `<<<`-prefixed non-matching line gets a LOUD `unrecognized_protocol_line` violation (`:151-159`). Not silent; the E5 detector correctly leaves those lines to the parser. |
| R4 | DeepSeek F1 "server-generated id must be omitted from POST — the fifth family" (their top finding) | Gold does the opposite: create stores the CLIENT-supplied id and echoes the body (`scaffold.ts:298-305`); id is a required field; the visible T0 create scenarios POST bodies including ids. |
| R5 | Qwen F6 / Kimi F8 / GLM#5 / Claude F7(part) "no standing README-vs-sealed equality test" | It exists and runs in every suite: `test/e4-v2-constants.test.ts:114-117` pins `constants.protocol_text.workspace_readme === renderE4V2Readme()` verbatim. |
| R6 | Claude F7(part) "items 5 and 7 carry no test evidence" | `test/e5-p0v-rig-repair.test.ts` contains facet suites for item 5 (4 tests incl. the disposition table) and item 7 (3 tests); the package summarized rather than quoted them. |
| R7 | Claude F6(threat i) "substrate_version may enter seeding" | Seeding is `createE4Prng(config.substrate_seed)` — numeric seed only (`v2/provider.ts:84`); the version string is a label. |
| R8 | ChatGPT#9 "malformed parked dirs may poison validate/archive" | The committed park facet tests use an UNPARSEABLE leftover and pass custody including live CLI `openspec validate` on the active change and the real-archive preview (`test/e5-p0v-rig-repair.test.ts`, LEFTOVER fixture). |
| R9 | Kimi F3 / Claude F1(second instance) "retired-path 404 body is an unresolvable new family" | Gold 404s uniformly with the standard envelope (`scaffold.ts:287,310,316,328`); the visible T0 spec carries 404+envelope scenarios (`gold-spec.ts:262-263` and read templates); the canonical tombstone asserts the envelope; a status-only tombstone violates the value-binding floor and draws loud custody feedback. Residual micro-improvement: the README retirement section could mention the envelope assertion. |
| R10 | Kimi F7 / Qwen F5 / GLM#3 / ChatGPT#8(part) "pool_id feeds downstream records" | No v2 consumer found (grep): pool_id is consumed at render; the v1 `phrasing_pools.pool_ids` seal governs the v1 renderer only (`test/e4-substrate.test.ts:228`); v2 seals render.ts as a code twin instead. The determinacy-table shift is deliberate and boundary-stamped. |
| R11 | ChatGPT#8(part) / Claude F6(part) "pick may not consume as f(length)" | `pick = items[nextInt(items.length)]`, exactly one `next()` per call, pure in array length (`prng.ts:34-40`). Same-length pools ⇒ identical stream. |

Also rejected: ChatGPT's overall **NO-GO** framing — of its six "minimum blocking repairs",
two rest on refuted or softened findings (R8; S2), one is a wording fix (V3), and the
remainder are covered by V1/V2/V8. The verified repair set is small, cheap, and zero-spend.

---

## Part 4 — DESIGN-INPUT ledger (no boundary defect; carry into probe design)

| D# | Input | Source | Where it lands |
|----|-------|--------|----------------|
| D1 | Baseline comparisons must pool `false_close + off_topic_fc_events` | Gemini#3 | P1.1 readout template |
| D2 | Parking friction is arm-correlated (refusal-heavy arm accrues more leftovers); publish per-arm park diagnostics as covariate | ChatGPT#11, Qwen F4, Claude F11 | P1.x readouts (`gate_events.parks` already recorded) |
| D3 | No E4 turn-metric comparisons (effective-budget change) | ChatGPT#6, Claude F9 | probe templates (with V8's note fix) |
| D4 | Commitment scorer: sub-type `contradicted` (wrong-value vs no-value); verbatim convention match punishes paraphrase | Claude F10 | P1.5 design |
| D5 | Clustered burden: print cluster item_counts; raw stays primary | S3 | learning-report line (cheap) |
| D6 | prng.ts is not twin-pinned (de facto guarded by v1 fixture tests) | Claude F6 | candidate twin at next boundary |
| D7 | Validator-optional ids: consider version-aware requirement (required for ≥0.6) | ChatGPT#12 | candidate at next boundary |
| D8 | Brief dead branch "needs no endpoints beyond…" unreachable in v2 (add_entity always mints 5 endpoints) — latent only | Claude F12b | note; no action |
| D9 | Screen probe transcripts for feedback-induced DONEs/file-writes | Claude F8 / S4 | P1.1 analysis checklist |
| D10 | The structural lesson: per-fact-kind coverage ≠ informational sufficiency. Candidate follow-up census: for every underdetermined fact, does (brief line + README + visible spec) determine every assertion the hidden suite makes about it? V4 is the instance this would have caught — and it is buildable (the hidden suite and brief are both derivable per drawn task). | Claude (meta-observation) | candidate P0-V follow-up instrument |

---

## Part 5 — Claim verdicts after adjudication

| Claim | Panel majority | Adjudicated | Basis |
|-------|----------------|-------------|-------|
| A (disclosures truthful, no overreach) | refuted | **partially refuted** | Every NEW disclosure sentence verified TRUE against gold (update semantics incl. unknown-field checks on PATCH; id/value keep on rename; parking semantics; 404 envelope). Both headline "fifth family" candidates refuted (R4, R9). But: V2 (variant-0 contradiction, direction falsity), V3 (workflow bullet), V4 (row-11 sufficiency), V5/V6 (doc notes) are real text-level defects. |
| B (PRNG/byte-identity) | survives / needs-data | **survives** | R2, R7, R10, R11 close every needs-data item. |
| C (park primitive) | split | **survives with corners** | S1 (content-based diff escape; one narrow irreversible corner), S2 (laundering is V1's weakness), V6 (doc overclaim). |
| D (off-topic classifier) | refuted | **refuted in substance** | V1. Polarity defensible, power ≈0 where it matters; maintenance hole. Fix or demote before P1.1 leans on the column. |
| E (clustered burden) | split | **survives as worded** | Publication rule holds; S3 guardrails recommended. |
| F (hygiene) | split | **survives with a wording fix** | R5, R6 close the substantiation attacks; V8 is the one real (wording) hit; D6/D7 optional hardening. |

---

## Part 6 — Recommendation to the operator (decision menu, not applied)

One small follow-up repair boundary ("P0-V.1", zero spend, one gate act, v2/v3 → v0.7)
before probe P1.1:

**Blocking-recommended (the probe leans on them):**
1. V1 — off-topic classifier v2 **or** explicit lower-bound demotion in the P1.1 template
   (+ D1 pooling rule either way).
2. V2 — variants 0/2 direction-neutral rewording (or recorded-contradiction acceptance).
3. V4 — analytics brief line + row 11 correction.

**Cheap riders on the same bump:**
4. V3 workflow-bullet rewording; V5 D2-note rewrite; V6 D1-sentence fix; V8 budgets_note
   sentence; S1 README parked-content sentence; S4 conditional glue wording; D5 report
   line.

**Optional hardening (same bump or later):** V7 name-recycling draw guard (or seed
screening); D6 prng twin; D7 version-aware ids.

**Explicitly NOT recommended:** ChatGPT's full NO-GO (basis dissolved under verification);
any reopening of E4 verdicts (out of scope by ground rule and unaffected: the committed M6/M7
evidence never drew the V7 collision, and V1–V8 are forward-looking instrument fixes).
