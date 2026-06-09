# e1-harness-calibration-step0-v0

Status: draft calibration protocol. Local E1 L0 mechanics are implemented in `src/e1-harness.ts`; the L1 agent loop, L2 run orchestrator, CartCalc task, and provider calibration are not implemented. No provider run is authorized by this document.

## Purpose

Before building Billing v2, validate the E1 turn mechanics on a tiny task. The purpose is to test the harness format, logging, command channel, and cost model, not to generate scientific evidence about executable specs.

This is Step 0 for any frontier-model branch using `e1-self-directed-verification-turn-based-v0`.

## Layered Harness Scope

Step 0 is not complete until all three layers exist:

- L0 mechanics library: patch application, command validation, protected-path integrity, verification execution, output truncation/hashing, and local counters.
- L1 agent loop adapter: parse model output blocks, assemble provider turns with a cached prefix, inject harness notices and verification output, debit the token ledger, and call providers.
- L2 run orchestrator: seed workspaces, configure arms, advance checkpoints, persist scratch, snapshot each turn, classify terminations, and emit the artifact bundle.

The L0/L1/L2 implementation must cover:

- turn loop: full-file replacement block, verification request, done declaration;
- fixed block precedence: replacements, then at most one verification request, then optional done;
- no-op-turn handling: zero valid blocks consumes a turn, injects `no valid blocks parsed`, and three consecutive no-ops terminate `agent_stalled`;
- harness-enforced read-only `specs/` for both arms;
- harness-enforced read-only `specs/steps/` for `feedback_capable_spec`;
- read-only harness config: `package.json`, `bunfig.toml`, and `tsconfig.json`/Bun lockfiles if present;
- checkpoint-start hashes and turn-end verification for every protected path, terminating `invalid_integrity` on mismatch;
- writable `scratch/` with cross-checkpoint persistence;
- argv-templated command whitelist enforcement, never shell execution;
- relative POSIX path allowlist `^[A-Za-z0-9._-][A-Za-z0-9._/-]*$`, ASCII only, no leading `/`, no leading `-`, no `..` segment before realpath containment;
- 60s verification timeouts;
- deterministic head+tail truncation;
- budget counters for turns, verification executions, model output tokens, injected verification-output tokens, and cached-prefix cost as a separate statistic;
- deterministic model-facing replacement confirmations;
- audit-only unified diffs between pre/post snapshots;
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
- block-grammar no-op rate;
- `agent_stalled` rate per model and arm;
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

- Patching: well-formed replacement applied atomically; malformed delimiter rejected with turn semantics intact; replacement targeting `specs/`, `specs/steps/`, `package.json`, `bunfig.toml`, `tsconfig.json`, `bun.lock`, or `bun.lockb` rejected and logged; multi-file replacement in one turn; empty-content edge case; deterministic confirmation lines.
- Command gating: these commands are rejected and consume a verification slot: `scratch/../src/x.ts`, absolute path outside scratch, symlink inside scratch pointing to `src/`, `scratch/*.ts`, `scratch/a.ts; rm -rf /`, backticks, `&&`, `$(...)`, `FOO=1 bun ...`, flag smuggling such as `--eval`, `bun run spec` from the context arm, `bun test src/`, bare `bun test`, and non-integer `--cp` value.
- Allowlist confirmations: absolute paths both inside and outside `scratch/`, `scratch%2F..%2Fsrc`, `scrаtch/a.ts` with Cyrillic `а`, `scratch/a.ts\nrm`, `scratch\..\src\x.ts`, and embedded `\x00` are rejected by the sealed relative POSIX path grammar before resolution.
- Mounts and persistence: scratch file written at CP1 is readable at CP3; read-only enforcement survives checkpoint transitions; example test is green in fresh sandboxes in both arms.
- Integrity: protected-path hashes cover `specs/`, `specs/steps/`, `package.json`, `bunfig.toml`, `tsconfig.json`, and Bun lockfiles when present; replacement-time or verification-time drift terminates `invalid_integrity`.
- Parser and termination semantics: zero valid blocks consume turns, inject the one-line harness notice, and three consecutive no-op turns terminate `agent_stalled`.
- Accounting and logging: verification counter refuses at exactly 6; refusals consume slots; token-budget exhaustion mid-checkpoint terminates `budget_exhausted`; full-output hash matches independently recomputed hash; truncation marker is present and head/tail split is correct on the noisy fixture; per-turn snapshots replay to bit-identical workspace state.
- Snapshot replay: after a full CartCalc run, replay artifact snapshots onto a fresh workspace and byte-compare final state.

Layer 1 must be green on two clean environments before Billing v2 design starts: macOS local and an Ubuntu 24 container, with the same pinned Bun version.

Lockfile/environment requirement:

- if a Bun lockfile exists, sandbox setup runs `bun install --frozen-lockfile`;
- runtime uses `--no-install`;
- environment boundary records Bun version plus lockfile hash;
- for the current zero-dependency package, Bun deletes an empty lockfile, so the boundary records `deps: none` plus `lockfile_absent_zero_dependency_package` until a real dependency makes `bun.lock` meaningful;
- from the first commit with any runtime or dev dependency in `package.json`, missing or stale `bun.lock` is an invalid environment boundary and the orchestrator refuses to start a run.

Full-suite stability is a gate, not a footnote. Harness tests must not depend on real-clock sleeps; use fake timers or injected clocks for timeout behavior. Step 0 requires 10 consecutive green full-suite runs on both environments, with zero quarantined tests or a published exclusion list.

## L1 Shakedown

Insert a no-provider L1-shakedown phase after the L1 adapter exists and before L2/CartCalc calibration.

Scripted fake agents must cover:

- pure prose with no protocol blocks;
- malformed delimiters: unclosed, nested, duplicated, and interleaved with code fences;
- valid blocks wrapped in a single outer markdown fence;
- valid blocks in wrong precedence order;
- chatty output with valid blocks buried in explanations.

The sealed parser policy is to strip one outer markdown fence layer, then parse. This avoids manufacturing stalls from common model formatting habits. Parser behavior on every scripted agent must match the sealed grammar exactly before provider spend.

After scripted shakedown, run one cheap real model calibration to measure live no-op rate. If no-op rate exceeds 10 percent, prompt-template iteration is allowed before the Step 0 seal and frozen after it.

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

- L1 and L2 are implemented and a CartCalc run executes end-to-end from one orchestrator command, emitting the full artifact bundle;
- L1-shakedown passes scripted fake agents and one cheap real model no-op-rate check;
- the Layer 1 battery is green on macOS local and Ubuntu 24 with the same pinned Bun version;
- the stability gate records 10 consecutive green full-suite runs on both environments;
- CartCalc model-in-loop calibration completes a second consecutive defect-free pass;
- `scratch/example.test.ts` runs green in a fresh sandbox in both arms;
- read-only spec rejection is observed and logged;
- measured `t`, `v`, `o`, no-op rate, truncation behavior, and wall-time profile are recorded;
- projected full-matrix cost is within the operator's budget ceiling.

Only after this gate opens should Billing v2 design start. The first Billing v2 artifact should be a consolidated protocol document carrying the full E1 decisions and compatibility boundary, with its hash used as the task-branch commitment anchor.
