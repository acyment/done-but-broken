import type { Order } from "../dispatch-types";

function statusOf(order: Order): string {
  let shippedCount = 0;
  let returnedCount = 0;
  let refundedCount = 0;

  for (const line of order.lines) {
    if (line.shipped) shippedCount += 1;
    if (line.returned) returnedCount += 1;
    if (line.refunded) refundedCount += 1;
  }

  const lineCount = order.lines.length;

  if (order.cancelled) {
    if (order.paid_cents > 0 && !order.paid) {
      return "cancelled_owing";
    }
    return shippedCount > 0 ? "cancelled_partial" : "cancelled";
  }

  if (!order.paid) {
    return order.paid_cents > 0 ? "partially_paid" : "awaiting_payment";
  }

  const allReturned = lineCount > 0 && returnedCount === lineCount;
  const allRefunded = allReturned && refundedCount === lineCount;

  if (allReturned && allRefunded) {
    return "closed";
  }

  if (allReturned) {
    return "returned";
  }

  if (lineCount > 0 && shippedCount === lineCount) {
    return returnedCount > 0 ? "partially_returned" : "shipped";
  }

  if (shippedCount > 0) {
    return "partially_shipped";
  }

  return "processing";
}

export function exportOrder(order: Order): string {
  const parts: string[] = [];
  const status = statusOf(order);

  parts.push(`"order":${JSON.stringify(order.order_id)}`);
  parts.push(`"status":"${status}"`);
  parts.push(`"total_cents":${order.lines.reduce((sum, line) => sum + line.amount_cents, 0)}`);

  if (status === "cancelled_partial") {
    parts.push(`"requires_refund":true`);
  }
  if (status === "cancelled_owing") {
    parts.push(`"outstanding_owing":true`);
  }

  const lines = order.lines.map((line) => {
    const fields = [`"line":${JSON.stringify(line.line_id)}`, `"amount_cents":${line.amount_cents}`];

    if (line.shipped) {
      fields.push(`"shipped":true`);
    }
    if (line.carrier) {
      fields.push(`"carrier":${JSON.stringify(line.carrier)}`);
    }
    if (line.tracking) {
      fields.push(`"tracking":${JSON.stringify(line.tracking)}`);
    }
    if (line.returned) {
      fields.push(`"returned":true`);
    }
    if (line.refunded) {
      fields.push(`"refunded":true`);
    }

    return `{${fields.join(",")}}`;
  });

  parts.push(`"lines":[${lines.join(",")}]`);

  if (order.notes.length > 0) {
    parts.push(`"notes":${JSON.stringify(order.notes)}`);
  }

  return `{${parts.join(",")}}`;
}
