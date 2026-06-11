# Billing v2 Task Design Boundary — v3 (output-discipline amendment)

Date precommitted: 2026-06-11, before any v3 task code. This document amends
`billing-v2-task-design-v1.md` (frozen at SHA-256
`5db61561dde688dbc1cb9b396345e931ab1cf615c621b6d965a726f0d09d8a5c`) as already amended by
`billing-v2-task-design-v2.md` (frozen at SHA-256
`9596433d72af46704794330820e438995ebaaaf9cb4b47f9ba7841806aa812c0`). Everything in v1+v2
carries over verbatim unless explicitly amended below. Task version becomes
`e1-billing-v2-v3`.

## Why v3 exists

The v2 seed-a Stage 1 probe (run card
`docs/run-cards/e1-billing-v2-sonnet-context-probe-v2-seed-a-20260611.md`) returned the
predeclared structural verdict again, with a different mechanism than v1. The v2 module
split fixed the per-file emission ceiling (gate 6 held; no single file exceeds the turn
budget), but the agent repeatedly batched several modules into one response — ~4,400+
tokens of code against the sealed 4000-output-token cap — and lost 22 of 86 turns to
`finish_reason=length` (`output_truncated_turn_rate=0.2558` > the 0.10 Amendment 3
threshold; CP07 opened with 4 consecutive length-terminated turns). Nothing in the v2
task tells the agent that turn output is bounded or that one-file-per-turn is the viable
strategy. This is a task-design defect (missing environment information), not a protocol
or model finding. v2 is burned for evidence; no further runs under it.

## Amendment 5 — output-discipline instruction in the mounted README

The seed `template-workspace/README.md` gains an explicit output-discipline section
stating, in substance:

- each response's output is hard-capped, and a file block cut off by that cap is discarded
  (the edit does not apply);
- therefore rewrite **at most one source file per turn**, never batch multiple files into
  one response;
- the existing keep-files-small rule (one file must stay rewritable in full within a
  single turn's budget) is restated alongside it.

This is task-environment information, identical in both arms (the README is part of the
shared workspace snapshot), so it cannot differ between conditions and does not touch the
causal variable. It documents an existing sealed protocol property; it does not change
budgets, checkpoints, invariants, the interaction graph, the oracle, or any spec content.
Visible specs, change requests, oracle cases, and all source files are byte-identical to
v2; only the README text and the task/oracle `task_version` fields change.

## Not amended

Module layout (v2 Amendment 1), the per-file emission-budget gate 6 (v2 Amendment 2,
threshold 2400 tokens, largest file 1,372), the truncation-aware structural rule (v2
Amendment 3, thresholds 0.10 and 3+ consecutive), run-identity hygiene (v2 Amendment 4),
checkpoints CP01–CP18, the 12 invariants, the interaction graph, the friction registry,
the 153-case oracle with held-out tagging, naive-agent regression proofs, frozen-baseline
and mutation gates, the probe gate numbers (mean context AUC ≤ 0.92, mean ≥ 2 on-graph
drift regressions), and the MCID (+0.05) are unchanged. The oracle package carries over
once more: no evidence package was published against the v2 commitments (the v2 probe
produced a structural no-claim verdict; hidden case content was never revealed).

## Predeclared interpretation note (recorded before the v3 probe)

The v2 run is directional evidence that the truncation-free task may not trip a frontier
model at all: zero cross-checkpoint regressions occurred even with 22 wasted turns. If the
v3 probe returns AUC > 0.92 with < 2 on-graph regressions, the predeclared outcome is
**context ceilings → boundary result only** — billing-v2 as designed is not
frontier-discriminating, and extending it requires a new sealed design revision. That
outcome must be reported as such, not reinterpreted.
