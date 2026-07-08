// Three-way diff + classification (architecture §2.4; IMPLEMENTATION-PLAN.md M2). Compares each
// side (spec, code) against ground truth, kind by kind, and classifies every mismatch as
// contradiction / coverage_gap / stale_claim. [R2: R2-1] resolves a stale-claim's identity via the
// rename-lineage map so a missed rename's stale-claim + coverage-gap pair share one
// semantic_item_uid (result-schema.ts's episode keying then merges them to one onset by
// construction — no meter-side "merge" step needed). Gate-1 change 1: registry-bypass
// reconciliation redirects an endpoint that executes successfully but is registry-absent to the
// conventions channel instead of a plain API-channel gap.
import type { E4Discrepancy, E4DriftClass, E4DriftItemKind, E4DriftReport, E4ExecutorEvidence } from "../types";
import type { E4InventoryItem, E4InventoryTriple, E4TruthInventoryItem } from "./types";

export type E4RenameLineageLookupEntry = { old_item_id: string; new_item_id: string; semantic_item_uid: string };

const ALL_KINDS: E4DriftItemKind[] = ["endpoint", "entity", "field", "validation_rule", "convention"];
// Conventions are a spec-only concept (ADR-004) — they have no code-side surface to compare
// against. The registry-bypass rule below still synthesizes a convention-kind code_vs_truth
// discrepancy for the one case that legitimately crosses channels; that's a direct push, not a
// diffOneDirection("convention", "code_vs_truth", ...) comparison.
const CODE_COMPARABLE_KINDS: E4DriftItemKind[] = ["endpoint", "entity", "field", "validation_rule"];

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entryValue]) => [key, sortKeysDeep(entryValue)])
    );
  }
  return value;
}

function diffOneDirection(
  kind: E4DriftItemKind,
  direction: E4Discrepancy["direction"],
  truthItems: E4TruthInventoryItem[],
  otherItems: E4InventoryItem[]
): E4Discrepancy[] {
  const truthByItemId = new Map(truthItems.filter((item) => item.kind === kind).map((item) => [item.item_id, item]));
  const otherByItemId = new Map(otherItems.filter((item) => item.kind === kind).map((item) => [item.item_id, item]));
  const discrepancies: E4Discrepancy[] = [];

  for (const [itemId, truthItem] of truthByItemId) {
    const otherItem = otherByItemId.get(itemId);

    if (!otherItem) {
      discrepancies.push({
        kind,
        class: "coverage_gap",
        direction,
        item_id: itemId,
        semantic_item_uid: truthItem.semantic_item_uid,
        detail: { expected: canonicalJson(truthItem.detail) }
      });
    } else if (canonicalJson(otherItem.detail) !== canonicalJson(truthItem.detail)) {
      discrepancies.push({
        kind,
        class: "contradiction",
        direction,
        item_id: itemId,
        semantic_item_uid: truthItem.semantic_item_uid,
        detail: { expected: canonicalJson(truthItem.detail), found: canonicalJson(otherItem.detail) }
      });
    }
  }

  for (const [itemId, otherItem] of otherByItemId) {
    if (!truthByItemId.has(itemId)) {
      discrepancies.push({
        kind,
        class: "stale_claim",
        direction,
        item_id: itemId,
        semantic_item_uid: "", // resolved below: rename-lineage match, else a stable pseudo-identity
        detail: { found: canonicalJson(otherItem.detail) }
      });
    }
  }

  return discrepancies;
}

function resolveStaleClaimIdentity(discrepancy: E4Discrepancy, renameLineage: E4RenameLineageLookupEntry[]): E4Discrepancy {
  if (discrepancy.class !== "stale_claim" || discrepancy.semantic_item_uid !== "") {
    return discrepancy;
  }

  const lineageMatch = renameLineage.find((entry) => entry.old_item_id === discrepancy.item_id);

  if (lineageMatch) {
    return { ...discrepancy, semantic_item_uid: lineageMatch.semantic_item_uid };
  }

  // No lineage entry — this is either a genuine delete (spec/code never cleaned up) with nothing
  // to reconcile against, or an item the harness never knew as a rename target. Either way it
  // needs a STABLE identity of its own so a persisting stale claim doesn't re-onset every task,
  // and one that a freshly-minted real uid (delete-then-recreate) can never collide with.
  const prefix = discrepancy.direction === "spec_vs_truth" ? "spec-only" : "code-only";
  return { ...discrepancy, semantic_item_uid: `${prefix}:${discrepancy.item_id}` };
}

function buildCounts(discrepancies: E4Discrepancy[]): Record<E4DriftItemKind, Record<E4DriftClass, number>> {
  const counts = Object.fromEntries(
    ALL_KINDS.map((kind) => [kind, { contradiction: 0, coverage_gap: 0, stale_claim: 0 }])
  ) as Record<E4DriftItemKind, Record<E4DriftClass, number>>;

  for (const discrepancy of discrepancies) {
    counts[discrepancy.kind][discrepancy.class] += 1;
  }

  return counts;
}

export function classifyE4Drift(input: {
  triple: E4InventoryTriple;
  executorEvidence: E4ExecutorEvidence;
  renameLineage: E4RenameLineageLookupEntry[];
  meterVersion: string;
}): E4DriftReport {
  const { triple, executorEvidence, renameLineage, meterVersion } = input;
  const specUnparseable = !Array.isArray(triple.spec);
  const extractionFailed = !Array.isArray(triple.code);

  let discrepancies: E4Discrepancy[] = [];
  const registryBypass: { item_id: string }[] = [];

  if (!specUnparseable) {
    const specItems = triple.spec as E4InventoryItem[];
    for (const kind of ALL_KINDS) {
      discrepancies.push(...diffOneDirection(kind, "spec_vs_truth", triple.truth, specItems));
    }
  }

  if (!extractionFailed) {
    const codeItems = triple.code as E4InventoryItem[];
    const passingEndpointIds = new Set(
      executorEvidence.endpoints.filter((endpoint) => endpoint.passed).map((endpoint) => endpoint.item_id)
    );

    for (const kind of CODE_COMPARABLE_KINDS) {
      for (const discrepancy of diffOneDirection(kind, "code_vs_truth", triple.truth, codeItems)) {
        if (kind === "endpoint" && discrepancy.class === "coverage_gap" && passingEndpointIds.has(discrepancy.item_id)) {
          // Gate-1 change 1: executor-green + dump-absent ⇒ registry_bypass, attributed to the
          // conventions channel (a structural-convention violation) — never an API-channel gap.
          registryBypass.push({ item_id: discrepancy.item_id });
          discrepancies.push({
            kind: "convention",
            class: "contradiction",
            direction: "code_vs_truth",
            item_id: discrepancy.item_id,
            semantic_item_uid: discrepancy.semantic_item_uid,
            detail: { found: "registry_bypass" }
          });
        } else {
          discrepancies.push(discrepancy);
        }
      }
    }
  }

  discrepancies = discrepancies.map((discrepancy) => resolveStaleClaimIdentity(discrepancy, renameLineage));

  return {
    meter_version: meterVersion,
    discrepancies,
    spec_unparseable: specUnparseable,
    extraction_failed: extractionFailed,
    registry_bypass: registryBypass,
    counts: buildCounts(discrepancies)
  };
}
