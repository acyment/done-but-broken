# Pricing Discount Public Narrative

## Claim

On a sealed pricing-lifecycle task under `mistralai/mistral-small-2603` with a 2-turn / 1-feedback budget, executable BDD-style specs helped an AI coding agent implement and preserve more behavior than prose-only specs.

The honest decomposition matters:

- In the first pricing matrix, executable, example-bearing checks strongly beat prose-only specs (`mean AUC delta +0.4444`, positive in `3/3`).
- That first result bundled two benefits: concrete contract/examples and runnability. The prose-only arm did not see the event API examples embedded in the runnable tests.
- In the content-controlled matrix, both arms received the same event API and worked examples. The executable feedback loop still helped, but less dramatically (`mean AUC delta +0.1852`, positive in `3/3`).

So the bounded statement is: executable specs helped partly by clarifying the contract, and partly through the feedback loop itself. This is preliminary, single-task-family, single-model evidence. It is not a generalized benchmark claim.

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
