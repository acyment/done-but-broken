# SWE-Milestone container-level verification — results v1

Executed against the frozen spec `SWE-MILESTONE-VERIFICATION-SPEC-v1.md`. Zero model/provider spend —
Docker + git + pytest only. Environment: OrbStack Docker Desktop on Apple Silicon, images are
`linux/amd64` (QEMU-emulated; slower than native, noted as a caveat, not a blocker).

---

## Step C — on-disk calibration

Pulled `burntsushi_ripgrep_14.1.1_15.0.0__base` (the lightest repo) and one milestone image built from
it (`milestone_seed_119407d_1_sub-01`).

| Image | Registry (compressed, manifest layer sum) | Local on-disk (`docker system df -v`) | Ratio |
|---|---|---|---|
| ripgrep `base` | 0.920 GB | 2.70 GB (0 B shared — first image) | **2.93×** |
| ripgrep milestone (built FROM base) | 0.943 GB total manifest (~0.023 GB incremental over base) | 2.73 GB total, **2.702 GB shared with base, only 26.75 MB unique** | incremental ≈ **1.16×** the incremental compressed bytes |

**Two different ratios, both worth keeping separate:**
- **Compressed→uncompressed expansion for a single image: ~2.9×**, higher than the ~2× estimate in
  `SUBSTRATE-SCREENS-v1.md §4`. Layer decompression + Docker's copy-on-write overhead account for the
  gap — the estimate there was a guess and undershot.
- **Cross-image layer sharing is real and matches the reassessment**: a second image built FROM the
  same base cost only ~27 MB unique on disk once the base was already local, not another 2+ GB. For
  planning N milestone images from the same repo: **base size once + a few tens of MB × N**, not N ×
  full image size.

Net effect on the disk plan: the *expansion ratio* is worse than estimated (2.9× not 2×), but the
*sharing benefit* is confirmed and dominates for any multi-image pull, so the original "~100 GB
comfortable for the scikit-learn two-arm study" planning number in the substrate screen still holds —
if anything the sharing finding makes it more comfortable, not less.

**Smoke test:** `docker run --rm <image> ls /testbed` succeeded; the debug entrypoint
`python -m harness.e2e.run_milestone --help` required `uv sync` (undocumented at the top of the spec,
trivial) but then ran cleanly. Pull→retag→run loop confirmed end to end. Proceeded to scikit-learn.

---

## Environment note (correcting the spec's assumed harness path)

The spec's preferred path (§4b) was: "find how `run_milestone.py` / `container_setup.py` construct the
graded gold baseline state, and reuse it." That code path is for **agent-driven trials** (network
lockdown, quarantine, live agent containers) and requires `--model`/`--agent` — out of scope (zero
model spend) and the wrong tool for a static git-state comparison. Went to the manual fallback per the
spec's own permission to do so.

**What the manual exploration found**, which the spec did not anticipate and which shaped the actual
method:

1. Per-milestone Docker images (`__m04`, `__m12_5`, etc.) do **not** carry independent, isolated git
   histories. `docker run --rm <M04 image> git tag` and `<M17 image> git tag` return the **same 24
   tags** (`milestone-{M01,M03,M04,M06,M11,M12.1..M12.5,M13,M17}-{start,end}`) — every per-milestone
   image is built by copying **one shared, fully-tagged git history** into `/testbed`, then checking
   out just that milestone's own tags to compile.
2. **The tags are ancestrally ordered, not independent branches.** Verified directly:
   `git merge-base --is-ancestor milestone-M12.5-end milestone-M04-start` → **YES**, and the same holds
   for every edge tested (`M12.4-end`→`M12.5-start`, `M12.3-end`→`M12.4-start`, `M12.2-end`→`M12.3-start`,
   `M03-end`→`M12.5-start`, `M11-end`→`M12.5-start`, `M06-end`→`M12.5-start`, `M01-end`→`M12.5-start`,
   `M12.2-end`→`{M01,M03}-start` — all YES). This means `milestone-B-start` already *is* "the gold
   chain up to B, applied" — no manual patch-stacking needed for the FULL/NO-OP states.
