# Experiment Runtime Optimization

Updated: 2026-06-09

This document describes runtime optimizations that do not change the two-arm protocol semantics.

No provider/model run is authorized by this document.

## Current Default

CLI provider/operator runs default to:

```bash
--condition-concurrency 2
```

Pass `--condition-concurrency 1` when a provider route has tight concurrency limits or when reproducing a sequential historical profile.

## Safe Parallelism

Checkpoint order inside a condition is causal: `I02` must start from the workspace produced by `I01`, and so on. Do not parallelize checkpoints within one condition.

The two condition workspaces are independent, so the runner can execute the condition pipelines concurrently:

The runner library remains sequential when called directly without a budget. The CLI sets the parallel default for operator runs.

This runs `context_only_spec` and `feedback_capable_spec` at the same time while preserving serial checkpoint order inside each condition.

Use this only when the provider quota can tolerate two concurrent requests. If a provider starts returning rate-limit, quota, malformed-response, or timeout flags under parallelism, stop and treat that as a separate provider execution boundary.

## Provenance Boundary

`condition_concurrency` is recorded in the run budget when it differs from the sequential runner default. That changes the `budget_hash`, so parallel CLI runs do not silently pool with sequential runs.

Sequential direct-library runs omit the field and keep the historical budget shape.

## Profiling

New checkpoint manifests and run manifests include per-checkpoint timing:

- `timing.checkpoint_ms`
- `timing.agent_ms`
- `timing.hidden_oracle_ms` when a hidden oracle runs

Use these fields to separate provider/model latency from local oracle and artifact-writing overhead.

Quick local inspection:

```bash
bun -e 'const m=await Bun.file("runs/<run-id>/run.json").json(); for (const c of m.conditions) for (const p of m.condition_results[c].checkpoints) console.log(c, p.checkpoint_id, p.timing)'
```

## Expected Impact

For provider-bound runs with similar arm latency, `--condition-concurrency 2` should approach a 2x wall-clock improvement because the two arms are the dominant independent units. It will not reduce token cost.

For local fake-agent runs, hidden-oracle execution and workspace hashing can dominate, so the speedup may be smaller.
