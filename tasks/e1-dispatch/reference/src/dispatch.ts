import { emptyState, type DispatchState, type Ev, type Query } from "./dispatch-types";
import { applyEvent, deriveStatus } from "./orders";
import { exportOrder } from "./api/render-order";
import { parseOrder } from "./api/parse-order";
import { statusDigest, receivablesDigest } from "./notify/digest";

export function applyEvents(state: DispatchState, events: Ev[]): DispatchState {
  return events.reduce((current, event) => applyEvent(current, event), state);
}

function requireOrder(state: DispatchState, orderId: unknown) {
  const order = state.orders[String(orderId)];

  if (!order) {
    throw new Error(`Unknown order: ${String(orderId)}`);
  }

  return order;
}

export function evaluate(events: Ev[], query: Query): unknown {
  const state = applyEvents(emptyState(), events);

  switch (query.kind) {
    case "order_status": {
      const order = requireOrder(state, query.order_id);
      return { order_id: order.order_id, status: deriveStatus(order) };
    }
    case "export_order":
      return exportOrder(requireOrder(state, query.order_id));
    case "reimport_order":
      return parseOrder(exportOrder(requireOrder(state, query.order_id)));
    case "status_digest":
      return statusDigest(state);
    case "receivables_digest":
      return receivablesDigest(state);
    default:
      throw new Error(`Unknown query kind: ${String(query.kind)}`);
  }
}
