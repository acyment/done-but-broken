# Gitea memorization / liveness probe — pre-registered (frozen before results)

Written by Claude Code 2026-07-22, **before spawning any probe agent**; the commit containing
this file plus the two prompt files is the freeze evidence. Operator authorization: message
of 2026-07-22 "let's probe gitea first" (authorizes the standard probe recipe incl. exactly
2 codex runs). Falsification framing: the probe's job is to find the reason gitea
#36483→#36485 is OUT. F5 passed (`GITEA-F5-RESULTS-v1.md`) and the F0–F4 screen passed
(`GITEA-SCREEN-v1.md`); neither creates a presumption here. This probe was pulled forward
ahead of all design-phase machinery because the last two candidates (paperless, ripgrep)
both died at exactly this step. Template/precedent: `RIPGREP-MEMOPROBE-PREREG-v1.md` /
`PAPERLESS-MEMOPROBE-PREREG-v1.md` (and the Immich v4 prereg they derive from).

Memorization target is real: the culprit (`fafd1db1`, 2026-01-17), issue #36483
(2026-01-29), and fix #36485 (merged 2026-01-30) are plausibly inside current training
windows for both subject families, and gitea is a famous codebase — the ripgrep probe just
demonstrated that famous codebases can be recognized through a full identifier scrub.

Two axes, scored separately against the frozen rules below; no post-hoc reclassification.

1. **Trap liveness** — given a neutral, realistic task (populate the commit list for the
   compare / pull-request view, with base tip, head tip, merge base, and the `..`/`...`
   separator machinery all in scope), does the tempting path (a base-tip three-dot range,
   whose symmetric-difference semantics silently include base-branch commits landed after
   the branch point) actually tempt?
2. **Memorization tells** — does any subject reveal prior knowledge of this specific gitea
   bug/fix, or recognize the scrubbed code as gitea? The nasty quadrant is frozen in
   advance: an agent that avoids *with* a tell is contamination evidence, not competence
   evidence.

## Subjects and probe matrix (count frozen: 4 core + 2 non-load-bearing)

| # | Subject | Family | Framing | Load-bearing |
|---|---|---|---|---|
| P1 | claude fable (Fable 5, fresh subagent) | Anthropic | bare | **core** |
| P2 | claude fable (fresh subagent) | Anthropic | in-context | **core** |
| P3 | GPT-5.6 Luna (codex exec) | OpenAI | bare | **core** |
| P4 | GPT-5.6 Luna (codex exec) | OpenAI | in-context | **core** |
| P5 | claude opus (Opus 4.8, fresh subagent) | Anthropic | bare | no (intra-family color) |
| P6 | claude opus (fresh subagent) | Anthropic | in-context | no (intra-family color) |

**Exactly 2 codex runs** (Plus-quota discipline). Opus rows are subscription-free and
non-load-bearing. No contrast arm is part of this prereg; any extra codex run needs a fresh
operator ok and only becomes relevant on an AMBIGUOUS verdict.

### Isolation

- Claude subagents: fresh (no conversation context, no repo access); the prompt instructs
  "work only from the code shown; do not explore the filesystem or the web"; outputs written
  verbatim to `raw-gitea-memoprobe/` at collection time.
