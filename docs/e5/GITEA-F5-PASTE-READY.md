# Gitea F5 build session — paste-ready prompt (v1)

Session mechanics (operator): fresh context, frontier tier, high effort. Zero external
spend. Expected length: one session.

---

Run admission filter **F5 (live end-to-end repro)** for the Gitea candidate of substrate
search v5. **Falsification framing: your job is to find the reason this candidate is OUT.**
A candidate that survives an honest kill attempt is admitted; a candidate nursed through a
sympathetic check is how this program has died twice before (Immich §7.2, Batch A).

## Read first (do not re-litigate F0–F4)

1. `docs/e5/E5-SUBSTRATE-SEARCH-V5-BRIEF-v1.md` — §3 (F5 definition), §8 (reusable stack
   properties, <60 s loop bar).
2. `docs/protocols/e5-substrate-search-v5-20260722/GITEA-SCREEN-v1.md` — the candidate's
   F0–F4 record, fossil anchors, F5 plan sketch.
3. `docs/protocols/e5-substrate-search-v5-20260722/COMPARISON-v1.md` §6 — exit-gate rules.

F0–F4 verdicts stand; do not re-argue them. DO re-anchor the two pinned facts locally
before building (cheap, and Batch A existed because an unverified inference slipped
through): `git show fafd1db1` must show the deleted `BaseCommitID = MergeBase` reassignment
in `services/git/compare.go`; the #36485 diff must show the `MergeBase+".."` fix.

## Hard constraints

- **Zero external spend**: local compute, git, docker, GitHub reads only. No model
  experiments, no OpenRouter/provider calls, no runs.
- **Stop at first kill.** Kill ⇒ write the finding memo, stop; no redesign-in-place
  (Batch A precedent). Control returns to the operator either way.
- **No design-phase machinery** regardless of outcome: no memorization probe, no
  blind-author probe, no Three Amigos, no prereg drafting. Exit memo → operator.

## Pinned states

Repo: `go-gitea/gitea`.

- **FIXED** = merge commit of PR #36485 (resolve the SHA via
  `gh pr view 36485 --repo go-gitea/gitea --json mergeCommit`; record it).
- **BUGGY** = first parent of the FIXED merge commit (must contain `fafd1db1`; verify with
  `git merge-base --is-ancestor`).
- **PRE-CULPRIT** (optional leg v) = `fafd1db1^`.

## The fixture (the precondition, black-box)

Via the HTTP API only (no DB pokes, no internal shortcuts): create user + repo; commit A on
`main`; branch `feature` at A; commit B on `feature`; open PR feature→main; then commit C
directly on `main` (base advances after branch creation). Deterministic; no clock or TZ
dependence.

## Legs (all four required; archive raw outputs for each)

1. **(i) Wrong value live at the public surface, BUGGY build:**
   `GET /api/v1/repos/{owner}/{repo}/pulls/{index}/commits` must include commit **C** (the
   base-branch commit) in the PR's commit list. If the web route and API route diverge,
   check the web Commits tab too and record which surfaces are exposed. **If the buggy
   build does NOT show the wrong value through the real surface, that is the kill — write
   it up, stop.** (Batch-A corollaries live here: the fix's behavioral delta must reach
   this surface, and the live path must actually produce the sensitive state.)
2. **(ii) Correct behavior, FIXED build:** same fixture, same request → exactly commit B
   (branch commits only). Byte-diff the two responses; archive both.
3. **(iii) Decoy property — native suite green on BUGGY:** run Gitea's test suite on the
   BUGGY checkout. Scope honestly: at minimum the unit tests covering `services/git` and
   the integration tests touching pulls/compare; record exactly what was run and why that
   scope is a fair reading of "native suite". **Any native test that fails on BUGGY because
   of this bug ⇒ decoy property fails ⇒ KILL.** (Unrelated pre-existing flakes: record and
   distinguish.)
4. **(iv) Evidence archive:** raw HTTP captures, suite logs, build logs, fixture script →
   `docs/protocols/e5-substrate-search-v5-20260722/raw-gitea-f5/`, memo →
   `docs/protocols/e5-substrate-search-v5-20260722/GITEA-F5-RESULTS-v1.md` (same dir as the
   search, per the brief's evidence layout).

Optional **(v)** if cheap: PRE-CULPRIT build shows correct behavior — closes the regression
window end to end.

Additionally **measure the loop**: wall-clock for reset→seed→assert on the buggy build,
reported against the <60 s bar (§8). Not a kill condition by itself; a number the episode
design needs.

## Build hints (hints, not prescriptions)

- API-only testing may not need the frontend: try `make backend` (Go only,
  `TAGS="sqlite sqlite_unlock_notify"`) and run with a minimal `app.ini` (SQLite, no
  mailer, `INSTALL_LOCK=true`). If the web Commits tab must be checked, a full
  `make build` needs Node as well.
- Gitea January-2026 tree: check `go.mod` for the Go toolchain version; pin it.
- Program gotchas that recur: detach long builds (don't block the loop); file-redirected
  stdout can buffer — flush or tee; do all fixture setup through the API so the repro is
  replayable from the archived script.

## Exit

- **PASS all legs** ⇒ Gitea is the first F5-verified primary-slot candidate; memo +
  standings line; stop. Operator decides whether paperless (nominee 2,
  `PAPERLESS-SCREEN-v1.md`) gets the second F5 session and when design-phase machinery
  starts.
- **KILL** ⇒ memo with the exact leg and evidence, one-line entry for the comparison doc's
  kill table; stop. The CLI reserves (ripgrep first) are the next vein — operator decision.
