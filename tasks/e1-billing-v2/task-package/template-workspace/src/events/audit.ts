// Audit log with per-aggregate gap-free monotonic sequence numbers (I-SEQ).

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