3. **Each milestone's `start..end` range is 2 commits** ("End state for M{id}" + occasionally an
   `[ENV-PATCH]` compatibility-stub commit baked in at *Docker image build time*, not present in the
   underlying tag on other images). The "End state" commit's **test-file diff is much larger than its
   src-file diff** and doesn't match the milestone's own `touched_src_files` list — test files track
   the *real upstream timeline* broadly (absorbing whatever the actual scikit-learn test suite looked
   like at that calendar date), while src changes stay scoped to the milestone's own listed commits.
   This explains the wild F2P counts for large/long milestones (M12.1: 872 F2P) — it's calendar-time
   test drift, not a dependency signal, and is why M12.1 was excluded from the tested chain (see below).
4. **Per-milestone images retag `milestone-{own id}-end/start` at build time** (the Dockerfile does
   `git checkout ...-end && <apply env-patch stub> && git commit && git tag -f ...-end HEAD`), mutating
   *only that milestone's own two tags* in that specific image. To avoid re-testing through a masking
   compatibility stub (one of which — `is_clusterer` — directly overlaps a dependency this spec exists
   to check), **all git state construction and test execution in this run uses a single container from
   the `__m17` image**, since M17 is not a source or target of any tested edge, so none of its tags are
   mutated and every tag we read stays pristine (unpatched).
