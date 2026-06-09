# e1-harness-calibration-step0-v0

Status: draft calibration protocol. No harness implementation is implied by this document. No provider run is authorized by this document.

## Purpose

Before building Billing v2, validate the E1 turn mechanics on a tiny task. The purpose is to test the harness format, logging, command channel, and cost model, not to generate scientific evidence about executable specs.

This is Step 0 for any frontier-model branch using `e1-self-directed-verification-turn-based-v0`.

## Harness Skeleton Scope

Implement only the protocol mechanics:

- turn loop: patch block, verification request, done declaration;
- read-only `specs/` for both arms;
- read-only `specs/steps/` for `feedback_capable_spec`;
- writable `scratch/` with cross-checkpoint persistence;
- command whitelist enforcement;
- 60s verification timeouts;
- deterministic head+tail truncation;
- budget counters for turns, verification executions, and output tokens;
- per-turn logging: command, exit code, wall time, full-output hash, shown output, and workspace snapshot.

Every item above can contaminate future runs if it silently malfunctions. None requires Billing v2 to exist.

## Calibration Task: CartCalc

`CartCalc` is deliberately trivial.

- single TypeScript module, about 150 LOC;
- 3 checkpoints:
  - CP1: line totals with rounding;
  - CP2: percent discount;
  - CP3: discount cap rule that perturbs CP2;
- visible Gherkin/spec text;
- runnable steps for `feedback_capable_spec`;
- 10-assertion hidden mini-oracle.

The task should be easy for both arms. A difficult CartCalc result means the harness or prompt format is defective.

## Calibration Run Matrix

Minimum calibration matrix:

- cheap model, for example Haiku or Mistral-small: 2 arms x 2 seeds = 4 runs;
- one frontier context-arm run for realistic turn, token, and patch-format measurement.

Total: 5 runs x 3 checkpoints.

These are calibration runs only. They are not causal evidence.

## Required Measurements

Record:

- malformed-patch rate;
- turns used per checkpoint;
- verification calls used per checkpoint;
- fresh input tokens per turn;
- cached input tokens per turn, if provider reports them;
- output tokens per turn;
- truncation hit rate;
- whether the head+tail split preserves useful failure summaries;
- scratch persistence across checkpoints;
- read-only spec rejection and log entry behavior;
- wall time per turn including sandbox execution.

Predeclared patch-format fallback:

- if malformed-patch rejection rate is greater than 10 percent, switch from unified diffs to full-file replacement blocks before Billing v2 is built.

## Cost Model

Step 0 fills in these measured variables:

- `t`: mean turns used per checkpoint;
- `v`: mean verification calls per checkpoint;
- `f`: fresh input tokens per turn;
- `o`: output tokens per turn.

Planning episode counts:

| Stage | Runs | Checkpoint episodes |
| --- | ---: | ---: |
| Probe: 3 context + 1 feedback | 4 | 72-96 |
| Stage A: 2 models x 2 arms x 5 seeds | 20 | 360 |
| Stage B extension, worst case both models | +20 | +360 |
| Isolated competence, scoped | n/a | about 20-30 short episodes |

Worst case is roughly 800 checkpoint episodes and 5,000-8,000 model turns if `t` lands near 7-8.

## Context Strategy

The context strategy is part of the future seal:

- full repo context is injected once at checkpoint start;
- later turns stay in one provider conversation where possible;
- later turns receive applied-diff confirmations and verification output, not a full repo reinjection;
- provider caching behavior and reported cached/fresh token split are recorded when available.

Without caching, a frontier E1 matrix is likely operationally infeasible.

## Cost Trim Order

If Step 0 projects cost above the operator's budget ceiling, trim in this order before sealing Billing v2:

1. reduce max turns from `12` to `10`;
2. reduce the primary probe from 18 checkpoints to 15 by dropping the lowest-interaction-degree checkpoints from the sealed interaction graph;
3. keep Stage A at 5 clean pairs;
4. cap Stage B at 8 clean pairs.

Do not trim calibration's frontier context-arm run. Patch rejection and turn usage are model-dependent, and those numbers drive the seal.

## Go Gate For Billing v2

Do not build Billing v2 until:

- second calibration pass has zero open harness defects;
- patch-format decision is resolved, either native diffs or full-file replacement fallback;
- `scratch/example.test.ts` runs green in a fresh sandbox in both arms;
- read-only spec rejection is observed and logged;
- projected full-matrix cost is within the operator's budget ceiling.

