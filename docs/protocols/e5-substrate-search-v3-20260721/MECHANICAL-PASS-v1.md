# Substrate search v3 — mechanical fossil-hunt pass (v1)

Run by Claude Code 2026-07-21 with operator authorization. Zero model spend — `gh search` + `gh
pr view` only. Companion to the v3 scout prompt (`docs/e5/SUBSTRATE-SEARCH-V3-PASTE-READY.md`);
scout outputs, when run, land in this folder.

**Target:** shipped-regression fossils — merged post-Jan-2026 PRs fixing silently-shipped wrong
behavior with an identifiable culprit change — per the v3 retargeting (silent edges, not loud
ones).

## Method (exact queries, reproducible)

```
gh search prs --merged --language python "regression introduced in" --created ">2026-01-01"
gh search prs --merged --language python "silent regression"        --created ">2026-01-01"
gh search prs --merged --language python "regressed in"             --created ">2026-01-01"
gh search prs --merged --repo <R> "regression" --created ">2026-01-01"
    for R in pandas-dev/pandas pydantic/pydantic fastapi/fastapi django/django
             encode/httpx sqlalchemy/sqlalchemy
```

**Noise profile, worth recording:** the generic (non-repo-scoped) queries return mostly tiny
personal repos — the searchable phrase is common, the usable instance is not. The yield is in
**repo-scoped** queries against major libraries, where "regression" in a title reliably marks a
fossil. Scouts (and future passes) should scope per-repo from the start; the generic sweep is
only good for discovering which repos to scope to.

## Specimens (ranked)

### 1. pandas `idxmax`/`idxmin` wrong-row pair — the strongest fossil found, and the strongest candidate the program has seen

- **Culprit:** pandas-dev/pandas **#64478** "COMPAT: Fix OverflowError in nanops with numpy 2.5",
  merged **2026-03-09**. Changed the ±inf sentinel fill in `nanops._get_fill_value` from Python
  `int` to `np.int64`.
- **Silent mechanism:** for nullable `UInt64` columns, `uint64 + int64` has no common integer
  type under NEP 50, so `np.where` silently promotes to `float64`, losing precision above 2^53 —
  `DataFrame.idxmax`/`idxmin` **returns the wrong row**. No exception, no warning, suite green.
- **Fossil/fix:** **#66250** "BUG: idxmax/idxmin wrong row for nullable UInt64 with NA…", merged
  **2026-07-15**, whose body opens "Fixes a regression introduced in GH-64478" — the culprit is
  named by the maintainers themselves, not inferred. Four months shipped-silent.
- **Why it leads:** every v3 evidence bar at its strongest — culprit named, mechanism named,
  wrong-*result* class (the purest silent failure), pure public API (`DataFrame.idxmax`),
  maximal audience credibility (pandas), and both ends of the pair inside the post-Jan-2026
  window. A black-box scenario (frame with large UInt64 values + NA → assert the returned row)
  detects it; nothing in the visible suite did.

### 2. pydantic `Interval` zero-bounds — same failure class as the FastAPI edge

- **Fix:** pydantic/pydantic **#13452** "Fix `Interval` zero bounds silently dropped in pipeline
  API", merged **2026-07-16** (fixes issue #13450). `_apply_constraint` tested bounds for
  truthiness, so a bound of exactly `0` was **silently skipped**: `Interval(ge=0, le=10)`
  accepted `-5`; all four bound kinds affected.
- **Culprit:** the pipeline API's original constraint-application implementation (culprit PR not
  named in the fix body — one bisect step needed).
- **Class:** validation silently absent — precisely the FastAPI #15022→#15030 silent layer,
  observed in a second, independent codebase. Cross-substrate recurrence of the class is itself
  evidence for the eventual writeup.
- **Caveat:** lives in `pydantic/experimental/` — a skeptical reader can discount experimental
  surfaces; mid-tier credibility.

### 3. mypy dataclass-narrowing regression

- **Fix:** python/mypy **#21675** "Fix regression in dataclass narrowing for Python >= 3.13",
  merged **2026-07-07** (fixes #21635). Python 3.13's synthesized `__replace__ -> Self` makes
  mypy's ad-hoc intersection check fail, so `issubclass`-narrowing against a second dataclass
  silently produces wrong type-checking verdicts.
- **Surface:** mypy CLI output — public, scenario-drivable (run mypy on a snippet, assert the
  verdict), and a *tool* rather than a web framework (representativeness variety).
- **Caveat:** culprit is an interaction with a Python-version change, not a single named PR —
  the "remove A" construction is less clean; knockout-style verification would target the
  `__replace__` handling.

### 4. pandas `MultiIndex.equals` bit-width regression

- **Fix:** pandas-dev/pandas **#65701**, merged **2026-06-27** (fixes #65700): equality
  incorrectly `False` when comparing codes of different bit-widths (int32 vs int64) — silent
  wrong-answer on a public comparison method. Culprit not named in the body; needs a bisect.
  Second pandas specimen — pandas could supply a multi-edge *sequence* on its own.

### 5. Meta-fossil: pandas #66398 — an index of 38 once-silent bugs

Merged **2026-07-21** (today): test-only PR adding regression tests for **38 issues already
fixed on main without one** — each line a bug that shipped, got fixed, and had no test at fix
time. Direct supply evidence for "test suites systematically under-cover silent failure modes,"
and a ready-made catalog for held-out-oracle material in any pandas-based episode.

## Supply answer (the v3 retargeted question, from this pass)

Mechanically findable: **yes** — one afternoon of queries produced two certified fossil pairs,
two strong leads, and a 38-item index, versus v2's entire three-scout round producing one
candidate. Concentration: data/computation libraries (wrong-result class), validation layers
(silently-absent-constraint class), and developer tools (wrong-verdict class). The binding
constraint has moved exactly as the v3 prompt predicted: not finding silent edges, but finding
ones with a public surface + runnable local build + enough surrounding related change to form a
worksequence. Pairs are abundant; sequences still need assembly.

## Recommended verification queue (all zero model spend, needs operator go)

1. **pandas #64478→#66250**: subtract-one-change is directly applicable (revert the sentinel-fill
   change at the pre-fix state; run the fix's new tests + a black-box scenario); record loudness
   (predicted: fully silent — wrong row, no error). Then screen the surrounding nanops/masked-ops
   commit window for sequence-padding changes.
2. **pydantic #13452**: one bisect to name the culprit, then same treatment.
3. Hold 3–4 behind the scout round; if scouts independently surface pandas, that is convergence
   worth recording.

No spend, no runs, no publishing beyond this record without explicit operator go.
