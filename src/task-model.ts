export type CheckpointId = string;

export type FeedbackBinding = {
  asset_id: string;
  checkpoint_id?: CheckpointId;
};

export type SpecRecord = {
  spec_id: string;
  checkpoint_introduced: CheckpointId;
  commitment_id: string;
  title: string;
  intent: string;
  given?: string;
  when?: string;
  then?: string;
  scenario?: string[];
  active_checkpoints: CheckpointId[];
  feedback_binding?: FeedbackBinding;
  hidden_oracle_refs?: string[];
};

export type CanonicalSpecSource = {
  records: SpecRecord[];
};

export type FeedbackAsset = {
  asset_id: string;
  checkpoint_introduced: CheckpointId;
  relative_path: string;
  content: string;
};

export type CoverageStatus = "planned" | "implemented" | "absent";

export type CoverageManifest = {
  schema_version: "visible-hidden-coverage-v0";
  task_id: string;
  task_version: string;
  entries: CoverageManifestEntry[];
};

export type CoverageManifestEntry = {
  spec_id: string;
  commitment_id: string;
  checkpoint_introduced: CheckpointId;
  visible_feedback: {
    status: CoverageStatus;
    asset_id?: string;
    relative_path?: string;
    notes?: string;
  };
  hidden_oracle: {
    status: CoverageStatus;
    refs: string[];
    check_ids: string[];
    notes?: string;
  };
};

export type FakeAgentValidationPlan = {
  schema_version: "fake-agent-validation-plan-v0";
  task_id: string;
  task_version: string;
  scenarios: FakeAgentValidationScenario[];
};

export type FakeAgentValidationScenario = {
  scenario_id: string;
  checkpoint_id: CheckpointId;
  purpose: string;
  expected_agent_mode: string;
};

export type LocalAcceptanceCriteriaManifest = {
  schema_version: "local-acceptance-criteria-v0";
  task_id: string;
  task_version: string;
  criteria: LocalAcceptanceCriterion[];
};

export type LocalAcceptanceCriterion = {
  criterion_id: string;
  target: "visible_feedback_asset" | "hidden_oracle" | "fake_agent_validation" | "sealing_gate";
  checkpoint_id?: CheckpointId;
  commitment_id?: string;
  scenario_id?: string;
  required_before: "feedback_assets" | "hidden_oracle" | "difficulty_probe" | "causal_pilot";
  description: string;
  evidence: string[];
};

export type AnalysisPlanManifest = {
  schema_version: "analysis-plan-v0";
  analysis_plan_id?: string;
  protocol_profile_id?: string;
  provider_execution_profile_id?: string;
  status: "draft" | "sealed";
  task_id: string;
  task_version: string;
  conditions: string[];
  run_classifications: string[];
  primary_metric: string;
  secondary_metrics: string[];
  planned_metrics: string[];
  budget: {
    max_model_turns: number;
    max_feedback_runs: number;
  };
  model_provider: {
    provider: string;
    model: string;
    adapter_id: string;
  };
  exclusion_rules: string[];
  pooling_rules: {
    compatibility_fields: string[];
    reject_validity_flags: boolean;
    reject_unclassified_runs?: boolean;
  };
  promotion_gates: string[];
  frozen_inputs: string[];
};

export type TaskDefinition = {
  task_id: string;
  task_version?: string;
  checkpoints: CheckpointId[];
  template_workspace: string;
  canonical_spec: CanonicalSpecSource;
  visible_spec_packets?: Record<CheckpointId, string>;
  executable_feedback_assets?: FeedbackAsset[];
  coverage_manifest?: CoverageManifest;
  fake_agent_validation_plan?: FakeAgentValidationPlan;
  local_acceptance_criteria?: LocalAcceptanceCriteriaManifest;
  analysis_plan?: AnalysisPlanManifest;
  analysis_plans?: AnalysisPlanManifest[];
  hidden_oracle_path: string;
  public_api_contract?: string;
  package_provenance?: TaskPackageProvenance;
};

export type TaskPackageProvenance = {
  task_package_path: string;
  task_package_hash: string;
  canonical_spec_hash: string;
};

export function defaultTaskVersion(taskId: string): string {
  return `${taskId}-v0`;
}

export function checkpointIndex(task: TaskDefinition, checkpoint_id: CheckpointId): number {
  const index = task.checkpoints.indexOf(checkpoint_id);

  if (index === -1) {
    throw new Error(`Unknown checkpoint ID ${checkpoint_id} for task ${task.task_id}`);
  }

  return index;
}

export function activeSpecRecords(task: TaskDefinition, checkpoint_id: CheckpointId): SpecRecord[] {
  checkpointIndex(task, checkpoint_id);

  return task.canonical_spec.records
    .filter((record) => record.active_checkpoints.includes(checkpoint_id))
    .toSorted((left, right) => {
      const checkpointOrder =
        checkpointIndex(task, left.checkpoint_introduced) -
        checkpointIndex(task, right.checkpoint_introduced);

      if (checkpointOrder !== 0) {
        return checkpointOrder;
      }

      return left.spec_id.localeCompare(right.spec_id);
    });
}

export function feedbackAssetsThroughCheckpoint(
  task: TaskDefinition,
  checkpoint_id: CheckpointId
): FeedbackAsset[] {
  const targetIndex = checkpointIndex(task, checkpoint_id);
  const activeAssetIds = new Set(
    activeSpecRecords(task, checkpoint_id).flatMap((record) => {
      const binding = record.feedback_binding;

      if (!binding?.asset_id) {
        return [];
      }

      const bindingCheckpoint = binding.checkpoint_id ?? record.checkpoint_introduced;

      return checkpointIndex(task, bindingCheckpoint) <= targetIndex ? [binding.asset_id] : [];
    })
  );

  return (task.executable_feedback_assets ?? [])
    .filter((asset) => {
      if (!activeAssetIds.has(asset.asset_id)) {
        return false;
      }

      return checkpointIndex(task, asset.checkpoint_introduced) <= targetIndex;
    })
    .toSorted((left, right) => {
      const checkpointOrder =
        checkpointIndex(task, left.checkpoint_introduced) -
        checkpointIndex(task, right.checkpoint_introduced);

      if (checkpointOrder !== 0) {
        return checkpointOrder;
      }

      return left.relative_path.localeCompare(right.relative_path);
    });
}
