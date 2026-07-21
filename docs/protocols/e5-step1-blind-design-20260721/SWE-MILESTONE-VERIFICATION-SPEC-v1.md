# SWE-Milestone container-level verification — pre-registered spec v1

**Written 2026-07-21, before any container run, in the Opus session that holds the Step-1 nuance.**
**Frozen.** The decision rules in §5 are sealed before results exist; do not amend them after seeing
any output. If a rule turns out wrong, write a numbered successor spec — do not edit this one.

**Who runs this.** A fresh session (Sonnet is fine — the execution is mechanical; the judgment is
pinned by §5 so it is not left to the driver's discretion). Read this whole file before touching
Docker.

**Cost.** **Zero model/provider spend.** No agent-under-test runs, no API calls to any model under
evaluation. This is Docker + git + test-suite execution only. It consumes disk and wall-clock, not
budget. Nothing here authorizes any experiment spend, and **passing this gate does not commit to
Route 2** — it produces a lead that feeds the Step 5 decision (`docs/e5/CRITIQUE-PROCESS-v1.md`).

---

## 1. What this verifies, and what it does not

The substrate screen (`SUBSTRATE-SCREENS-v1.md`) rated SWE-Milestone a **qualified go** from paper +
metadata reads, and flagged **one disqualifier that only a container run can settle**: the dependency
DAG is model-authored with a `confidence_score`, not per-edge verified. The screen's own words: a
skeptical reader "will see `confidence_score: 0.70` and the rationale 'Auto-inferred from commit-level
dependencies' next to a 'Strong' label, and say: your dependent changes are an LLM's guess dressed up
as a DAG." **This spec settles whether the edges are real requirement dependencies or co-location** —
the exact question that rejected ChainSWE.

In scope (all zero model-spend):
- **P — the primary check: leave-one-out edge verification** on scikit-learn (the one repo that fits
  both a stable public surface and the existing Python Gherkin tooling).
- **D — per-check discrimination:** does each target test fail on the no-op and pass on gold
  (`AGENTS.md`, discriminating-check precondition).
- **C — on-disk calibration:** one light image pulled to replace the layer-sharing *estimate* with a
  measured number.

Explicitly OUT of scope (needs authored material or spend, deferred to later Pass-3 work): authoring
`.feature` scenarios; the defective-variant transfer floor (C4); any two-arm agent run; contamination
probing. Do not attempt these.

**Standing caution.** Two agent findings in the Step-1 review were written up confidently and demoted
on inspection. This check's entire value is rigor about *why a test fails*. A confident-but-wrong
"dependency confirmed" is worse than an honest "indeterminate." Default to the weaker verdict when the
evidence is not clean.

---

## 2. Environment setup

A fresh session has a new scratchpad and none of this session's clones. Rebuild:

1. Work only under this session's scratchpad dir. Never write into the user's project tree except the
   report and artifacts named in §6.
2. `docker login` first — anonymous DockerHub pulls are rate-limited.
3. Clone the harness fresh: `git clone https://github.com/DeepCommit-ai/SWE-Milestone` (redirects from
   `Hydrapse/EvoClaw`). Confirm tag `v1.0` and MIT `LICENSE`.
4. Fetch the dataset metadata (patches, `classification.json`, `dependencies.csv`, `SRS.md`) from HF
   `DeepCommit-ai/SWE-Milestone-data` — metadata/patches only; do not LFS-pull images from HF.
5. Disk: operator has ~176 GB free. scikit-learn images are ~3.7 GB/img compressed. Pull **only the
   selected chain's** milestone images + `base` + `base-offline`, not the whole repo. Use
   `scripts/pull_images.sh --repo scikit-learn --dry-run` to see the plan, then pull selectively (read
   `harness/e2e/image_version.py` for finer filtering). `docker rmi` between edges if disk tightens.

## 3. Step C — on-disk calibration (do this first, it is cheap and de-risks the rest)

1. Pull one ripgrep milestone image (~1 GB compressed, the lightest repo).
2. Record actual on-disk size (`docker system df -v`) vs the compressed registry figure. Report the
   real ratio — this replaces the ~2× layer-sharing estimate in `SUBSTRATE-SCREENS-v1.md §4`.
3. Start a container from it and run one trivial command (`ls`, or the harness single-milestone debug
   entrypoint `python -m harness.e2e.run_milestone --help`) to confirm the pull→retag→run loop works
   end to end before committing to scikit-learn. If this fails, stop and report — do not proceed to P.

## 4. Step P — leave-one-out edge verification (the primary deliverable)

### 4a. Selection, recorded BEFORE any run
From `dependencies.csv` for scikit-learn, pick **one chain of 4–6 milestones** whose consecutive
edges you will test. Record, before running: each edge, its `type` (Strong/Weak/TEXT/NFR), its
`confidence_score`, and its verbatim `rationale`. **Also pick, if they exist in scikit-learn's DAG,
2 high-confidence "Strong" edges and 2 low-confidence / "auto-inferred" edges** as a calibration set —
we want to know whether the confidence label predicts the verdict. Freeze this selection in the report
before executing.

### 4b. The three states, per edge A→B (B depends on A)
Prefer the harness's own gold-application path (find how `run_milestone.py` / `container_setup.py`
construct the graded "gold" baseline state, and reuse it — more faithful than hand-rolled `git apply`).
Fallback is manual: from the base commit, apply gold **implementation** patches for the chain up to B
in order, then B's **test** patch, then run B's `fail_to_pass` IDs from `classification.json`.

