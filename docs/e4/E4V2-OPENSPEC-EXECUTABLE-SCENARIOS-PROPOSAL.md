# E4 v2 proposal — OpenSpec workspace with executable scenarios (gate proposal, DRAFT)

**Status: PROPOSED — awaiting operator gate review. No implementation, no runs.**
**Drafted 2026-07-09 during the qwen-plus pilot, at operator direction ("perhaps using openspec
(which includes gherkin), so that we also tackle the sota sdd fwk part").**

## 1. Motivation (from the v1 pilots)

The v1 instrument produced the finding that motivates this redesign: under enforcement, agents
keep the *code* honest (false done-claims get refused; the oracle ends near-green) while the
*spec artifacts still rot* — because the spec is prose, nothing ever executes it, and staleness
is therefore invisible to every arm by design (the meter is hidden). Enforcement as built rejects
lies about code; it cannot reject lies in documentation.

The fix is the original HIT-SDD thesis, which the estate has measured *around* but never tested
directly: **make the spec itself executable**. A stale scenario then stops being silent
documentation debt and becomes a red check.

## 2. The design in one paragraph

Every arm works in the **same real OpenSpec workspace** (pinned CLI, real
`openspec/specs/**` + `openspec/changes/**` layout, real validate/archive steps in the task
protocol). The spec artifacts are OpenSpec requirement files whose `#### Scenario:` blocks are
written in a **sealed, constrained WHEN/THEN grammar** that maps 1:1 onto a **fixed harness step
library** (HTTP steps: request, status, body fields). In the ungated arms the scenarios are
text. In the enforced arm, the gate **executes the agent's own scenarios** as its red/green
check. The framework, the artifacts, the workflow, and the budgets are identical everywhere;
*whether the spec runs* is the only difference. This follows the `e1-openspec-workflow-v0`
governance shape exactly: OpenSpec as a shared task-environment property under a declared
profile (working name `e4-openspec-workflow-v1`), never a condition, arm, or format comparison.

## 3. What each existing piece becomes

| v1 piece | v2 disposition |
| --- | --- |
| Spec artifacts (`specs/openapi.json`, `specs/CONVENTIONS.md`) | Replaced as the agent-facing spec by OpenSpec requirement files with scenario blocks; the typed ground-truth IR stays harness-side as the referee's source of truth |
| Gate custody check (spec changed + parses) | Custody + `openspec validate` (pinned CLI) + scenario-grammar check |
| Gate red/green (harness-generated tests) | **The agent's own scenarios, executed** via the sealed step interpreter (red before implementation, green to accept done) |
| Hidden ground-truth oracle | **Kept unchanged as referee**: true correctness scoring + the anti-gaming guard (below) |
| Drift meter | Re-pointed at scenario/requirement blocks: coverage of the true surface, stale claims, plus the known OpenSpec rot surface (archive replaces whole requirement blocks) |
| Fake agent, snapshots, replay, budgets, verdict tool | Carry over with fixture updates |

## 4. Anti-gaming (the vacuous-spec problem)

An agent under an executed-spec gate can pass trivially by writing weak scenarios. Defense, same
shape the authored-spec study landed on: the hidden ground-truth checks still score true
correctness, and the meter reports **scenario coverage vs the true surface** as a first-class
number. Gaming does not break the gate; it shows up as a measured coverage gap — and
"gated agents write thin specs" would itself be a reportable finding.

## 5. Claim this design can earn (per the public-claim target)

"In a real OpenSpec workflow, agents — including frontier ones — let scenarios rot unless the
scenarios execute." Names a real framework, uses its real CLI and layout, one causal variable,
CTO-legible. Model tier and problem-pool difficulty remain orthogonal knobs (frontier run and the
pre-registered pool-escalation ladder in the claim-target memory).

## 6. Estimated shape of the work (no commitment implied)

Two to three focused sessions, all no-spend until a new calibration gate: workspace generator for
the OpenSpec layout + pinned CLI integration (quirks known: exit-0 abort, dated archive dirs),
scenario grammar + step interpreter over the existing HTTP executor, meter re-pointing, fake-agent
and fixture updates, then the usual staged path (dry run → calibration → pre-registered pilot).

## 7. Open questions for the gate

1. Does the propose→archive OpenSpec cycle happen once per task (matching the per-task change
   granularity) or once per sequence? (Per task matches how OpenSpec is actually used.)
2. Do the ungated arms keep the standing-instruction arm, given its observed inertness — or does
   v2 drop to two arms (prose vs executed) for budget?
3. Scenario grammar scope: HTTP-request steps only (v1-equivalent coverage), or include the
   conventions channel (error-envelope shape steps)?
4. Does v1's bespoke-substrate lineage continue in parallel for comparability, or is it retired
   as superseded?
