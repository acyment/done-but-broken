# E5 ripgrep admission brief v1 — screen + probe (NO build session)

Paste-ready prompt for a fresh session (Fable 5, high effort). Written 2026-07-22 after the
paperless memorization-probe KILL (`7d6ca86`). Operator authorization to run this brief =
pasting it.

---

Run the **admission pipeline** for the top CLI reserve: **ripgrep #3376/#3320 → fix
`43e2f08ede`** (BurntSushi/ripgrep). **Falsification framing: your job is to find the reason
this candidate is OUT.** Scope: F0 re-anchor, culprit dating, F1–F4 screen, and the
liveness/memorization probe. **NO F5 build in this session** — the v5 at-most-two-F5 budget
is spent; a ripgrep build session needs fresh explicit authorization after the probe verdict.

**Order is pinned cheapest-kill-first, and the probe comes BEFORE any build.** Lesson from
paperless (2026-07-22): it passed the full end-to-end build verification, then died at the
nearly-free probe — 0/4 core probes entered the trap. Do not repeat that inversion.

## Read first

1. `docs/protocols/e5-substrate-search-v5-20260722/COMPARISON-v1.md` — kill table line 30
   (ripgrep), §2 (the scout misattributed the fix; main-loop F0 already corrected: real fix
   = `43e2f08ede`, 2026-06-04, the earlier commit was the test commit), §4 CLI-slot
   standings, §6 current standings (gitea = sole service primary).
2. `docs/protocols/e5-substrate-search-v5-20260722/HARVEST-CLI-RAW.md` — the harvest record
   for ripgrep (treat as leads, not facts; re-resolve everything load-bearing).
3. `docs/protocols/e5-substrate-search-v5-20260722/PAPERLESS-MEMOPROBE-PREREG-v1.md` and
   `...-RESULTS-v1.md` — the probe template AND the kill precedent (two axes: trap liveness
   ≥ half core falls-in per the Immich rule; memorization tells frozen in advance; frozen
   prereg committed before any probe spawn; verbatim archives; falsification scoring).
4. `docs/e5/E5-SUBSTRATE-SEARCH-V5-BRIEF-v1.md` §2–§3 — profile `path-survival` trap
   properties (D2 certified-silent-user-meaningful, D3 shape, F0–F4 definitions) and filter
   order. The 2026-01-01 recency bar applies.

## Hard constraints

- **Zero external spend.** GitHub reads (`gh`), local git clone of ripgrep, local `cargo`
  only if needed for dating sanity — no model-provider APIs, no OpenRouter, no runs.
  Claude-family subagents are subscription-covered — replicate freely. **Codex = exactly 2
  runs max** (GPT-5.6 Luna, `codex exec -m gpt-5.6-luna`, empty scratch dir per probe, never
  inside this repo or any ripgrep checkout, verbatim stdout+stderr archived; record model id
  + reasoning effort in the prereg). Pasting this brief authorizes those 2 runs; any more
  (replicates, contrast arms) needs a fresh operator ok.
- **Freeze before you look.** The probe prereg (`RIPGREP-MEMOPROBE-PREREG-v1.md`, v5
  protocol dir) is committed **before any probe agent is spawned**; the commit is the freeze
  evidence. Probe agents get no repo access and no conversation context.
- **Main-loop discipline.** Every load-bearing repo/issue/commit fact re-resolved in the
  main loop; verdicts at frontier tier, high effort; contestable readings score **against
  admission**. Preserve run/candidate classifications; no overclaiming.
- **Stop at the verdict.** Deliverables: `RIPGREP-SCREEN-v1.md`, probe prereg + results +
  `raw-ripgrep-memoprobe/`, one-line standings update in COMPARISON §6, stop. No F5 build,
  no episode design, no gitea work.

## Stage 1 — F0 re-anchor + culprit dating (the known first task)

- Resolve #3376 and #3320 (user-filed twice — verify author associations), the fix commit
  `43e2f08ede` (2026-06-04) and its tests; read the full diff. Confirm the mechanism the
  harvest recorded: ignored files **silently included** when searching **multiple roots**
  (core-contract pin: "ignored files never appear"), fault in parent-matcher caching.
- **Date the culprit** (git blame/log on the caching code the fix touches). This decides the
  class: culprit in-window ⇒ strict pair; culprit pre-2026 ⇒ **latent shape** — admissible
  only under the v4 pre-declared fallback (already fired), probe mandatory (it is mandatory
  in this brief regardless). If the culprit cannot be pinned cheaply, record that honestly
  as a demerit, not a blocker.
- Kill triggers here: fix not settled (later sibling fixes), wrongness not silent, not
  user-discovered, contract contestable (was the multi-root ignore behavior ever actually
  established, or born broken? — D3 check).

## Stage 2 — F1–F4 screen → `RIPGREP-SCREEN-v1.md`

Per the v5 filter definitions, falsification-framed, one verdict per filter with evidence.
Record explicitly:

- **D7 honesty line:** ripgrep is CLI-surface. Passing fills the **CLI slot** (D7's eventual
  pairing), NOT the service-shaped primary slot — gitea remains the sole service primary
  either way. Say so in the screen doc and the standings update.
- §2.5 exposure-precondition sketch: what event during a trap task = trap entry (the
  agent's implementation drops/reuses ignore matchers across roots so ignored files leak
  into results), base-rate source, surface check (deterministic CLI invocation on a seeded
  multi-root fixture with `.gitignore`s — loop trivially <60 s at run time; note cargo
  build cost separately, per the F5-cost convention).

## Stage 3 — liveness/memorization probe (the gate; frozen prereg first)

Template = paperless prereg, adapted to this mechanism by the session (the exact framings
depend on Stage 1's read of the fix diff — design them there, then freeze):

- **Two framings × two subjects (fable, GPT-5.6 Luna) = 4 core probes**, plus optional
  free non-load-bearing claude rows if frozen pre-run. Bare framing = scrubbed skeleton of
  the matcher-caching decision (no ripgrep identifiers); in-context framing = the real
  ripgrep code at the pre-fix checkout with the fix site elided, project named — the
  memorization-trigger arm. Neutral task wording; nothing that hints at bugs, ignore-leaks,
  or caching dangers. Enumerate implementation shapes in advance (falls-in / avoids /
  ambiguous, including asks-for-clarification), freeze the Immich threshold (**≥ half of 4
  core fall in ⇒ LIVE; fewer ⇒ KILL**), and freeze the tells axis (naming ripgrep in the
  bare arm, citing #3376/#3320/the fix, "known bug" claims = decisive ⇒ KILL; the
  avoids-with-tell quadrant = contamination, not competence).
- Memorization target is real: the fix (2026-06-04) and both issues are plausibly inside
  current training windows; per-family tells scored separately.
- Verbatim outputs archived at collection; score only after all outputs are in.

## Exit

- **Probe LIVE + no disqualifying tells + screen PASS** ⇒ ripgrep is the verified CLI-slot
  candidate, pending its (separately authorized) F5-style build verification. Memo +
  standings; stop.
- **Any KILL** (screen filter, dead trap, or tells) ⇒ kill-table line with the exact rule
  that fired; the CLI vein continues at restic #5767 (clear the recorded number/date
  anomaly first) — operator decision. Gitea remains the sole verified primary throughout.
- Either way, restate the honest scope limits (two model families; probe puts the decision
  in focus; CLI-slot-not-primary).
