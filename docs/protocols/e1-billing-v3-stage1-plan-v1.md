# e1-billing-v3 Stage 1 Frontier Difficulty Probe — Sealed Analysis Plan (v1)

Date sealed: 2026-06-11. This is the first and only probe plan for billing-v3. The task
was built as the successor to billing-v2 after both frontier models (Sonnet 4.6 AUC
0.9929, Qwen 3.7 Max AUC 0.9361) saturated billing-v2 at ceiling. The successor adds a
seeded fragile hash spine (from CP01), forced rewrites of frozen files (audit.ts,
serializers.ts, invoice.ts, money.ts), and 13 of 18 checkpoints perturbing the I-REPLAY
invariant. Execution requires explicit operator authorization; this document only fixes
what an authorized run means.

## Boundary

| Field | Value |
| --- | --- |
| Task | `e1-billing-v3`, checkpoints CP01–CP18 |
| Design boundary | `billing-v3-task-design-v1.md` |
| Protocol profile | `e1-openspec-workflow-v0` (sealed 1.0.0) over base constants `e1-frontier-sealed-constants-v1.0.json` (sealed 1.0.0) |
| Run classification | `difficulty_probe` (not causal evidence) |
| Condition | `context_only_spec` only; up to 3 runs with pairing labels `seed-a`, `seed-b`, `seed-c`, fired sequentially with a read between runs, subject to the early-stop rule |
| Model/route | `qwen3.7-max` direct to the operator's Alibaba MaaS OpenAI-compatible endpoint (route id `dashscope-compatible-chat-completions`, key env `DASHSCOPE_API_KEY`). The workspace-scoped endpoint URL lives in `.env` as `MODEL_LOOP_ENDPOINT` (gitignored; it is stamped into local bundle manifests, which stay private — published run cards quote the route id only) |
| Budgets | sealed constants: 12 turns/checkpoint, 6 verification executions/checkpoint, 4000 output tokens/turn |
| Primary metric | hidden-oracle `checkpoint_mean_cumulative_hidden_assertion_pass_rate_v1` (regression-free AUC) |
| Bundle grade | evidence requires the sealed constants plus `--protocol-document-hash` of the commitments doc (`e1-billing-v3-commitments-v1.md`) at invocation |

Hashes for every sealed artifact are published in `e1-billing-v3-commitments-v1.md`
(commit-then-reveal; the oracle package stays private until publication and executes only
against captured snapshots).

A probe verdict under this plan is a statement about Qwen 3.7 Max on billing-v3, never
pooled with billing-v2 observations nor with any Sonnet observations.

## Predeclared probe gate (pass = the task is frontier-valid for Stage 2)

All three criteria, evaluated over the clean context runs:

1. Mean context regression-free AUC ≤ 0.92.
2. Mean ≥ 2 on-graph drift regressions per run — a regression is a hidden-oracle check
   that passes at some checkpoint end and fails at a later checkpoint end; "on-graph"
   means the failing checkpoint lists the check's introducing checkpoint in its
   perturbation set in the frozen interaction graph (`billing-v3-task-design-v1.md`).
3. Failures are drift, not structural — all of:
   - no protocol-usability stall flag (sealed stall-reporting rule);
   - `output_truncated_turn_rate` ≤ 0.10 per run (model-output `finish_reason=length`,
     measured by `bun run e1:stats`), and no checkpoint with 3+ consecutive
     length-terminated turns;
   - source-code capture confirms real multi-file edits.

Outcomes (no reinterpretation after results):

- **Gate passes** → Stage 2 causal pilots may be proposed for Qwen 3.7 Max (separate
  authorization; MCID +0.05 paired hidden-oracle AUC delta; two-look group-sequential
  rule per the design doc).
- **Context ceilings (criterion 1 fails: AUC > 0.92, or criterion 2 fails: < 2 on-graph
  regressions)** → boundary result only. Third-ceiling closure rule applies: if this is a
  clean ceiling (criterion 3 also passes), the billing domain closes for frontier
  discrimination claims (see commitments doc). No on-the-fly escalation: extending the
  task or changing domain requires a new sealed design revision reviewed at the AGENTS.md
  level.
- **Structural failures dominate (criterion 3 fails)** → no claim; redesign under a new
  version before more spend.
