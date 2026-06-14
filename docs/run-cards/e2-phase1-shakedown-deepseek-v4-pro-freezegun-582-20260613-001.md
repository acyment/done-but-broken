# Run Card: e2-phase1-shakedown-deepseek-v4-pro-freezegun-582-20260613-001

| Field | Value |
| --- | --- |
| Run ID | `e2-phase1-shakedown-deepseek-v4-pro-freezegun-582-20260613-001` |
| Date | 2026-06-13 |
| Program | E2 brownfield acceptance-feedback ablation (`docs/protocols/e2-brownfield-acceptance-ablation-design-v1.md`) |
| Classification | **`calibration`** — harness-feasibility shakedown; **NOT causal evidence** |
| Substrate | SWE-bench Live, `spulec__freezegun-582` (1 instance) |
| Model / route | `deepseek-v4-pro` via litellm openai-compatible (`https://api.deepseek.com/v1`) |
| Agent scaffold | OpenHands Agent SDK v1.27 |
| Harness | `hit-sdd-bench-e2` @ `e8566e7` (separate Python/Docker repo) |

## Result

In 6 bounded iterations, DeepSeek V4 Pro read the issue, located `freezegun/api.py`, and edited it
(1,438-char diff). The patch, scored in the instance's Docker container via the validated eval tier:

| Metric | Value |
| --- | --- |
| Resolved (F2P all pass) | **True** |
| P2P regressions | **0** |
| Self-verification gap | **False** |

## Treatment-arm validation (run_tests executable-feedback mechanism, 2026-06-14)

A second real DeepSeek V4 Pro run exercised the **treatment** arm
(`examples/real_run_deepseek_treatment.py`): the agent had `file_editor` + the container-backed
**`run_tests`** tool. It edited the source and called `run_tests` ~4 times — each call took the
agent's current host working-tree diff, applied it in a fresh sanitized container, ran the hidden
acceptance subset there, and returned per-check pass/fail ("Acceptance checks: 5/5 passed") — then
finished. Final patch scored in-container: **resolved=True, 0 P2P regressions**. This validates the
executable-feedback mechanism (the causal variable) end-to-end with a real frontier model. Both
arms are now functional: `control` = `file_editor`; `treatment` = `file_editor` + `run_tests`.

## What it establishes (and what it does NOT)

**Establishes (calibration only):** the full E2 loop runs end-to-end with a real frontier model —
substrate load → adversarial git sanitization (future/fix history pruned, verified) → OpenHands +
DeepSeek agent → patch → container oracle (F2P/P2P) → resolution / regression / self-verification-gap.
Every harness component (provenance hashing, substrate adapter, eval tier, sanitization, scorer, the
OpenHands tool-toggle wiring) is exercised against real systems.

**Does NOT establish anything about the feedback hypothesis.** This is a single instance, **control-
flavored** (read/edit tools only; the `treatment` `run_tests` executor is not yet wired), at lower
fidelity (architecture caveat below), with a 6-iteration cap. That a frontier model self-solves a
tractable single-file task is consistent with the E1 finding and is irrelevant to the powered two-arm
read; the H1/H2 question needs Phase 1.5 (regression-enriched, N≈10/arm, permutation test).

## Validity / fidelity caveats (honest)

- **Architecture:** the SWE-bench image is Python 3.8 but OpenHands needs 3.12+, so OpenHands ran on
  the **host** against a `docker cp`-exported **sanitized** checkout; the patch was then scored in the
  container (authoritative env). Lower fidelity than agent-in-container; the in-container OpenHands
  runtime is future work.
- **Tools:** read/edit only (no host shell, no `run_tests`) for host safety → control-flavored.
- **Contamination:** not controlled in this shakedown (the memorization probe / post-cutoff fence are
  Phase-1 GATE B, not run here). `freezegun-582` is post-2025-04 but its status vs the model's cutoff
  was not checked.
- Not pooled with any E1 run, nor with any future E2 run of different classification/fidelity.

## Next

The remaining harness gap is the in-container OpenHands runtime + the `run_tests` executor (treatment
arm). A sealed `e2-phase1-pilot-commitments-v1.md` and the Phase-1/1.5 design gate the move from
shakedown to evidence.
