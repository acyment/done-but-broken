import type { Order } from "../dispatch-types";

function statusOf(order: Order): string {
  let shippedCount = 0;

  for (const line of order.lines) {
    if (line.shipped) {
      shippedCount += 1;
    }
  }

  if (order.cancelled) {
    return "cancelled";
  }

  if (!order.paid) {
    return "awaiting_payment";
  }

  if (order.lines.length > 0 && shippedCount === order.lines.length) {
    return "shipped";
  }

  return "processing";
}

export function exportOrder(order: Order): string {
  const parts: string[] = [];

  parts.push(`"order":${JSON.stringify(order.order_id)}`);
  parts.push(`"status":"${statusOf(order)}"`);
  parts.push(`"total_cents":${order.lines.reduce((sum, line) => sum + line.amount_cents, 0)}`);

  const lines = order.lines.map((line) => {
    const fields = [`"line":${JSON.stringify(line.line_id)}`, `"amount_cents":${line.amount_cents}`];

    if (line.shipped) {
      fields.push(`"shipped":true`);
    }

    return `{${fields.join(",")}}`;
  });

  parts.push(`"lines":[${lines.join(",")}]`);

  return `{${parts.join(",")}}`;
}