- An optional single `feedback_capable_spec` feasibility run is pre-authorized to follow
  only if the gate passes, classification `calibration`.

## Third-ceiling closure rule (billing domain)

Billing-v2 ceilinged under both Sonnet 4.6 (AUC 0.9929) and Qwen 3.7 Max (AUC 0.9361).
Billing-v3 is the final attempt at the billing domain for frontier discrimination. If
billing-v3 returns a clean ceiling result under criterion-3, the billing domain closes:
no further billing task version may be proposed without a domain-change justification
reviewed and recorded in AGENTS.md. A clean ceiling here means the domain's structural
complexity ceiling has been reached, not that the causal hypothesis is false — it means
frontier models solve this class of problem independently of spec quality.

## Early-stop rule (predeclared)

If seed-a returns a clean (criterion-3-passing) run whose AUC > 0.92 **and** shows zero
on-graph regressions, seeds b and c are not fired: the boundary verdict is already
determined. This rule can only stop early on the ceiling side, never to rescue a pass.

If seed-a returns a stall or is invalid (criterion 3 fails), one replacement run is
permitted before stopping.

## Validity rules

- Clean run = inspection `valid=true` via `bun run e1:inspect -- --task billing-v3`
  (full replay including archive steps), no provider validity flags, no carry-forward.
- Provider-flagged or invalid runs are recorded, excluded, and may be replaced once under
  the identical boundary; two consecutive same-mode provider failures stop the probe for
  profile revision under a new boundary.
- No pooling with any billing-v2 runs (any seed, any model), Sonnet runs of any version,
  CartCalc, pricing, payroll, subscription, or inventory runs, nor across model/route/
  profile/task-version changes.
- The survival ledger (OpenSpec scenario drops) is secondary descriptive context, never
  the gate.

## Cost (projected from measured billing-v2 Qwen run)

Billing-v2 Qwen probe (v4, seed-a) measured: roughly $3.30/run with DashScope caching
active. Billing-v3 is larger (197 vs ~167 oracle cases, more files, more complex state)
— projection: **≈ $4.50/run** with caching effective, **≈ $11/run** worst-case zero
caching.

The first run must confirm `cached_input_tokens > 0` in the run summary; if caching is
not engaging, stop and investigate before further seeds.

DashScope prices (same as billing-v2 v4): $1.25 / $0.25 cached / $3.75 per Mtok output.
Per-call guardrail: worst-case single call ≈ $0.12 (80k fresh input + 4k output), so
`--max-call-cost 0.15`. Suggested cap: $8 with caching confirmed, $15 for the first run.

## Invocation template (requires explicit authorization)

Prerequisites: `.env` provides `DASHSCOPE_API_KEY` and `MODEL_LOOP_ENDPOINT` (the
workspace-scoped `/compatible-mode/v1/chat/completions` URL). No proxy or other process
is involved; the runner's own transport calls the endpoint directly.

```
set -a; source .env; set +a
bun run e1 -- --task=billing-v3 --arm=context --live --transport=live \
  --model qwen3.7-max --endpoint "$MODEL_LOOP_ENDPOINT" \
  --route-id dashscope-compatible-chat-completions \
  --api-key-env DASHSCOPE_API_KEY \
  --classification=difficulty_probe \
  --input-usd-per-mtok 1.25 --cached-input-usd-per-mtok 0.25 --output-usd-per-mtok 3.75 \
  --max-call-cost 0.15 --cap <operator-cap> \
  --prompt-cache off \
  --protocol-document-hash <commitments-v1-doc-sha256> \
  --run-id e1-billing-v3-qwen37max-context-probe-v1-seed-a-20260611-001
```

`--prompt-cache off` is correct for this route: explicit `cache_control` breakpoints are
an Anthropic-style mechanism; DashScope applies implicit context caching server-side and
reports it via `usage.prompt_tokens_details.cached_tokens`, which the runner already
records.

After the run:
1. `bun run e1:inspect -- --task billing-v3` → confirm `valid=true`.
2. `bun run e1:stats -- --bundle <run-id>` → record truncation rate, AUC, regression
   count.
3. Write a run card in `docs/run-cards/` with classification `difficulty_probe`.
4. Apply the early-stop rule: if seed-a ceilings cleanly, stop; write the domain-closure
   note in AGENTS.md under the third-ceiling closure rule.
