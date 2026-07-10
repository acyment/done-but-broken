# v3-M5 — Product-arm budget calibration: notes

Mirrors `E4V2-M6-BUDGET-CALIBRATION-NOTES.md` / `E4V2-M8-GLM-BUDGET-CALIBRATION-NOTES.md`'s
recorded-notes style, for the milestone named in `E4V3-PRODUCT-LOOP-PROPOSAL.md` §5 ("v3-M5 —
budget calibration on glm-5.2 thinking-on, arm p full-length sequence (spend-gated), budgets
re-ratified or adjusted-once"). Binding precedent honored twice over: (1) the v2 v0.3 budgets
were frozen on glm-5.2 thinking-on but for the *v2 gate* — the v3 constants file carried them
only PROVISIONALLY because the product gate changes per-task appetite; (2) the model-id pin
discipline (v1 M6.5 → v2-M6 → v2-M8) — this ratification is what makes the budgets valid for a
v3-M6 evidence run on this exact model/config/route.

## Pre-flight (executed 2026-07-10, operator authorized this calibration step's spend)

- Working tree clean at `06d73f4` (v3-M4, the build-arc head).
- `e1:protect` PASS immediately before launch (779/779, sealed hash, canned smoke).
- Constants hashes verified against disk: v2 `2f78f534…` (v0.3, frozen), v3 `36107927…`
  (v0.1, non-budget freeze). `ZHIPU_API_KEY` present in `.env`.
- No code was needed for the run itself: `bin/e4-v3.ts --live` is fully CLI-flag-driven
  (v2-M6/M8 precedent), with the reasoning recorder already wired.

## Launch procedure (headless-correct detachment — the M8 §7.1 deviation resolved)

The M8 evidence run's recorded deviation was that the sealed `pgid==pid` check cannot pass
headless (`bash -m` job control needs a tty). This calibration used and validated the
setsid-equivalent that deviation note asked for:

- Launch: `bash -c 'nohup python3 <setsid-shim.py> </dev/null >>seed-37.log 2>&1 &'` — the
  shim calls `os.setsid()`, writes the PID file, `chdir`s to the repo (Bun auto-loads `.env`),
  then `execvp`s the real `bun run bin/e4-v3.ts …` command, so the run process itself is the
  session leader.
- Verification (headless-correct, no tty needed): `pgid == pid` (own group leader; `setsid()`
  succeeding is guaranteed by the shim not crashing) and `PPID == 1`. Observed: pid 12884,
  pgid 12884, ppid 1. Polling was file-only (log + manifest); a read-only monitor watched task
  closes.

**Recorded incident (infrastructure, superseded, non-evidence):** a first launch attempt died
~2 minutes in because the launch shell call also contained a blocking wait; the harness's
per-call timeout killed the call and swept the still-attached run with it (2 turns of task 1
recorded, no task closed, usage unrecorded — estimated a few cents, run root wiped by the
relaunch). Lesson recorded for the v3-M6 sealed launch procedure: the launch call must contain
*nothing but* the detached launch and must return immediately; verification and polling are
separate calls. The relaunch under the procedure above ran to completion and survived the
session's call boundaries throughout (~25 min).

## Run identity

One full-length **e4_arm_p** (product arm) sequence, 6 tasks × **seed 37** (the established
calibration seed, excluded from all evidence seed sets), model **glm-5.2 thinking-ON** on the
exact M8 route: z.ai paas/v4 (`https://api.z.ai/api/paas/v4/chat/completions`),
`ZHIPU_API_KEY` (route_id `direct-zhipu-api-key`), pricing cap-guardrail overestimates
1.4/0.26/4.4 USD/M, `max_output_tokens` 32000, empty extras (thinking on at provider default
effort), `classification=calibration`, pairing_label `pair-calibration-seed-37`, profile
`e4-openspec-workflow-v2`. Run root `tmp/e4-v3-m5-calibration/seed-37`.

**Result: complete, `chain_replay_valid=true`, all 6 tasks `done`, total spend $0.8175
(cap $5), wall clock ~25.1 min.** Per-task detail (via `bin/e4-v2-budget-report.ts`, which
accepts the additively-extended v3 manifest):

| task | op_kind | turns | tokens (spec/impl) | smoke | oracle | asked_pm | spend |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | add_relationship | 4 | 53,560 (30.9k/22.7k) | 1 | 26/27 | yes (turn 1) | $0.0833 |
| 2 | add_entity | 5 | 74,723 (31.9k/42.8k) | 1 | 32/36 | no | $0.0895 |
| 3 | modify_convention | 6 | 127,846 (86.7k/41.1k) | 1 | 32/36 | yes (turn 1) | $0.1452 |
| 4 | delete_entity | 5 | 118,759 (52.8k/66.0k) | 1 | 26/27 | no | $0.1179 |
| 5 | modify_endpoint | 7 | 178,400 (59.8k/118.6k) | 2 | 26/27 | no | $0.2149 |
| 6 | noop_maintenance | 4 | 106,015 (61.2k/44.8k) | 1 | 26/27 | no | $0.1283 |

## Thinking-on validity checks (scoping-§4 instruments, calibration-scale)

From `reasoning-observability.json` (recorder wired into `bin/e4-v3.ts --live`):

- **§4(a) reasoning ACTIVE on 37/37 calls** — non-empty `reasoning_content` every turn;
  per-call reasoning burn 21–11,784 tokens.
- **§4(b) accounting FOLDED on 37/37 calls** — reasoning tokens included in
  `usage.completion_tokens`; budget ledger and derived cost honest as-is; the E4-side
  adjustment seam stays inert.
- **§5(iv) zero truncation** at `max_tokens` 32000 — no `finish_reason: "length"` anywhere.

## Product-arm appetite (what this calibration was for)

- **Product-gate refusals: ZERO of every kind on every task** — `pm_review_refusals=0`,
  `reconcile_refusals=0`, `mutation_refusals=0`, `pm_review_flags_total=0`,
  `reconcile_unavailable_count=0`. The gate's floors were cleared first-try at every
  done-claim; its live cost on this seed was evaluation-only, no feedback loops.
- **Mutation kill score 1.0 at every done-claim** (all six boundary mutants killed each task,
  `mutation-N.json` records; floor 5/6 never approached). Final reconcile finding count 0.
- **ASK_PM used on 2/6 tasks** (task 1 `add_relationship`, task 3 `modify_convention`), both
  at turn 1. Notably the model did NOT ask on task 2 `add_entity` — the op kind whose
  underdetermination cascaded in M8; the PM-review invention rules are dormant when no brief
  was delivered, by design (incentive to ask). Recorded as a mechanism observation for the
  v3-M6 report to watch across three arms; carries no claim weight (single arm, single seed,
  calibration).
- **Mutation-analysis wall-clock is not recorded in-manifest.** Offline stand-in, measured on
  the final (task-6) snapshot with the same harness and the live concurrency (4): **~4.3 s**
  for 32 baseline-green scenarios × 6 mutants (kill 6/6, byte-matching the recorded task-6
  report). At one analysis per accepted done-claim this is negligible against multi-minute
  provider turns.
- `refused_done_over_red` 0, custody failures 0; smoke feedback 1–2 runs/task.

## Freeze rule outcome

**No wall was hit — the freeze rule's "fits with headroom" branch applies.** Observed
appetite: max turns/task **7** (cap 27), max tokens/task **178,400** (cap 490,000), max
verifications/task **2** (cap 12), sequence spend **$0.8175** (cap $5),
`budget_walls_observed=false`. The product gate did raise appetite relative to the v2-M8 GLM
calibration on the same seed/model (max tokens 178.4k vs 116.2k, turns 7 vs 5, spend $0.82 vs
$0.62 — ~+32–53% per axis) but well inside every sealed wall, so the adjust-once rule was not
triggered.

**Ratified values: turns_per_task 27→27, verifications_per_task 12→12, token_budget
490000→490000, spend_cap_usd 5→5 — unchanged**, still read from the frozen v2 v0.3 file.
The v3 constants file's `version` moves **0.1 → 0.2** and its `budgets_note` records the
ratification; new full-file sha256
`aec35e3d7db94e5be953b2bb5f318ab33d3fa3da96609579994633ffba8cf85a`, pinned by
`test/e4-v3-m4.test.ts`. The v2 file is untouched (hash `2f78f534…` unchanged); all eight v3
code-twin hashes unchanged.

**Model-id pin:** these budgets transfer to a v3-M6 evidence run only on the exact model id
`glm-5.2`, thinking-ON, on this route. Any other model or thinking configuration repeats this
ratification.

## Flags for the v3-M6 pre-registration gate (observations, not actions taken here)

1. **The manifest does not stamp the v3 constants hash** — `compatibility_boundary` carries
   the v2 identity (v0.3 `2f78f534…`) and the CLI prints the v3 hash, but evidence manifests
   should stamp the v3 hash explicitly. Adding that field is a design act for the M6 gate
   commit (same deferred-by-precedent class as the 3-arm gonogo extension).
2. The sealed launch procedure for the evidence run should seal the setsid-shim mechanism and
   the headless-correct check validated here (pgid==pid + PPID==1 + file-only polling +
   launch-call-contains-nothing-else).

## Mechanism observation (non-evidence, flagged for the v3-M6 report)

As in the v2-M6/M8 calibrations, **every task closed `false_confidence.event=true`** (own
gate green, hidden oracle failing 26/27 or 32/36) with hidden-bank kill score 1.0 throughout
— but the residual is markedly smaller than v2-M8's calibration on the same seed/model
(1–4 hidden-test failures per close vs 4/27–13/36 there), and per-task drift burdens were
2/11/11/2/5/5. Single-arm, single-seed, `calibration` classification: structurally excluded
from any verdict, no claim weight; the three-arm contrast is exactly what v3-M6 measures.

**Total spend this milestone: $0.8175 recorded + a few unrecorded cents from the superseded
partial launch (~$0.85 all-in), against the ~$1–2 expectation and $5 ceiling.**
