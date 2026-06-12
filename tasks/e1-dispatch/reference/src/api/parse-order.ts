const STATUS_VOCABULARY = [
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
  if (raw.outstanding_owing === true) {
    out.outstanding_owing = true;
  }

  out.lines = ((raw.lines as Array<Record<string, unknown>>) ?? []).map((line) => {
    const parsed: Record<string, unknown> = {
      line_id: line.line,
      amount_cents: line.amount_cents
    };

    if (line.shipped === true) {
      parsed.shipped = true;
    }
    if (line.carrier != null) {
      parsed.carrier = line.carrier;
    }
    if (line.tracking != null) {
      parsed.tracking = line.tracking;
    }
    if (line.returned === true) {
      parsed.returned = true;
    }
    if (line.refunded === true) {
      parsed.refunded = true;
    }

    return parsed;
  });

  if (Array.isArray(raw.notes) && raw.notes.length > 0) {
    out.notes = raw.notes;
  }

  return out;
}
