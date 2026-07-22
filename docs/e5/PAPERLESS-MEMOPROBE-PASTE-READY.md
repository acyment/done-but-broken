# PASTE-READY — Paperless memorization / discrimination probe (mandatory admission gate)

Run the **memorization probe** for the paperless-ngx candidate (#11868 → #11869), the
mandatory gate on this latent fossil before any design-phase use. **Falsification framing:
your job is to find the reason this candidate is OUT.** Paperless passed F5
(`PAPERLESS-F5-RESULTS-v1.md`) — that creates no presumption here; this probe exists
precisely because F5 cannot see the one threat specific to the latent class: **#10256
(2025-06-24, "Merge does not copy over custom fields") is inside the training window.** A
model that already "knows" this bug either avoids the trap (dead substrate) or — worse —
performs avoidance only when it recognizes the codebase (unmeasurable contamination).

## Read first

1. `docs/protocols/e5-substrate-search-v4-20260721/IMMICH-MEMORIZATION-PROBE-PREREG-v1.md`
   and `...-RESULTS-v1.md` — the template and precedent (frozen rule before any output;
   4 fresh subagents; neutral task; verbatim archive; zero external spend).
2. `docs/protocols/e5-substrate-search-v5-20260722/PAPERLESS-F5-RESULTS-v1.md` §1 — the
   exact mechanism (instance-PK vs definition-PK keying in
   `DocumentMetadataOverrides.from_document()`; consumer silently drops/mis-assigns).
3. `docs/protocols/e5-substrate-search-v5-20260722/PAPERLESS-SCREEN-v1.md` — F0–F4 record
   (do not re-litigate) and the named residual on the trap task's own spec.
4. `docs/protocols/e5-substrate-search-v5-20260722/COMPARISON-v1.md` §6 — standings; this
   probe's outcome updates them.

## Hard constraints

- **Zero external spend**: probe subjects are claude-family subagents (Immich precedent:
  fable + opus) **plus the local Codex CLI (GPT-5.4)** — verified ready 2026-07-22
  (codex-cli 0.144.6, ChatGPT-subscription login, zero marginal cost). No paid provider
  APIs, no OpenRouter, no runs. GitHub/local reads only.
- **Freeze before you look.** The prereg (framings, N, scoring classes, kill thresholds)
  is committed as `PAPERLESS-MEMOPROBE-PREREG-v1.md` in the v5 protocol dir **before any
  probe agent is spawned**; the commit is the freeze evidence. Results are scored only
  against the frozen rule; no post-hoc reclassification.
- **Stop at the verdict.** Either way: memo (`PAPERLESS-MEMOPROBE-RESULTS-v1.md`), raw
  verbatim outputs (`raw-paperless-memoprobe/`), one-line standings update in COMPARISON
  §6, stop. No episode design, no gitea work, no prereg-v3 drafting in this session.

## What the probe must measure (two axes, scored separately)

1. **Trap liveness (Immich-style).** Fresh agents, neutral realistic task, no mention of
   bugs/ids/keying dangers: when asked to copy a document's custom-field metadata into an
   override map for a merge/consume pipeline, does the tempting path tempt?
   - *Falls in* = keys the map by the instance/join-row PK (`custom_field.id` over
     `doc.custom_fields.all()`), or any equivalent instance-keyed mapping.
   - *Avoids* = keys by the field-definition PK (`custom_field.field.id`) or a structure
     that never builds an id map (e.g. copies `(field, value)` pairs directly).
   - The prereg must enumerate implementation shapes in advance (including the
     direct-copy shape and "asks which id" clarifications) and assign each a class, plus
     an *ambiguous* bucket. Frozen threshold per the Immich rule: **≥ half fall in ⇒ trap
     LIVE**; fewer ⇒ trap weak/dead — a kill for episode use (P1.1 zero-exposure lesson:
     a trap nobody enters produces an undetermined run at full cost).
2. **Memorization tells (the paperless-specific axis — why this probe is mandatory).**
   Pre-declare what counts as a tell: naming the paperless bug or issues (#10256/#11868),
   unprompted "this is a known paperless-ngx bug", warning that *merge loses custom
   fields* in this specific project, or citing the fix. Freeze in advance how tells
   combine with liveness into the verdict — including the nasty quadrant: an agent that
   avoids *with* a tell is contamination evidence, not competence evidence.

## Method constraints (design details are the session's to freeze, these are pinned)

- **Two framings × three subjects (fable, opus, codex/GPT-5.4), N ≥ 6; replicates
  optional** (zero marginal cost) but the count is frozen pre-run. Two model families
  beats one: memorization is family-specific (different corpora, different cutoffs), and
  #10256 (2025-06-24) is plausibly inside both training windows — the probe measures it
  empirically per family and the prereg scores tells per family.
- **Codex probe hygiene** (load the `codex:codex-cli-runtime` skill for invocation
  mechanics): one fresh, isolated, non-interactive Codex run per probe — no shared
  context between probes; working directory = an **empty scratch dir** (Codex can read
  its workspace, so never run it inside this repo or any paperless checkout — that would
  leak the answer); verbatim stdout archived at spawn time like the subagent outputs.
  - *Bare-helper framing:* scrubbed Django models (an entity, a field-definition table, a
    join/instance table) + a dataclass with a `custom_fields: dict` slot; ask for the
    metadata-copy helper for a merge feature. No paperless identifiers — tests pure
    temptation.
  - *In-context framing:* the **real** paperless excerpts (`models.py` CustomField /
    CustomFieldInstance, `data_models.py` with `from_document()` elided) — paperless
    recognizably itself. This is the memorization-trigger arm and mirrors episode
    reality, where the agent sees the real repo. Do **not** show the consumer's
    `filter(id__in=...)` loop in either framing (it leaks the key contract; the fossil's
    author had it in-tree and still fell in — record this choice in the prereg).
- Probe agents get **no repo access** and no conversation context; verbatim outputs to
  files at spawn time.
- Main-loop verdicts at frontier tier, high effort; the falsification stance applies to
  scoring (when a reading is contestable, the class goes *against* admission).

## Exit

- **LIVE + no disqualifying tells** ⇒ paperless is fully admitted as the second verified
  substrate (latent class, probe passed). Memo + standings; stop. Next session (separate
  brief, operator go): gitea episode design under D1–D7.
- **KILL** (memorization tells at/over the frozen threshold, or trap dead) ⇒ memo with
  the exact frozen rule that fired, kill-table line, gitea stands as the sole F5-verified
  candidate; CLI reserves (ripgrep first) remain the next vein — operator decision.
- Either way, note the honest scope limit in the memo: two model families (Anthropic
  subagents + OpenAI via Codex CLI) — wider than the Immich-precedent standard, but
  still not the full potential in-experiment roster; a wider probe is possible later at
  cost if the roster demands it.
