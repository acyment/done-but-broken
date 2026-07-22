# Gitea #36483 → #36485 — F5 live end-to-end repro (RESULTS v1)

Run 2026-07-22 by Claude Code under `E5-SUBSTRATE-SEARCH-V5-BRIEF-v1.md` §3 (F5) and the
operator's F5 build-session prompt (falsification framing: the session's job was to find
the reason this candidate is OUT). Zero external spend: local compute, git, GitHub reads
(`gh`), local builds only. No model experiments, no runs. F0–F4 verdicts
(`GITEA-SCREEN-v1.md`) were not re-litigated; the two pinned facts were re-anchored locally
before building (§1).

**VERDICT: PASS on all four required legs + optional leg (v). No kill found. Gitea
#36483→#36485 is the first F5-verified primary-slot candidate.**

Evidence: `raw-gitea-f5/` (raw HTTP captures, suite logs, server logs, fixture scripts,
per-leg JSON). All commands below are replayable from the archived scripts.

## 1. Re-anchor of the two pinned facts (pre-build, per Batch-A discipline)

1. **Culprit hunk**: `git show fafd1db1 -- services/git/compare.go` at the local clone
   shows the deleted line `compareInfo.BaseCommitID = compareInfo.MergeBase` and — the
   mainline-path mechanism — the deleted local `baseCommitID := compareInfo.MergeBase`
   feeding `ShowPrettyFormatLogToList`. Post-culprit the call is
   `BaseCommitID + CompareSeparator + HeadCommitID` with `BaseCommitID` = base **tip** and
   `CompareSeparator = "..."` for PR views (non-direct comparison), i.e. the range moved
   from `mergebase...head` to `basetip...head`. Honest nuance recorded: the literal
   `BaseCommitID = MergeBase` deletion sits in the old error-fallback branch; the
   load-bearing deletion for the live path is the `baseCommitID` local. Both are in the
   hunk; the screen doc's mechanism claim is exact.
2. **Fix diff**: `gh pr diff 36485` shows the single-file change in
   `services/git/compare.go` (+5/−1) replacing the range with
   `compareInfo.MergeBase + ".." + compareInfo.HeadCommitID`, with the in-code comment on
   `...`-vs-`..` semantics. Matches the screen doc.

## 2. Pinned states (resolved this session)

| State | SHA | How pinned | Version string as built |
|---|---|---|---|
| FIXED | `208cbd5a6f9be60bc79105c6223f759d42902f52` | `gh pr view 36485 --json mergeCommit`; merged 2026-01-30T18:46:35Z | `1.26.0+dev-358-g208cbd5a6` |
| BUGGY | `de829c7821b4f7cba3fb60de47eef347b2751492` | sole parent of FIXED (squash merge); `git merge-base --is-ancestor fafd1db1 de829c78` = true | `1.26.0+dev-357-gde829c782` |
| PRE-CULPRIT | `149f7a6f1f333ebeff27d6507dff0362e588fce6` | `fafd1db1^` | `1.26.0+dev` (leg v build) |

Builds: `TAGS="sqlite sqlite_unlock_notify" make backend`, Go toolchain auto-pinned by
`go.mod` to go1.25.6, macOS arm64, backend-only (no frontend build; templates/assets served
from the source tree via `STATIC_ROOT_PATH`). Version strings in the archived server logs
confirm each binary is the pinned commit.

## 3. The fixture (black-box, HTTP surface only)

Per-build fresh instance: SQLite, `INSTALL_LOCK=true`, registration open, no mailer, no
external services (archived `*-app.ini`). Everything through the public HTTP surface — no
`gitea admin` CLI, no DB access:

1. First user `f5admin` via the web sign-up form POST (first registrant becomes admin;
   this tree serves and accepts the form without a CSRF hidden input — recorded, not
   assumed: archived `*-signup.code` = 303).
2. API token via `POST /api/v1/users/f5admin/tokens` (basic auth).
3. Fixture via the v1 API: repo `fixture` (`auto_init`, default branch `main`) → commit
   **A**; branch `feature` at A; commit **B** on `feature` (contents API); PR #1
   `feature→main`; commit **C** directly on `main` (contents API) — base advances after
   branch creation. Deterministic; no clock/TZ dependence.
4. Assertion: `GET /api/v1/repos/f5admin/fixture/pulls/1/commits?verification=false&files=false`
   plus the web Commits tab (`GET /f5admin/fixture/pulls/1/commits`, anonymous).

Script: `raw-gitea-f5/f5-fixture.sh` (+ `f5-server.sh`, `f5-warmloop.sh`).

## 4. Leg results

### (i) Wrong value live at the public surface, BUGGY build — PASS (bug reproduces)

API returned **2 commits: [C, B]** — commit C (`eb17ec39…`, the base-branch commit pushed
after the PR was opened) is inside the PR's commit list. The web Commits tab HTML contains
both B and C SHAs (4 occurrences each). Silent: HTTP 200, page renders normally, git
history itself correct. Raw: `buggy-pr-commits-api.json`, `buggy-pr-commits-web.html`.
Reproduced a second time in the warm loop (`buggy-warm-loop-pr-commits-api.json`).

Surfaces exposed (all three route through `services/git/compare.go GetCompareInfo` with
`directComparison=false`, confirmed by code reading at BUGGY):
- `GET /api/v1/repos/{o}/{r}/pulls/{n}/commits` (`routers/api/v1/repo/pull.go:1343`)
- web Commits tab (`routers/web/repo/pull.go` `ViewPullCommits` → `preparePullViewPullInfo`)
- web `GET /{o}/{r}/pulls/{n}/commits/list` JSON (`services/pull/pull.go GetPullCommits`)

