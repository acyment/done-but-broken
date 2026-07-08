# Claim B design: measured tautology-event calibration (control-only) — v1

**Status**: design only, written 2026-07-05. No run is authorized by this document. Any evidence
run against this design needs (a) the instrumentation gap closed, (b) the predictions section
filled in BEFORE launch, and (c) explicit operator authorization with a cost ceiling
(CLAUDE.md standing rule).

**Classification of any resulting run**: `mechanism_probe` / calibration. Control-only; no
treatment arm; not causal evidence for any product claim.

**Executes**: re-entry steps 2–3 of
`e2-fallback-claims-regression-and-tautology-v1.md` (Claim B). Step 1 (zero-compute mining)
was executed 2026-07-05; its verdict is §2 below and is the reason this design exists.

---

## 1. The claim, stated precisely

> **Candidate Claim B**: when an agent must verify its own work without an independent
> executable contract, its self-written checks systematically fail to detect that the stated
> acceptance criteria are unmet — the agent's own tests go green on code the sealed spec fails.

Unit of evidence: the **tautology event**, per task-run:

```
tautology_event :=
      agent declared done
  AND agent authored ≥1 test artifact and ran it        (measured, not proxied)
  AND the agent's own final test run exited green        (measured, not proxied)
  AND the sealed authored spec fails on the final code   (primary oracle)
```

Publishable shape: "in X% of shell-capable 'done' claims, the agent's own tests were green
while the stated acceptance criteria failed; rate for [mid-tier] = Y, [frontier] = Z."

What it licenses: "independent executable contracts address a real, measured failure mode."
What it does NOT license: "HIT-SDD wins," or any treatment-vs-control causal statement.

## 2. Why the existing data cannot carry this claim (2026-07-05 audit)

The `self_verification_gap` field in the E2 causal-pilot files
(`e2-phase1-5-causal-pilot-deepseek-v4-pro.json`: control 70/90 = 78%;
`e2-phase1-5-causal-pilot-qwen3.7-max.json`: control 52/89 of done-runs = 58%) does **not**
measure tautology events, for three reasons found in the harness source:

1. **The self-test verdict is a proxy.** Every agent sets
   `self_verification_passed = declared_done` (`agent/openhands_agent.py:172`,
   `agent/stage0_agent.py:103`, `agent/codex_agent.py:71`). No agent-written test was ever run
   by the harness. The field measures *false confidence* (done-claim vs oracle), which is the
   already-classified E2 causal-pilot finding — a single-model CANDIDATE, not new evidence.
2. **Causal-pilot controls had no shell.** 0/90 control rollouts in the V4 Pro pilot made a
   bash call (`file_editor` only). An agent that cannot run tests cannot exhibit tautological
   *testing*; those runs are out of scope for Claim B by construction.
3. **Oracle mismatch.** The pilot oracle is SWE-bench gold F2P+P2P (`runner/scoring.py:83-87`),
   not the sealed authored spec. Claim B's fairness caveat (the spec encodes only requirements
   the agent was shown) is guaranteed only by the seal discipline.

What DOES exist: 12 shell-capable control rollouts (stage0-cal, freezegun-582 only:
6× V4 Flash → 1 gap event; 6× V4 Pro → 0), with `bash_call_log` entries carrying
`command` + `exit_code`. That is a specimen, not a rate.

## 3. Instrumentation to build BEFORE any run (no model spend)

The gap between "false confidence" and "tautology" is exactly the gap between a proxy and a
measurement. Close it in the harness first:

- **I1 — measured self-test verdict.** After the rollout ends, the harness (not the agent):
  1. identifies agent-authored test artifacts: files added/modified by the workspace diff
     matching `test_*.py` / `*_test.py` / files the agent ran via pytest in `bash_call_log`
     (including `/tmp/test_*.py` — observed agent behavior in the stage0-cal specimens);
  2. re-runs exactly those artifacts against the agent's **final** code in a fresh container;
  3. records `self_test_verdict ∈ {green, red, error, none}` + the artifact list + node counts.
  `self_verification_passed` is then set from the measured verdict — the `declared_done` proxy
  is retired for this protocol.
- **I2 — verification-behavior taxonomy**, classified from `bash_call_log` per rollout:
  `wrote_and_ran_tests` / `ran_repo_suite_only` / `print_or_repl_only` / `no_verification`.
  Tautology events are only defined inside `wrote_and_ran_tests`; the other classes are
  reported as context (they are failure modes too, but different ones).
- **I3 — assertion census** (secondary, from the harvested artifacts): assert statements vs
  print/echo calls per artifact, to connect with the published assertion-density literature.
- **I4 — keep `gap_gold`.** The authored-spec scorer already cross-checks against gold
  (`authored_spec/scoring.py:139`); report both `spec_red` and `gold_red` per event so a
  spec-vs-gold disagreement is visible, per Addendum B's guard.

All four are harness code + zero-compute re-analysis; they can also be run retroactively over
the 12 existing stage0-cal rollouts (their patches and bash logs are stored) as the free
Stage B0 below.

## 4. Design

Control-only. The "arms" are model tiers, not treatments.

