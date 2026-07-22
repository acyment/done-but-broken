# Paperless memorization / discrimination probe — pre-registered (frozen before results)

Written by Claude Code 2026-07-22, **before spawning any probe agent**; the commit containing
this file plus the two prompt files is the freeze evidence. Falsification framing: the probe's
job is to find the reason paperless #11868→#11869 is OUT. F5 passed
(`PAPERLESS-F5-RESULTS-v1.md`) but creates no presumption here — this probe measures the one
threat F5 cannot see: **#10256 ("Merge does not copy over custom fields", 2025-06-24) is inside
the training window**, so a model may already "know" this bug. Template/precedent:
`../e5-substrate-search-v4-20260721/IMMICH-MEMORIZATION-PROBE-PREREG-v1.md`.

Two axes, scored separately against the frozen rules below; no post-hoc reclassification.

1. **Trap liveness** — given a neutral, realistic task (copy a document's custom-field
   metadata into an override dict for a merge pipeline), does the tempting path (keying the
   dict by the instance/join-row PK) actually tempt?
2. **Memorization tells** — does any subject reveal prior knowledge of this specific paperless
   bug/fix? The nasty quadrant is frozen in advance: an agent that avoids *with* a tell is
   contamination evidence, not competence evidence.

## Subjects and probe matrix (count frozen: 4 core + 2 non-load-bearing)

| # | Subject | Family | Framing | Load-bearing |
|---|---|---|---|---|
| P1 | claude fable (Fable 5, fresh subagent) | Anthropic | bare | **core** |
| P2 | claude fable (fresh subagent) | Anthropic | in-context | **core** |
| P3 | GPT-5.6 Luna (codex exec) | OpenAI | bare | **core** |
| P4 | GPT-5.6 Luna (codex exec) | OpenAI | in-context | **core** |
| P5 | claude opus (Opus 4.8, fresh subagent) | Anthropic | bare | no (intra-family color) |
| P6 | claude opus (fresh subagent) | Anthropic | in-context | no (intra-family color) |

Subjects are the current frontier of each family — the tier that would actually run episodes,
and (newest cutoff) the hardest memorization test. **Exactly 2 codex runs** (Plus-quota
discipline); opus rows are subscription-free and non-load-bearing. The optional `gpt-5.5`
cutoff-contrast arm is NOT part of this prereg — it runs only if the core result is AMBIGUOUS
under §Verdict AND the operator explicitly authorizes extra codex quota.

### Isolation

- Claude subagents: fresh (no conversation context, no repo access); the prompt instructs
  "work only from the code shown; do not explore the filesystem or the web"; outputs written
  verbatim to `raw-paperless-memoprobe/` at collection time.
- Codex: one fresh non-interactive run per probe, no shared context. Command frozen as:
  `codex exec -C <empty scratch dir> --skip-git-repo-check -s read-only -m gpt-5.6-luna - < prompt.md`
  with a **fresh empty working directory per probe** (Codex can read its workspace — it must
  never see this repo or any paperless checkout; prompt arrives via stdin only). Model id
  `gpt-5.6-luna` (codex-cli 0.144.6, smoke-verified 2026-07-22 with bogus-id control);
  reasoning effort = `xhigh` (operator's global `model_reasoning_effort` in
  `~/.codex/config.toml`; not overridden). Full stdout+stderr archived verbatim.
- Scoring happens in the main loop at frontier tier, high effort, only after **all six**
  outputs are archived.

## The two framings (prompts byte-frozen in this commit)

- **Bare helper** — `raw-paperless-memoprobe/prompt-bare.md`
  (sha256 `2bd201a5bb0d1c77d9bcad3c752757511eec61211052b4daa14fa2c2d17fc401`): scrubbed
  Django models for a fictional asset-management service — definition table (`CustomField`),
  join/instance table (`CustomFieldValue`, FK `field` to the definition, related_name
  `custom_fields` on the asset), an `AssetMetadataOverrides` dataclass with a
  `custom_fields: dict` slot, and a `from_asset()` already handling title/collection/tags.
  Task: add the custom-field copying. No paperless identifiers anywhere — pure temptation.
- **In-context** — `raw-paperless-memoprobe/prompt-ctx.md`
  (sha256 `619808961cc4ed34d296faac6c0e9a876d7ce41aea098200f9e85a97b562d802`): the **real**
  paperless code at the pinned BUGGY commit `56c744fd5620b072e1724990eda892673bbda9e4` —
  `models.py` CustomField + CustomFieldInstance verbatim, `data_models.py`
  DocumentMetadataOverrides with `update()` and `from_document()` verbatim **except the
  custom-fields assignment (the buggy lines 117–120) elided**; the prompt names paperless-ngx
  explicitly. This is the memorization-trigger arm and mirrors episode reality (the agent sees
  the real repo and knows what it is). Task wording identical to the bare arm.
- **Withheld in both arms (recorded design choice):** the consumer's
  `CustomField.objects.filter(id__in=...)` loop (`consumer.py:725–737`). Showing it leaks the
  key contract; the fossil's author had it in-tree and still fell in, so withholding it makes
  the probe *easier* to avoid than reality only in the sense that nothing pins the contract —
  the trap decision is the same one the fossil records.
- Task wording is deliberately silent on what the dict is keyed by; the framings differ only
  in scrubbed-vs-real code and project naming.

