// Meter-local types (architecture §2.4; IMPLEMENTATION-PLAN.md M2). E4DriftReport/E4Discrepancy/
// E4DriftItemKind/E4ExecutorEvidence already live in ../types (pinned at M0, [R1-S6]); this module
// adds only what the meter needs internally to get from raw sources to that shared shape.
import type { E4DriftItemKind } from "../types";

// What the surface-dump extractor reads out of an agent workspace's registry.ts/schema.ts —
// mirrors exactly what src/e4/substrate/scaffold.ts generates (ADR-001: the registry IS the
// code-side inventory source).
export type E4SurfaceDump = {
  routes: Array<{ method: string; path: string; entity: string; kind: string }>;
  entities: Array<{
    name: string;
    fields: Array<{ name: string; type: string; ref_entity: string | null; required: boolean }>;
  }>;
  validation_rules: Array<{ entity: string; field: string; kind: string; detail: Record<string, unknown> }>;
};

export type E4SurfaceDumpResult = E4SurfaceDump | { extraction_failed: true; reason: string };

// One rendered inventory item, from any of the three sources (spec / code / truth). `detail` is
// whatever's comparable for that kind (e.g. a field's type+required); item identity for matching
// is `item_id` (rendered name/path — NOT semantic_item_uid, which only ground truth carries
// natively and which contradiction/coverage_gap/stale_claim classification resolves via the
// rename-lineage map, [R2: R2-1]).
export type E4InventoryItem = {
  kind: E4DriftItemKind;
  item_id: string;
  detail: Record<string, unknown>;
};

export type E4TruthInventoryItem = E4InventoryItem & { semantic_item_uid: string };

export type E4InventoryTriple = {
  spec: E4InventoryItem[] | { spec_unparseable: true };
  code: E4InventoryItem[] | { extraction_failed: true; reason: string };
  truth: E4TruthInventoryItem[];
};