- **Agent config**: identical to the sealed Stage-0 control: `file_editor` + container-backed
  `bash` (both arms of stage0 already get shell — `agent/stage0_agent.py:82-84`); sees the
  sealed proposal prose; never sees check code. No `run_spec` tool for anyone.
- **Primary oracle**: sealed authored-spec bundle verdict (`resolved` over authored outcomes,
  `authored_spec/scoring.py:124`). Secondary: gold cross-check (`gap_gold`).
- **Models**: `deepseek` (V4 Pro) and `qwen` (3.7 Max) as the frontier tier — the two the
  program has committed to; `glm` (5.2) optional third. `flash` (V4 Flash) as the mid/cheap
  tier for the tier contrast. Routes per `_cli/routes.py`; LiteLLM direct endpoints only.
- **Per-rollout record**: `declared_done`, behavior class (I2), `self_test_verdict` (I1),
  spec verdict, `gap` (measured), `gap_gold`, assertion census (I3), usage.

### Stages

- **Stage B0 — free, do first**: apply I1–I3 retroactively to the 12 stored stage0-cal
  rollouts. Output: a worked-example table and the candidate tautology specimen
  (flash, freezegun-582, run=1) either confirmed as a measured event or reclassified.
  No authorization needed (no model spend).
- **Stage B1 — single-task calibration** (freezegun-582, the only sealed bundle):
  20 rollouts × {flash, deepseek, qwen}. Purpose: does the measured event rate clear the gate
  on a task the frontier tier mostly solves? freezegun is easy for V4 Pro (6/6 resolved in
  stage0-cal), so B1 may floor out at the frontier tier — that is itself the gate signal.
