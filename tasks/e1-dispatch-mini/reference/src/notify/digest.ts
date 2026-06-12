import type { DispatchState, Order } from "../dispatch-types";

const LIFECYCLE_ORDER = [
  "awaiting_payment",
  "processing",
  "partially_shipped",
  "shipped",
  "partially_returned",
  "returned",
  "cancelled",
  "cancelled_partial"
];

function bucketFor(order: Order): string {
  const lines = order.lines;
  const anyShipped = lines.some((line) => line.shipped);
  const anyReturned = lines.some((line) => line.returned);
  const allShipped = lines.length > 0 && lines.every((line) => line.shipped);
  const allReturned = lines.length > 0 && lines.every((line) => line.returned);

  if (order.cancelled) {
    return anyShipped ? "cancelled_partial" : "cancelled";
  }

  if (!order.paid) {
    return "awaiting_payment";
  }

  if (allReturned) {
    return "returned";
  }

  if (allShipped) {
    return anyReturned ? "partially_returned" : "shipped";
  }

  if (anyShipped) {
    return "partially_shipped";
  }

  return "processing";
}

export function statusDigest(state: DispatchState): Array<{ status: string; count: number; total_cents: number }> {
  const tally = new Map<string, { count: number; total_cents: number }>();

  for (const order of Object.values(state.orders)) {
    const bucket = bucketFor(order);
    const entry = tally.get(bucket) ?? { count: 0, total_cents: 0 };
    entry.count += 1;
    entry.total_cents += order.lines.reduce((sum, line) => sum + line.amount_cents, 0);
    tally.set(bucket, entry);
  }

  return LIFECYCLE_ORDER.filter((status) => tally.has(status)).map((status) => ({
    status,
    count: tally.get(status)!.count,
    total_cents: tally.get(status)!.total_cents
  }));
}
