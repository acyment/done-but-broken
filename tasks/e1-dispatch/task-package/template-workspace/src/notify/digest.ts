import type { DispatchState, Order } from "../dispatch-types";

const LIFECYCLE_ORDER = ["awaiting_payment", "processing", "shipped", "cancelled"];

function bucketFor(order: Order): string {
  const allShipped = order.lines.length > 0 && order.lines.every((line) => line.shipped);

  if (order.cancelled) {
    return "cancelled";
  }

  if (!order.paid) {
    return "awaiting_payment";
  }

  if (allShipped) {
    return "shipped";
  }

  return "processing";
}

export function statusDigest(state: DispatchState): Array<{ status: string; count: number }> {
  const tally = new Map<string, number>();

  for (const order of Object.values(state.orders)) {
    const bucket = bucketFor(order);
    tally.set(bucket, (tally.get(bucket) ?? 0) + 1);
  }

  return LIFECYCLE_ORDER.filter((status) => tally.has(status)).map((status) => ({
    status,
    count: tally.get(status)!
  }));
}
