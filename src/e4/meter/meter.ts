// E4DriftMeter (architecture §2.4; IMPLEMENTATION-PLAN.md M2). Wires extraction + classification;
// versioned and frozen per run (brief §6) — this exact meter_version stamps every task record and
// must equal the manifest's compatibility_boundary.meter_version.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { E4SchemaIR } from "../substrate/ir";
import type { E4DriftReport, E4ExecutorEvidence } from "../types";
import { extractSurfaceDump, parseSpecInventory, surfaceDumpToInventory, truthInventory } from "./extract";
import { classifyE4Drift, type E4RenameLineageLookupEntry } from "./classify";
import type { E4InventoryTriple, E4SurfaceDumpResult } from "./types";

export const METER_VERSION = "e4-drift-meter-v1";

export interface E4DriftMeter {
  readonly meter_version: string;
  extract(input: {
    spec_artifacts: { openapi_json: string; conventions_md: string };
    surface_dump: E4SurfaceDumpResult;
    ground_truth_ir: E4SchemaIR;
  }): E4InventoryTriple;
  // [R2: R2-1] renameLineage is a Phase-3 addition beyond architecture §2.4's original sketch,
  // required so a missed rename's stale-claim/coverage-gap pair can share one semantic_item_uid.
  classify(input: {
    triple: E4InventoryTriple;
    executorEvidence: E4ExecutorEvidence;
    renameLineage: E4RenameLineageLookupEntry[];
  }): E4DriftReport;
}

export const e4DriftMeterV1: E4DriftMeter = {
  meter_version: METER_VERSION,

  extract(input) {
    return {
      spec: parseSpecInventory(input.spec_artifacts),
      code: "extraction_failed" in input.surface_dump ? input.surface_dump : surfaceDumpToInventory(input.surface_dump),
      truth: truthInventory(input.ground_truth_ir)
    };
  },

  classify(input) {
    return classifyE4Drift({
      triple: input.triple,
      executorEvidence: input.executorEvidence,
      renameLineage: input.renameLineage,
      meterVersion: METER_VERSION
    });
  }
};

// Convenience for the common case (M3 gate/oracle, M6 dry-run): read the two spec artifacts and
// the workspace's registry/schema straight off disk, then run the full extract→classify pipeline.
export async function runE4DriftMeterOnWorkspace(input: {
  workspaceDir: string;
  groundTruthIr: E4SchemaIR;
  executorEvidence: E4ExecutorEvidence;
  renameLineage: E4RenameLineageLookupEntry[];
}): Promise<E4DriftReport> {
  const [openapiJson, conventionsMd] = await Promise.all([
    readFile(join(input.workspaceDir, "specs", "openapi.json"), "utf8"),
    readFile(join(input.workspaceDir, "specs", "CONVENTIONS.md"), "utf8")
  ]);
  const surfaceDump = await extractSurfaceDump(input.workspaceDir);

  const triple = e4DriftMeterV1.extract({
    spec_artifacts: { openapi_json: openapiJson, conventions_md: conventionsMd },
    surface_dump: surfaceDump,
    ground_truth_ir: input.groundTruthIr
  });

  return e4DriftMeterV1.classify({ triple, executorEvidence: input.executorEvidence, renameLineage: input.renameLineage });
}
