# Task Card: inventory-reservations-lifecycle-v0

## Purpose

`inventory-reservations-lifecycle-v0` is a sealed stateful lifecycle task for inventory holds, order fulfillment, backorders, and returns. It provides a second task family beyond subscription entitlements while preserving the same two-arm protocol.

The task is designed for:

- `context_only_spec`: same visible semantic spec content, no executable feedback assets.
- `feedback_capable_spec`: same visible semantic spec content, executable feedback assets available during agent work.

The causal variable remains executable feedback information, not extra model turns.

## Public API Contract

```text
applyEvent(state, event): State
canReserve(state, sku, quantity, now): boolean
getAvailability(state, sku, now): Availability
getReservationStatus(state, reservationId, now): ReservationStatus
```

## Checkpoint Sequence

| Checkpoint | Public behavior introduced | Regression pressure |
| --- | --- | --- |
| `I01` | Stock receipts increase sellable inventory. | Later holds, shipments, and returns must preserve inventory accounting. |
| `I02` | Reservations hold stock until expiration. | Later confirmation and cancellation must not lose hold semantics. |
| `I03` | Order confirmation commits held stock. | Confirmed units remain unavailable for new reservations. |
| `I04` | Expiration releases held stock. | Boundary behavior must not leak held stock past `expiresAt`. |
| `I05` | Cancellation releases unshipped allocations. | Cancellation must release held, committed, and backordered units before shipment. |
| `I06` | Duplicate event IDs are idempotent. | Replayed events must not double-count stock, reservations, shipments, or returns. |
| `I07` | Shipment consumes committed stock. | Cancellation after shipment must not restore shipped units. |
| `I08` | Restock fills backorders FIFO. | Partial restocks allocate full reservations to oldest backorders first. |
| `I09` | Returns restore only sellable stock. | Damaged returns are tracked but do not increase sellable inventory. |

## Feedback And Oracle Coverage

Every checkpoint has:

- visible semantic spec text in `tasks/inventory-reservations-lifecycle/canonical-spec.json`
- a runnable visible feedback asset in `tasks/inventory-reservations-lifecycle/feedback-assets/`
- hidden oracle coverage in `tasks/inventory-reservations-lifecycle/hidden-oracle/`
- local acceptance criteria in `tasks/inventory-reservations-lifecycle/local-acceptance-criteria.json`

Visible feedback is useful but not identical to the hidden oracle. Hidden oracle checks are not included in prompt packets or feedback summaries.

## Sealing Status

- Task version: `inventory-reservations-lifecycle-v0`
- Checkpoint list: `I01` through `I09`
- Visible specs: implemented
- Feedback assets: implemented and gated
- Hidden oracle: implemented
- Template workspace: implemented
- Local fake-pilot validation: passes
- Analysis plan: sealed

## Current Public Evidence

Current clean public-facing difficulty result:

| Run | Model/provider profile | Primary delta | Secondary AUC delta | Interpretation |
| --- | --- | ---: | ---: | --- |
| `docs/run-cards/inventory-reservations-difficulty-probe-20260605-001.md` | `mistralai/mistral-small-2603` through OpenRouter loop | 0 | -0.2222 | Clean difficulty probe; both arms finished 9/9, feedback-capable had temporary I05/I06 misses before recovery. |
| `docs/run-cards/inventory-reservations-causal-pilot-20260605-001.md` | `mistralai/mistral-small-2603` through OpenRouter loop | 0 | 0 | Clean causal pilot; both arms passed all checkpoints. |

The clean causal pilot is task/model/profile-specific. It does not support a generalized claim across tasks, models, or budgets.
