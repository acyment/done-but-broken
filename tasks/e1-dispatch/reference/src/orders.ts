import type { DispatchState, Ev, Line, Order } from "./dispatch-types";

// Canonical status vocabulary in lifecycle order. Both the importer's validation list
// and the digest's bucket-ordering table must stay in sync with this sequence.
// Every correction checkpoint that adds a status token requires updating all four sites:
// this list, the importer vocabulary, the digest LIFECYCLE_ORDER, and deriveStatus itself.
export const STATUS_VOCAB = [
  "awaiting_payment",
  "partially_paid",
  "processing",
  "partially_shipped",
  "shipped",
  "partially_returned",
  "returned",
  "closed",
  "cancelled",
  "cancelled_partial",
  "cancelled_owing"
] as const;

export type StatusToken = (typeof STATUS_VOCAB)[number];

// --- Internal state snapshot types used by deriveStatus ---

type PaymentState = {
  fullyPaid: boolean;
  hasPartialPayment: boolean;
};

type ShipmentState = {
  lineCount: number;
  shippedCount: number;
  returnedCount: number;
  refundedCount: number;
  allShipped: boolean;
  anyShipped: boolean;
  allReturned: boolean;
  anyReturned: boolean;
  allRefunded: boolean;
};

function getPaymentState(order: Order): PaymentState {
  return {
    fullyPaid: order.paid,
    hasPartialPayment: order.paid_cents > 0 && !order.paid
  };
}

function getShipmentState(lines: Line[]): ShipmentState {
  const lineCount = lines.length;
  let shippedCount = 0;
  let returnedCount = 0;
  let refundedCount = 0;

  for (const line of lines) {
    if (line.shipped) shippedCount += 1;
    if (line.returned) returnedCount += 1;
    if (line.refunded) refundedCount += 1;
  }

  return {
    lineCount,
    shippedCount,
    returnedCount,
    refundedCount,
    allShipped: lineCount > 0 && shippedCount === lineCount,
    anyShipped: shippedCount > 0,
    allReturned: lineCount > 0 && returnedCount === lineCount,
    anyReturned: returnedCount > 0,
    allRefunded: lineCount > 0 && refundedCount === lineCount
  };
}

// --- Helpers ---

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

function lineById(order: Order, lineId: string): Line | undefined {
  return order.lines.find((line) => line.line_id === lineId);
}

// --- Event application ---

export function applyEvent(state: DispatchState, event: Ev): DispatchState {
  switch (event.type) {
    case "order_created": {
      const orderId = String(event.order_id);
      const lines = (event.lines as Array<Record<string, unknown>>).map((line) => ({
        line_id: String(line.line_id),
        amount_cents: Number(line.amount_cents),
        shipped: false,
        returned: false,
        refunded: false
      }));
      return {
        orders: {
          ...state.orders,
          [orderId]: {
            order_id: orderId,
            paid: false,
            paid_cents: 0,
            cancelled: false,
            lines,
            notes: []
          }
        }
      };
    }

    case "payment_received":
      return updateOrder(state, String(event.order_id), (order) => {
        const fullTotal = order.lines.reduce((sum, line) => sum + line.amount_cents, 0);
        return { ...order, paid: true, paid_cents: fullTotal };
      });

    case "partial_payment_received": {
      const amount = Number(event.amount_cents);
      if (Number.isNaN(amount) || amount <= 0) {
        return state;
      }
      return updateOrder(state, String(event.order_id), (order) => ({
        ...order,
        paid_cents: order.paid_cents + amount
      }));
    }

    case "line_shipped": {
      const orderId = String(event.order_id);
      const lineId = String(event.line_id);
      const carrier = event.carrier != null ? String(event.carrier) : undefined;
      const tracking = event.tracking != null ? String(event.tracking) : undefined;
      return updateOrder(state, orderId, (order) =>
        updateLine(order, lineId, (line) => ({
          ...line,
          shipped: true,
          ...(carrier !== undefined ? { carrier } : {}),
          ...(tracking !== undefined ? { tracking } : {})
        }))
      );
    }

    case "line_returned": {
      const orderId = String(event.order_id);
      const lineId = String(event.line_id);
      return updateOrder(state, orderId, (order) => {
        const target = lineById(order, lineId);
        // Returns only apply to lines that have shipped.
        if (!target || !target.shipped) {
          return order;
        }
        return updateLine(order, lineId, (line) => ({ ...line, returned: true }));
      });
    }

    case "refund_issued": {
      const orderId = String(event.order_id);
      const lineId = String(event.line_id);
      return updateOrder(state, orderId, (order) => {
        const target = lineById(order, lineId);
        // Refunds only apply to lines that have been returned.
        if (!target || !target.returned) {
          return order;
        }
        return updateLine(order, lineId, (line) => ({ ...line, refunded: true }));
      });
    }

    case "order_cancelled":
      return updateOrder(state, String(event.order_id), (order) => ({
        ...order,
        cancelled: true
      }));

    case "note_added":
      return updateOrder(state, String(event.order_id), (order) => ({
        ...order,
        notes: [...order.notes, String(event.note)]
      }));

    default:
      return state;
  }
}

// --- Status derivation ---

export function deriveStatus(order: Order): string {
  const payment = getPaymentState(order);

  // Cancellation branch — highest precedence.
  if (order.cancelled) {
    // An order cancelled while a partial payment (but not full payment) was outstanding
    // takes the cancelled_owing branch. This takes precedence over cancelled_partial to
    // avoid ambiguity when both conditions hold (partial payment AND some lines shipped).
    if (payment.hasPartialPayment) {
      return "cancelled_owing";
    }

    const shipment = getShipmentState(order.lines);
    return shipment.anyShipped ? "cancelled_partial" : "cancelled";
  }

  // Not fully paid yet — distinguish zero payment from partial payment.
  if (!payment.fullyPaid) {
    return payment.hasPartialPayment ? "partially_paid" : "awaiting_payment";
  }

  // Fully paid — assess line state.
  const shipment = getShipmentState(order.lines);

  // Zero-line orders remain processing after payment.
  if (shipment.lineCount === 0) {
    return "processing";
  }

  // Closed: every line returned AND every line refunded (fully settled).
  // Must be checked before `returned` so it takes precedence.
  if (shipment.allReturned && shipment.allRefunded) {
    return "closed";
  }

  // Returned: every line returned but at least one not yet refunded.
  if (shipment.allReturned) {
    return "returned";
  }

  // All lines shipped; check return state.
  if (shipment.allShipped) {
    return shipment.anyReturned ? "partially_returned" : "shipped";
  }

  // Some lines shipped, some still pending.
  if (shipment.anyShipped) {
    return "partially_shipped";
  }

  return "processing";
}

// --- Aggregate computations ---

export function orderTotal(order: Order): number {
  return order.lines.reduce((sum, line) => sum + line.amount_cents, 0);
}

export function orderRefundedCents(order: Order): number {
  return order.lines.filter((l) => l.refunded).reduce((sum, l) => sum + l.amount_cents, 0);
}

export function orderOutstanding(order: Order): number {
  return orderTotal(order) - order.paid_cents - orderRefundedCents(order);
}
