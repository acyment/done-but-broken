# e1-harness-calibration-step0-v0

Status: draft calibration protocol. Local E1 harness mechanics are implemented in `src/e1-harness.ts`; CartCalc and provider calibration are not implemented. No provider run is authorized by this document.

## Purpose

Before building Billing v2, validate the E1 turn mechanics on a tiny task. The purpose is to test the harness format, logging, command channel, and cost model, not to generate scientific evidence about executable specs.

This is Step 0 for any frontier-model branch using `e1-self-directed-verification-turn-based-v0`.

## Harness Skeleton Scope

Implement only the protocol mechanics:

- turn loop: full-file replacement block, verification request, done declaration;
- read-only `specs/` for both arms;
- read-only `specs/steps/` for `feedback_capable_spec`;
- read-only harness config: `package.json`, `bunfig.toml`, and `tsconfig.json`/Bun lockfiles if present;
- writable `scratch/` with cross-checkpoint persistence;
- argv-templated command whitelist enforcement, never shell execution;
- 60s verification timeouts;
- deterministic head+tail truncation;
- budget counters for turns, verification executions, and output tokens;
- per-turn logging: command, exit code, wall time, full-output hash, shown output, and workspace snapshot.

Every item above can contaminate future runs if it silently malfunctions. None requires Billing v2 to exist.

## Calibration Task: CartCalc

`CartCalc` is deliberately trivial.

- four small TypeScript modules: `types.ts`, `pricing.ts`, `discounts.ts`, and `totals.ts`;
- 3 checkpoints:
  - CP1: line totals with rounding;
  - CP2: percent discount;
  - CP3: discount cap rule that perturbs CP2 and requires coordinated edits to `discounts.ts` and `totals.ts`;
- visible Gherkin/spec text;
- runnable steps for `feedback_capable_spec`;
- 10-assertion hidden mini-oracle;
- one deliberately noisy CP2 failure fixture that emits more than 4000 tokens so head+tail truncation is tested against real Bun output shape.

The task should be easy for both arms. A difficult CartCalc result means the harness or prompt format is defective.

## Calibration Run Matrix

Minimum calibration matrix:

- cheap model, for example Haiku or Mistral-small: 2 arms x 2 seeds = 4 runs;
- one frontier context-arm run for realistic turn, token, and replacement-format measurement.

Total: 5 runs x 3 checkpoints.

These are calibration runs only. They are not causal evidence.

## Required Measurements

Record:

- malformed-replacement rate;
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

Patch format decision:

- full-file replacement is the only supported format;
- unified diffs are never implemented;
- calibration measures replacement-format token cost rather than adjudicating a conditional format decision.

Billing v2 design constraint flowing from this decision:

- no Billing v2 source file should exceed about 450 LOC.

## Scripted Acceptance Battery

Layer 1 is a no-model automated harness battery. It must pass before model-in-loop CartCalc calibration.

Required coverage:

- Patching: well-formed replacement applied atomically; malformed delimiter rejected with turn semantics intact; replacement targeting `specs/`, `specs/steps/`, or `package.json` rejected and logged; multi-file replacement in one turn; empty-content edge case.
- Command gating: these commands are rejected and consume a verification slot: `scratch/../src/x.ts`, absolute path outside scratch, symlink inside scratch pointing to `src/`, `scratch/*.ts`, `scratch/a.ts; rm -rf /`, backticks, `&&`, `$(...)`, `FOO=1 bun ...`, flag smuggling such as `--eval`, `bun run spec` from the context arm, `bun test src/`, bare `bun test`, and non-integer `--cp` value.
- Mounts and persistence: scratch file written at CP1 is readable at CP3; read-only enforcement survives checkpoint transitions; example test is green in fresh sandboxes in both arms.
- Accounting and logging: verification counter refuses at exactly 6; refusals consume slots; token-budget exhaustion mid-checkpoint terminates cleanly; full-output hash matches independently recomputed hash; truncation marker is present and head/tail split is correct on the noisy fixture; per-turn snapshots replay to bit-identical workspace state.

Layer 1 must be green on two clean environments before Billing v2 design starts.

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
- later turns receive harness-computed replacement summaries, optional harness-computed diffs, and verification output, not a full repo reinjection;
- provider caching behavior and reported cached/fresh token split are recorded when available.

Without caching, a frontier E1 matrix is likely operationally infeasible.

## Cost Trim Order

If Step 0 projects cost above the operator's budget ceiling, trim in this order before sealing Billing v2:

1. reduce max turns from `12` to `10`;
2. reduce the primary probe from 18 checkpoints to 15 by dropping the lowest-interaction-degree checkpoints from the sealed interaction graph;
3. keep Stage A at 5 clean pairs;
4. cap Stage B at 8 clean pairs.

Trims are permitted exactly once: after CartCalc, before the Billing v2 seal. After the seal, the matrix is immutable.

Do not trim calibration's frontier context-arm run. Replacement rate and turn usage are model-dependent, and those numbers drive the seal.

Precondition for launching Stage A:

- the operator has budget reserve for worst-case Stage B for both models.

If worst-case Stage B cannot be funded, do not start Stage A.

## Go Gate For Billing v2

Do not build Billing v2 until:

- Layer 1 is green on two clean environments;
- Layer 2 model-in-loop calibration completes a second pass with zero open harness defects;
- `scratch/example.test.ts` runs green in a fresh sandbox in both arms;
- read-only spec rejection is observed and logged;
- projected full-matrix cost is within the operator's budget ceiling.