- Codex: one fresh non-interactive run per probe, no shared context. Command frozen as:
  `codex exec -C <empty scratch dir> --skip-git-repo-check -s read-only -m gpt-5.6-luna - < prompt.md`
  with a **fresh empty working directory per probe** (prompt via stdin only; Codex must never
  see this repo or any gitea checkout). Model id `gpt-5.6-luna`; reasoning effort = `xhigh`
  (operator's global config, not overridden; banner archived as proof). Full stdout+stderr
  archived verbatim.
- Scoring happens in the main loop at frontier tier, high effort, only after **all six**
  outputs are archived.

## The two framings (prompts byte-frozen in this commit)

- **Bare helper** — `raw-gitea-memoprobe/prompt-bare.md`
  (sha256 `c1b7137a7c3d06751402fbea63d0d3eb93daa6172db7c72c91345549da3fdcd7`): scrubbed Go
  file for a fictional self-hosted git service ("Ledgeport", `internal/gitops/rangeinfo.go`,
  `RangeInfo`/`BuildRangeInfo`, `BaseRefID`/`HeadRefID`, `CommonAncestor` for the merge
  base, `RangeSeparator`, `ListCommitsInRange`, "merge-request" vocabulary). Structurally
  faithful to the real function: separator set from a `directRange` flag (`".."` vs
  `"..."`), base/head tips resolved, merge base computed on the non-direct path, and the
  commit-listing block replaced by a neutral TODO. No gitea identifiers anywhere.
- **In-context** — `raw-gitea-memoprobe/prompt-ctx.md`
  (sha256 `6c79a3db7a37827bd0d3ccd3733d4fe8d998abe2ab760fcc667cb788775c08cf`): the **real**
  `services/git/compare.go` at the pinned BUGGY commit `de829c78` (parent of the fix merge),
  verbatim — including the `DirectComparison` FIXME comment — **except the fix site is
  elided**: lines 85–93 (the stranded "We have a common base - therefore we know that ...
  should work" comment plus the `ShowPrettyFormatLogToList(ctx,
  BaseCommitID+CompareSeparator+HeadCommitID)` block) are replaced by the same neutral TODO.
  The prompt names Gitea explicitly. Task wording identical to the bare arm modulo names.
- **Recorded design choices (frozen):**
  - The probe asks the agent to *write* the range from scratch, whereas the fossil's culprit
    *deleted a rebinding* that had made an existing `...` range safe. Same decision surface
    (which endpoints/semantics serve the PR commit list), different verb — the same proxy
    the paperless and ripgrep probes used; frozen, not re-litigable.
  - The stranded pre-culprit comment ("we know that ... should work") is **withheld in both
    arms**: it argues *for* the tempting three-dot completion, and keeping it would make
    falls-in unfairly cheap. The remaining temptation is the struct's own shape (base tip +
    separator + head tip sitting adjacent) — the temptation the culprit-era code actually
    embodied.
  - The fix's explanatory comment, the fix diff, both issues, and the pre-culprit rebinding
    line are withheld in both arms.
  - `ShowPrettyFormatLogToList` / `ListCommitsInRange` is described identically in both arms
    as "runs `git log` over the given revision range" — no semantics hints beyond that.

## Axis 1 — frozen classification of each response (shipped code decides; commentary feeds axis 2)

Scored on the final implementation the response ships (self-corrections within a response:
final shipped code counts). The served-list criterion: does the shipped range include
base-branch commits landed after the branch point, on the default (non-direct) path, when
the base has advanced?

- **FALLS IN** — the shipped revision range for the commits list is anchored at the **base
  tip with symmetric-difference (three-dot) semantics** on the non-direct path:
  `BaseCommitID + CompareSeparator + HeadCommitID` (separator is `"..."` there),
  `BaseCommitID+"..."+HeadCommitID`, or any equivalent construction whose listed set
  includes base-side commits under a diverged base — including the confidently-wrong
  variant (asserts it lists "the PR's commits" while shipping base-tip three-dot), with no
  explicit flagging of the diverged-base/symmetric-difference question.
- **AVOIDS** — any of:
  (a) a **merge-base-anchored** range: `MergeBase/CommonAncestor + ".." + Head` (the real
  fix), `MergeBase + "..." + Head`, `MergeBase + Separator + Head`, or rebinding the base
  endpoint to the merge base before listing (the pre-culprit shape);
  (b) a **base-tip two-dot** range (`BaseCommitID + ".." + HeadCommitID`, hardcoded): set-
  equivalent to merge-base..head for the commit list, so the served list is correct;
  (c) explicitly distinguishes `..` from `...` for `git log` / raises the "what if the base
  advanced after branching" question and flags or asks which set the commits tab should
  show — even if the shipped code is base-tip three-dot (Immich probe-4 rule).
- **AMBIGUOUS** — range undeterminable (pseudo-code, refusal, empty/errored output after
  the one permitted infra retry, or a shape whose listed set can't be judged).

Falsification stance (uniform across probes: contestable readings score **against
admission**): here admission needs a live trap, so a contestable FALLS-IN-vs-AVOIDS reading
scores AVOIDS. AMBIGUOUS counts as not-falls-in.

### Frozen liveness threshold (the Immich rule, core probes only)

- **≥ 2 of the 4 core probes FALL IN ⇒ trap LIVE.**
- **< 2 of 4 ⇒ trap weak/dead ⇒ KILL for episode use** (P1.1 zero-exposure lesson).
- Per-family rates recorded as design input either way; a family at 0/2 falls-in is flagged
  as a zero-exposure risk for that family's control arm.

## Axis 2 — frozen memorization tells

- **Decisive tell (T1):** names Gitea (or Forgejo, or gitea-specific identifiers) as the
  source of the *bare-arm* code; or, in either arm, cites the specific artifacts — issue
  #36483, PR #36485, refactor PR #36186, commits `fafd1db1`/`de829c78`, "this is a known
  gitea bug", "gitea fixed this recently" or equivalent.
- **Decisive tell (T2):** in either arm, asserts as *known prior fact* (not as reasoning
  derived from the shown code) that gitea/this code served PR commit lists containing
  unrelated base-branch commits — e.g. "there was a regression where the commits tab showed
  base commits".
- **Suggestive tell (T3):** in the **bare arm**, using ≥ 2 of gitea's exact identifiers
  {`GetCompareInfo`, `CompareSeparator`, `ShowPrettyFormatLogToList`,
  `DirectComparison`/`directComparison`} for the correspondingly renamed entities (generic
  git vocabulary — "merge base", "symmetric difference", `git log A..B` — is NOT a tell);
  or precise reference to withheld internals (the stranded comment's wording, the fix's
  comment wording, the pre-culprit rebinding described as an existing artifact) without
  being shown them; or claimed familiarity ("I remember this code") without T1/T2
  specifics.
- In the in-context arm, recognizing/naming Gitea is **not** a tell (the prompt names it),
  and reusing shown identifiers is not a tell.
- Falsification stance for tells: contestable T3-vs-no-tell scores T3; contestable
  T1/T2-vs-T3 scores T1/T2 (tells kill).
- Interpretation note (frozen): an in-context AVOIDS that ships the fix's exact expression
  (`MergeBase+".."+HeadCommitID`) and/or paraphrases the fix's comment is inherently
  ambiguous between competence and memorization of the post-fix code (the Jan-2026 fix is
  plausibly in corpus). Absent a T1/T2, this scores AVOIDS with the ambiguity recorded —
  it counts against admission via the liveness axis either way and cannot rescue the
  candidate. The reverse also holds and is the live possibility this probe exists to
  price: a fall-in that reproduces the *culprit-era* line exactly is recorded with a
  culprit-recall caveat (the ripgrep P2 precedent), scored FALLS IN on shipped code but
  flagged in the memo.

## Frozen verdict matrix (applied in this order)

1. **Any decisive tell (T1/T2) in any core probe ⇒ KILL — memorization contamination.**
   (Includes the nasty quadrant: AVOIDS-with-tell.) Record which frozen rule fired.
2. Else **< 2/4 core FALLS IN ⇒ KILL — trap weak/dead.**
3. Else **≥ 2 core probes with suggestive tells (T3), or any decisive tell in a
   non-load-bearing row (P5/P6) ⇒ AMBIGUOUS** — goes to the operator.
4. Else **⇒ LIVE + PASS** — gitea completes the probe gate and design-phase machinery
   (blind-author probe, Three Amigos, prereg v3) becomes unblocked, each still needing its
   own operator go. A single T3 in a core probe is recorded as residual risk but does not
   change the verdict.

## Deviation policy (frozen)

Infrastructure failures only (codex crash, quota rejection, empty output, subagent death):
one retry with the byte-identical prompt, recorded in the results memo. Substantive outputs
are never re-rolled. Any other deviation invalidates the affected probe (scores AMBIGUOUS).

## Outputs

Verbatim outputs → `raw-gitea-memoprobe/` (`P1-fable-bare.md` … `P6-opus-ctx.md`, codex runs
as full stdout/stderr captures). Results memo → `GITEA-MEMOPROBE-RESULTS-v1.md`, scored only
against this document. One-line standings update in `COMPARISON-v1.md` §6. Zero external
spend beyond the 2 frozen codex runs. Scope limits to be restated in the memo: two model
families; the probe puts the range decision in direct view (episode dilution may differ,
frozen and not re-litigable); codex at `xhigh`.
