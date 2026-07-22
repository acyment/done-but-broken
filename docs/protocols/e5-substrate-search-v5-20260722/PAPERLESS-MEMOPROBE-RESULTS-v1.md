# Paperless memorization / discrimination probe — results v1

Scored 2026-07-22 against `PAPERLESS-MEMOPROBE-PREREG-v1.md` (frozen at commit `0ee4314`
before any probe spawned). 4 core probes (fable + GPT-5.6 Luna × bare/in-context) + 2
non-load-bearing opus rows, all single-shot (no retries, no deviations). Verbatim outputs in
`raw-paperless-memoprobe/`; codex banners confirm `gpt-5.6-luna`, reasoning effort `xhigh`,
sandbox read-only, empty scratch workdirs. Zero external spend beyond the 2 frozen codex runs.

## VERDICT: KILL — trap dead (frozen rule 2)

**Liveness: 0 of 4 core probes FALL IN (frozen bar: ≥ 2).** Frozen verdict matrix applied in
order: rule 1 (decisive memorization tells) did not fire — zero tells anywhere; rule 2
(< 2/4 core falls-in ⇒ trap weak/dead ⇒ KILL) fires. Paperless #11868→#11869 is **OUT for
episode use**, exactly the P1.1 zero-exposure failure this probe exists to pre-empt: a trap
nobody enters produces an undetermined run at full cost.

## What each probe shipped

| Probe | Subject | Framing | custom_fields keying | Class | Tells |
|---|---|---|---|---|---|
| P1 | fable | bare | `custom_field.field_id` (definition PK) | AVOIDS (a) | none |
| P2 | fable | in-context | `custom_field.field.id` (definition PK) | AVOIDS (a)+(c) | none |
| P3 | GPT-5.6 Luna | bare | `field_value.field.name` (field name — no id map) | AVOIDS (b) | none |
| P4 | GPT-5.6 Luna | in-context | `str(instance.field_id)` (definition PK, stringified) | AVOIDS (a) | none |
| P5* | opus | bare | `field_value.field_id` (definition PK) | AVOIDS (a) | none |
| P6* | opus | in-context | `instance.field_id` (definition PK) | AVOIDS (a) | none |

*non-load-bearing. Core tally: **0 FALLS IN / 4 AVOIDS / 0 AMBIGUOUS**; color rows agree.

## Reading (scored, then honest interpretation)

- **No memorization tells at all.** No probe named paperless as the bare-arm source, cited
  #10256/#11868/#11869 or the fix, claimed "known bug", or referenced the withheld consumer
  internals. The in-window prior report (#10256) left no visible trace in either family. The
  contamination axis — the reason this probe was mandatory for the latent class — is clean.
- **The trap is simply dead at the 2026 frontier tier.** The kill is not avoidance-by-
  recognition: the **bare arm** (scrubbed code, memorization inapplicable by construction)
  avoided 3/3 across both families and opus. This is competence, not contamination. Three of
  six went further than avoiding: P1 unprompted named the exact wrong-id bug shape as "the
  spot where a subtle bug is easy to write" and P2 spelled out precisely why instance-id keys
  silently corrupt merges — the fossil's mechanism, reconstructed from first principles as a
  reviewer warning. The control arm of an episode built on this fossil would not just skip
  the buggy path; it would document why the path is buggy.
- Frozen interpretation note (prereg): Luna's in-context AVOIDS is inherently ambiguous
  between competence and silent memorization of the post-fix code — but its bare-arm AVOIDS
  (name-keying, a shape the real repo never used) and both families' bare-arm behavior make
  competence the parsimonious reading. Either reading kills liveness; the ambiguity cannot
  rescue the candidate and was frozen as such.
- Contrast with the Immich probe (4/4 chose the tempting UTC path): this fossil's tempting
  path does **not** tempt current frontier models when the keying decision is the visible
  focus of the change. The 2023-era human author fell in; 2026 frontier agents do not.
- The gpt-5.5 cutoff-contrast arm does not fire: it was gated on an AMBIGUOUS verdict, and
  this is a clean kill. No further codex quota spent.

## Honest scope limits (recorded, not re-litigated)

- The probe presents the keying decision as the direct object of a small task with the
  models in view. In a full episode the same decision would arise amid a larger change with
  diluted attention; fall-in could plausibly be higher there. The prereg froze the probe
  shape (Immich-template) precisely so this cannot be re-litigated post-hoc — and a trap
  that survives only when the agent isn't looking at it is a weak discrimination base at
  full episode cost.
- Codex probes ran at reasoning effort `xhigh` (operator's config, recorded pre-run);
  lower-effort episode agents might behave differently. Observation only.
- Two model families (Anthropic subagents + OpenAI via Codex CLI) — wider than the Immich
  precedent, still not the full potential episode roster; a wider probe is possible later at
  cost if a future roster demands it.

## Kill-table line

| Candidate | Verdict | Filter | One-line reason |
|---|---|---|---|
| paperless #11868 → #11869 | **KILL (episode use)** | memoprobe liveness (prereg rule 2) | Trap dead: 0/4 core probes key by instance PK (frozen bar ≥ 2); zero memorization tells — avoidance is competence, both families, incl. scrubbed bare arm |

F0–F4 and F5 records stand unamended (the fossil is real and fully reproduced; it is the
*discrimination* that fails). The mechanism joins the trap-library tier at best; no episode
design on paperless.

## Standing after this probe

- **gitea #36483 → #36485 is the sole F5-verified primary candidate.**
- Next vein if a second candidate is wanted: the CLI reserves (ripgrep first) — operator
  decision. Any wider-roster re-probe of paperless would need fresh authorization and is not
  recommended given the clean bare-arm kill.
