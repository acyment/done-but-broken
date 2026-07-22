# Gitea #36483 → #36485 — F0–F4 screen (SURVIVOR #1, F5 nominee)

Screened 2026-07-22 in the main loop, falsification-framed, per
`E5-SUBSTRATE-SEARCH-V5-BRIEF-v1.md` §3. All facts below observed directly via `gh` this
session (lead originated from the service-harvest subagent; every load-bearing fact
re-resolved in the main loop).

## The fossil

- **Culprit:** `fafd1db1` "Some refactors about GetMergeBase (#36186)", authored
  **2026-01-17**. In `services/git/compare.go` the refactor **deleted the
  `compareInfo.BaseCommitID = compareInfo.MergeBase` reassignment** while keeping the log
  call `ShowPrettyFormatLogToList(ctx, BaseCommitID + CompareSeparator + HeadCommitID)`.
  Pre-culprit, `BaseCommitID` had been rebound to the merge base, so the range was
  effectively `mergebase...head`; post-culprit it is `basetip...head` — a symmetric
  difference that **includes commits landed on the base branch after the PR branch was
  created**. (Hunk archived in `raw/F0-COMMAND-LOG.md`.)
- **User discovery:** issue #36483 "Regression: PR commits list includes unrelated commits
  after fafd1db1", filed 2026-01-29 by `tyroneyeh` (author_association **CONTRIBUTOR** —
  outside community member, not maintainer/collaborator), with repro steps naming the first
  bad commit. Symptom: "The PR branch history itself is correct … but the Gitea UI
  incorrectly shows extra commits in Pull request → Commits."
- **Fix:** PR #36485 "Fix bug when list pull request commits", merged **2026-01-30**, one
  file (`services/git/compare.go`, +5/−1): range changed to `MergeBase + ".." +
  HeadCommitID`, with an in-code comment spelling out the `...`-vs-`..` semantics mistake.
  **No regression test added** (recorded demerit, gunicorn-style; not disqualifying under
  §2.2 "ideally").
- **Recency:** culprit 2026-01-17, issue 2026-01-29, fix 2026-01-30 — **all post-cutoff.
  Strict A1 pair — the only one in the v5 pool.**

## Filter verdicts

- **F0 (existence):** all four artifacts (#36483, #36485, `fafd1db1`, #36186) resolve on
  go-gitea/gitea; dates and diffs read in-session. PASS.
- **F1 (layer):** fix lands in `services/git/compare.go` — server-side service layer
  feeding both web UI and API; no client code involved. PASS.
- **F2 (behavioral delta, stated in writing):** the delta is real and reaches the surface:
  the PR commits list (web "Commits" tab and the corresponding API listing built from
  `CompareInfo.Commits`) changes from "commits introduced by the head branch since
  merge-base" to "symmetric difference of base tip and head tip", i.e. unrelated base-branch
  commits appear inside the PR's commit list. Not a rename, not a refactor. PASS.
- **F3 (operand/type):** the wrongness needs no sensitive type — it is a git range-semantics
  error; the sensitive *state* is "base branch advanced after branch creation", which the
  issue reporter produced on a live instance through the normal UI/git flow (the issue IS a
  live-surface repro recipe). No driver/schema layer exists to neutralize it (contrast:
  Immich Batch A kill 2). PASS pending F5 end-to-end confirmation, as the rule requires.
- **F4 (precondition-pinning):** the trap precondition is a **black-box workflow state**
  (another change merges to the target branch while a PR is open) — the *normal* state of a
  busy repository, not a narrow config edge (D3-refinement-2 compliant: no internal
  convention involved). A plausible pre-trap acceptance suite for a forge pins it: PR
  lifecycle scenarios (update-branch, conflict, re-review flows) necessarily construct
  base-advanced fixtures, and "the commits tab lists exactly the commits introduced by this
  PR" is a natural assertion over those fixtures. Honest residual: a minimal happy-path
  suite that never advances base is a decoy — whether blind authors pin it is exactly what
  the blind-author probe measures (design phase, not admission). PASS on the strengthened
  bar, strongest in pool.

## D2 properties

- **Silent:** page renders normally, no error anywhere; git history itself is correct, only
  the rendered/served list is wrong. Native suite stayed green (no test covered the range;
  the fix added none either).
- **Forced touch:** the trap task is the culprit's own task — "refactor
  GetMergeBase/compare plumbing" — which cannot be completed without editing
  `GetCompareInfo`, the single shared pipeline that renders the commits list. The tempting
  path is certified by a real maintainer falling in: deleting a reassignment that looked
  like noise but was load-bearing.
- **User-meaningful:** wrong commit list on a PR = wrong review scope; directly
  user-observable at the public HTTP surface.

## §2.5 exposure precondition (statable pre-spend — sketch for prereg)

- **Event the treatment acts on:** during a compare/merge-base refactor task, the agent's
  patch alters the revision-range computation (or removes the merge-base rebinding) such
  that the served commits list changes under the base-advanced fixture.
- **Base rate source:** control-arm calibration runs on the same task; abort floor: if 0/N
  control runs touch the range expression in `GetCompareInfo`, the lever has zero exposure
  — abort before treatment spend (the §7.2/P1.1 lesson, stated up front).
- **Surface check:** the hidden grader asserts the commits-list contents through the HTTP
  API against a fixture repo whose base has advanced post-branch — deterministic, no
  clock/TZ dependence.

## F5 plan sketch (build session, needs operator go)

Pin parent of `fafd1db1` (pre-culprit), `fafd1db1` itself (buggy), and #36485's merge
(fixed). Single Gitea binary + SQLite in docker; seed via API: repo → branch → PR → push
unrelated commit to base → `GET /repos/{o}/{r}/pulls/{n}/commits`. Legs: (i) buggy build
returns the base commit inside the PR list; (ii) fixed build returns only branch commits;
(iii) native suite green on buggy code; (iv) archive raw responses. Loop budget: Gitea
boots in seconds; expected well under the 60 s bar.
