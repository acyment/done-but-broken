import type { DispatchState, Ev, Line, Order } from "./dispatch-types";

function updateOrder(state: DispatchState, orderId: string, update: (order: Order) => Order): DispatchState {
  const order = state.orders[orderId];

  if (!order) {
    return state;
  }

  return { orders: { ...state.orders, [orderId]: update(order) } };
}

function updateLine(order: Order, lineId: string, update: (line: Line) => Line): Order {
  return {
    ...order,
    lines: order.lines.map((line) => (line.line_id === lineId ? update(line) : line))
  };
}

export function applyEvent(state: DispatchState, event: Ev): DispatchState {
  switch (event.type) {
    case "order_created": {
      const orderId = String(event.order_id);
      const lines = (event.lines as Array<Record<string, unknown>>).map((line) => ({
        line_id: String(line.line_id),
        amount_cents: Number(line.amount_cents),
        shipped: false,
        returned: false
      }));
      return {
        orders: {
          ...state.orders,
          [orderId]: { order_id: orderId, paid: false, cancelled: false, lines, notes: [] }
        }
      };
    }
    case "payment_received":
      return updateOrder(state, String(event.order_id), (order) => ({ ...order, paid: true }));
    case "line_shipped":
      return updateOrder(state, String(event.order_id), (order) =>
        updateLine(order, String(event.line_id), (line) => ({ ...line, shipped: true }))
      );
    case "line_returned":
      return updateOrder(state, String(event.order_id), (order) =>
        updateLine(order, String(event.line_id), (line) => (line.shipped ? { ...line, returned: true } : line))
      );
    case "order_cancelled":
      return updateOrder(state, String(event.order_id), (order) => ({ ...order, cancelled: true }));
    case "note_added":
      return updateOrder(state, String(event.order_id), (order) => ({
        ...order,
        notes: [...order.notes, String(event.note)]
      }));
    default:
      return state;
  }
}

export function deriveStatus(order: Order): string {
  const lines = order.lines;

  if (order.cancelled) {
    return lines.some((line) => line.shipped) ? "cancelled_partial" : "cancelled";
  }

  if (!order.paid) {
    return "awaiting_payment";
  }

  if (lines.length > 0 && lines.every((line) => line.returned)) {
    return "returned";
  }

  if (lines.length > 0 && lines.every((line) => line.shipped)) {
    return lines.some((line) => line.returned) ? "partially_returned" : "shipped";
  }

  if (lines.some((line) => line.shipped)) {
    return "partially_shipped";
  }

  return "processing";
}

export function orderTotal(order: Order): number {
  return order.lines.reduce((sum, line) => sum + line.amount_cents, 0);
}