Construct three states and run B's `fail_to_pass` target tests in each:

| State | Chain applied (gold impl) | B impl | B test patch | B's F2P expected |
|---|---|---|---|---|
| **FULL** (sanity) | all milestones before B, incl. A | yes | yes | PASS |
| **NO-OP** (discrimination, Step D) | all before B, incl. A | **no** | yes | FAIL |
| **MINUS-A** (the test) | all before B **except A** | yes | yes | ? |

Record for every state: did each patch **apply cleanly** (yes/no, and the conflict if not); did tests
**collect** (yes/no); each F2P id's **pass/fail**; and for any failure, the **traceback / assertion
text** (this is load-bearing — a verdict without a saved failure reason is invalid).

### 4c. Sanity gates (abort the edge, do not force a verdict, if these break)
- FULL must PASS B's F2P. If it does not, the state construction is wrong — fix it or mark the edge
  INDETERMINATE and say why.
- NO-OP must FAIL B's F2P (Step D). A target test that PASSES on the no-op is **vacuous** — flag it,
  exclude it from the edge verdict, and report the count. (This is the per-check discrimination rule.)

## 5. The decision rule — FROZEN

### Per-edge verdict (from the MINUS-A result, after the 4c gates pass)
- **CONFIRMED requirement dependency** — B's F2P **fails** in MINUS-A, **and** the failure is
  *semantic*: the traceback shows B's code or test referencing a symbol/attribute/behavior that A
  introduced (e.g. `AttributeError`/`ImportError`/`NameError` on the exact symbol A added, or an
  assertion on behavior A implements). This matches a genuine "Strong" rationale like "M04 requires the
  `force_writeable` parameter introduced in M12.5."
- **CO-LOCATION / NOT DEPENDENT** — B's F2P **passes** in MINUS-A. B does not need A's behavior. This
  is the ChainSWE outcome. (If B's *impl patch* would not apply without A but the test still passes once
  you resolve the textual conflict, that is textual co-location, not requirement dependency — record it
  as NOT DEPENDENT with a note.)
- **ENVIRONMENTAL (not dependency)** — B's F2P fails in MINUS-A but the failure is a build/collection
  error, an unrelated missing import, a patch-application conflict, or a flake — *not* a reference to
  A's semantic contribution. Removing A broke something incidentally. **This does NOT count as
  dependency.** Defaulting a build breakage to CONFIRMED is the exact error this spec exists to prevent.
- **INDETERMINATE** — cannot construct MINUS-A (B's patch won't apply and the conflict can't be cleanly
  resolved), or the failure can't be classified. Record and move on. Do not force a verdict.

### Substrate-level gate for scikit-learn (pre-registered)
- **PASS** — a **majority of tested Strong edges** verify as CONFIRMED, **and** at least one 4+
  milestone chain exists in which **every consecutive edge is CONFIRMED** (you need one genuinely
  dependent chain to run a study on).
- **FAIL** — most Strong edges are NOT DEPENDENT or ENVIRONMENTAL. Then the DAG is co-location like
  ChainSWE, SWE-Milestone falls as a substrate for a dependency claim, and Route 2 returns to
  hand-built episodes. A FAIL is a valuable, cheap answer — report it plainly.
- **Report regardless:** the confidence-score calibration — did `confidence_score` / the Strong-vs-
  auto-inferred label predict the verdict? This is worth knowing even on a PASS.

## 6. Output

Write `SWE-MILESTONE-VERIFICATION-RESULTS-v1.md` in this directory:
- Step C calibration number (real on-disk ratio).
- The frozen §4a selection table.
- A per-edge table: edge, type, confidence, verdict, and the **one-line failure reason** behind each
  CONFIRMED/ENVIRONMENTAL call.
- The substrate-level PASS/FAIL against §5, and the confidence-score calibration.
- Anything the spec's procedure got wrong (this spec is a draft; flag its errors like any other).

Save raw artifacts (patch-apply logs, full test output per state per edge) under a `verification-raw/`
subdir so every verdict is auditable. Commit the report and artifacts; **do not push** (this repo's
standing pattern is operator-pushed). Separate what you verified by running from what you inferred.

## 7. Stop conditions
- Step C smoke test fails → stop, report, do not pull scikit-learn.
- 3+ hours in without one chain's edges classified → stop and report the partial result; partial is
  expected and useful.
- Any impulse to run a model/provider call, edit the substrate's patches or tests, or author scenarios
  → stop; those are out of scope (§1).
- Disk under ~20 GB free → `docker rmi` aggressively or stop; do not fill the disk.
