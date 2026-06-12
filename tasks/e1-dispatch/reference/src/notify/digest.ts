import type { DispatchState, Order } from "../dispatch-types";
import { deriveStatus, orderTotal, orderOutstanding } from "../orders";

const LIFECYCLE_ORDER = [
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
];

// Uses deriveStatus from orders to guarantee the bucket matches the status API.
function bucketFor(order: Order): string {
  return deriveStatus(order);
}

export function statusDigest(
  state: DispatchState
): Array<{ status: string; count: number; total_cents: number; refund_cents?: number }> {
  const tally = new Map<string, { count: number; total_cents: number; refund_cents: number }>();

  for (const order of Object.values(state.orders)) {
    const bucket = bucketFor(order);
    const entry = tally.get(bucket) ?? { count: 0, total_cents: 0, refund_cents: 0 };
    entry.count += 1;
    entry.total_cents += orderTotal(order);
    entry.refund_cents += order.lines.filter((l) => l.refunded).reduce((sum, l) => sum + l.amount_cents, 0);
    tally.set(bucket, entry);
  }

  return LIFECYCLE_ORDER.filter((status) => tally.has(status)).map((status) => {
    const entry = tally.get(status)!;
    const result: { status: string; count: number; total_cents: number; refund_cents?: number } = {
      status,
      count: entry.count,
      total_cents: entry.total_cents
    };
    if (entry.refund_cents > 0) {
      result.refund_cents = entry.refund_cents;
    }
    return result;
  });
}

export function receivablesDigest(
  state: DispatchState
): Array<{ status: string; outstanding_cents: number }> {
  const tally = new Map<string, number>();

  for (const order of Object.values(state.orders)) {
    const bucket = bucketFor(order);
    const outstanding = orderOutstanding(order);

    if (outstanding > 0) {
      tally.set(bucket, (tally.get(bucket) ?? 0) + outstanding);
    }
  }

  return LIFECYCLE_ORDER.filter((status) => tally.has(status)).map((status) => ({
    status,
    outstanding_cents: tally.get(status)!
  }));
}