Batch-A corollaries: the fix's behavioral delta reaches this exact surface (leg ii is a
1-commit vs 2-commit byte-level difference on the same request), and the live path
produces the sensitive state (a normal API push to `main` while the PR is open — no
schema/driver layer exists to neutralize it).

### (ii) Correct behavior, FIXED build — PASS

Same fixture, same request: **exactly [B]**, count=1, C absent; web tab shows only B.
Raw: `fixed-pr-commits-api.json`, `fixed-pr-commits-web.html`;
`api-response-byte-diff.txt` (145-line diff of the prettified responses; SHAs differ
between instances because commits embed creation timestamps — the load-bearing delta is
the extra commit-C object and count 2→1).

### (iii) Decoy property — native suite green on BUGGY — see §5

### (iv) Evidence archive — this directory; script-replayable.

### (v, optional) PRE-CULPRIT correct — PASS

`fafd1db1^` build, same fixture: **exactly [B]**, C absent. The regression window is
closed end to end: correct → `fafd1db1` wrong → #36485 correct.

## 5. Leg (iii): native suite on BUGGY — scope and results

Scope rationale (a fair reading of "native suite" for this bug): (a) unit tests of the
changed package `services/git` — **the package contains zero test files** (only
`commit.go`, `compare.go`; recorded as a data point, consistent with the fossil's
no-regression-test demerit); (b) the full backend unit suite (`make test-backend`,
`TEST_TAGS="sqlite sqlite_unlock_notify"` — exactly what upstream CI runs at the unit
level); (c) the sqlite integration suite filtered to every test whose name contains
`Pull` or `Compare` (`./integrations.sqlite.test -test.run 'Pull|Compare'` under
`tests/sqlite.ini`) — this includes `TestAPIPullCommits` and `TestListPullCommits`, which
pin exact commit lists on the two surfaces above and DO exercise the buggy code path;
they can only fail if a fixture PR's base tip has advanced past the merge base.

### Results — PASS (no native test fails because of this bug)

**(a) Changed package:** `services/git` has zero test files (only `commit.go`,
`compare.go`) — vacuously green; recorded as a data point.

**(b) Full backend unit suite on BUGGY:** first run (under concurrent fixture-server load,
`buggy-test-backend.log`) had 4 failing tests; the falsification pass attributed every one
to environment, not the bug:

- `TestUserAvatarLink`, `TestTestHook`, `TestRoutes` (avatars / webhook-task / install
  page — subsystems with no path to `GetCompareInfo`): all pass on a quiet re-run of the
  same BUGGY tree (`buggy-retest-4pkgs.log`) — load flakes.
- `TestPullRequest_AddToTaskQueue`: initially the kill signature (fails BUGGY, passes
  FIXED, quiet machine). Cause isolated by a two-way experiment: the failure follows the
  presence of `tests/sqlite.ini` (generated in the BUGGY tree by this session's
  integration-binary prep; unit tests default `GITEA_TEST_CONF` to it, changing
  `pr_patch_checker` queue settings), **not** the code delta — BUGGY without the file:
  5/5 pass; FIXED with the file: same assertion fails (`check_test.go:53`). The code
  delta between the trees is exactly the +5/−1 compare.go fix (`git diff --stat`
  verified), and this test never touches it.
- **Clean full re-run on BUGGY** (quiet machine, config artifact removed):
  **exit 0, 211 packages ok, zero failures** (`buggy-test-backend-clean.log`).

**(c) Integration suite (sqlite), all 128 tests matching `Pull|Compare`**
(`buggy-integration-scope.txt`; includes every pulls/compare integration file):

- **The two tests that pin PR commit lists through the buggy code path —
  `TestAPIPullCommits` and `TestListPullCommits` — PASS on BUGGY** (explicit verbose run,
  `buggy-integration-commitlist-tests-verbose.log`). Their fixture PRs never advance the
  base branch, so `basetip...head` collapses to `mergebase...head` — exactly the
  precondition-gated suite-blindness the trap requires (and matches upstream CI having
  been green when the bug shipped).
- 12 merge-performing tests failed on BUGGY (`buggy-integration-pull-compare.log`) with
  "Timed out waiting for pull merge to succeed": fixture webhook deliveries to
  `www.example.com` stall ~5 s each in this sandboxed-network environment (upstream CI
  fails them instantly), pushing merge waits past their timeouts. Controlled comparison:
  **the identical 12 tests fail identically on the FIXED tree** under the same
  environment (`fixed-integration-12merge.log`; 12/12 name-for-name, same timeout
  message) — failure set invariant under the code delta ⇒ environmental, not bug-caused.

**Leg (iii) verdict: decoy property holds.** No native test fails because of this bug;
the native suite is green on BUGGY under clean conditions at the unit level, and the only
commit-list-pinning integration tests pass on the buggy build.

## 6. Loop measurement (§8 <60 s bar)

| Loop | Wall-clock |
|---|---|
| Cold: wipe workdir → boot server → sign-up → seed → assert | **10.6 s** (buggy), 13.3 s (fixed), 17.9 s (pre-culprit) |
| Seed+assert only (within cold run) | 7.2 s |
| Warm: delete repo → reseed → assert on running server | **7.1 s** |

Comfortably under the 60 s bar; server boot is ~3–8 s of the cold loop. Not a kill
condition; recorded for episode design.

## 7. Standings line

Gitea #36483→#36485: **F5 PASS (all legs + v). First F5-verified primary-slot candidate.**
Control returns to the operator: paperless (nominee 2) F5 session and any design-phase
machinery (memorization probe, blind-author probe, Three Amigos, prereg v3) are separate
operator decisions.
