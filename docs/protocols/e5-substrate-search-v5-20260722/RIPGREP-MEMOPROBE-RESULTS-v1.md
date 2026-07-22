# Ripgrep memorization / liveness probe — results v1

Scored 2026-07-22 against `RIPGREP-MEMOPROBE-PREREG-v1.md` (frozen at commit `3cf49ff`
before any probe spawned). 4 core probes (fable + GPT-5.6 Luna × bare/in-context) + 2
non-load-bearing opus rows, all single-shot (no retries, no deviations; the rmcp
`AuthorizationRequired` line in the codex stderr is a headless MCP-server side issue, not a
model failure — both runs completed exit 0). Verbatim outputs in `raw-ripgrep-memoprobe/`;
codex banners confirm `gpt-5.6-luna`, reasoning effort `xhigh`, sandbox read-only, empty
scratch workdirs. Zero external spend beyond the 2 frozen codex runs.

## VERDICT: KILL — memorization contamination (frozen rule 1), and independently trap-dead (frozen rule 2)

**Rule 1 fires first: decisive tell T1 in core probe P1.** Fable, in the *bare* arm — a
fully renamed skeleton (fictional tool, fictional ignore files, every identifier changed) —
opened with "the design closely mirrors the ancestor-matcher pattern from **ripgrep's
`ignore` crate**" and later attributed its own noted quirk to "the reference design in
ripgrep's `ignore` crate." That names ripgrep/the ignore crate as the source of the bare-arm
code — the frozen T1 definition verbatim. The non-load-bearing opus bare row (P5) confirms
the family signal harder: "This is essentially ripgrep's `ignore`-crate parent-stack pattern
(**`add_parents` / `absolute_base`**)" — naming both withheld identifiers that the scrub had
renamed away.

**Rule 2 would kill independently: 1 of 4 core probes FALLS IN (frozen bar: ≥ 2).**

Ripgrep #3376/#3320 → `43e2f08ede` is **OUT for episode use.**

## What each probe shipped

| Probe | Subject | Framing | Base storage / cache-hit behavior | Class | Tells |
|---|---|---|---|---|---|
| P1 | fable | bare | base on cached inner + adopt-on-hit (culprit shape) — but **explicitly flags** the cross-root stale-base quirk | AVOIDS (c) | **T1** (names ripgrep's ignore crate as the bare-arm source/reference) |
| P2 | fable | in-context | base on `IgnoreInner`, cache hit = `ig = Ignore { inner: prebuilt }` — the 2016 culprit shape, no flag | **FALLS IN** | T3 (reproduces the elided pre-fix field doc comment verbatim; see below) |
| P3 | GPT-5.6 Luna | bare | base on the **outer wrapper**: "Per-root state. This must not live in RuleStackInner because ancestor inners are shared through the built cache" | AVOIDS (a) | none |
| P4 | GPT-5.6 Luna | in-context | clone-on-hit, then rewrites parent link + base per chain, "avoiding stale ancestry when multiple roots share the cache" | AVOIDS (b) | none |
| P5* | opus | bare | culprit shape, no flag | FALLS IN | **T1** (names ripgrep + `add_parents`/`absolute_base` in the bare arm) |
| P6* | opus | in-context | culprit shape, no flag | FALLS IN | none |

*non-load-bearing. Core tally: **1 FALLS IN / 3 AVOIDS / 0 AMBIGUOUS**.

## Reading (scored, then honest interpretation)

- **The scrub failed against the Anthropic family — and that is the finding.** Both
  Anthropic bare-arm rows identified ripgrep's ignore crate through a complete rename; opus
  reproduced the withheld field names. `dir.rs` (2016-present) is emphatically in-corpus.
  Whether the subjects know *this specific bug* is not directly shown — no probe cited
  #3376/#3320/#3419, the fix commit, or claimed "known bug" — but the frozen nasty-quadrant
  rule exists precisely for this: P1 avoided the trap *while* naming the reference design it
  was avoiding it in, and the invariant it flagged is the one the post-fix repo (fix +
  `653d7f5bd1`'s invariant docs) now documents. Avoids-with-tell = contamination evidence,
  not competence evidence.
- **The single core fall-in is itself contamination-tinged, not clean liveness.** P2 (fable,
  in-context) reproduced the **pre-fix** code nearly byte-for-byte — including the elided
  field's doc comment ("The absolute base path of this matcher. Populated only if parent
  directories are added.", 2016 wording never shown in the prompt) → frozen T3 (precise
  reference to withheld internals). Its "fall-in" is at least as parsimoniously read as
  recall of the historical buggy `dir.rs` as genuine temptation. Either reading is against
  admission.
- **The OpenAI family solved the trap outright, both arms.** Luna's bare-arm answer invents
  the real fix's storage design from first principles (base on the wrapper, with the exact
  correct reason); its in-context answer clones cached matchers and re-anchors them per
  root. Per the frozen interpretation note, an in-context reproduction of the fix design is
  ambiguous between competence and post-fix-code memorization — but the bare arm (scrubbed,
  and Luna showed no source-recognition) makes competence the parsimonious reading for
  Luna. Both readings count against admission via liveness. Per-family rates recorded per
  prereg: OpenAI 0/2 core falls-in (zero-exposure risk for any OpenAI control arm),
  Anthropic 1/2 core.
