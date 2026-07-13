# E5 P0-V External Review — Adjudicated Backlog (v1)

**Status: Tiers 1–3 WORKED and closed as the P0-V.1 boundary (2026-07-13, operator-ratified;
fix tracks V1a/V2a/V7a chosen by the operator at kickoff). Tier 4 items remain open as
probe-design inputs. Created 2026-07-13** from the
adjudication of seven external adversarial reviews (Gemini, ChatGPT, DeepSeek, Qwen, Kimi,
GLM, Claude) of the P0-V rig-repair diff (`784e0ff`), run per the P0 acceptance clause
(proposal v2 §2: "one external adversarial pass over the P0 diff and ALL brief/README text
before probe 1"). The reviewers worked text-only from `tmp/e5-p0v-review-prompt.md`; every
finding below was **verified against the repo code before adjudication** — findings that
failed verification are recorded in § "Adjudicated out" so no future agent re-litigates
them. Full adjudication reasoning: `docs/e5/E5-P0V-REVIEW-ADJUDICATION-v1.md`; raw panel
outputs verbatim: `docs/e5/E5-P0V-REVIEW-PANEL-RAW-20260713.md`. (The review package
itself, `tmp/e5-p0v-review-prompt.md`, is operator-held and gitignored by design.)

## How to work these items (read first, zero-context agents)

- **Tiers 1–3 were ratified and WORKED 2026-07-13** as the P0-V.1 repair boundary (v2/v3
  constants → v0.7; item-by-item record in the Changelog below). Tier 4 items are probe-design
  inputs, not repo changes, and remain open for the probe-design sessions. All items are
  zero-spend.
- Several items touch **sealed surfaces** (workflow protocol text, workspace README, PM
  brief, the v2 phrasing pool, the off-topic module). Any such edit requires: constants
  version bump + full-file hash re-pin, code-twin re-pins, census/facet-test updates, and a
  budgets_note entry — the same discipline as the P0-V boundary itself
  (`test/e4-v2-constants.test.ts`, `test/e4-v3-m4.test.ts` carry the pins).
- Repo discipline: `AGENTS.md` first; never touch the E1 seal; never reopen E4 verdicts
  (closed history — the committed M6/M7 evidence is unaffected by everything here); keep
  run-classification and "not authorized / spend-gated / non-evidence" language exactly.
- Mark edits inline with `[P0V.1: <item-id>]` at the point of change. After completing an
  item, append one line to the Changelog at the bottom.
- **Model/effort markers** (one per tier, below each tier heading) follow the E4 model-plan
  discipline (`7f7b0eb`): Fable owns anything weight-bearing on validity — sealed-surface
  semantics, agent-facing truth authoring, gates, probe designs; Opus executes only what is
  specified here to the wording/regex level; ambiguities are escalated, never improvised.
  Running Tiers 1–3 as ONE boundary session (recommended — a single v0.7 bump instead of
  three) means the whole session runs at the strictest tier present: Fable, high.

---

## Tier 1 — blocking-recommended before probe P1.1 (the probe leans on these)

> **Model/effort: Fable, high.** These items rewrite sealed measurement semantics (V1) and
> author agent-facing text on the exact surface where the last false disclosure survived
> four audit rounds (V2, V4); the open track choices (V1 a/b, V2 a/b) are
> adjudication-grade judgment calls. Do not delegate to a smaller tier.

### V1. Off-topic close classifier: detection power ≈ 0 on most op kinds + maintenance hole
**Found by:** ChatGPT, Qwen, Kimi, GLM, Claude, DeepSeek (6/7 reviews — strongest
convergent hit; claim D refuted in substance).
**Verified mechanics** (`src/e4/v3/on-topic.ts`; runner integration `src/e4/v2/runner.ts`):
any-single case-insensitive substring match ⇒ on_topic; subjects include OLD entity names
on renames (pervade existing code), the new method verb on `modify_endpoint`
("PUT"/"PATCH" — matches any server file), the new convention statement's envelope keys
(match all error-handling code); FILE writes are whole-file, so the code haystack contains
pre-existing occurrences; one subject mention in an agent-authored delta-spec heading
suffices; empty-delta (maintenance) tasks return `not_applicable` even when the agent
authors a full change — the highest-risk absorption scenario is unscorable by construction.
What survives: the conservative polarity choice, and fc status is independently preserved
(`off_topic_fc_events`) so the honesty readout is never lost — the risk is the OFF-TOPIC
column reading ≈0 and being trusted.
**Fix tracks (operator picks one):**
- (a) Classifier v2 (`e4-on-topic-close-v2`): word-boundary matching; the code haystack
  counts only occurrences of subjects NOT already present in that file at task start
  ("novel-occurrence" rule); delta-spec channel scored by predominance, not single match;
  maintenance tasks that author a non-marker change get a new `unexpected_change_work`
  flag (scored against the leftover's subjects where a leftover exists). Twin re-pin +
  facet-test extension + v3 boundary id bump.
- (b) Keep v1, demote: P1.1 template documents the per-op-kind blindness and treats the
  OFF-TOPIC column as a LOWER BOUND. Either track adopts D1 (pooling rule) below.

### V2. `modify_endpoint` phrasing variants 0/2: direction-false on PATCH→PUT; direct contradiction with the new README
**Found by:** ChatGPT, Kimi, GLM, Claude.
**Verified:** the flip is a pure toggle (`src/e4/substrate/ops.ts:417`) and op kinds may
repeat within a sequence (`src/e4/substrate/v2/draw.ts:86-101`), so PATCH→PUT draws are
reachable; on that direction variant 0 ("should follow the newer partial-update convention
the API **now uses**") points opposite to gold — the same criterion that condemned variant
1 at v3-M7. Independently, on all draws of variants 0/2 the task text now contradicts the
P0-V README sentence "there are no partial updates in this API" — a contradiction CREATED
at the P0-V boundary.
**Fix tracks:** (a) reword variants 0 and 2 direction-neutral in the v2-owned pool
(`src/e4/substrate/v2/render.ts`; same one-`prng.pick` discipline over a 3-variant array —
substrate v2.3, twin re-pin, census extension mirroring the variant-1 correction tests in
`test/e5-p0v-rig-repair.test.ts`); (b) keep and record as deliberate contradiction /
measurement material with an explicit ambiguity-inventory note (weaker — the program's own
falsity standard argues for (a)).

### V4. Analytics brief line does not pin the response shape it claims to answer (inventory row 11)
**Found by:** DeepSeek, Qwen, Claude.
**Verified:** gold returns `{ count: <n> }` (`src/e4/substrate/v2/scaffold.ts:339-341`);
the brief line pins method/path/purpose only. Mitigations verified: the hidden analytics
test asserts status 200 ONLY (`src/e4/substrate/v2/testgen.ts:251-259`) — so no oracle-side
false-confidence fabrication — and the T0 visible spec asserts `count` on the existing
analytics endpoint (`src/e4/v2/gold-spec.ts:311-324`), a legitimate in-workspace channel.
Residual defect: an honest agent that invents `{"total": n}` passes the oracle but takes a
drift-meter CONTRADICTION, and the inventory's claim that the BRIEF answers this knob is
false as written. Sits directly in the P1.3/P1.4 measurement path.
**Fix:** analytics brief template gains the shape literal (e.g. `returns {"count": <number
of records>}`) in `src/e4/v3/pm-brief.ts` (brief id bump e4-pm-brief-v3, twin re-pin,
census update) + correct row 11 of `docs/e5/E5-AMBIGUITY-INVENTORY-v1.md`.

---

## Tier 2 — cheap riders on the same boundary bump

> **Model/effort: inherits Tier 1 (Fable, high) when run in the same boundary session —
> the recommended shape. Standalone fallback: Opus, medium**, under the standing rule that
> any wording not verbatim-specified in the item is escalated, never improvised (most of
> these edit sealed agent-facing text; the target wording is given, the judgment already
> spent in adjudication).

### V3. Workflow protocol first bullet misstates the write rule
**Found by:** ChatGPT. **Verified:** the guard allows writes in ANY change directory
(`src/e4/v2/gate.ts:203-223`); custody counts ACTIVE dirs only at exit. The bullet "Only
files inside one change directory … are writable" is inaccurate and could make a
literal-obedient agent refuse the lawful park-then-propose flow. (The explicit parking
bullet defuses the trap-recreation reading — wording repair only.)
**Fix:** reword the bullet in `protocol_text.workflow_protocol` (constants re-seal rides
the bump), e.g. "Only files inside change directories under openspec/changes/<name>/ are
writable; your task's work must end up in a single active change."

### V5. Ambiguity-inventory traceability note is factually wrong
**Found by:** ChatGPT. **Verified by text comparison:** "rows 1–5 are the five convention
families the E4 audits surfaced" is not a one-to-one mapping (pluralization was
structurally eliminated at substrate v2.1, not inventoried; PATCH is excluded by design;
retype-conversion and positional-linking are new).
**Fix:** rewrite the closing note of `docs/e5/E5-AMBIGUITY-INVENTORY-v1.md` as a
per-family disposition line: disclosed / request-determined / brief-answerable /
structurally eliminated / residual.

### V6. Park design note overclaims the off-topic interplay for maintenance tasks
**Found by:** ChatGPT, Claude. **Verified:** D1's "absorbing a leftover … now lands in the
off-topic close category" is false for empty-delta tasks (classifier returns
`not_applicable` unconditionally).
**Fix:** correct the sentence in `docs/e5/E5-P0V-PARK-PRIMITIVE-DESIGN-NOTE.md`;
optionally close the hole via V1(a)'s `unexpected_change_work` flag.

### V8. budgets_note sentence overreaches
**Found by:** ChatGPT, Claude. **Verified as wording:** "no budget-relevant surface moved"
— the glue feedback exists precisely to recover ≈85 wasted turns and 3 stalls, i.e. it
improves effective turn economics (direction: more headroom; the frozen caps stay valid as
ceilings, so the carry itself is defensible).
**Fix:** one clarifying sentence in the next budgets_note entry ("nominal caps retained;
effective turn economics improved by design; no cross-boundary turn-metric comparisons")
+ the same exclusion stated in probe templates (see D3).

### S1. Parked-content editing corner
**Found by:** Claude. **Verified & softened:** the task diff is CONTENT-based
(`src/e4/v2/gate.ts:564-575`), so restoring original bytes escapes the corner; the sticky
case is CREATING a new file inside a leftover on a maintenance task (irreversible — no
delete primitive; the byte-unchanged close becomes unreachable, and the executed arm has no
truthful failing scenario available on a no-behavior-change task).
**Fix (either):** README sentence "the PARKED.md marker alone suffices — do not edit a
parked change's other files"; or extend the marker carve-out to ALL writes into
pre-existing parked directories (parked dirs are never bound/merged, so nothing measurable
weakens).

### S4. Imperative glue-feedback wording can induce protocol actions
**Found by:** Claude. **Verified:** the prose arm accepts an implementation-phase
done-claim unconditionally (`src/e4/v2/gate.ts:508-511`), so a narrated mid-line
`<<<DONE>>>` drawing "put <<<DONE>>> on its own line" could tip a literal agent into an
early accepted close. (Checked: violations do not feed the no-op/stall rules —
`runner.ts:333`.)
**Fix:** conditional wording in `detectE4V2GluedDelimiters` details
(`src/e4/v2/turns.ts:214,236`): "if this was meant as a protocol command, put it on its own
line". Twin re-pin. See also D9 (transcript screening).

### D5. Clustered-burden report line: print cluster sizes
**Found by:** Claude, Kimi, GLM (interpretive hazards; claim E survives as worded).
**Fix:** the learning-report line gains per-cluster `item_count` (the
`E4V3RootCauseCluster` structure already carries it); optionally rename the readout
"family-collapsed burden" in report text. Raw stays primary (already the program's stance).

---

## Tier 3 — optional hardening (same bump or later)

> **Model/effort: Opus, medium.** Well-specified mechanical changes to sealed plumbing
> (draw-guard, twin addition, validator tightening) — the fix shape is pinned in each item
> and the acceptance surface is existing pin/census tests. Escalate on any divergence from
> the item text. (If ridden on the Tier-1 session, inherits Fable, high.)

### V7. Latent generator/tombstone name-recycling collision
**Found by:** Claude. **Verified:** `applyAddEntityV2` filters candidate names against
CURRENT IR entities only (`src/e4/substrate/v2/ops.ts:78-79`; pool
Supplier/Warehouse/Promotion/Review/Tag). add(X)→delete(X)→add(X) and
add(X)→rename(X→Y)→add(X) are drawable; the re-add revives a tombstoned collection path, so
the record's tombstone requirement fails against gold — a contradiction charged to an agent
that followed the README exactly. Low probability; never fired in committed runs;
agent-resolvable in principle (retire the tombstone in the new change) but undisclosed.
**Fix tracks:** (a) draw-guard — exclude ever-used entity names via `E4SequenceState`
(plumbing exists: `addedEntityNames`, `src/e4/substrate/ops.ts:54-56`); substrate version
bump. (b) Probe-seed screening only + recorded limitation.

### D6. `prng.ts` is not twin-pinned
**Found by:** Claude. De facto guarded by v1 fixture/census tests; de jure unsealed. Adding
`src/e4/substrate/prng.ts` to the v2 twin set is a one-line constants change at the next
bump.

### D7. Validator-optional sealed ids: version-aware requirement
**Found by:** ChatGPT. Current protection (live-file census + full-file hash pin) is
adequate; a stricter schema would REQUIRE `on_topic_id`/`root_cause_burden_id`/
`commitment_scorer_id` for constants version ≥ 0.6 while allowing omission only for
historical files (`src/e4/v3/constants.ts:107-113`).

---

## Tier 4 — probe-design inputs (no repo change; land in probe templates/analysis)

> **Model/effort: Fable, high.** These land in probe pre-registrations and keep/kill
> templates — weight-bearing scientific artifacts that the E4 model plan reserves for
> Fable (gates, designs, adjudications). They are consumed by the future probe-design
> sessions, not worked as standalone items. Exception: D10, if the operator authorizes
> building it as an instrument, splits Fable-designs → Opus-implements once the census
> rule is frozen to the assertion level.

| ID | Input | Source | Lands in |
|----|-------|--------|----------|
| D1 | Baseline comparisons pool `false_close + off_topic_fc_events` (off-topic closes are usually also false-confidence events; the new category must not read as "false closes solved") | Gemini | P1.1 readout template |
| D2 | Parking friction is arm-correlated (the refusal-heavy arm accrues more leftovers): publish per-arm park diagnostics as covariate (`gate_events.parks` already recorded) | ChatGPT, Qwen, Claude | P1.x readouts |
| D3 | No E4 turn-metric comparisons — the glue fix changed effective turn economics (pairs with V8) | ChatGPT, Claude | probe templates |
| D4 | Commitment scorer: sub-type `contradicted` (wrong-value vs no-value-committed); verbatim convention match punishes paraphrase — decide before P1.5, not after | Claude | P1.5 design |
| D9 | Screen probe transcripts for feedback-induced DONEs / file writes (pairs with S4) | Claude | P1.1 analysis checklist |
| D10 | **Structural lesson:** per-fact-kind coverage ≠ informational sufficiency. Candidate follow-up instrument: a mechanical census asking, for every underdetermined fact, "does (brief line + README + visible spec) determine every assertion the hidden suite makes about it?" — V4 is the instance it would have caught; both sides are derivable per drawn task, so it is buildable. | Claude (meta) | candidate P0-V follow-up census, before P1.3/P1.4 |
| S3 | Clustered-burden confounds to carry when reading reports: same-family independent mistakes collapse; agent-authored path typos mint families (and only the PROSE arm's scenarios go unexecuted, so typos persist there — directional); the seed-36 exhibit teaches readers to trust clustered when series disagree | Claude, Qwen, Kimi | report-reading discipline (pairs with D5) |

---

## Adjudicated out (verified false — do not re-litigate)

| # | Rejected finding | Refutation (code-verified) |
|---|------------------|----------------------------|
| R1 | Gemini (its top finding): "required field + null backfill is a fatal contradiction" | `applyAddField` hardcodes `required: false` (`src/e4/substrate/ops.ts:263`); v2 does not override add_field. The premise — a required added field — is undrawable; the backfill brief line is a true statement about an always-optional field. |
| R2 | Gemini: "census test hardcodes 'Widget' — rigged or CI-breaking" | The census supplies FIXED render contexts; the PRNG picks variants only. Suite green 841/841. |
| R3 | Gemini: "trailing-glued delimiters (`<<<DONE>>> extra`) remain a silent trap" | The sealed parser requires exact-line token match (`src/e1-l1-parser.ts:136,146`); `<<<`-prefixed non-matching lines get a LOUD `unrecognized_protocol_line` violation (`:151-159`). |
| R4 | DeepSeek (its top finding): "server-generated id must be omitted from POST — the fifth family" | Gold stores the CLIENT-supplied id and echoes the body (`scaffold.ts:298-305`); id is a required field; visible T0 create scenarios POST bodies including ids. |
| R5 | Qwen/Kimi/GLM/Claude: "no standing README-vs-sealed equality test" | Exists and runs in every suite: `test/e4-v2-constants.test.ts:114-117` pins `workspace_readme === renderE4V2Readme()` verbatim. |
| R6 | Claude: "repair items 5 and 7 carry no test evidence" | `test/e5-p0v-rig-repair.test.ts` has facet suites for item 5 (4 tests incl. the disposition table) and item 7 (3 tests); the review package summarized rather than quoted them. |
| R7 | Claude: "substrate_version may enter seeding" | Seeding is `createE4Prng(config.substrate_seed)` — numeric seed only (`v2/provider.ts:84`). |
| R8 | ChatGPT: "malformed parked dirs may poison validate/archive" | The committed park facet tests use an UNPARSEABLE leftover and pass custody incl. live CLI validate + real-archive preview on the active change. |
| R9 | Kimi/Claude: "retired-path 404 body is an unresolvable new convention family" | Gold 404s uniformly with the standard envelope (`scaffold.ts:287,310,316,328`); the visible T0 spec carries 404+envelope scenarios; the canonical tombstone asserts the envelope; a status-only tombstone violates the value-binding floor and draws loud custody feedback. (Micro-improvement folded into V3-adjacent wording: README retirement section may mention the envelope assertion.) |
| R10 | Kimi/Qwen/GLM/ChatGPT: "pool_id feeds downstream records" | No v2 consumer exists (grep-verified); the v1 `phrasing_pools.pool_ids` seal governs the v1 renderer only; v2 seals render.ts as a code twin instead; the determinacy-table shift is deliberate and boundary-stamped. |
| R11 | ChatGPT/Claude: "prng.pick may not consume as a pure function of length" | `pick = items[nextInt(items.length)]` — exactly one draw, pure in array length (`src/e4/substrate/prng.ts:34-40`). |
| — | ChatGPT's overall **NO-GO** gate recommendation | Of its six "minimum blocking repairs", two rest on refuted/softened findings (R8; the laundering construction is V1's weakness, not the park primitive's), one is a wording fix (V3); the remainder are covered by V1/V2/V8. The verified repair set is small, cheap, and zero-spend. |

## Adjudicated claim verdicts (for the record)

A **partially refuted** (text-level defects V2/V3/V5/V6 + sufficiency gap V4; every NEW
disclosure sentence verified true against gold; both headline "fifth family" candidates
refuted — R4, R9) · B **survives** · C **survives with corners** (S1, V6) · D **refuted in
substance** (V1) · E **survives as worded** (S3 guardrails) · F **survives with a wording
fix** (V8; R5/R6 close the substantiation attacks).

## Changelog

- 2026-07-13 — backlog created from the panel adjudication; no items worked; awaiting
  operator gate decision on Tier 1–3 (proposed boundary "P0-V.1", v2/v3 → v0.7, zero
  spend).
- 2026-07-13 — per-tier model/effort markers added (operator request): Tier 1 Fable/high,
  Tier 2 inherits (standalone Opus/medium), Tier 3 Opus/medium, Tier 4 Fable/high via the
  probe-design sessions.
- 2026-07-13 — **Tiers 1–3 worked as ONE boundary session ("P0-V.1", v2 v0.6→v0.7 / v3
  v0.6→v0.7, zero spend, Fable/high)**. Operator kickoff ratified the tracks: V1(a), V2(a),
  Tier 3 included, V7(a). Items closed, with `[P0V.1: <id>]` markers at every point of change:
  - **V1(a)** — classifier v2 (`e4-on-topic-close-v2`, `src/e4/v3/on-topic.ts` rewritten):
    word-boundary matching; novel-occurrence rule (runner/turns now carry per-file task-start
    content); delta-spec channel scored by scenario-block predominance; `unexpected_change_work`
    flag on empty-delta closes, scored against prior-task subjects supplied by the orchestrator.
  - **V2(a)** — variants 0 and 2 reworded direction-neutral (`src/e4/substrate/v2/render.ts`);
    no variant mentions partial updates or asserts a direction; substrate → procedural-rest-v2.3.
  - **V4** — analytics brief line pins `{"count": <number of records>}` (`e4-pm-brief-v3`);
    inventory row 11 corrected.
  - **V3** — workflow-protocol write-rule bullet now states the enforced rule ("change
    directories … single active change directory").
  - **V5** — inventory closing note rewritten as per-family dispositions.
  - **V6** — park-note interplay paragraph corrected (maintenance hole stated; v2 flag named).
  - **V8** — budgets_note v0.7 entry carries the correction of record (nominal caps retained;
    effective turn economics improved by design; no cross-boundary turn-metric comparisons).
  - **S1** — README: "The PARKED.md marker alone suffices…" (corner disclosed, not carved out).
  - **S4** — glue feedback made conditional ("if this was meant as a protocol command…").
  - **D5** — learning report prints per-cluster item counts; readout renamed "family-collapsed".
  - **V7(a)** — add_entity ever-used-name draw-guard (+ eligibility mirror); the
    add→delete/rename→re-add tombstone-revival collision is undrawable within a sequence.
  - **D6** — `src/e4/substrate/prng.ts` twin-pinned. **D7** — v3 validator requires the P0-V
    sealed ids for version ≥ 0.6.
  Acceptance: facet suites extended/added in `test/e5-p0v-rig-repair.test.ts` (+ the gold-spec
  delete-then-re-add test now pins both derivation coherence and the guard); full suite green.
  Tier 4 (D1–D4, D9, D10, S3) remains open for the probe-design sessions.
