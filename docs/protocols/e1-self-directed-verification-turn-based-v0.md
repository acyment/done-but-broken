# e1-self-directed-verification-turn-based-v0

Status: draft protocol profile. No harness implementation is implied by this document. No provider run is authorized by this document.

## Purpose

This profile defines the recommended control policy for any future frontier-model branch. It replaces the vague phrase "normal tool access" with an exact turn-based verification channel.

The treatment under this profile is:

> provided executable BDD specs on top of the same bounded self-directed verification channel available to both arms.

This is the industry-relevant question. A production frontier coding agent can usually run some checks. The experiment should therefore ask whether maintained executable BDD assets still help when the context arm can write and run its own probes under the same budget.

## Turn Structure

Each checkpoint allows up to `12` model turns.

On each turn the model may return:

- one optional patch block;
- one optional verification request block;
- one optional done declaration.

The harness applies the patch, then executes at most one verification request. Verification output is injected verbatim at the start of the next model turn. The checkpoint ends when the model declares done, the turn budget is exhausted, or the sealed token budget is exhausted.

Malformed patches are rejected with a short error. Rejection is logged and consumes the patch opportunity for that turn.

## Verification Command Whitelist

Allowed command patterns are sealed per task language. For this repo's default JavaScript/TypeScript task shape:

| Command pattern | `context_only_spec` | `feedback_capable_spec` |
| --- | --- | --- |
| `bun test /scratch/...` | allowed | allowed |
| `bun /scratch/<script>.ts` | allowed | allowed |
| `make spec` or `make spec CP=<checkpoint>` | not available | allowed |

If a future task deliberately introduces Python, use `uv`-owned equivalents only:

| Command pattern | `context_only_spec` | `feedback_capable_spec` |
| --- | --- | --- |
| `uv run pytest /scratch/...` | allowed | allowed |
| `uv run python /scratch/<script>.py` | allowed | allowed |

Rules:

- no network;
- no package installation;
- no arbitrary shell;
- one verification request per turn;
- execution timeout `60s`;
- non-whitelisted commands return a refusal string and still consume the verification slot.

`make spec` is the provided BDD runner. It exists only for `feedback_capable_spec`.

## Workspace Rules

`/scratch`:

- writable by both arms;
- intended for model-authored tests and probes;
- persists across turns and checkpoints;
- captured in code snapshots for auditability;
- excluded from the hidden oracle import path.

`/specs`:

- mounted read-only for both arms;
- contains visible Gherkin/spec content.

`/specs/steps`:

- mounted read-only for `feedback_capable_spec`;
- contains provided step definitions and runner assets.

Application code:

- writable in both arms.

Patch attempts against read-only paths are rejected and logged. This prevents both spec vandalism and feedback-suite tampering.

## Budgets

All constants are part of the compatibility boundary and must be sealed before evidence-generating runs:

- max model turns per checkpoint: `12`;
- max verification executions per checkpoint: `6`;
- verification timeout: `60s`;
- output shown to model per execution: `4000` tokens;
- truncation rule: first `2500` tokens plus last `1500` tokens, with an explicit truncation marker;
- verification output tokens count against the per-checkpoint token budget.

The `6` verification executions are shared across command types. For the feedback arm, `make spec` consumes the same quota as self-authored tests or probes. The feedback arm is not compensated with extra executions.

## Feedback Semantics

Execution output consists of:

- command string;
- exit code;
- capped stdout;
- capped stderr.

The harness injects this output verbatim into the next turn. It adds no interpretation, summarization, hints, triage, or file suggestions.

Stack traces and runner output that reveal file structure are declared part of the treatment. They are not sanitized away.

## Logging And Audit

For every verification request, artifacts record:

- turn index;
- command string;
- exit code;
- wall time;
- hash of the full untruncated output;
- truncated output shown to the model.

The full untruncated output must be archived with the publication bundle. A reviewer should be able to reconstruct the exact information channel for each arm.

Model-authored files in `/scratch` are snapshotted per turn like application code.

## Claim Meaning

A positive result under this profile means:

> Given identical visible specs, identical budgets, and an identical ability to write and run their own tests, providing maintained executable BDD assets reduced regression drift.

The isolated mechanism is the cost of self-authoring and self-maintaining verification under budget. The context arm can reproduce the feedback arm's checks in principle, but it must spend turns, executions, and tokens to do so.

## Harness Gap

The current harness does not yet implement this profile. The existing model loop only runs the provided feedback command for `feedback_capable_spec`; it does not support symmetric model-requested verification commands for both arms.

Before any E1 evidence-generating run, add test-first harness support for:

- structured verification request parsing;
- command whitelist enforcement;
- `/scratch` persistence and capture;
- read-only spec mounts or equivalent patch rejection;
- capped output injection on the next turn;
- full-output hashing;
- budget accounting for verification executions;
- compatibility-profile recording for all constants above.
