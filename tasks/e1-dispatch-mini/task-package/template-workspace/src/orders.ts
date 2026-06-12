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
        shipped: false
      }));
      return {
        orders: {
          ...state.orders,
          [orderId]: { order_id: orderId, paid: false, cancelled: false, lines }
        }
      };
    }
    case "payment_received":
      return updateOrder(state, String(event.order_id), (order) => ({ ...order, paid: true }));
    case "line_shipped":
      return updateOrder(state, String(event.order_id), (order) =>
        updateLine(order, String(event.line_id), (line) => ({ ...line, shipped: true }))
      );
    case "order_cancelled":
      return updateOrder(state, String(event.order_id), (order) => ({ ...order, cancelled: true }));
    default:
      return state;
  }
}

export function deriveStatus(order: Order): string {
  if (order.cancelled) {
    return "cancelled";
  }

  if (!order.paid) {
    return "awaiting_payment";
  }

  if (order.lines.length > 0 && order.lines.every((line) => line.shipped)) {
    return "shipped";
  }

  return "processing";
}

export function orderTotal(order: Order): number {
  return order.lines.reduce((sum, line) => sum + line.amount_cents, 0);
}