5. **State construction method actually used**, given ancestral ordering:
   - **FULL** = `git checkout -f milestone-B-end` directly (already contains the full upstream chain).
   - **NO-OP** = `git checkout -f milestone-B-start` directly.
   - **MINUS-A** = `git rebase --onto milestone-A-start milestone-A-end milestone-B-end` — replays
     every commit after A (including B's own) onto A's pre-state, surgically excising exactly A's
     contribution while preserving order. A clean rebase = a resolvable state; a conflict is recorded
     verbatim and the edge defaults to INDETERMINATE per §5, not forced to a verdict.

---

## §4a — frozen selection (recorded before any FULL/NO-OP/MINUS-A run)

**Primary chain (4b/4c/§5, every consecutive edge tested): M12.2 → M12.3 → M12.4 → M12.5 → M04**
(5 milestones, 4 edges, chosen because every edge is FUNC/Strong ≥0.90 and it terminates in the
substrate screen's own flagship example M12.5→M04, giving both the "topological Infrastructure-Phase"
edges and the one named-symbol edge in a single chain of the requested 4–6 length.)

| Edge (A→B) | type | strength | confidence | rationale (verbatim) | B's F2P count |
|---|---|---|---|---|---|
| M12.2→M12.3 | FUNC | Strong | 0.90 | "Topological dependency - Phase 3a depends on Phase 2" | 17 |
| M12.3→M12.4 | FUNC | Strong | 0.90 | "Topological dependency - Phase 3b depends on Phase 3a" | 104 |
| M12.4→M12.5 | FUNC | Strong | 0.90 | "Topological dependency - Phase 4a depends on Phase 3b" | 47 |
| M12.5→M04 | FUNC | Strong | 0.95 | "M04 requires force_writeable parameter introduced in M12.5" | 1 |

**Calibration set (§4a, "if they exist... 2 high-confidence Strong + 2 low-confidence/auto-inferred"),
all targeting B=M12.5 except one targeting B=M01 (reuses the same FULL/NO-OP baselines where B repeats):**

| Edge (A→B) | type | strength | confidence | rationale (verbatim) | B's F2P count |
|---|---|---|---|---|---|
| M03→M12.5 | FUNC | Strong | 0.95 | "M12.5 tags revamp depends on M03 is_clusterer function" | 47 (shared w/ above) |
| M12.2→M01 | FUNC | Strong | 0.95 | "M01 commits depend on metadata routing commits in M12.2" | 10 |
| M11→M12.5 | FUNC | Weak | 0.70 | "Auto-inferred from commit-level dependencies" | 47 (shared) |
| M06→M12.5 | FUNC | Weak | 0.70 | "Array API foundation for validation phase" | 47 (shared) |

**Deliberately excluded:** `M12.1→M12.2` (M12.1's own F2P is 872 — see the calendar-time-drift finding
above; a MINUS-M12.1 rebase would confound "M12.1's semantic contribution" with "however much real
upstream test churn happened to land inside M12.1's 6-month commit window," which is exactly the kind
of confound §5's ENVIRONMENTAL bucket exists for. Flagged, not tested, in the time available.)
`M13→M04` (NFR/Weak/0.75 — explicitly a documentation-ordering rationale, not a functional claim; out
of scope for a functional-dependency check). `M01→M12.5` and `M12.5→M17` (Weak, redundant with the
already-selected weak calibration pair once M06/M11 are chosen).

---

## Environment finding that applied to every edge below

**Every checkout of an early-in-chain milestone (M12.3-end, and likely M12.4/M01) fails to even
collect its own F2P tests without two uniform, non-A-specific environment patches**, both already
established precedent in the harness's own per-milestone Dockerfiles (found via
`git log --all --oneline | grep -i frozen`):

1. `sklearn/frozen/` (the real `FrozenEstimator` implementation, cherry-picked from commit
   `16e222879a5`, itself already present in the shared history as `"[ENV-PATCH] Add missing
   sklearn.frozen module for test collection"`) — needed because test files sync to the *real*
   upstream timeline broadly (confirmed earlier by the M04/M12.5 diff-stat asymmetry finding), so an
   early-chain milestone's test files already reference a module that, in the artificial DAG
   curriculum, isn't introduced until M12.5.
2. A stub for `_yield_masked_array_for_each_param` in `sklearn/model_selection/_search.py`, appended
   verbatim from the M04 Dockerfile's own `apply_patches.sh`.

Both are applied identically across every FULL/NO-OP/MINUS-A state for every edge below — they do not
touch any file relevant to a tested A→B pair, so they cannot bias a verdict. This is a genuine
substrate finding, not a workaround invented for this check: **the DAG's artificial curriculum order
does not match the real chronological order the test suite was authored against**, and every
milestone before M12.5 needs this fix to even run its own graded tests. Worth carrying into the Step 5
decision regardless of the edge verdicts below.

---

## Per-edge results

### M12.2 → M12.3 (primary chain edge 1) — FUNC/Strong/0.90, "Topological dependency - Phase 3a depends on Phase 2"

- **FULL**: 17/17 F2P PASS (after the 2 uniform env patches). Sanity gate: PASS.
- **NO-OP**: 17/17 F2P FAIL. Discrimination gate (Step D): PASS, zero vacuous tests.
- **MINUS-M12.2**: rebase clean (no conflicts) → **12/17 PASS, 5/17 FAIL**.

**Verdict: MIXED — partially CONFIRMED, partially NOT DEPENDENT.**
- **CONFIRMED** for the 5 `permutation_test_score`-related tests: M12.2 changes
  `_check_params_groups_deprecation`'s signature from 3 to 4 positional args (verified directly in
  M12.2's own diff) and updates its own call sites; M12.3's own `permutation_test_score` code
  (added in M12.3's commits) also calls the 4-arg form. Remove M12.2 → `TypeError:
  _check_params_groups_deprecation() takes 3 positional arguments but 4 were given`. This is exactly
  the CONFIRMED pattern in §5: a traceback referencing the specific signature A introduced.
- **NOT DEPENDENT / CO-LOCATION** for the other 12 (`test_matthews_corrcoef*` ×10,
  `test_calibration_prefit` ×2): pass cleanly without M12.2, unrelated code paths.
- Full raw logs: `verification-raw/M12.2-M12.3/{FULL,NOOP,MINUS-M12.2}.log`.

**This is the single most important finding of the whole check**: a "Strong 0.90, Topological
dependency" edge label is not a monolithic claim. It bundles a genuine, verified symbol-level
dependency for roughly a third of the target's graded tests with complete independence for the rest.
Treating the DAG edge as a binary CONFIRMED/REFUTED fact (as a public claim would need to) would be
wrong in both directions — call it CONFIRMED and you overclaim for 12/17 tests; call it NOT DEPENDENT
and you miss a real, verifiable dependency for 5/17.

### M12.3 → M12.4 (primary chain edge 2) — FUNC/Strong/0.90, "Topological dependency - Phase 3b depends on Phase 3a"

- **FULL** (`milestone-M12.4-end` + 3 uniform env patches — a new one found here, see box below):
  104/104 F2P PASS (5.95s). Sanity gate: PASS.
- **NO-OP** (`milestone-M12.4-start`): 104/104 F2P FAIL (5.66s). Discrimination gate: PASS.
- **MINUS-M12.3** (`git rebase --onto milestone-M12.3-start milestone-M12.3-end HEAD`): rebase clean,
  no conflicts → **104/104 PASS** (5.36s).

**Verdict: NOT DEPENDENT / CO-LOCATION — clean, verified.** None of M12.4's 104 graded tests need
M12.3's contribution. Sanity-checked this isn't a false negative from a broken rebase: M12.3 adds a
`zero_division` parameter to `matthews_corrcoef` (confirmed in the previous edge's diff); in this
exact MINUS-M12.3 tree, `inspect.signature(matthews_corrcoef)` shows `(y_true, y_pred, *,
sample_weight=None)` — `zero_division` is genuinely gone, so the rebase did excise M12.3, and M12.4
still passes fully without it. This is the ChainSWE-style result the "Topological dependency"
rationale (0.90 confidence, same wording as the M12.2→M12.3 edge) would predict if the edges really
are just consecutive commit-window labels rather than functional prerequisites — and here, unlike
M12.2→M12.3, there is no partial signal at all. Full raw logs:
`verification-raw/M12.3-M12.4/{FULL,NOOP,MINUS-M12.3}.log`.

> **A third uniform env patch was needed to reach FULL sanity for M12.4**: `test_self_training.py`
> imports `SimpleEstimator` from `test_pipeline.py`, which does `from sklearn.utils.validation import
> _check_feature_names, check_is_fitted` and calls it in free-function style. Checked all 12
> milestone-end tags: `_check_feature_names` is a **method** on `BaseEstimator` in `base.py` in every
> one — never actually relocated to `validation.py` in this benchmark's curated commits, despite M04's
> own milestone description claiming that refactor happens. This looks like a genuine gap in the
> benchmark's curation (the LLM-written description overclaims a refactor that isn't in the curated
> commit set), not a DAG-ordering artifact like the other two patches. Fixed with a behavior-preserving
> shim (`def _check_feature_names(estimator, X, *, reset): return estimator._check_feature_names(X,
> reset=reset)`), not a mock — delegates to the real method, changes no test-relevant behavior. All 3
> patches consolidated into `/tmp/apply_env_patches.sh` for the remaining edges.

### M12.4 → M12.5 (primary chain edge 3) — FUNC/Strong/0.90, "Topological dependency - Phase 4a depends on Phase 3b"

**Verdict: INDETERMINATE — MINUS-A construction breaks on a real git merge boundary.**

- **FULL** (`milestone-M12.5-end` + env patches): the first attempt hit 6 collection errors across 3
  new symbols (`ClassifierTags`, `_estimator_has`, `sklearn.utils._test_common`). None have a real
  implementation anywhere in the benchmark's 12-milestone curated set — but the **official**
  `dockerfiles/M12.5/Dockerfile` (already shipped with the dataset) has its own verbatim stubs for
  exactly these three (plus `validate_data`), confirming the harness authors hit and solved the same
  gap. Copied those stubs verbatim (not invented) into `/tmp/apply_env_patches.sh`. Rebuilt: hit a
  **segfault** in polars' native `numpy_to_pydf` during
  `test_set_output_transform_configured[check_global_set_output_transform_polars-...]`, traced to the
  stub `get_tags`/tag classes (empty pass-through stubs, matching the official Dockerfile, not
  something invented here) feeding malformed metadata into polars' C extension. Scoped the F2P set
  down from 47 to 27 tests, excluding the `test_common.py` estimator-registry/set-output-transform
  cluster that exercises `all_estimators()` broadly (unrelated to any tested edge's actual claim).
  **27/27 PASS** on the scoped set (3.80s). Sanity gate: PASS, on a reduced, explicitly-flagged subset.
- **NO-OP** (`milestone-M12.5-start` + patches): needed a `--timeout=15` per-test guard —
  `IterativeImputer` convergence tests hang without M12.5's fix rather than failing fast (a genuine,
  non-vacuous signal, just slow). **27/27 FAIL** (8.90s with the guard). Discrimination gate: PASS.
  Notably `test_check_array_writeable_{mmap,df,np}` fail with `TypeError: check_array() got an
  unexpected keyword argument 'force_writeable'` — independent confirmation that `force_writeable`
  genuinely doesn't exist before M12.5, consistent with the M12.5→M04 rationale's premise even though
  that edge couldn't test it directly (see above).
- **MINUS-M12.4**: `git rebase --onto milestone-M12.4-start milestone-M12.4-end HEAD` produced a
  **100+ file conflict cascade** (build configs, docs, meson.build, pyproject.toml, ...) and was
  aborted. Root cause, verified directly: `git log --merges milestone-M12.4-end..milestone-M12.5-end`
  shows **three real merge commits** — `Intermediate merge: M01`, `Intermediate merge: M06`,
  `Intermediate merge: M11` — sitting inside the replay range. **The shared git history is not a
  linear chain; it's a real DAG**, and M12.5 is its actual convergence point (5 upstream dependencies:
  M12.4, M03, M01, M11, M06). `git rebase --onto` uses the default "apply" backend, which flattens
  merge commits into linear patches when a range crosses one — it tried to replay an entire other
  milestone's (M11's) commits as a patch against our tree, which conflicts on nearly everything.
  **This corrects an assumption stated earlier in this report**: `git merge-base --is-ancestor`
  returning YES proves reachability, not linearity, and the edges that constructed cleanly
  (M12.2→M12.3, M12.3→M12.4, M12.5→M04) all happen to sit on pure single-parent segments that never
  cross a merge boundary. Full logs: `verification-raw/M12.4-M12.5/{FULL,NOOP,MINUS-M12.4-FAILED}.log`.

**Consequence:** every edge targeting B=M12.5 (this one plus the three calibration edges below) hits
this exact structural wall — none could be constructed with the rebase-based method this check uses.
A merge-preserving rebase (`--rebase-merges`) or manual per-commit cherry-pick against a 3-way merge
might resolve this in a follow-up pass; not attempted here given the time already spent.

**This is a genuine, load-bearing methodological finding, not a workaround failure**: it means
leave-one-out edge verification (this spec's whole method) is straightforward for single-parent DAG
segments and structurally hard for any node with multiple real converging dependencies — which is
exactly the shape a "Strong" edge into a busy convergence node like M12.5 has. A study that only runs
milestones in the DAG's own prescribed order (an agent trial) never hits this, because it never needs
to *subtract* a specific upstream milestone from an already-merged state.

### M12.5 → M04 (primary chain edge 4, the substrate screen's flagship example) — FUNC/Strong/0.95, "M04 requires force_writeable parameter introduced in M12.5"

- **FULL** (`milestone-M04-end`, no env patches needed for this one): F2P PASS (0.61s). Sanity gate: PASS.
- **NO-OP** (`milestone-M04-start`): F2P FAIL — `Failed: DID NOT WARN. No warnings of type
  (FutureWarning,) were emitted.` Discrimination gate (Step D): PASS.
- **MINUS-M12.5** (`git rebase --onto milestone-M12.5-start milestone-M12.5-end milestone-M04-end`):
  rebase clean, one commit auto-dropped as "patch contents already upstream" (benign, not a
  conflict) → F2P **PASSED** (0.70s).

**Verdict: NOT DEPENDENT / CO-LOCATION — by this specific test — with an important caveat.**

M04's only F2P test (after the benchmark's own filtering) is
`test_birch_copy_deprecated`, which checks a `FutureWarning` on `Birch(copy=...)`. Diffed
`milestone-M12.5-end..milestone-M04-end` for `sklearn/cluster/_birch.py` and its test file: the
change is fully self-contained (imports `Hidden, StrOptions` from `_param_validation`, adds a
deprecation branch) — **no reference to `force_writeable` or anything M12.5 introduced.** Separately
confirmed the actual `force_writeable`-related tests
(`test_check_array_writeable_{mmap,df,np}`) are classified `pass_to_pass` in M04's own
`classification.json` — i.e. they pass identically at both M04-start and M04-end, so they were never
in the F2P set this check (or the benchmark's own agent evaluation) exercises at all.

**This means the flagship dependency this whole spec was written to check has a detection blind
spot, not a clean refutation**: the *claimed* mechanism (`force_writeable`, introduced by M12.5) may
well be real in M04's source code, but the *only graded test* M04 ships doesn't exercise it — it
happens to test an unrelated Birch deprecation that was bundled into the same milestone label. A
verdict of "M12.5→M04 is co-location, not a real dependency" would overclaim in the other direction:
correct for what we could test, silent on the actual claim. Full raw logs:
`verification-raw/M12.5-M04/{FULL,NOOP,MINUS-M12.5}.log`.

---

## Calibration set

FULL and NO-OP for all three of these are the same M12.5 states recorded in the M12.4→M12.5 section
above (same B, same 27-test scoped subset, same sanity/discrimination results — PASS/PASS). All three
share M12.4→M12.5's MINUS-A blocker: `git log --merges` confirms `Intermediate merge: M03` does **not**
appear as a separate merge (M03 merges in earlier, before M11, per the DAG: M12.2→M03), but
`Intermediate merge: M11` and `Intermediate merge: M06` both sit inside `milestone-{M11,M06}-end..
milestone-M12.5-end` exactly as they did for M12.4, and M03's own replay range still crosses the M01/
M06/M11 merge points on the way to M12.5-end. None were attempted given the confirmed structural
blocker and the time already spent — attempting each individually would only reproduce the same
100+-file conflict cascade already diagnosed once for M12.4.

### M03 → M12.5 — FUNC/Strong/0.95, "M12.5 tags revamp depends on M03 is_clusterer function"

**Verdict: INDETERMINATE** — same MINUS-A construction blocker as M12.4→M12.5 (rebase range crosses
real merge commits). Not attempted; see reasoning above.

### M12.2 → M01 — FUNC/Strong/0.95, "M01 commits depend on metadata routing commits in M12.2"

**Not reached.** This edge targets a different B (M01, not M12.5) and does not share the M12.5
merge-boundary blocker — `M12.2-end..M01-end` should in principle be a clean single-parent segment,
the same shape as the three edges that worked. Not attempted due to time: this check ran roughly 4
hours against the spec's own 3-hour checkpoint (§7), and finishing the primary chain plus the M12.5
calibration attempts took priority. A follow-up session could very plausibly complete this one
cheaply, following exactly the M12.2→M12.3 pattern (get M01's F2P list from
`test_results/M01/M01_classification.json`, 10 tests; FULL = `milestone-M01-end`, NO-OP =
`milestone-M01-start`, MINUS-M12.2 = `git rebase --onto milestone-M12.2-start milestone-M12.2-end
milestone-M01-end`).

### M11 → M12.5 — FUNC/Weak/0.70, "Auto-inferred from commit-level dependencies"

**Verdict: INDETERMINATE** — same MINUS-A construction blocker (M11 is literally one of the three
merge commits that broke the M12.4→M12.5 rebase). Not attempted as a separate run.

### M06 → M12.5 — FUNC/Weak/0.70, "Array API foundation for validation phase"

**Verdict: INDETERMINATE** — same MINUS-A construction blocker. Not attempted as a separate run.

---

## Summary table

| Edge (A→B) | type/strength/confidence | Verdict | Basis |
|---|---|---|---|
| M12.2→M12.3 | FUNC/Strong/0.90 | **MIXED**: 5/17 CONFIRMED, 12/17 NOT DEPENDENT | Verified: `_check_params_groups_deprecation` signature change |
| M12.3→M12.4 | FUNC/Strong/0.90 | **NOT DEPENDENT** (104/104) | Verified clean, sanity-checked against false negative |
| M12.4→M12.5 | FUNC/Strong/0.90 | **INDETERMINATE** | MINUS-A crosses a real git merge boundary |
| M12.5→M04 | FUNC/Strong/0.95 | **NOT DEPENDENT by available test** (caveat: F2P blind spot) | `force_writeable` claim untested by M04's only F2P test |
| M03→M12.5 | FUNC/Strong/0.95 | **INDETERMINATE** | Same merge-boundary blocker |
| M12.2→M01 | FUNC/Strong/0.95 | **NOT REACHED** | Time budget |
| M11→M12.5 | FUNC/Weak/0.70 | **INDETERMINATE** | Same merge-boundary blocker |
| M06→M12.5 | FUNC/Weak/0.70 | **INDETERMINATE** | Same merge-boundary blocker |

---

## Substrate-level gate (§5, frozen decision rule)

**PASS** requires (a) a majority of tested Strong edges verify CONFIRMED, **and** (b) at least one 4+
milestone chain in which every consecutive edge is CONFIRMED.

**Verdict: FAIL.**

- **(b) fails outright, independent of the INDETERMINATE edges.** The primary chain
  (M12.2→M12.3→M12.4→M12.5→M04) cannot have "every consecutive edge CONFIRMED" — M12.2→M12.3 is at
  best MIXED (not a clean CONFIRMED), and M12.3→M12.4 plus M12.5→M04 both verified NOT DEPENDENT. No
  amount of resolving the INDETERMINATE M12.4→M12.5 edge can produce a fully-CONFIRMED 4+ chain,
  because two of the other three edges are already settled as not-CONFIRMED.
- **(a) also fails.** Of the 4 tested Strong edges with a real verdict (M12.2→M12.3, M12.3→M12.4,
  M12.5→M04, M03→M12.5 is INDETERMINATE so excluded): zero are a clean, full CONFIRMED. One (M12.2→
  M12.3) is CONFIRMED for a minority (5/17) of its own target's tests. That is not a majority of tested
  Strong edges verifying CONFIRMED under any reasonable reading of "verifies as CONFIRMED."

Per §5: **"most Strong edges are NOT DEPENDENT or ENVIRONMENTAL. Then the DAG is co-location like
ChainSWE, SWE-Milestone falls as a substrate for a dependency claim, and Route 2 returns to hand-built
episodes. A FAIL is a valuable, cheap answer — report it plainly."** That is the finding here, with
one important qualifier the spec's binary framing doesn't capture: **the one edge that did verify
CONFIRMED behavior (M12.2→M12.3's signature dependency) was real, specific, and independently
verified against the source diff** — this is not a clean ChainSWE-style "zero real dependencies"
result. It is a "the DAG mixes real dependencies with co-location under the same label, and the mix
skews toward co-location for the tested Strong edges" result, which is a different and more precise
failure mode than a flat rejection.

## Confidence-score calibration

The dataset's `confidence_score` did **not** reliably predict the verdict among tested edges:

| Edge | confidence_score | Verdict |
|---|---|---|
| M12.5→M04 | 0.95 | NOT DEPENDENT (by available test) |
| M12.2→M12.3 | 0.90 | MIXED (5/17 CONFIRMED) |
| M12.3→M12.4 | 0.90 | NOT DEPENDENT |

The single highest-confidence edge tested (0.95) resolved to NOT DEPENDENT-by-available-test; the two
0.90 edges split between MIXED and clean NOT DEPENDENT; the only edge that produced a clean,
independently-verified CONFIRMED signal for *any* of its tests was one of the 0.90s, and only for
5 of its 17 tests. With only 3 edges reaching a real (non-INDETERMINATE) verdict, this is far too
small a sample to compute a real correlation, but the direction of what little data there is runs
counter to "higher confidence_score predicts CONFIRMED" — worth a specific note for Step 5 given the
substrate screen flagged this exact question as open. The rationale *text* (specific named symbols
like `force_writeable`, `is_clusterer`, `_check_params_groups_deprecation` vs. generic "Topological
dependency" / "Auto-inferred from commit-level dependencies" phrasing) was not a clean predictor
either — the one CONFIRMED signal came from a "Topological dependency"-labeled edge (M12.2→M12.3),
the same generic label as the clean NOT-DEPENDENT M12.3→M12.4 edge.

## What the spec's procedure got wrong or didn't anticipate

1. **§4b's preferred path (`run_milestone.py`/`container_setup.py`) is for live agent trials**, not a
   static two-state comparison — requires `--model`/`--agent`, network lockdown, quarantine. The
   manual fallback (§4b's own permitted alternative) was the only viable path from the start; worth
   updating the spec to say so directly rather than "prefer" the agent-trial path.
2. **The ancestral, shared-history tag structure was not anticipated.** The spec's own table (§4b)
   describes constructing states by "apply gold implementation patches for the chain up to B in
   order" as if patches needed manual stacking. In practice `milestone-B-start`/`-end` are direct
   checkouts in one shared repo — simpler than the spec assumed, until it wasn't (see next point).
3. **The shared history is a DAG with real merge commits, not a linear chain** — discovered only when
   `git rebase --onto` catastrophically failed on M12.4→M12.5. `git merge-base --is-ancestor`
   returning YES (used throughout §4a/4b of this report to justify the method) proves reachability,
   not a safely-replayable linear path. This is the single biggest correction to make to any future
   version of this spec: **check for merge commits in the replay range before choosing rebase --onto**,
   and prefer `git rebase --onto ... --rebase-merges` or a different construction method entirely for
   any B with more than one direct dependency edge into it.
4. **Calendar-time test-file drift is real and escalates deeper into the DAG's declared order.** M12.3
   needed 2 uniform env patches to reach FULL sanity; M12.4 needed 3; M12.5 needed 6 (plus a segfault
   workaround). The spec's Step C/D language assumes FULL sanity is close to automatic; in practice it
   was the majority of the wall-clock cost of this whole check.
5. **The harness's own official per-milestone Dockerfiles are inconsistent in patch fidelity** — some
   env patches backport the *real* upstream implementation (the `sklearn.frozen` module, found via
   `git log --all | grep frozen`), others are empty pass-through stubs (M12.5's own
   `ClassifierTags`/`_estimator_has`/tag-system stubs, verified by reading
   `dockerfiles/M12.5/Dockerfile` directly), and at least one of those stubs is fragile enough to
   segfault a native dependency (polars) under a broad enough test. This means the benchmark's own
   "gold" per-milestone images are not uniformly gold — a caveat beyond what `SUBSTRATE-SCREENS-v1.md`
   flagged.
6. **F2P-based dependency verification has a detection blind spot the spec doesn't name**: a milestone
   can genuinely depend on an earlier milestone's contribution in its source code, while the *only*
   graded F2P test that survived the benchmark's own filtering exercises something unrelated (M04's
   case exactly). The method this spec specifies can only speak to what the available F2P set actually
   exercises, not to the underlying claim in general — worth stating as an explicit limitation up
   front in any successor spec, not just discovered mid-run.
7. **Slow-not-failing tests need a timeout guard**: `IterativeImputer` at M12.5's NO-OP state hangs
   rather than failing fast without a `--timeout` flag on pytest. Not mentioned anywhere in the spec's
   procedure; without noticing it, a run could silently stall indefinitely on the discrimination gate.