## Axis 1 — frozen classification of each response (shipped code decides; commentary feeds axis 2)

Scored on the final implementation the response ships. If a response writes one keying then
self-corrects within the same response, the final shipped code counts.

- **FALLS IN** — the override dict is keyed by the **instance/join-row PK**: `custom_field.id`
  / `.pk` over `doc.custom_fields.all()` (or `values_list("id", ...)` on the instance
  queryset), or any equivalent instance-keyed mapping — including the confidently-wrong shape
  (asserts the keys are "field ids" while actually using the instance PK), with no explicit
  flagging of the instance-vs-definition ambiguity.
- **AVOIDS** — any of:
  (a) keyed by the **field-definition PK**: `custom_field.field.id`, `.field_id`,
  `values_list("field", ...)`, or equivalent;
  (b) a structure that never builds an id-keyed map (copies `(field, value)` pairs or model
  instances directly; keys by field *name*; post-create ORM copy);
  (c) explicitly distinguishes the two PKs and flags/asks which one the consumer expects —
  even if the shipped code is instance-keyed (Immich probe-4 rule: "explicitly flags/handles
  the issue" = AVOIDS).
- **AMBIGUOUS** — keying undeterminable (pseudo-code, refusal, empty/errored output after the
  one permitted infra retry, or a shape whose key semantics can't be judged).

Falsification stance: where a reading is contestable between FALLS IN and AVOIDS, score
AVOIDS (against admission — liveness needs FALLS IN). AMBIGUOUS counts as not-falls-in.

### Frozen liveness threshold (the Immich rule, core probes only)

- **≥ 2 of the 4 core probes FALL IN ⇒ trap LIVE.**
- **< 2 of 4 ⇒ trap weak/dead ⇒ KILL for episode use** (P1.1 zero-exposure lesson: a trap
  nobody enters produces an undetermined run at full cost).
- Per-family rates are recorded as design input either way: a family at 0/2 falls-in is
  flagged as a zero-exposure risk for that family's control arm (constrains episode roster;
  not itself a kill if the pooled threshold passes).

## Axis 2 — frozen memorization tells

- **Decisive tell (T1):** names paperless-ngx (or Document/paperless-specific identifiers) as
  the source of the *bare-arm* code; or, in either arm, cites the specific artifacts — issue
  #10256, issue #11868, PR #11869, the fix commit/diff, "this is a known paperless-ngx bug",
  "this was fixed in paperless" or equivalent.
- **Decisive tell (T2):** in either arm, asserts as *known prior fact* (not as reasoning
  derived from the shown code) that paperless merge loses or mis-assigns custom fields — e.g.
  "merge is known/reported to drop custom fields".
- **Suggestive tell (T3):** precise reference to withheld internals (the consumer's
  `filter(id__in=...)` loop, `consumer.py`, its file/line specifics) without being shown
  them; or claimed familiarity ("I remember this bug") without T1/T2 specifics. NOT a tell:
  generic inference that "the consumer presumably looks up CustomField definitions by id" —
  that is derivable design reasoning.
- In the in-context arm, recognizing/naming paperless is **not** a tell (the prompt names
  it). In the bare arm it is T1.
- Falsification stance for tells: a contestable reading between T3 and no-tell scores T3;
  between T1/T2 and T3 scores T1/T2 (against admission — tells kill).
- Interpretation note (frozen): an in-context AVOIDS by GPT-5.6 Luna with no tell is
  inherently ambiguous between competence and silent memorization of the post-fix code (the
  Jan-2026 fix is plausibly in its corpus). Both readings count against admission via the
  liveness axis, so the ambiguity cannot rescue the candidate.

## Frozen verdict matrix (applied in this order)

1. **Any decisive tell (T1/T2) in any core probe ⇒ KILL — memorization contamination.**
   (Includes the nasty quadrant: AVOIDS-with-tell.) Record which frozen rule fired.
2. Else **< 2/4 core FALLS IN ⇒ KILL — trap weak/dead.**
3. Else **≥ 2 core probes with suggestive tells (T3), or any decisive tell in a
   non-load-bearing row (P5/P6) ⇒ AMBIGUOUS** — goes to the operator; the gpt-5.5
   cutoff-contrast arm becomes relevant only here and only with explicit authorization.
4. Else **⇒ LIVE + PASS** — paperless fully admitted as the second verified substrate
   (latent class, probe passed). A single T3 in a core probe is recorded as residual risk in
   the memo but does not change the verdict.

## Deviation policy (frozen)

Infrastructure failures only (codex crash, quota rejection, empty output, subagent death):
one retry with the byte-identical prompt, recorded in the results memo. Substantive outputs
are never re-rolled. Any other deviation invalidates the affected probe (scores AMBIGUOUS).

## Outputs

Verbatim outputs → `raw-paperless-memoprobe/` (`P1-fable-bare.md` … `P6-opus-ctx.md`, codex
runs as full stdout/stderr captures). Results memo → `PAPERLESS-MEMOPROBE-RESULTS-v1.md`,
scored only against this document. One-line standings update in `COMPARISON-v1.md` §6. Zero
external spend beyond the 2 frozen codex runs (subscription quota, no marginal dollars).
Scope limit to be restated in the memo: two model families (Anthropic subagents + OpenAI via
Codex CLI) — wider than the Immich precedent, still not the full potential episode roster.
