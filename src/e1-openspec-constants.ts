import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { E1WorkflowGuards } from "./e1-harness";
import { loadE1Constants, type E1SealedConstants } from "./e1-l1-constants";
import { OPENSPEC_PINNED_VERSION } from "./e1-openspec-workflow";

export type E1OpenSpecWorkflowConstants = {
  schema: "e1-openspec-workflow-constants";
  version: string;
  status: string;
  protocol_profile_id: "e1-openspec-workflow-v0";
  base_constants_file: string;
  base_constants_version: string;
  scoping_rule: string;
  workflow_profile: {
    workflow: "openspec";
    openspec_package: "@fission-ai/openspec";
    openspec_version: string;
    telemetry_policy: string;
    archive_step: Record<string, unknown>;
    additional_read_only_prefixes: string[];
    additional_protected_directories: string[];
    spec_of_record_mutation_rule: string;
    additional_snapshot_roots: string[];
    snapshot_exclusions: string[];
    scenario_canonicalizer_id: string;
    scenario_parity_rule: string;
    survival_ledger: { metric_role: string; rule: string };
    task_package_fields: Record<string, string>;
  };
  seal_preconditions: string[];
};

export type E1OpenSpecProfile = {
  profile: E1OpenSpecWorkflowConstants;
  constants: E1SealedConstants;
  workflowGuards: E1WorkflowGuards;
  snapshotIncludedRoots: string[];
  snapshotExcludedPathPrefixes: string[];
};

export async function loadE1OpenSpecProfile(profilePath: string): Promise<E1OpenSpecProfile> {
  const resolvedPath = resolve(profilePath);
  const profile = JSON.parse(await readFile(resolvedPath, "utf8")) as E1OpenSpecWorkflowConstants;

  if (profile.schema !== "e1-openspec-workflow-constants") {
    throw new Error("OpenSpec profile schema must be e1-openspec-workflow-constants");
  }

  if (profile.protocol_profile_id !== "e1-openspec-workflow-v0") {
    throw new Error("OpenSpec profile protocol_profile_id must be e1-openspec-workflow-v0");
  }

  if (profile.workflow_profile.openspec_version !== OPENSPEC_PINNED_VERSION) {
    throw new Error(
      `OpenSpec profile pins ${profile.workflow_profile.openspec_version} but the wrapper pins ${OPENSPEC_PINNED_VERSION}`
    );
  }

  const constants = await loadE1Constants(join(dirname(resolvedPath), profile.base_constants_file));

  if (constants.version !== profile.base_constants_version) {
    throw new Error(
      `OpenSpec profile expects base constants ${profile.base_constants_version} but loaded ${constants.version}`
    );
  }

  return {
    profile,
    constants,
    workflowGuards: {
      extra_read_only_prefixes: profile.workflow_profile.additional_read_only_prefixes,
      extra_protected_directories: profile.workflow_profile.additional_protected_directories
    },
    snapshotIncludedRoots: [
      ...profile.workflow_profile.additional_snapshot_roots,
      "scratch/",
      "specs/",
      "src/"
    ].toSorted(),
    snapshotExcludedPathPrefixes: profile.workflow_profile.snapshot_exclusions
  };
}