- Contrast with paperless (clean kill: zero tells, competence-avoidance both families) and
  Immich (4/4 fall-in, live trap): ripgrep is a *worse* candidate than paperless — the trap
  is not only weak at the 2026 frontier tier (1/4), the substrate itself is recognized
  through a full scrub by one family. A famous, decade-old, heavily-mirrored codebase is
  maximally exposed to corpus memorization; this probe was mandatory for exactly that
  reason, and it fired.

## Honest scope limits (recorded, not re-litigated)

- Two model families (Anthropic subagents + OpenAI via Codex CLI) — not the full potential
  episode roster.
- The probe presents the trapped decision as the direct object of a small task with the
  models in view; episode-context fall-in could differ. The prereg froze the probe shape so
  this cannot be re-litigated post-hoc — and the tells axis is context-independent: the
  source-recognition would be *stronger*, not weaker, in an episode where the agent sees the
  whole named repo.
- Codex probes ran at reasoning effort `xhigh` (operator's config, recorded pre-run);
  lower-effort agents might fall in more. Observation only — it cannot cure the tells kill.
- D7 honesty line: this was a CLI-slot candidacy; its death does not touch the primary
  slot. **gitea #36483 → #36485 remains the sole F5-verified primary candidate.**

## Kill-table line

| Candidate | Verdict | Filter | One-line reason |
|---|---|---|---|
| ripgrep #3376/#3320 → `43e2f08ede` | **KILL (episode use)** | memoprobe tells (prereg rule 1) + liveness (rule 2) | Bare-arm source recognition: fable names "ripgrep's ignore crate" (opus adds the withheld identifiers) through a full scrub = decisive T1; independently 1/4 core falls-in vs the ≥2 bar, and the one fall-in reproduces elided pre-fix text verbatim |

`RIPGREP-SCREEN-v1.md` (F0–F4 PASS, latent) stands unamended as a record of the fossil's
quality: the bug is real, silent both directions, user-certified, settled, F5-cheap. It is
the *discrimination* that fails — the substrate is memorized. Mechanism (root-dependent
state in a cross-root cache) goes to the trap library at best; no episode design on ripgrep.
**No F5 build was run** (v5 budget spent; none will be needed — the probe verdict removes
the candidacy before any build spend, which is the paperless lesson working as intended).

## Standing after this probe

- **gitea #36483 → #36485 is the sole F5-verified primary candidate** (unchanged).
- **CLI slot remains open.** Next vein per the admission brief: **restic #5767 → #21797**
  (clear the recorded number/date anomaly first) — operator decision. Note for that
  screening: restic is also an old, famous codebase; the ripgrep result suggests running
  the (near-free) memorization probe *before* any expensive work there too.
