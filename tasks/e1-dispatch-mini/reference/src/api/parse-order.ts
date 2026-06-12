const STATUS_VOCABULARY = [
  "awaiting_payment",
  "processing",
  "partially_shipped",
  "shipped",
  "partially_returned",
  "returned",
  "cancelled",
  "cancelled_partial"
];

export function parseOrder(json: string): Record<string, unknown> {
  const raw = JSON.parse(json) as Record<string, unknown>;
  const status = String(raw.status ?? "");

  if (!STATUS_VOCABULARY.includes(status)) {
    return { error: "unknown_status", status };
  }

  const out: Record<string, unknown> = {
    order_id: raw.order,
    status,
    total_cents: raw.total_cents
  };

  if (raw.requires_refund === true) {
    out.requires_refund = true;
  }

  out.lines = ((raw.lines as Array<Record<string, unknown>>) ?? []).map((line) => {
    const parsed: Record<string, unknown> = {
      line_id: line.line,
      amount_cents: line.amount_cents
    };

    if (line.shipped === true) {
      parsed.shipped = true;
    }
    if (line.returned === true) {
      parsed.returned = true;
    }

    return parsed;
  });

  if (Array.isArray(raw.notes) && raw.notes.length > 0) {
    out.notes = raw.notes;
  }

  return out;
}
