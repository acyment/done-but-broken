# The black-4684 exclusion: what the record shows and does not show (2026-07-20)

**Purpose.** `hit-sdd-bench-e2/e2-phase1-5-PLUS-black4684-CONTAMINATED-do-not-cite.json` sits
untracked in the harness repo root. Its filename says "CONTAMINATED — do not cite." Anyone who finds
it without this note will reasonably suspect the program cherry-picked a task out of a published
result. This note lays out what is independently verifiable from the data and code, what two
existing prose accounts say (and where they disagree with the data and with each other), and what
remains genuinely unknown. **It does not conclude the exclusion was proper or improper** — that
judgment isn't supported by what's recorded, one way or the other.

Every claim below was independently re-derived from the artifacts, not transcribed from a prior
summary. Where a supplied lead turned out to be imprecise, that is flagged explicitly.

## What the file is

- `run_id: "e2-phase1-5-causal-pilot-deepseek-v4-pro"` — **the same run id as the published DeepSeek
  pilot** (`e2-phase1-5-causal-pilot-deepseek-v4-pro.json`).
- 200 records (10 tasks × 2 arms × 10 runs), vs. the published file's 180 records (9 tasks).
  **Confirmed: the one additional task is `psf__black-4684`, in full** (10 control + 10 treatment
  records, zero errors).
- Analysis verdict: `n_tasks: 10, n_hits: 9, family_wise_null_p: 1.865234375×10⁻¹¹`. The published
  (9-task) file's verdict is `n_hits: 8, family_wise_null_p: 3.359×10⁻¹⁰`. **The 10-task version is
  the statistically stronger result** — lower family-wise p, one more significant task.