- **Stage B2 — pool expansion** (only if B1's gate fires): seal 3–5 more bundles from the
  Stage-0 shortlist pool (the authoring pipeline + admission gates exist), then
  10 rollouts × task × model. B2 is where a publishable rate with task diversity lives.

### Predeclared gates

- **Gate B1 (proceed to B2)**: ≥3 measured tautology events across the B1 frontier-tier runs
  (i.e. the phenomenon exists at the frontier on a solvable task), OR ≥30% event rate in the
  mid tier with frontier ≥1 event. If frontier events = 0 at B1 *because frontier resolves the
  task*, B2 task selection must prioritize the shortlist's low-frontier-solve tasks before
  concluding anything.
- **Kill condition**: if across B1 (60 rollouts) `wrote_and_ran_tests` behavior itself is rare
  (<20% of done-runs), the claim's denominator is empty — agents don't self-test enough for
  "tautological self-tests" to be the right frame; fall back to the behavior-taxonomy finding
  and stop.

### Stage B0 — EXECUTED 2026-07-05 (zero spend)

Instrumentation built (`authored_spec/tautology.py`, frozen rules v1 in module docstring;
driver `scripts/run_claim_b0.py`; output `runs/claim-b/b0-retro-analysis.json`).
Result over the 12 stored stage0-cal rollouts (freezegun-582):

- Behavior: **12/12 `wrote_and_ran_tests`** — the kill condition is settled for this task; these
  agents self-test universally. Verdict masking is pervasive (most pytest runs wrapped in python
  `subprocess.run` heredocs, exit code masked; 2–7 masked runs per rollout).
- **Measured tautology events: 0/12.** The one stored `self_verification_gap` candidate
  (flash run=1) is RECLASSIFIED: its measured self-test verdict on final code is **red** — the
  agent declared done while its own test was failing. New named secondary:
  `red_test_done_claim` (overconfidence despite contrary self-evidence, distinct from tautology).
- V4 Pro: 6/6 self-tests green AND oracle green — correct confidence, no events.

Implication: tautology events require the agent to *fail while its tests pass*; on a task the
model solves (or knows it hasn't solved), events cannot appear. B1 remains the honest gate;
B2 task selection must weight low-frontier-solve tasks.

### Predictions — COMMITTED 2026-07-05, before B1 launch (author: Claude, session record)

- flash tautology event rate among done-runs: **~10%** (plausible 0–25%; B0 measured 0/4)
- deepseek V4 Pro: **~0–5%** (predicts 0–1 events/20; it solves freezegun 6/6)
- qwen 3.7 Max: **~5–10%**
- `wrote_and_ran_tests` prevalence: **>80% every tier** (B0: 12/12)
- `red_test_done_claim` (secondary): flash 1–3/20; frontier 0–2/20
- **Gate B1 predicted NOT to fire on freezegun-582 alone** (frontier events 0–2 < 3): the task is
  too solvable at the frontier. If so, per §Gates, B2 selection must precede any conclusion —
  a B1 null on one easy task does not falsify the claim, it bounds it.

### Stage B1 — EXECUTED 2026-07-05 (authorized "run b0 and b1"; classification: mechanism_probe)

20 control rollouts × {flash, deepseek V4 Pro, qwen 3.7 Max} on freezegun-582, sealed-spec
primary oracle + gold cross-check (spec/gold agreed on all 60), measured I1 verdicts.
Artifacts: `hit-sdd-bench-e2/runs/claim-b/b1-{flash,deepseek,qwen}-full.json`. Cost ≈ $1–2
(LiteLLM has no price map for these routes; estimated from stage0-cal token usage).

| tier | valid | done-claims | correct done-claims | spec resolved | **tautology events** | red_test_done_claim | wrote_and_ran_tests |
|---|---|---|---|---|---|---|---|
| flash (V4 Flash) | 20 | 10 | **0** | 0 | **0** | 5 | 60% |
| deepseek V4 Pro | 20 | 20 | 17 | 17 | **0** | 4 | 85% |
| qwen 3.7 Max | 20 | 10 | 10 | 12 | **0** | 1 | 95% |

**Gate B1 verdict: DOES NOT FIRE** (0 frontier events; 0 mid-tier events) — as predicted
pre-launch. Predictions vs measured: tautology rates all came in at the floor of the predicted
bands (predicted flash ~10%, pro 0–5%, qwen 5–10%; all measured 0%); `wrote_and_ran_tests`
below the >80% prediction for flash (60%); `red_test_done_claim` above prediction for flash
(5 vs 1–3).

**The headline finding is the inverse of Claim B.** Across B0+B1 (72 measured rollouts), not
one agent-written test wrongly passed failing code — self-tests were nearly perfectly
calibrated (every green self-test at every tier → oracle pass; failing code → red or error).
The live failure mode is the DONE-CLAIM POLICY, not test quality:
- flash: 0/10 done-claims correct; 5/10 made with a red self-test verdict in hand
  (`red_test_done_claim`), the rest with unrun/absent tests.
- V4 Pro: all 3 incorrect done-claims were red-test done-claims — the agent had the evidence
  and overrode it.
- qwen: 10/10 done-claims correct; withheld done on 6 of 7 red self-tests (the only
  red-test done-claim was actually resolved — a false-NEGATIVE self-test, the second observed).

What this licenses (bounded, single task, n=20/tier): "on this task, agents' own tests were
reliable; agents' done-claims were not; an enforced independent contract (cannot claim done
while red) targets the measured failure." What it does NOT license: any claim that self-tests
are tautological (0 events in 72 rollouts), nor generalization beyond freezegun-582.

**B2 disposition**: per the gate, B2 does not proceed on the tautology frame. If pursued at
all, the object of study should be re-scoped to done-claim calibration
(`red_test_done_claim` + done-precision per tier), where B1 shows a real tier gradient
(flash 50% of done-claims red-backed vs qwen 0 incorrect). That re-scope needs its own
predeclared design; not authorized by this doc.

## 5. Power sketch (rates, not hypothesis tests)

B1 reports rates with 95% Wilson CIs, no significance claims. n=20 done-runs/tier gives
±~18pp half-width at p≈0.3 — enough to distinguish "common" (≥30%) from "absent" (0 events →
upper bound ~16%), which is all the B1 gate needs. Distinguishing tiers (e.g. 30% vs 10%)
needs B2 scale (≥50 done-runs/tier across tasks).

## 6. Cost envelope (estimate, to be priced before authorization)

B1 = 60 rollouts ≈ the compute of the stage0-cal series ×5 per model. The stage0-cal V4 Pro
file (6 rollouts) records per-rollout usage; multiply out from there before asking for
authorization. B0 is free. B2 is not priced until B1's gate fires.

## 7. Validity threats & honest limits

- **Scope-narrowing vs tautology**: an agent may legitimately test a narrower reading of the
  issue. Mitigation: seal discipline guarantees the spec encodes only shown requirements
  (fallback doc, "honest limits"); per-event qualitative sub-labeling in B2:
  `implementation-echo` (test asserts what the code does) vs `shared-misreading` (impl and
  test encode the same wrong interpretation) vs `narrow-scope`. The first two support the
  claim; the third is the fairness discount and must be reported.
- **Verdict-harvest false negatives**: agents sometimes verify via inline `python -c` instead
  of test files (observed in stage0-cal logs). I2 classes these as `print_or_repl_only` unless
  they contain asserts; the harvest rule (I1) must be frozen before B1 and applied uniformly.
- **Single-task B1**: freezegun-582 results generalize to nothing by themselves; B1 is a gate,
  not evidence. Public statements only after B2, and only with the
  `public-post-framing-standard` language.
- **This is a mechanism/diagnosis claim**: even a clean B2 licenses "self-verification without
  independent contracts fails at measured rate X" — not any comparative statement about
  harnessed workflows. The treatment-arm comparison remains the main wedge's job.

## 8. Relationship to standing rules

- No run under this design without explicit operator authorization naming a stage (B1/B2),
  a model list, and a cost ceiling. B0 needs no authorization (zero spend).
- Run classification for B1/B2: `mechanism_probe` (calibration family). Never describe results
  as causal evidence (CLAUDE.md).
- OpenRouter remains retired; routes via `_cli/routes.py` direct endpoints only.

Related: `e2-fallback-claims-regression-and-tautology-v1.md` (parent),
`e2-frontier-gap-task-selection-synthesis-v1.md` §2 mechanism A (literature),
memory `e2-causal-pilot-result` (the false-confidence result this must not be conflated with).
