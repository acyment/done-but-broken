// Audit log with per-aggregate gap-free monotonic sequence numbers (I-SEQ) and the
// canonical state registry + renderer behind the deterministic replay hash (I-REPLAY).

export type AuditEntry = {
  seq: number;
  event_id: string;
  event_type: string;
  at: string;
};

export type AuditMap = Record<string, AuditEntry[]>;

// Appends exactly one entry per applied event. seq starts at 1 per aggregate and is
// gap-free: seq = current length + 1.
export function appendAuditEntry(
  audit: AuditMap,
  aggregate_id: string,
  event: { event_id: string; type: string; at: string }
): AuditMap {
  const entries = audit[aggregate_id] ?? [];

  return {
    ...audit,
    [aggregate_id]: [
      ...entries,
      { seq: entries.length + 1, event_id: event.event_id, event_type: event.type, at: event.at }
    ]
  };
}

// Canonical state registry. Order is load-bearing and append-only: new sections and new
// fields are appended exactly as each change request instructs, never reordered and never
// alphabetized. The renderer emits only registered fields, in registry order. Derived
// bookkeeping (applied event ids) is excluded.
export const STATE_FIELD_REGISTRY: { sections: string[]; fields: Record<string, string[]> } = {
  sections: ["subscriptions", "invoices", "audit", "pending_prorations", "coupons"],
  fields: {
    subscription: [
      "subscription_id",
      "customer_id",
      "plan_id",
      "plan_price_cents",
      "status",
      "period_start",
      "period_end",
      "scheduled_change"
    ],
    invoice: [
      "invoice_id",
      "subscription_id",
      "status",
      "lines",
      "subtotal_cents",
      "total_cents",
      "captured_cents",
      "discount_total_cents"
    ],
    line: ["line_id", "kind", "description", "amount_cents", "discount_cents"],
    audit_entry: ["seq", "event_id", "event_type", "at"],
    scheduled_change: ["plan_id", "plan_price_cents"],
    coupon: ["coupon_id", "kind", "percent_bp", "amount_cents", "remaining_invoices"]
  }
};

const SECTION_ENTRY_FIELDS: Record<string, string> = {
  subscriptions: "subscription",
  invoices: "invoice",
  audit: "audit_entry",
  pending_prorations: "line",
  coupons: "coupon"
};

const NESTED_FIELDS: Record<string, string> = {
  lines: "line",
  scheduled_change: "scheduled_change"
};

// Empty values are omitted everywhere: null, undefined, false, 0, empty string, empty
// array, empty object. This is the same omits-empty discipline as the v1 serializer and
// is what keeps earlier checkpoints' hashes stable as later checkpoints append fields.
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === false || value === 0 || value === "") {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length === 0;
  }

  return false;
}

function renderRecord(record: Record<string, unknown>, fieldRegistry: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const field of fieldRegistry) {
    const value = record[field];

    if (isEmpty(value)) {
      continue;
    }

    const nested = NESTED_FIELDS[field];

    if (nested && Array.isArray(value)) {
      out[field] = value.map((item) => renderRecord(item as Record<string, unknown>, STATE_FIELD_REGISTRY.fields[nested]));
    } else if (nested && typeof value === "object") {
      out[field] = renderRecord(value as Record<string, unknown>, STATE_FIELD_REGISTRY.fields[nested]);
    } else {
      out[field] = value;
    }
  }

  return out;
}

// Canonical rendering: sections in registry order (non-empty only), aggregate ids sorted
// bytewise within each section, fields in registry order, empties omitted.
export function canonicalizeState(state: Record<string, unknown>): string {
  const out: Record<string, unknown> = {};

  for (const section of STATE_FIELD_REGISTRY.sections) {
    const value = state[section];

    if (isEmpty(value)) {
      continue;
    }

    const entryRegistry = STATE_FIELD_REGISTRY.fields[SECTION_ENTRY_FIELDS[section]];
    const rendered: Record<string, unknown> = {};

    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const entry = (value as Record<string, unknown>)[key];

      if (isEmpty(entry)) {
        continue;
      }

      rendered[key] = Array.isArray(entry)
        ? entry.map((item) => renderRecord(item as Record<string, unknown>, entryRegistry))
        : renderRecord(entry as Record<string, unknown>, entryRegistry);
    }

    if (Object.keys(rendered).length > 0) {
      out[section] = rendered;
    }
  }

  return JSON.stringify(out);
}

// FNV-1a 32-bit hash over the UTF-16 code units of the input, rendered as 8 hex chars.
export function fnv1aHex(text: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, "0");
}