- `psf__black-4684`'s own per-task numbers in this file: `effect: 0.9, p_value: 0.0001,
  meets_mcid: true, control_gap_rate: 1.0, treatment_gap_rate: 0.1` — a clean hit.
- File mtime: **2026-06-17 13:41:47**. The published (9-task) file's mtime: **2026-06-17 13:43:44** —
  **two minutes later, same session, same day** as the original DeepSeek pilot run (the run-card
  records the run date as 2026-06-17). This file is not a later re-run or repair; it was produced
  essentially simultaneously with the published artifact.

## The filename says "contaminated." The recorded cause is not contamination.

Independently verified, three separate ways, that `psf__black-4684` was a legitimate, screened,
certified member of the task pool this pilot drew from:

1. **Pool membership.** `examples/run_phase1_5.py:39` lists `"psf__black-4684"` in `CERTIFIED`, the
   frozen 13-task list the harness runs against.
2. **Contamination screen (GATE-B).** `e2-phase1-5-gateb-poolv2-new-deepseek-v4-pro-20260615-001.json`
   — the actual contamination/memorization screen for the E2 Phase-1.5 pool — has a `psf__black-4684`
   row: `file_path_hit_rate: 0.5, memorized_verbatim: false, high_localization: false, excluded:
  false`. It is in the file's `clean_set` (10 of 10 clean). Screened clean, not contaminated.
3. **Flake certification.** `e2-phase1-5-flake-certify-poolv2-20260615-001.json`:
   `psf__black-4684 → completed_runs: 60/60, flaky_fraction: 0.0, flake_certified: true`. Also listed
   in `docs/protocols/e2-phase1-pilot-commitments-v1-addendum-b.md`'s sealed 13-task certified table
   with the same numbers (441 tests, 60/60, 0 flaky, 91.2 min cert wall time).

So: pool member, contamination-clean, flake-certified. Nothing in the screening record supports the
filename's "contaminated" label. The actual mechanism documented for excluding black-4684 is
**infrastructural**, not a contamination finding — see below. **The filename is misleading about the
reason**, whatever the merits of the exclusion itself.

## "Strongest task in the set" — partially confirmed, one correction

The supplied lead described black-4684 as "the strongest task in the set." Re-ranking all 10 tasks in
this file by p-value then effect size:

| rank | task | effect | p |
|---|---|---:|---:|
| 1 | `pypa__twine-1249` | 1.00 | 0.0000 |
| 2 | `django-guardian__django-guardian-899` | 0.90 | 0.0000 |
| 3 (tie) | `koxudaxi__datamodel-code-generator-2408` | 0.90 | 0.0001 |
| 3 (tie) | **`psf__black-4684`** | **0.90** | **0.0001** |
| 5 | `koxudaxi__datamodel-code-generator-2461` | 0.90 | 0.0002 |

**Correction:** black-4684 is tied for third-strongest by exact p-value (tied with
datamodel-code-generator-2408), not the single strongest — `twine-1249` (effect 1.00) and
`django-guardian-899` (effect 0.90, lower p) both rank ahead of it. It is fair to call it "one of the
strongest results in the set" or "top-tier"; "the strongest" overstates it slightly. Either way, it
was a full hit that would have strengthened, not weakened, the published result.

## Two documented rationales exist, and neither one, checked against this file's own data, is a clean fit

This is the part that most needs surfacing plainly, because the two accounts already in the record
don't agree with each other, and neither fully matches what the raw records for black-4684 in *this
file* actually show.

**Rationale 1 — an infrastructure/empty-arm failure, recorded in code.**
`src/hit_sdd_e2/orchestrate/phase1_5_analysis.py:17-19` (comment) and `:119-120` (comment):

> "v1.1 EXCLUDES empty-arm tasks (an arm with zero valid runs) from the family — previously such a
> task raised ZeroDivisionError and was excluded by hand (the black-4684 treatment-n=0 case)."
> ... "Formalizes the manual black-4684 (treatment n=0) exclusion."

The commit that added this comment (`aab6a21`, 2026-06-23) says the same thing in its message,
and adds: "verified by replay: v1.1 reproduces the sealed DeepSeek (8/9, p=3.36e-10) and qwen (n9
5/9; all-valid 6/12 with black-4684 auto-excluded) verdicts."

**Problem:** in *this* file (the DeepSeek "PLUS black4684" artifact), black-4684's treatment arm is
**not empty** — it has 10 complete records, zero errors. A treatment-n=0 empty-arm condition did
occur, but independently verified, it occurred in the **qwen** run: qwen's
`e2-phase1-5-causal-pilot-qwen3.7-max.json` has 20 black-4684 records (10 control, 10 treatment), of
which **16 carry a Docker error** (`docker create ... returned non-zero exit status 1`) — 10 of 10
treatment records errored, 6 of 10 control records errored, leaving control n=4 / treatment n=0. That
is an exact match for the "treatment n=0" story. It is not what happened in the DeepSeek data.

So the code comment's specific claim ("black-4684, treatment n=0") is verified **for qwen**, not for
the DeepSeek file at hand. Whether an *earlier*, unpreserved DeepSeek attempt also hit a treatment-n=0
failure (prompting the original "excluded by hand" precedent, later carried forward even after a
clean run was obtained) cannot be confirmed or ruled out — no such earlier DeepSeek artifact survives
in the record. This is a genuine gap, not a resolved point.

**Rationale 2 — a navigation confound, recorded in prose docs.**
The DeepSeek run-card (`docs/run-cards/e2-phase1-5-causal-pilot-deepseek-v4-pro-20260617-001.md`)
groups black-4684 with three other tasks:

> "n = 9 of the 13 certified tasks. The 4 large/complex repos (black ×2, attrs, kafka-python) were
> **deferred** — they thrash the file-editor-only control to the iteration cap (a navigation
> confound...)."

`docs/protocols/e2-protocol-v2-large-repo-navparity-design-v1.md` (2026-06-21) repeats this framing
more explicitly: "The 4 largest certified repos — `psf__black-4684`, `psf__black-4670`,
`python-attrs__attrs-1448`, `dpkp__kafka-python-2608` — were **excluded from the DeepSeek headline
(n=9)** ... because the control arm (file_editor, no shell) cannot navigate a large codebase." The
public protopaper (`docs/papers/e2-executable-feedback-protopaper-v1.md:141`) repeats the same
four-repo grouping and separately notes only that "for Qwen, one of these, black-4684, was further
excluded for a container-infrastructure failure" — i.e. the *public* document attributes the
infra-failure explanation to qwen only, and folds DeepSeek's black-4684 into the generic
navigation-confound group with no distinct explanation.

**Problem:** checking this file directly, black-4684's control arm does **not** show the profile the
"thrashed to the iteration cap" story predicts. Its `control_gap_rate` is 1.0 (all 10 control runs
declared done falsely) — the same shape as several *other, genuinely included* tasks in the published
9 (e.g. `mlco2__codecarbon-831`, `celery__kombu-2300`, also 1.0), not evidence of stalling or
non-completion. There are zero errors in any of black-4684's 20 records. Its 441-test suite is
comparable in size to several included tasks (`celery__kombu-2300` has 1,089 tests, roughly 2.5x
larger, and is in the published 9) and far smaller than `python-attrs__attrs-1448` (1,331 tests) or
`dpkp__kafka-python-2608` (1,465 tests) — the two tasks in the "4 large repos" group that, unlike
black-4684, have **zero records anywhere in either headline artifact** (never run at all in the
DeepSeek pass, consistent with a genuine, prospective "too large to attempt" deferral). By test-suite
size and completion profile, black-4684 does not obviously belong in the same bucket as attrs/kafka.

**Net: the record contains two different rationales for the same absence, and independently checking
each against black-4684's own DeepSeek records, neither is a precise match.** The empty-arm/infra
story is real and verified — for qwen. The navigation-confound story is real and verified — for
attrs and kafka-python, which were never run at all. Applied specifically to DeepSeek's black-4684,
which *did* run, completely, cleanly, and with a strong effect, neither story is fully consistent
with what the data shows. This is presented as an open discrepancy, not a resolved one.

## An existing "verified" correction in `E5-BRIEFING-PACKET-v1.md` is itself wrong

Separately, and worth flagging precisely because it is currently labeled **[VERIFIED against code]**
in this repo's own untracked briefing packet
(`docs/e5/E5-BRIEFING-PACKET-v1.md:298-306`, section "Two corrections to earlier accounts"): that
document claims black-4684 "is recorded `qualified: false` in **both** pool-screen artifacts, failing
the reproduction and wiring checks — it never belonged in the pool," and calls the prior
navigation-confound inference "wrong."

**This claim is itself wrong, and for the exact reason flagged in this task's brief: it reads the
wrong screening file.** `runs/pool-screen/pool_screen.json` and `pool_screen_midtier.json`
(both independently re-checked here) are produced by `examples/screen_task_pool.py` for the
**authored-spec / Gherkin-authoring line** — a different experiment with its own candidate pool of
~1,000 SWE-bench-Live instances, scored on authorability heuristics (`s1_wiring`, `s2_preservation`,
`s3_clauses`, `s4_state`, `s6_input_class`, `s7_literal_tokens`, per `pool_screen.md`'s own header:
"Heuristic ranking only; authoring gates remain the admission ground truth"). Black-4684 does show
`qualified: false` in both of those files — but "qualified" there means "qualifies as a good
candidate for hand/model-authored executable-spec writing," not "qualifies for the E2 Phase-1.5
causal-pilot pool." The actual E2 Phase-1.5 pool screen
(`e2-phase1-5-gateb-poolv2-new-deepseek-v4-pro-20260615-001.json`, checked above) shows black-4684
`excluded: false`, clean. Two unrelated pipelines share the word "qualified"/"excluded"; the briefing
packet conflated them. A short status note has been added to the top of that packet pointing here
(see `docs/e5/E5-BRIEFING-PACKET-v1.md`'s header) — the packet's body text itself was left unedited
per instruction, since fixing draft content is out of scope for this note.

## What the exclusion removed

The published DeepSeek headline (n=9, 8 hits, family-wise p≈3.36×10⁻¹⁰) is the version without
black-4684. Including it (this file: n=10, 9 hits, family-wise p≈1.865×10⁻¹¹) would have been a
**stronger** result on every axis that was reported — more hits, a smaller (better) family-wise null
p, one more top-tier effect size. The exclusion, whatever its reason, cost the published result
statistical power rather than protecting it from a weak or contaminated data point.

## What remains genuinely unknown

- **Who decided** to drop black-4684 from the published DeepSeek file, and **when** relative to the
  ~2-minute gap between the two files' mtimes on 2026-06-17.
- **Why**, if the DeepSeek treatment arm was complete and clean at the time, the exclusion happened
  at all for this specific task on this specific day — as opposed to being deferred prospectively
  like attrs/kafka/black-4670 (which have no records at all, i.e. were never attempted).
- Whether an earlier DeepSeek attempt at black-4684 *did* hit a treatment-n=0 infrastructure failure
  (matching the code comment) that was later fixed within the same working session, producing this
  clean re-run, with the exclusion decision simply never revisited afterward. No artifact of an
  earlier, broken DeepSeek black-4684 attempt survives to confirm or refute this.
- Whether re-including black-4684 in the published result was ever considered and rejected, or simply
  not revisited.
- The exact commit or working session that produced the navigation-confound framing in the run-card
  and design doc, and whether the author of that framing had this file (with black-4684's complete,
  clean data) in view at the time.

None of the above is resolvable from the artifacts and code currently in the repo. This note
describes the record as it stands, not a reconstruction of intent.

## Sources checked directly for this note

- `hit-sdd-bench-e2/e2-phase1-5-PLUS-black4684-CONTAMINATED-do-not-cite.json` (records + analysis)
- `hit-sdd-bench-e2/e2-phase1-5-causal-pilot-deepseek-v4-pro.json` (published; confirmed 180 records,
  9 distinct instance ids, zero black-4684 records of any kind)
- `hit-sdd-bench-e2/e2-phase1-5-causal-pilot-qwen3.7-max.json` (black-4684 records + Docker errors)
- `hit-sdd-bench-e2/examples/run_phase1_5.py:39` (`CERTIFIED` pool list)
- `hit-sdd-bench-e2/e2-phase1-5-gateb-poolv2-new-deepseek-v4-pro-20260615-001.json` (GATE-B, E2 pool)
- `hit-sdd-bench-e2/e2-phase1-5-flake-certify-poolv2-20260615-001.json` (flake cert, E2 pool)
- `hit-sdd-bench-e2/runs/pool-screen/pool_screen.json`,
  `hit-sdd-bench-e2/runs/pool-screen/pool_screen_midtier.json`,
  `hit-sdd-bench-e2/runs/pool-screen/pool_screen.md`,
  `hit-sdd-bench-e2/examples/screen_task_pool.py` (authored-spec pool — the *different* experiment)
- `hit-sdd-bench-e2/src/hit_sdd_e2/orchestrate/phase1_5_analysis.py` and its git history
  (`git log -p`, commit `aab6a21`)
- `hit-sdd-bench/docs/run-cards/e2-phase1-5-causal-pilot-deepseek-v4-pro-20260617-001.md`
- `hit-sdd-bench/docs/run-cards/e2-phase1-5-causal-pilot-qwen3.7-max-20260623.md`
- `hit-sdd-bench/docs/protocols/e2-phase1-pilot-commitments-v1-addendum-b.md`
- `hit-sdd-bench/docs/protocols/e2-protocol-v2-large-repo-navparity-design-v1.md`
- `hit-sdd-bench/docs/papers/e2-executable-feedback-protopaper-v1.md:141`
- `hit-sdd-bench/docs/e5/E5-BRIEFING-PACKET-v1.md:289-306`
- `hit-sdd-bench/BACKLOG.md:367` (Protocol v2 backlog entry, repeats the four-repo grouping)
