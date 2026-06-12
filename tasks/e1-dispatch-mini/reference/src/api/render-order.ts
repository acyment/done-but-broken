import type { Order } from "../dispatch-types";

function statusOf(order: Order): string {
  let shippedCount = 0;
  let returnedCount = 0;

  for (const line of order.lines) {
    if (line.shipped) {
      shippedCount += 1;
    }
    if (line.returned) {
      returnedCount += 1;
    }
  }

  const lineCount = order.lines.length;

  if (order.cancelled) {
    return shippedCount > 0 ? "cancelled_partial" : "cancelled";
  }

  if (!order.paid) {
    return "awaiting_payment";
  }

  if (lineCount > 0 && returnedCount === lineCount) {
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

  parts.push(`"order":${JSON.stringify(order.order_id)}`);
  parts.push(`"status":"${statusOf(order)}"`);
  parts.push(`"total_cents":${order.lines.reduce((sum, line) => sum + line.amount_cents, 0)}`);

  if (order.cancelled && order.lines.some((line) => line.shipped)) {
    parts.push(`"requires_refund":true`);
  }

  const lines = order.lines.map((line) => {
    const fields = [`"line":${JSON.stringify(line.line_id)}`, `"amount_cents":${line.amount_cents}`];

    if (line.shipped) {
      fields.push(`"shipped":true`);
    }
    if (line.returned) {
      fields.push(`"returned":true`);
    }

    return `{${fields.join(",")}}`;
  });

  parts.push(`"lines":[${lines.join(",")}]`);

  if (order.notes.length > 0) {
    parts.push(`"notes":${JSON.stringify(order.notes)}`);
  }

  return `{${parts.join(",")}}`;
}
