# Pricing Discount Public Narrative

## Claim

On a sealed pricing-lifecycle task with a 2-turn / 1-feedback budget, executable BDD-style specs let a cheap/weak coding agent (`mistralai/mistral-small-2603`) implement an evolving spec far more reliably than the same agent given prose-only specs — while strong, more expensive models already implement the task from the spec alone. The honest, bounded claim is **cheap-model viability**: executable specs help most exactly where capability is the bottleneck.

The three-part decomposition matters:

1. **Executable, example-bearing specs beat prose-only specs (weak model).** In the first pricing matrix, executable checks strongly beat prose-only specs (`mean AUC delta +0.4444`, positive in `3/3`). But this bundled two benefits — concrete contract/examples and runnability — because the prose-only arm did not see the event API examples embedded in the runnable tests.
2. **The feedback loop itself still helps after content parity (weak model).** In the content-controlled matrix, both arms received the same event API and worked examples; only one could run the checks. The executable feedback loop still helped, but less dramatically (`mean AUC delta +0.1852`, positive in `3/3`). So the v0 gap was partly contract clarification and partly the loop.
3. **Strong models ceiling this task — the benefit is for weaker/cheaper agents.** Two independent strong-model smokes on the same content-controlled task — `anthropic/claude-sonnet-4.6` and `qwen3.7-max` — solved **both** arms 9/9. A capable model needs no executable feedback here; it implements the task from the shared spec and event API alone. The feedback loop earns its keep where the model is the bottleneck, not on already-ceilinging frontier models.

So the bounded statement is: executable specs let cheaper/weaker agents achieve more reliable implementation of an evolving spec; they do not prove a benefit for frontier models, which already ceiling this task. This is preliminary, single-task-family evidence. It is not a generalized benchmark claim. The strong-model results are clean `diagnostic_invalid` smokes (a convergent ceiling hint across two vendors), not causal pilots.

## Why The Design Is Credible

The project uses exactly two active conditions:

- `context_only_spec`: same visible semantic spec, no runnable feedback assets.
- `feedback_capable_spec`: same visible semantic spec, plus executable feedback assets and `bun run spec` during agent work.

The harness records replayable artifacts for every checkpoint: prompts, workspace snapshots, hidden oracle results, provider validity flags, and result summaries. Hidden oracle checks are not shown to the agent. Provider-flagged runs are recorded but excluded from clean primary evidence.

The content-controlled pricing variant closes the main skeptic objection from the first pricing run. Both arms received identical:

- event API
- worked input-to-output examples
- visible pricing rules
- checkpoint order

Only the feedback-capable arm could execute the spec checks and see public-safe feedback output.

## Results

### First pricing matrix: executable/example-bearing specs vs prose-only specs

Run card: `docs/run-cards/pricing-discount-demo-v1-mistral-20260608.md`

| Metric | Result |
| --- | ---: |
| Clean causal pilots | 3 |
| Mean regression-free AUC delta | +0.4444 |
| Positive AUC direction | 3/3 |
| Mean final checkpoint pass-rate delta | +0.5926 |

Interpretation: executable, example-bearing specs beat prose-only specs. Caveat: the executable specs also disclosed concrete API examples, so this does not isolate the run-loop alone.

### Content-controlled pricing matrix: run-loop after content parity

Run card: `docs/run-cards/pricing-discount-content-controlled-demo-v1-mistral-20260608.md`

| Metric | Result |
| --- | ---: |
| Clean causal pilots | 3 |
| Mean regression-free AUC delta | +0.1852 |
| Positive AUC direction | 3/3 |
| Mean final checkpoint pass-rate delta | +0.2222 |
| Provider validity flags | none |
| Feedback opportunity integrity | complete, 9/9 in all causal pilots |

Interpretation: after contract and examples were equalized, the executable feedback loop still improved path survival under this task/model/budget. The smaller effect size is the point: it shows the original result was partly contract clarification and partly feedback-loop value.

## What We Are Not Claiming

We are not claiming:

- generalized effectiveness across models or task families
- that feedback always reduces regressions
- that a benchmark has proven BDD works
- that the pricing v0 and content-controlled results can be pooled

The clean claim is narrower and stronger: under this sealed pricing task, Mistral-small, and 2/1 budget, executable specs produced replayable implementation-and-survival gains, and a content-controlled follow-up still found a smaller positive run-loop effect.

## Evidence Links

- Public status: `docs/public-evidence-status.md`
- Public matrix: `docs/public-evidence-matrix.md`
- Pricing v0 run card: `docs/run-cards/pricing-discount-demo-v1-mistral-20260608.md`
- Content-controlled run card: `docs/run-cards/pricing-discount-content-controlled-demo-v1-mistral-20260608.md`
- Subscription task card: `docs/task-cards/subscription-entitlements-lifecycle-v0.md`
- Inventory task card: `docs/task-cards/inventory-reservations-lifecycle-v0.md`
