# Harvest raw report — CLI tools scout (subagent, 2026-07-22)

Provenance: claude-family subagent spawned by the main loop for breadth only. **Zero
inherited credibility** — load-bearing facts re-resolved in the main loop before any
verdict (see `COMPARISON-v1.md` §2; corrections found there: ripgrep fix-vs-test commit,
restic numbering anomaly). Verbatim output below.

---

## CONFIRMED CANDIDATES (issue + merged fix verified)

**C1. curl — issue #22038** "%time{%s} in --write-out returns wrong epoch on non-UTC hosts" — author wulin-nudt, created 2026-06-16
- Symptom quote: "`date +%s` → `1781539411` (correct) / `%time{%s}` → `1781510611` (wrong, exactly **28800 seconds less**)"
- Fix: commit `e0c6f4d4d6` "tool_writeout: fix %time{} output for %s", landed master 2026-06-16 (PR #22039 closed-unmerged; curl lands patches as direct commits, msg says "Closes #22039"). Files: src/tool_writeout.c, tests/data/test1981 (test updated).
- Precondition: host timezone ≠ UTC (glibc strftime `%s` treats the UTC struct tm as local time).
- Silence: issue transcript shows normal `curl -s -o /dev/null -w 'epoch:%time{%s}...'` output with wrong value; no error anywhere.
- CLI-surface: yes — wrong numeric value printed to stdout by --write-out.
- Least-confident: exit code 0 not explicitly shown in the transcript (ran with `-s`, no error shown).

**C2. rclone — issue #9507** "rclone config normalizes some extended ASCII characters when obscuring passwords" — author Chronogram, created 2026-06-09
- Symptom quote: `rclone reveal 0hn8hm...` returns `ËQÖ4];gia±...` for a password typed as `ËQÖ4];giª±...` (ª→a); "rClone was sending the wrong password on every login attempt" → provider IP-blacklisted the user.
- Fix: direct commit `c6cdb89935` 2026-06-15 "config: fix normalization when obscuring passwords - fixes #9507". Files: fs/config/crypt.go, fs/config/ui.go, fs/config/ui_internal_test.go (test added). Commit msg: "Interactively-entered passwords were run through NFKC Unicode normalization before being obscured, which silently rewrote characters such as ª (U+00AA) to a."
- Precondition: password entered interactively via `rclone config` containing NFKC-normalizable characters (standalone `rclone obscure` was unaffected).
- Silence: config writes the corrupted obscured value to rclone.conf with no error; wrongness surfaces only as remote auth failures.
- CLI-surface: yes — wrong file contents (rclone.conf) and wrong `rclone reveal` output.
- Least-confident: fix vehicle is a direct master commit, not a merged PR (no PR number).

**C3. restic — issue #5767** "Excluding with `--exclude-if-present` excludes whole source path" — author marinjurjevic, created 2026-03-28
- Symptom quote: "scan finished in 0.233s: 0 files, 0 B ... new /home/marin/, saved" — backup of the target saves nothing because `/home/marin/.git` (in a PARENT dir) triggered the exclude.
- Fix: PR #21797 "backup: prevent exclude of backup targets", merged 2026-05-31. Files: internal/archiver/{archiver.go,scanner.go,tree.go}, archiver_test.go + tree_test.go (tests added), changelog/unreleased/issue-5767, doc/040_backup.rst.
- Precondition: `--exclude-if-present=X` where marker X exists in a parent directory of the backup target.
- Silence: backup completes normally and creates a snapshot; it's just silently empty (0 files).
- CLI-surface: yes — silently empty snapshot artifact; "0 files, 0 B" with no error.
- Least-confident: exit code 0 not explicitly captured (transcript is a verbose dry-run showing success lines only).

**C4. restic — issue #21820** "`restic check --read-data` does not list all broken packs" — author rufketo, created 2026-05-21
- Symptom quote: "restic check --read-data only outputs a subset of damaged pack files. The repair commands did not fully repair the repository." (sha256 sweep found 7 broken packs; check listed 2; damaged pack ce8d0b6... was reported only as "Duplicate packs are non-critical").
- Fix: PR #21828 "repository: repair index: correctly handle split index entries", merged 2026-05-31. Files: cmd/restic/cmd_check.go, internal/repository/checker.go, internal/repository/index/{index.go,master_index.go}, master_index_test.go + blob_test.go (tests added), changelog/unreleased/issue-21820.
- Precondition: pack entries split/duplicated across multiple index files (repo that had prior damage/repair cycles).
- Silence: damaged pack passes as "Duplicate packs are non-critical, you can run `restic repair index'" — a verification tool blessing damaged data.
- CLI-surface: yes — check's damage report omits broken packs.
- Least-confident: whether a fully exit-0 check over damaged data occurs (in the transcript check still failed overall due to OTHER packs).

**C5. uv — issue #20229** "uv incorrectly excludes pre-releases of the base release of a `<V.post` specifier" — author notatallshaw (Damian Shaw), created 2026-07-08
- Symptom quote: "uv and packaging disagree on whether `0.12.a1` can satisfy `<0.12.post2`... uv's current behavior breaks the invariant".
- Fix: PR #20268 "Fix exclusive post-release ordering", merged 2026-07-10. Files: crates/uv-pep440/src/version_ranges.rs, version_specifier.rs, pip_install_scenarios.rs, pip_compile.rs + 3 NEW test/scenarios/post/*.toml (regression tests added).
- Precondition: dependency specifier of shape `<V.postN` with pre-releases of base V available.
- Silence: no error — resolver silently treats admissible versions as inadmissible.
- CLI-surface: yes, indirectly — wrong resolution/lock outcome from `uv lock`/`uv pip compile`.
- Least-confident: whether it manifests as a silently-wrong pick vs. a visible "no solution" error at the CLI (issue gives no CLI transcript; filed as spec-conformance divergence).

**C6. cli/cli (gh) — issue #13319** "gh pr view --json number returns exit 0 for Issue numbers due to numberFieldOnly optimization skipping API validation" — author apokamo, created 2026-04-30
- Symptom quote: "`gh pr view 1099 --json number; echo \"exit: $?\"` → `{\"number\":1099}` / `exit: 0 ← wrong: this is an Issue, not a PR`"
- Fix: PR #13327 "fix(pr): remove numberFieldOnly optimization that skips API validation", merged 2026-05-02. Files: pkg/cmd/pr/shared/finder.go (-6), finder_test.go (-19) — deletions only.
- Precondition: `--json number` as the sole requested field + selector number that is an Issue, not a PR (no API call made).
- Silence: fabricated JSON on stdout + exit 0.
- CLI-surface: yes — wrong exit-0 success and wrong JSON output.
- Least-confident: no NEW regression test added (PR removed the optimization and its old test; both files deletions-only).

**C7. ripgrep — issues #3376 + #3320** (same root cause) — #3376 "`.gitignore` not taken into account when multiple search paths are provided", author Erwyn, created 2026-04-22; #3320 "Order-dependent .rgignore bug with multiple explicit search roots", author markusylisiurunen, created 2026-03-26
- Symptom quotes: "`rg \"this\" src/ tests/` => **`src/invalid` is found**" (gitignored file); "`rg --files-with-matches -n 'AWS' alpha beta` incorrectly returns `beta/x.svg`" while `beta alpha` order correctly ignores it.
- Fix: direct commit `653d7f5bd1` 2026-06-27 ("Closes #3320, Closes #3376, Ref #3419, Closes #3451"). Files: crates/ignore/src/dir.rs (+128/-2), tests/misc.rs (+62, regression tests). Commit msg: parent ignore matchers cached across roots must keep per-root absolute_base for path rewriting. (Community PR #3417 closed-unmerged.)
- Precondition: multiple explicit search roots on the command line; wrongness is root-order-dependent.
- Silence: normal match output, no warning — ignored files silently included in results.
- CLI-surface: yes — wrong match/file list on stdout.
- Least-confident: whether 653d7f5's dir.rs hunk IS the behavioral fix or documents an invariant fixed slightly earlier (commit title says "add ... regression tests", yet carries +128 lines in src/dir.rs; three earlier referenced SHAs returned identical commit content, suggesting rebased duplicates of the same change).
- **[Main-loop correction: the behavioral fix is `43e2f08ede` "ignore: fix parent gitignore matching across multiple roots", 2026-06-04; `653d7f5bd1` (2026-06-27) adds the regression tests and closes the issues.]**

**C8. curl — issue #20715** "--follow doesn't respect 303 method change unless --data also present" — author thedanbob (Dan Arnfield), created 2026-02-24
- Symptom quote: "I expected... Curl to follow the redirect using GET. Instead, the redirect is followed with the original method." / "The redirect is correctly changed to GET if curl is called with empty `--data`... it's not documented."
- Fix: commit `e5087ac9fc` 2026-04-09 "http: on 303, switch to GET" ("Fixes #20715 ... Closes #21280"). Files: lib/http.c, tests/data/test1983 + test1984 (NEW regression tests), docs.
- Precondition: `--request <VERB>` + `--follow` + server responds 303, WITHOUT `--data` (all verbs incl. DELETE).
- Silence: redirect followed normally, no warning; wrong method sent.
- CLI-surface: partially — wrong request method changes server-side effect/response; visible via `-v` or server behavior, not flagged in curl's own output.
- Least-confident: silence/exit-0 not demonstrated by a transcript in the issue (no verbose output attached).

## MARGINAL / UNCONFIRMED LEADS (observed, but fix linkage or silence criterion not confirmed — screener may pursue)
- curl #22156 → merged PR #22161 (multi-member gzip): truncated output artifact BUT exits with error 23, so fails the "silent" criterion as filed.
- duckdb #21908 (window macro silently drops FILTER/DISTINCT; wrong values 45-vs-39 in CLI, author rustyconover, 2026-04-07): closed COMPLETED; timeline shows referenced commits (551f13db2..., 87df0d407..., etc.) but I did not verify which is the fix.
- cli/cli #13835 (`--search` OR escapes `--repo` scoping, undetectable in `gh issue list --json`): closed COMPLETED 2026-07-15, no linked fix PR found.
- rclone #9575 (zoho config silently repoints remote), #9572 (rc config params silently ignored): titles observed, not drilled.
- uv #19683 (wheel extraction silently drops subpackage — RECORD lists files never on disk), #19239 (exclude-newer-package silently ignored; closed same-day no PR), #18939, #20350: no linked closing PRs found where checked.
- restic #21894 (--skip-if-unchanged not honoured): no closing PR link.
- yt-dlp #16868 (corrupted 1.2MB file): no closing PR link.
- lazygit #5522 (copy absolute path wrong in worktree): title observed only.

## SWEPT, NOTHING FOUND (variants tried, no qualifying lead)
jqlang/jq (wrong, incorrect); python-poetry/poetry (silently, wrong); sharkdp/fd (wrong); junegunn/fzf (wrong); charmbracelet/glow (wrong); koalaman/shellcheck (incorrect); aria2/aria2 (wrong — empty); rockdaboot/wget2 (wrong — empty); git/git (wrong — empty, mirror likely has issues disabled); borgbackup/borg (wrong — nothing new beyond known #9853); pypa/pip (silently — nothing new beyond known #14131/#14084).
