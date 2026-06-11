// Audit log with per-aggregate gap-free monotonic sequence numbers (I-SEQ) and the
// deterministic state-hash helpers used by replay determinism (I-REPLAY).

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

// Deterministic JSON with object keys sorted bytewise at every level.
export function stableStringify(value: unknown): string {
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .toSorted(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);

    return `{${entries.join(",")}}`;
  }

  throw new Error(`stableStringify cannot encode ${typeof value}`);
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
