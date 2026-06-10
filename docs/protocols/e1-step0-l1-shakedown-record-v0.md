# E1 Step 0 L1 Shakedown Record (v0)

Date: 2026-06-10. Local-only; no provider runs.

The Step 0 go-gate requires an L1 shakedown with scripted fake agents covering five archetypes before model-in-loop calibration. Coverage now exists at two layers:

## Parser-level battery

`test/e1-l1-parser-shakedown.test.ts` — 23 tests covering pure prose, malformed delimiters (unclosed, nested, duplicated, fence-interleaved), valid blocks inside one outer markdown fence, wrong block precedence, chatty buried blocks, the adversarial command-grammar battery, and L1-to-L0 integration.

## End-to-end battery (this record's addition)

`test/e1-l1-shakedown-e2e.test.ts` — the five archetypes driven through the full `runE1TaskPackageNoProvider` loop on the real CartCalc task/oracle packages (mounting, real workspace-snapshot prompts, parity validation, oracle scoring on every turn snapshot, bundle emission):

| Archetype | Where | Asserted behavior |
| --- | --- | --- |
| Pure prose ×3 | dedicated run, both arms, all checkpoints | three no-op turns → `agent_stalled` per checkpoint; run continues into the next checkpoint; final metrics 0; stall counts 3/3 |
| Malformed delimiter (unclosed FILE block) | feedback arm CP2 turn 1 | block discarded with a recorded violation, turn consumed as no-op, harness notice injected, clean recovery on turn 2, checkpoint `done` |
| Valid blocks in one outer markdown fence | context arm CP1 | fence stripped, replacement applied, `done` |
| Wrong precedence (`<<<DONE>>>` textually before the FILE block) | context arm CP2 | replacement still applied (replacements → verification → done ordering), `done` |
| Chatty output with buried valid blocks | feedback arm CP1 | replacement applied from inside prose, `done` |

Mixed-archetype run ends `completed` with oracle metric 1.0 in both arms.

Both batteries are part of the default `bun test` suite, so the shakedown re-runs on every suite execution, including the Step 0 stability gate.
