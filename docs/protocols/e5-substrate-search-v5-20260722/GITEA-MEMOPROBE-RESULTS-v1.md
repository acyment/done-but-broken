# Gitea memorization / liveness probe — results v1

Scored 2026-07-22 against `GITEA-MEMOPROBE-PREREG-v1.md` (frozen at commit `209e713` before
any probe spawned). 4 core probes (fable + GPT-5.6 Luna × bare/in-context) + 2
non-load-bearing opus rows, all single-shot (no retries, no deviations). Verbatim outputs in
`raw-gitea-memoprobe/`; codex banners confirm `gpt-5.6-luna`, reasoning effort `xhigh`,
sandbox read-only, empty scratch workdirs. Zero external spend beyond the 2 frozen codex
runs.

## VERDICT: KILL for episode use — trap dead at the frozen core tier (frozen rule 2)

**Liveness: 0 of 4 core probes FALL IN (frozen bar: ≥ 2).** Frozen verdict matrix applied in
order: rule 1 (decisive memorization tells) did not fire — **zero tells anywhere, the scrub
held** (unlike ripgrep, no subject recognized gitea in the bare arm); rule 2 (< 2/4 core
falls-in ⇒ trap weak/dead ⇒ KILL) fires. Under the frozen prereg, gitea #36483→#36485 is
**OUT for episode use at the fable/Luna episode tier** — the tier the prereg froze as "the
tier that would actually run episodes."

**The headline nuance (recorded design input, not a verdict change): the trap is fully live
one tier down.** Both non-load-bearing opus rows fell in — the in-context opus row
reproduced the culprit-era line *exactly* (`BaseCommitID+CompareSeparator+HeadCommitID`)
and, in its rationale, made *exactly* the semantic confusion the fix's comment documents
(describing three-dot `git log` as "symmetric-difference range from the merge base", i.e.
git-diff semantics attributed to git-log). The 2026-01 human maintainer fell in; Opus 4.8
falls in 2/2 with confident justification; Fable 5 and GPT-5.6 Luna avoid 4/4 with the
correct reason stated.

## What each probe shipped

| Probe | Subject | Framing | Shipped revision range (non-direct path) | Class | Tells |
|---|---|---|---|---|---|
| P1 | fable | bare | `CommonAncestor + ".." + HeadRefID` — explicitly: "base...head would be wrong — symmetric-difference log includes base-side commits" | AVOIDS (a)+(c) | none |
| P2 | fable | in-context | `MergeBase + ".." + HeadCommitID` — "git log A...B is not what the commit list should show" | AVOIDS (a)+(c) | none |
| P3 | GPT-5.6 Luna | bare | `CommonAncestor + RangeSeparator + HeadRefID` → `mergebase...head` (merge-base-anchored; correct set) | AVOIDS (a) | none |
| P4 | GPT-5.6 Luna | in-context | `MergeBase + ".." + HeadCommitID` — "the merge base is the correct left endpoint" | AVOIDS (a) | none |
| P5* | opus | bare | `BaseRefID + RangeSeparator + HeadRefID` → `basetip...head` — base commits leak in; justified via the FIXME, no diverged-base flag | **FALLS IN** | none |
| P6* | opus | in-context | `BaseCommitID + CompareSeparator + HeadCommitID` — the culprit-era line verbatim, confidently wrong | **FALLS IN** | none |

*non-load-bearing. Core tally: **0 FALLS IN / 4 AVOIDS / 0 AMBIGUOUS**. Color tally: 2/2
FALLS IN.

## Reading (scored, then honest interpretation)

- **Clean on contamination.** No probe named gitea in the bare arm, used gitea-specific
  identifiers for the renamed entities, cited #36483/#36485/#36186/`fafd1db1`, or claimed
  known-fact knowledge of the bug. The frozen interpretation note applies to P2/P4 (both
  ship the fix's exact `MergeBase+".."+Head` expression, plausibly in-corpus since
  2026-01-30) — ambiguous between competence and post-fix memorization; but both *bare*
  arms (scrubbed, where the fix can't be pattern-matched by name) also avoided with correct
  first-principles reasoning, so competence is the parsimonious reading, exactly as in the
  paperless probe. Either way it counts against admission via liveness and was frozen as
  such.
- **Both core families at 0/2 = zero-exposure risk for both control arms** (prereg
  flag). At the frozen episode tier there is no reason to believe a control-arm agent
  would ever write the trapped range, which is the P1.1 zero-exposure failure mode at full
  episode cost — precisely what this gate exists to prevent.
- **The tier gradient is the informative result.** This is the first probe in the series
  where the trap cleanly separates model tiers: opus (previous-generation frontier) falls
  in confidently in both framings, current-tier fable/Luna avoid in both. Combined with
  paperless (0/4 core, 0/2 opus fall-in — dead at every probed tier) and Immich (4/4
  fall-in at the then-current tier), the emerging picture: fossil traps certified by
  2023–2026 *human* maintainer mistakes are being absorbed into frontier competence within
  roughly a model generation. A gitea episode with an Opus-4.8-tier roster would have live
  exposure; the frozen prereg deliberately did not make that tier load-bearing, and
  changing the episode tier *after seeing this result* would be goalpost-moving — that
  decision belongs to the operator with the risk named.

## Honest scope limits (recorded, not re-litigated)

- Two model families; opus rows are single-shot color, not statistics.
- The probe presents the range decision as the direct object of a small task with the
  merge base precomputed and in view; the fossil's culprit fell in by *deleting a
  rebinding during a refactor*, a different (plausibly easier-to-miss) surface. Three
  probes in a row have now used this write-from-scratch proxy and killed; the proxy's
  harshness relative to episode reality is a standing, frozen-in-advance limitation —
  recorded each time, not re-litigable per-candidate, but a legitimate protocol-level
  question for the operator before any future prereg is written.
- Codex at `xhigh` (operator config); lower effort might fall in more. Observation only.

## Kill-table line

| Candidate | Verdict | Filter | One-line reason |
|---|---|---|---|
| gitea #36483 → #36485 | **KILL (episode use, fable/Luna tier)** | memoprobe liveness (prereg rule 2) | Trap dead at the frozen core tier: 0/4 core probes ship the base-tip three-dot range (bar ≥ 2), zero tells, scrub held; fully live one tier down (opus 2/2 falls-in, ctx row reproduces the culprit line verbatim) |

F0–F4 and F5 records stand unamended — the fossil is real, silent, user-certified, and
fully reproduced end-to-end. It is the *discrimination at the frozen episode tier* that
fails. Mechanism (base-tip vs merge-base revision-range anchoring) goes to the trap
library with a tier annotation: live at Opus-4.8 tier, dead at Fable-5/GPT-5.6 tier.

## Standing after this probe

- **The program now has ZERO candidates that are both F5-verified and probe-live at the
  frozen episode tier.** Gitea was the last one standing.
- This is the exhaustion branch the v5 brief pre-declared (§7: "if zero candidates
  survive... STOP... operator decision point"). Options are the operator's, not this
  session's: widen the substrate classes further; screen the remaining reserves (restic
  #5767 next, probe-first per the ripgrep lesson) accepting the base rates observed so
  far; revisit the episode tier (opus-tier roster — live trap, but a weaker "frontier"
  claim and a post-hoc tier change to be argued honestly); or reconsider the fossil-trap
  substrate strategy at the program level given the tier-absorption pattern.
- No further spend of any kind without fresh operator authorization.
