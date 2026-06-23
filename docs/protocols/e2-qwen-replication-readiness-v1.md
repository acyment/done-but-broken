# E2 qwen 3.7 max replication — operator readiness checklist (v1)

Date: 2026-06-20. Operational companion to the sealed `e2-phase1-pilot-commitments-v1-addendum-c.md`
(the pre-registered second-model, independent-lineage replication of the E2 Phase-1.5
acceptance-feedback ablation). This page is the run book: gate status, the exact authorized command,
and the cost/preflight. **Nothing here authorizes the run** — the pilot fires only when the operator
sets `E2_AUTHORIZE_PHASE15=1` with a spend cap.

## Gate status

| Item | Status |
| --- | --- |
| Provider route (qwen 3.7 max, DashScope MaaS, OpenAI-compatible via litellm) | ✅ wired + connectivity-verified 2026-06-20 |
| Harness wiring (`E2_MODEL=qwen` route registry, `DASHSCOPE_API_KEY` auth gate, dry-plan verified) | ✅ `examples/run_phase1_5.py` |
| GATE-A flake certification (N=60) | ✅ **carried from Addendum B** — model-independent (suite determinism), no re-run needed |
| GATE-B contamination / memorization (qwen-relative) | ⏳ **fired 2026-06-20** — `e2-qwen3.7-max-contam-screen-n13-20260620-001.json`; seal result into Addendum C before the pilot |
| Sealed commitments (Addendum C) | ✅ finalized (SHA `8f92eb28…`), GATE-B CLEAN 13/13 sealed, row added to commitments doc |
| Integration smoke (OpenHands + qwen, both arms, freezegun) | ✅ passed 2026-06-20 — both arms resolved, `run_tests` fired, `agent_declared_done` + oracle + patch_hash captured, no errors/truncation (`e2-phase1-5-qwen3.7-max-SMOKE-20260620-001.json`) |
| Operator authorization + spend cap | ⛔ **required, not given** |

## Preflight (before firing)

1. **GATE-B result sealed.** The contamination re-screen must be complete and its result filled into
   Addendum C (clean task list confirmed; any excluded task dropped from the run). Do not fire the
   pilot on an unsealed gate.
2. **Disk.** The runner aborts a task below **10 GiB free** (`min_free_gb=10.0`). The full n=13 builds
   one image at a time and reclaims; still ensure tens of GiB headroom. Check: `df -h ~`.
3. **Docker** running, `linux/amd64` images pullable (the agent does `docker create --platform
   linux/amd64`).
4. **Env.** `DASHSCOPE_API_KEY` exported (or in `.env`); `MODEL_LOOP_ENDPOINT` set to the frozen
   MaaS endpoint so the qwen route resolves it (else it falls back to `dashscope-intl`).
5. **`max_output_tokens` decision (reasoning model).** Default raised to 16000 (`E2_LLM_MAX_OUT`).
   Confirm or override. 4096 (the DeepSeek pilot value) risks truncating qwen tool calls mid-turn.

## Exact authorized command

Dry plan (no spend — verify the plan first):

```sh
cd ~/dev/hit-sdd-bench-e2
E2_MODEL=qwen uv run --extra data python examples/run_phase1_5.py --n 10
```

Authorized full run (n=13 × 2 arms × 10 = 260 rollouts):

```sh
cd ~/dev/hit-sdd-bench-e2
E2_AUTHORIZE_PHASE15=1 \
E2_MODEL=qwen \
DASHSCOPE_API_KEY=sk-... \
MODEL_LOOP_ENDPOINT=https://<your-dashscope-maas-endpoint>/compatible-mode/v1/chat/completions \
  uv run --extra agent --extra data python examples/run_phase1_5.py \
    --n 10 --agent-cc 4 --score-cc 1 --score-timeout 600
```

Flags: `--n` runs/arm/task (sealed at 10); `--agent-cc` rollout concurrency; `--score-cc` oracle
scoring concurrency (keep low for determinism); `--limit N` / `--tasks id1,id2` to smoke a subset
first. Output + resumable checkpoint: `e2-phase1-5-causal-pilot-qwen3.7-max.json`.

**Recommended:** smoke 1–2 fast tasks first (`--tasks spulec__freezegun-582,casbin__pycasbin-392`)
to confirm the OpenHands+qwen integration end-to-end (the connectivity smoke covered litellm only,
not a full agent rollout), then fire the full n.

## Cost / caching — measured (not estimated)

Billing model confirmed from the Alibaba bill (`202606` month summary, Frankfurt): **pay-as-you-go
per-token**, not a flat dedicated-deployment charge. A **50% discount** was applied at billing
(payable = half of list) — may be a promo/commitment; do not assume it persists.

**qwen3.7-max real rate card (list, USD per 1M tokens):**

| token type | $/M | vs input |
| --- | ---: | --- |
| output | 4.951 | — |
| input (uncached) | 1.650 | baseline |
| cache creation / write (5m TTL) | 2.063 | +25% |
| cache hit (implicit tier) | 0.330 | 20% of input |
| **cache read** | **0.165** | **10% of input (90% off)** |

**Caching works and is the dominant cost lever.** Cost probe = 1 task (freezegun, lightest) at the
real N=10 (20 rollouts), with per-rollout token capture (`AgentOutcome.usage`, added to the harness):
- prompt 5.03M tok, of which **3.31M served from cache (65.7% hit ratio)**; output 72.5K (≈48% reasoning).
- Workload is input-heavy (~69:1 prompt:completion), so the 90%-off cache read **cut cost ~57%**
  ($8.67 → $3.75 list).
- **Probe cost ≈ $3.75 list ≈ $1.88 payable** for its 20 rollouts (artifact
  `e2-qwen3.7-max-COST-PROBE-20260620-001.json`, classification `calibration`).

**Full-pilot money estimate (real rates):** floor (freezegun ×13) ≈ **$24 payable**; realistic with
the heavy repos (black/kombu/kafka, 3–6× the agent turns) ≈ **$70–150 payable**. Cheap in absolute
terms.

**The binding cost is wall-clock, not money.** qwen reasoning turns run ~100 s each; with per-task
image pulls (~10 min/image) + up to 60 iterations/rollout, the full 260-rollout run is **many hours
to a couple of days** at `--agent-cc 4`. The run is **resumable** (per-task checkpoint), so it can be
stopped/restarted freely.

## After the run

- Classification `causal_pilot`; **never pool** with the DeepSeek pilot, E1, or across
  substrate/profile (separate compatibility boundary).
- Record a run-card in `hit-sdd-bench/docs/run-cards/`; apply the predeclared replication
  interpretation rule (Addendum C): positive → second independent-lineage controlled positive
  (convergent evidence); clean null → report both models, do not average, generality bounded.
- Replay-validate (re-score patches in a clean container; hashes reproduce) before any claim.
