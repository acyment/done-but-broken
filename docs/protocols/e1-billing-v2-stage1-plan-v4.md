# e1-billing-v2 Stage 1 Frontier Difficulty Probe — Sealed Analysis Plan (v4)

Date sealed: 2026-06-11. Supersedes `e1-billing-v2-stage1-plan-v3.md` **before execution**
(no run was ever fired under the v3 plan; the v3 task content and design boundary carry
over unchanged). Two changes only: (1) the provider route moves from OpenRouter to a
local LiteLLM proxy with direct provider keys — OpenRouter is retired by operator
decision 2026-06-11 and the runner now refuses `openrouter.ai` endpoints; (2) the probe
model becomes `qwen3.7-max` (Alibaba Qwen 3.7 Max), a frontier-class model by current
public rankings, at roughly one-third of Sonnet 4.6's token prices. Execution requires
explicit operator authorization; this document only fixes what an authorized run means.

## Boundary

| Field | Value |
| --- | --- |
| Task | `e1-billing-v2` version `e1-billing-v2-v3`, checkpoints CP01–CP18 |
| Design boundary | `billing-v2-task-design-v1.md` as amended by `billing-v2-task-design-v2.md` and `billing-v2-task-design-v3.md` |
| Protocol profile | `e1-openspec-workflow-v0` (sealed 1.0.0) over base constants `e1-frontier-sealed-constants-v1.0.json` (sealed 1.0.0) |
| Run classification | `difficulty_probe` (not causal evidence) |
| Condition | `context_only_spec` only; 3 runs with pairing labels `seed-a`, `seed-b`, `seed-c`, fired sequentially with a read between runs, subject to the early-stop rule |
| Model/route | `qwen3.7-max` via local LiteLLM proxy (`litellm-chat-completions`, endpoint `http://localhost:4000/v1/chat/completions`); the proxy config must map this model name to Alibaba DashScope `qwen3.7-max` with a direct DashScope key |
| Budgets | sealed constants: 12 turns/checkpoint, 6 verification executions/checkpoint, 4000 output tokens/turn |
| Primary metric | hidden-oracle `checkpoint_mean_cumulative_hidden_assertion_pass_rate_v1` (regression-free AUC) |
| Bundle grade | evidence requires the sealed constants plus `--protocol-document-hash` of this plan's commitments doc at invocation |

Hashes for every sealed artifact are published in `e1-billing-v2-commitments-v4.md`
(commit-then-reveal; the oracle package stays private until publication and executes only
against captured snapshots).

A probe verdict under this plan is a statement about Qwen 3.7 Max, never pooled with the
Sonnet v1/v2 observations. A later Sonnet-direct probe on the same task version would
need its own plan revision and authorization.

## Predeclared probe gate (pass = the task is frontier-valid for Stage 2)

Unchanged from the v2/v3 plans. All of, evaluated over the clean context runs:

1. Mean context regression-free AUC ≤ 0.92.
2. Mean ≥ 2 on-graph drift regressions per run — a regression is a hidden-oracle check
   that passes at some checkpoint end and fails at a later checkpoint end; "on-graph"
   means the failing checkpoint lists the check's introducing checkpoint in its
   perturbation set in the frozen interaction graph (`billing-v2-task-design-v1.md`).
3. Failures are drift, not structural — all of:
   - no protocol-usability stall flag (sealed stall-reporting rule);
   - `output_truncated_turn_rate` ≤ 0.10 per run (model-output `finish_reason=length`,
     measured by `bun run e1:stats`), and no checkpoint with 3+ consecutive
     length-terminated turns (design v2, Amendment 3);
   - source-code capture confirms real multi-file edits.

Outcomes (no reinterpretation after results):

- **Gate passes** → Stage 2 causal pilots may be proposed for Qwen 3.7 Max (separate
  authorization; MCID +0.05 paired hidden-oracle AUC delta; two-look group-sequential
  rule per the design doc).
- **Context ceilings (AUC > 0.92 or < 2 on-graph regressions)** → boundary result only.
  No on-the-fly escalation: extending the task requires a new sealed design revision and
  task version.
- **Structural failures dominate (criterion 3 fails)** → no claim; redesign under a new
  version before more spend.
- An optional single `feedback_capable_spec` feasibility run is pre-authorized to follow
  only if the gate passes, classification `calibration`.

## Early-stop rule (carried from v3, predeclared)

If seed-a returns a clean (criterion-3-passing) run whose AUC > 0.92 **and** shows zero
on-graph regressions, seeds b and c are not fired: the boundary verdict is already
determined. This rule can only stop early on the ceiling side, never to rescue a pass.

## Validity rules

- Clean run = inspection `valid=true` via `bun run e1:inspect -- --task billing-v2`
  (full replay including archive steps), no provider validity flags, no carry-forward.
- Provider-flagged or invalid runs are recorded, excluded, and may be replaced once under
  the identical boundary; two consecutive same-mode provider failures stop the probe for
  profile revision under a new boundary.
- No pooling with v1/v2 billing runs (any model), Sonnet runs of any version, CartCalc,
  pricing, payroll, subscription, or inventory runs, nor across model/route/profile/
  task-version changes.
- The survival ledger (OpenSpec scenario drops) is secondary descriptive context, never
  the gate.

## Isolated competence (NOT part of the probe)

Unchanged from prior plans; required before Stage 2 causal pilots only. If Stage 2 is
proposed for Qwen 3.7 Max, isolated-competence runs use the same model and route.

## Cost (projected from measured run shape; verify on first run)

No measured Qwen run exists; projection uses the v2 Sonnet run shape (1.287M fresh +
5.451M cached input, 0.174M output tokens, 86 turns) at DashScope-passthrough prices
($1.25 / $0.25 cached / $3.75 per Mtok):

- With provider-side caching effective: ≈ **$3.62/run**.
- Worst case, zero caching: ≈ **$9.07/run** — the first run must confirm
  `cached_input_tokens > 0` in the run summary; if caching is not engaging, stop and
  investigate before further seeds.

Cost-of-record: LiteLLM's OpenAI-compatible body carries no `usage.cost`, so the bundle's
derived spend (configured prices × recorded usage) is the cost of record
(`cost_of_record_source=derived`); cross-check against the LiteLLM dashboard and the
DashScope console. Per-call guardrail: worst-case single call ≈ $0.12 (80k fresh input +
4k output), so `--max-call-cost 0.15`. Suggested cap: $5 with caching confirmed, $10
for the first run.

## Invocation template (requires explicit authorization)

Prerequisites: LiteLLM proxy running on `localhost:4000` with a `model_list` entry
mapping `qwen3.7-max` → DashScope `qwen3.7-max` (direct `DASHSCOPE_API_KEY`), and
`LITELLM_MASTER_KEY` exported.

```
bun run e1 -- --task=billing-v2 --arm=context --live --transport=live \
  --model qwen3.7-max --route-id litellm-chat-completions \
  --classification=difficulty_probe \
  --input-usd-per-mtok 1.25 --cached-input-usd-per-mtok 0.25 --output-usd-per-mtok 3.75 \
  --max-call-cost 0.15 --cap <operator-cap> \
  --prompt-cache off \
  --protocol-document-hash <commitments-v4-doc-sha256> \
  --run-id e1-billing-v2-qwen37max-context-probe-v4-seed-a-<date>-001
```

`--prompt-cache off` is correct for this route: explicit `cache_control` breakpoints are
an Anthropic-style mechanism; DashScope applies implicit context caching server-side and
reports it via `usage.prompt_tokens_details.cached_tokens`, which the runner already
records. The flag changes wire format only, never conversation content, so the prompt
template hash is unaffected.
