# Ripgrep #3376/#3320 (+#3419) → `43e2f08ede` — F0–F4 screen (CLI slot)

Screened 2026-07-22 in the main loop, falsification-framed, per
`E5-SUBSTRATE-SEARCH-V5-BRIEF-v1.md` §3 and `E5-RIPGREP-ADMISSION-BRIEF-v1.md`. All facts
below re-resolved directly via `gh` / a fresh local clone this session (lead originated from
the CLI-harvest subagent, `HARVEST-CLI-RAW.md` C7; the COMPARISON §2 fix-vs-test correction
re-verified here). **D7 honesty line up front: ripgrep is CLI-surface. Passing this screen
fills the CLI slot (D7's eventual pairing), NOT the service-shaped primary slot — gitea
#36483→#36485 remains the sole service-shaped primary either way.**

## F0 — re-anchor (PASS)

- **Issue #3376** "`.gitignore` not taken into account when multiple search paths are
  provided" — filed 2026-04-22 by `Erwyn`, author_association **NONE**. Deterministic CLI
  repro in the issue: `.gitignore` contains `src/invalid`; `rg "this" src/ tests/` →
  **`src/invalid` is found**; `rg "this" tests/ src/` → correctly absent. Closed 2026-07-09
  `completed`.
- **Issue #3320** "Order-dependent .rgignore bug with multiple explicit search roots" —
  filed 2026-03-26 by `markusylisiurunen`, author_association **NONE**. `.rgignore` contains
  `beta/**/*.svg`; `rg --files-with-matches -n 'AWS' alpha beta` → **`beta/x.svg` returned**;
  reversed order correct. Closed 2026-07-09 `completed`.
- **Issue #3419** "Nondeterminism in ignore::WalkBuilder parallel multi-root walk" — filed
  2026-05-26 by `jelle-openai`, author_association **NONE** (username suggests OpenAI
  affiliation; recorded as observation — still an outside user, not a ripgrep maintainer).
  Library-surface report of the same root cause, and it shows the **opposite wrongness
  direction**: a legitimate file (`src/scikit_build_core/build/metadata.py`) sometimes
  **silently missing** from the walk because a `tests/**/build/` rule was applied under the
  wrong root. Closed 2026-06-05 by the fix commit.
- **Fix commit `43e2f08ede`** "ignore: fix parent gitignore matching across multiple roots"
  — authored **Micha Reiser** 2026-06-04, committed by Andrew Gallant (BurntSushi)
  2026-06-05; `crates/ignore/src/dir.rs` **+78/−26**; message states the exact mechanism and
  says `Fixes #3419`; **adds unit regression test**
  `absolute_parent_matchers_are_cached_across_roots`. Contained in release tag **15.2.0**.
- **Test commit `653d7f5bd1`** "ignore: add multi-root parent matcher regression tests" —
  authored Nipan Das 2026-06-27; `dir.rs` +130 (unit tests + invariant docs), `tests/misc.rs`
  +62 (CLI-level integration regression tests); `Closes #3320, Closes #3376, Ref #3419,
  Closes #3451`. This confirms the COMPARISON §2 correction: **`653d7f5bd1` is tests-only;
  `43e2f08ede` is the behavioral fix.**
- **Fix settled:** PR #3451 (same author as the test commit) is a **closed-unmerged
  performance optimization** (skip reading parent gitignores above a git boundary), not a
  sibling correctness fix. Post-fix commits touching `dir.rs`/`walk.rs` (incremental
  checking `b621e65`, `is_hidden` refactor `626b895`, panic-deadlock fix `0d7054d`) touch no
  `absolute_base` line. A `gh` sweep of gitignore-related issues created after 2026-06-05
  finds nothing about multi-root/ignore leaks. No later sibling fixes. **Settled.**

### Culprit dating → class = LATENT

`git log -S absolute_base` / `-S compiled` followed through the 2020 repo restructure
(`fdd8510`) into the pre-2020 path `ignore/src/dir.rs`: both the cross-root parent-matcher
cache (`compiled: Arc<RwLock<HashMap<OsString, Ignore>>>`) and the `absolute_base` field
stored on the cached matcher were **born together in `d79add3` "Move all gitignore matching
to separate crate", 2016-10-11, Andrew Gallant** — the commit that created the `ignore`
crate. The structural flaw (root-dependent state living inside a cross-root cache) is
original to that design.

- **Culprit pre-2026 ⇒ latent shape** — admissible only under the v4 pre-declared fallback
  (fired 2026-07-22, COMPARISON §1); **memorization/liveness probe mandatory** (and mandatory
  under the admission brief regardless).
- Recorded demerits (honest, not blockers): ~10 years of in-tree blindness before two users
  hit it in one spring; whether the pre-crate walker (Sep–Oct 2016) handled multi-root parent
  gitignores correctly was not investigated (not cheap; the class verdict does not depend on
  it).

### Mechanism (verified against pre-fix source at `79a23e0`, the fix's parent)

`Ignore::add_parents(root)` canonicalizes the root and builds one matcher per ancestor
directory, storing `absolute_base = canonicalize(root)` **on each cached `IgnoreInner`** and
inserting them into the `compiled` cache shared across roots. A second root whose ancestors
are already cached takes the cache-hit path (`ig = Ignore { inner: prebuilt }`) and therefore
**inherits the first root's `absolute_base`**; `add_child_path` copies it down to every
descendant matcher. `matched_ignore` then rewrites each walked path by stripping the current
root prefix and joining onto `absolute_base` before matching ancestor ignore rules — with the
wrong base, path-scoped ancestor rules (`src/invalid`, `tests/**/build/`, `beta/**/*.svg`)
misapply in **both directions**: ignored files leak into results (#3376/#3320) and legitimate
files silently vanish (#3419). Order-dependent at the CLI, nondeterministic under the
parallel walker. The fix moves `absolute_base` off the cached `IgnoreInner` onto the
per-walk `Ignore` wrapper and re-wraps cache hits with the current root's base.

## F1 — layer check (PASS)

The fix lands in `crates/ignore/src/dir.rs`, the workspace crate through which the `rg`
binary renders its file/match list: `walk.rs` calls `ig_root.add_parents(path)` per CLI path
argument in both the serial (`walk.rs:1590`) and parallel (`walk.rs:1201`) walkers, all
sharing one `compiled` cache. Not a client, not a test, not docs. Note recorded: `ignore` is
also a published library (that is #3419's surface), but the trap surface here is the `rg` CLI
and the fix reaches it directly — both fossil issues are `rg`-CLI transcripts.

## F2 — behavioral-delta check (PASS)

Exact delta, in writing: before the fix, the `absolute_base` used to rewrite a walked path
for ancestor-rule matching is whichever root **first built** the shared cache entry; after
the fix, it is always the **current** walk root (cache hits are re-wrapped with the caller's
base; the cached chain is base-free). Observable fields reached: the stdout match list /
`--files-with-matches` list of `rg` — entries appear that ancestor ignore rules exclude, and
entries disappear that no rule excludes. Not a rename or refactor: +78/−26 with a semantic
storage move plus a regression test asserting cached parent matchers are shared
(`Arc::ptr_eq`) *and* per-root matching stays correct.

## F3 — operand/type check (PASS)

The live path produces the sensitive condition without any synthetic help: any invocation
`rg PATTERN rootA rootB` where the roots share an ancestor (always true — at minimum `/`)
takes the per-root `add_parents` calls through the shared cache, so cross-root cache hits are
guaranteed on the second root. The sensitive operand — a **path-scoped pattern in an
ancestor ignore file** — is ordinary user data (`src/invalid`, `beta/**/*.svg`). Evidence is
the strongest form available: **real user CLI transcripts at the public surface in both
issues**, showing the wrong output of released binaries (15.1.0 era), plus the fix's own
`Arc::ptr_eq` test proving the cache-hit path is the one exercised. No reconstruction
needed; nothing here rests on the fix's test inputs alone.

## F4 — precondition-pinning screen (PASS, concern recorded)

Precondition components, all black-box environment conditions (D3-refinement-2): (1)
multiple explicit path arguments in one invocation; (2) an ignore file in a common ancestor
of the roots — the default layout of every git repo (root `.gitignore`, roots = subdirs);
(3) a path-scoped pattern in that file — routine in real gitignores. A plausible pre-trap
acceptance suite for a search CLI pins "searching several directories at once respects the
repository ignore file" — this pins ripgrep's **documented core contract** (ignored files
never appear in results), not the trap task's own criteria, and the invocation shape
(`rg PATTERN src tests`) is everyday usage, not a TimescaleDB-class exotic edge.

Falsification concerns, scored against admission and survived:

- **Order/parallelism dependence.** The wrongness depends on which root builds the cache
  first; a naive scenario could sample the passing order. Survives because the failing order
  is a natural one (#3376's `src/ tests/`) and a deterministic establishing item simply pins
  root order (and thread count) — recorded as an **episode-design constraint**: the
  establishing scenario must pin the failing configuration deterministically.
- **D3 born-broken reading.** The code edge was born broken in 2016, so "multi-root ignore
  handling" never worked in-code; a contestable reading calls it never-established behavior.
  Survives because the establishing contract is the black-box documented ignore contract —
  independent of, and predating, the 2016 caching implementation — and its reality is
  certified by the fossil itself: two independent users filed it as a bug with "should be
  ignored" expectations and the maintainer fixed it as a bug with regression tests (contrast
  the paperless #11881 "Fixhancement" kill, where maintainers treated the report as a spec
  choice). The wrongness also holds in the *correct-file-vanishes* direction (#3419), where
  no born-broken reading is available at all.

## D2 certification (PASS)

User-filed twice at the CLI surface (both NONE association) plus once at the library surface;
wrongness **silent in both directions** (normal match output, no warning, normal exit
semantics); shipped in released binaries; a maintainer-merged fix documents the mechanism and
adds regression tests; native suite was green on the buggy code for ~10 years (the decoy
property, to be re-verified live at F5 time). Recency: fix 2026-06-04/05, issues 2026-03/04
— in-window; culprit 2016 ⇒ latent class as above.

## §2.5 exposure-precondition sketch

- **Trap-task shape (illustrative, not designed here):** a change forced through the
  parent-matcher construction in `dir.rs` — perf work on matcher caching/prebuilding, or a
  feature like the #3451-shaped "skip parent gitignores above a VCS boundary".
- **Trap-entry event:** the agent's implementation stores or reuses walk-root-dependent
  state (the canonicalized base) in/with the cross-root cached matcher, so a later root
  inherits an earlier root's base and ignored files leak into results (or legitimate files
  vanish).
- **Base-rate source:** this session's liveness probe (`RIPGREP-MEMOPROBE-PREREG-v1.md`) —
  measured, not assumed.
- **Surface check:** deterministic CLI invocation on a seeded multi-root fixture (ancestor
  ignore file with a path-scoped rule): `rg PATTERN rootA rootB` with pinned root order and
  `-j1`; assert the ignored file absent and the legitimate file present. `rg` executes in
  milliseconds — loop trivially <60 s at run time. Cargo build cost noted separately per the
  F5-cost convention (debug build of the workspace, minutes cold, seconds incremental; to be
  measured in the separately-authorized F5 session, not now).

## Verdict

**F0–F4 PASS — latent class.** No kill filter fired. Proceed to the mandatory
liveness/memorization probe (Stage 3 of the admission brief) under a frozen prereg. **No F5
build in this session** (v5 at-most-two budget spent; a ripgrep build session needs fresh
explicit authorization after the probe verdict). CLI slot only; gitea remains the sole
service-shaped primary.
