import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, resolve, sep } from "node:path";
import { CONDITION_IDS } from "./conditions";
import { isProtocolProfileId } from "./protocol-profile";
import { hashDirectory, hashFile } from "./snapshot";
import { defaultTaskVersion } from "./task-model";
import type {
  AnalysisPlanManifest,
  CanonicalSpecSource,
  CheckpointId,
  CoverageManifest,
  FakeAgentValidationPlan,
  FeedbackAsset,
  LocalAcceptanceCriteriaManifest,
  SpecRecord,
  TaskDefinition
} from "./task-model";

export type TaskPackageJsonValidation = {
  ok: boolean;
  errors: string[];
};

type TaskPackageJson = {
  task_id: string;
  task_version?: string;
  checkpoints: CheckpointId[];
  template_workspace: string;
  canonical_spec: string;
  hidden_oracle_path: string;
  feedback_assets?: string;
  coverage_manifest?: string;
  fake_agent_validation_plan?: string;
  local_acceptance_criteria?: string;
  analysis_plan?: string;
  analysis_plans?: string[];
  public_api_contract?: string;
  condition_ids?: string[];
};

type FeedbackAssetManifestRecord = {
  asset_id: string;
  checkpoint_introduced: CheckpointId;
  relative_path: string;
  source_path: string;
};

export async function loadTaskPackage(packagePath: string): Promise<TaskDefinition> {
  const taskPackagePath = resolve(packagePath);
  const taskJson = await readJson<TaskPackageJson>(join(taskPackagePath, "task.json"));
  assertValid(validateTaskPackageJson(taskJson));

  const templateWorkspace = resolveInsidePackage(
    taskPackagePath,
    taskJson.template_workspace,
    "template_workspace"
  );
  const canonicalSpecPath = resolveInsidePackage(
    taskPackagePath,
    taskJson.canonical_spec,
    "canonical_spec"
  );
  const hiddenOraclePath = resolveMaybeRelative(taskPackagePath, taskJson.hidden_oracle_path);

  if (isPathInside(templateWorkspace, hiddenOraclePath)) {
    throw new Error("hidden_oracle_path must be outside the template workspace");
  }

  const canonicalSpec = await readJson<CanonicalSpecSource>(canonicalSpecPath);
  assertValid(validateCanonicalSpecJson(canonicalSpec, taskJson.checkpoints));
  const taskVersion = taskJson.task_version ?? defaultTaskVersion(taskJson.task_id);

  const executableFeedbackAssets = taskJson.feedback_assets
    ? await loadFeedbackAssets({
        task_json: taskJson,
        package_path: taskPackagePath,
        manifest_path: resolveInsidePackage(taskPackagePath, taskJson.feedback_assets, "feedback_assets")
      })
    : [];
  assertValid(
    validateTaskPackageCrossReferences({
      canonical_spec: canonicalSpec,
      feedback_assets: executableFeedbackAssets
    })
  );
  const coverageManifest = taskJson.coverage_manifest
    ? await readJson<CoverageManifest>(
        resolveInsidePackage(taskPackagePath, taskJson.coverage_manifest, "coverage_manifest")
      )
    : undefined;
  const fakeAgentValidationPlan = taskJson.fake_agent_validation_plan
    ? await readJson<FakeAgentValidationPlan>(
        resolveInsidePackage(taskPackagePath, taskJson.fake_agent_validation_plan, "fake_agent_validation_plan")
      )
    : undefined;
  const localAcceptanceCriteria = taskJson.local_acceptance_criteria
    ? await readJson<LocalAcceptanceCriteriaManifest>(
        resolveInsidePackage(taskPackagePath, taskJson.local_acceptance_criteria, "local_acceptance_criteria")
      )
    : undefined;
  const analysisPlan = taskJson.analysis_plan
    ? await readJson<AnalysisPlanManifest>(
        resolveInsidePackage(taskPackagePath, taskJson.analysis_plan, "analysis_plan")
      )
    : undefined;
  const additionalAnalysisPlans = taskJson.analysis_plans
    ? await Promise.all(
        taskJson.analysis_plans.map((analysisPlanPath) =>
          readJson<AnalysisPlanManifest>(
            resolveInsidePackage(taskPackagePath, analysisPlanPath, "analysis_plans")
          )
        )
      )
    : [];

  if (coverageManifest) {
    assertValid(
      validateCoverageManifestJson(coverageManifest, {
        task_id: taskJson.task_id,
        task_version: taskVersion,
        checkpoints: taskJson.checkpoints,
        canonical_spec: canonicalSpec
      })
    );
  }

  if (fakeAgentValidationPlan) {
    assertValid(
      validateFakeAgentValidationPlanJson(fakeAgentValidationPlan, {
        task_id: taskJson.task_id,
        task_version: taskVersion,
        checkpoints: taskJson.checkpoints
      })
    );
  }

  if (localAcceptanceCriteria) {
    assertValid(
      validateLocalAcceptanceCriteriaJson(localAcceptanceCriteria, {
        task_id: taskJson.task_id,
        task_version: taskVersion,
        checkpoints: taskJson.checkpoints,
        canonical_spec: canonicalSpec,
        coverage_manifest: coverageManifest,
        fake_agent_validation_plan: fakeAgentValidationPlan
      })
    );
  }

  if (analysisPlan) {
    assertValid(
      validateAnalysisPlanJson(analysisPlan, {
        task_id: taskJson.task_id,
        task_version: taskVersion
      })
    );
  }

  for (const additionalAnalysisPlan of additionalAnalysisPlans) {
    assertValid(
      validateAnalysisPlanJson(additionalAnalysisPlan, {
        task_id: taskJson.task_id,
        task_version: taskVersion
      })
    );
  }

  return {
    task_id: taskJson.task_id,
    task_version: taskVersion,
    checkpoints: taskJson.checkpoints,
    template_workspace: templateWorkspace,
    canonical_spec: canonicalSpec,
    executable_feedback_assets: executableFeedbackAssets,
    coverage_manifest: coverageManifest,
    fake_agent_validation_plan: fakeAgentValidationPlan,
    local_acceptance_criteria: localAcceptanceCriteria,
    analysis_plan: analysisPlan,
    analysis_plans: [...(analysisPlan ? [analysisPlan] : []), ...additionalAnalysisPlans],
    hidden_oracle_path: hiddenOraclePath,
    public_api_contract: taskJson.public_api_contract,
    package_provenance: {
      task_package_path: taskPackagePath,
      task_package_hash: (await hashDirectory(taskPackagePath)).hash,
      canonical_spec_hash: await hashFile(canonicalSpecPath)
    }
  };
}

async function loadFeedbackAssets(input: {
  task_json: TaskPackageJson;
  package_path: string;
  manifest_path: string;
}): Promise<FeedbackAsset[]> {
  const manifest = await readJson<FeedbackAssetManifestRecord[] | { assets: FeedbackAssetManifestRecord[] }>(
    input.manifest_path
  );
  const records = Array.isArray(manifest) ? manifest : manifest.assets;

  if (!Array.isArray(records)) {
    throw new Error("feedback_assets manifest must be an array or an object with an assets array");
  }

  const manifestDir = dirname(input.manifest_path);
  const assets: FeedbackAsset[] = [];

  for (const record of records) {
    assertValid(validateFeedbackAssetRecord(input.task_json.checkpoints, record));

    const sourcePath = resolveInside(manifestDir, record.source_path, "feedback asset source_path");

    assets.push({
      asset_id: record.asset_id,
      checkpoint_introduced: record.checkpoint_introduced,
      relative_path: record.relative_path,
      content: await readFile(sourcePath, "utf8")
    });
  }

  return assets;
}

export function validateTaskPackageJson(taskJson: unknown): TaskPackageJsonValidation {
  const errors: string[] = [];
  const candidate = taskJson as Partial<TaskPackageJson>;

  collectStringError(candidate.task_id, "task_id", errors);

  if (candidate.task_version !== undefined) {
    collectStringError(candidate.task_version, "task_version", errors);
  }

  collectStringError(candidate.template_workspace, "template_workspace", errors);
  collectStringError(candidate.canonical_spec, "canonical_spec", errors);
  collectStringError(candidate.hidden_oracle_path, "hidden_oracle_path", errors);

  if (!Array.isArray(candidate.checkpoints) || candidate.checkpoints.length === 0) {
    errors.push("checkpoints must be a non-empty array");
  } else {
    for (const checkpoint of candidate.checkpoints) {
      collectStringError(checkpoint, "checkpoint", errors);
    }

    errors.push(...findDuplicateStringErrors(candidate.checkpoints, "checkpoint"));
  }

  if (
    candidate.public_api_contract !== undefined &&
    (typeof candidate.public_api_contract !== "string" || candidate.public_api_contract.length === 0)
  ) {
    errors.push("public_api_contract must be a non-empty string when provided");
  }

  if (candidate.feedback_assets !== undefined) {
    collectStringError(candidate.feedback_assets, "feedback_assets", errors);
  }

  if (candidate.coverage_manifest !== undefined) {
    collectStringError(candidate.coverage_manifest, "coverage_manifest", errors);
  }

  if (candidate.fake_agent_validation_plan !== undefined) {
    collectStringError(candidate.fake_agent_validation_plan, "fake_agent_validation_plan", errors);
  }

  if (candidate.local_acceptance_criteria !== undefined) {
    collectStringError(candidate.local_acceptance_criteria, "local_acceptance_criteria", errors);
  }

  if (candidate.analysis_plan !== undefined) {
    collectStringError(candidate.analysis_plan, "analysis_plan", errors);
  }

  if (candidate.analysis_plans !== undefined) {
    validateStringArray(candidate.analysis_plans, "analysis_plans", errors);

    if (Array.isArray(candidate.analysis_plans)) {
      errors.push(...findDuplicateStringErrors(candidate.analysis_plans, "analysis_plan"));
    }
  }

  if (candidate.condition_ids !== undefined) {
    const declared = candidate.condition_ids;

    if (
      !Array.isArray(declared) ||
      declared.length !== CONDITION_IDS.length ||
      !CONDITION_IDS.every((conditionId, index) => declared[index] === conditionId)
    ) {
      errors.push("Unsupported condition IDs declared in task package");
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateCanonicalSpecJson(
  canonicalSpec: unknown,
  checkpoints: CheckpointId[] = []
): TaskPackageJsonValidation {
  const errors: string[] = [];
  const candidate = canonicalSpec as Partial<CanonicalSpecSource>;

  if (!Array.isArray(candidate.records)) {
    errors.push("canonical_spec.records must be an array");
    return { ok: false, errors };
  }

  errors.push(...findDuplicateFieldErrors(candidate.records, "spec_id", "spec_id"));
  errors.push(...findDuplicateFieldErrors(candidate.records, "commitment_id", "commitment_id"));

  for (const record of candidate.records) {
    errors.push(...validateSpecRecord(checkpoints, record));
  }

  return { ok: errors.length === 0, errors };
}

export function validateFeedbackAssetManifestJson(
  manifest: unknown,
  checkpoints: CheckpointId[] = []
): TaskPackageJsonValidation {
  const records = Array.isArray(manifest)
    ? manifest
    : (manifest as { assets?: unknown[] } | undefined)?.assets;
  const errors: string[] = [];

  if (!Array.isArray(records)) {
    return {
      ok: false,
      errors: ["feedback_assets manifest must be an array or an object with an assets array"]
    };
  }

  errors.push(...findDuplicateFieldErrors(records, "asset_id", "feedback asset_id"));

  for (const record of records) {
    errors.push(...validateFeedbackAssetRecord(checkpoints, record as FeedbackAssetManifestRecord).errors);
  }

  return { ok: errors.length === 0, errors };
}

export function validateTaskPackageCrossReferences(input: {
  canonical_spec: CanonicalSpecSource;
  feedback_assets: Array<{ asset_id: string }>;
}): TaskPackageJsonValidation {
  const errors: string[] = [];
  const assetIds = new Set(input.feedback_assets.map((asset) => asset.asset_id));

  for (const record of input.canonical_spec.records ?? []) {
    const assetId = record.feedback_binding?.asset_id;

    if (assetId && !assetIds.has(assetId)) {
      errors.push(`Feedback binding ${assetId} for ${record.spec_id} has no matching feedback asset`);
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function validateCoverageManifestJson(
  manifest: unknown,
  input: {
    task_id: string;
    task_version: string;
    checkpoints: CheckpointId[];
    canonical_spec: CanonicalSpecSource;
  }
): TaskPackageJsonValidation {
  const errors: string[] = [];
  const candidate = manifest as Partial<CoverageManifest>;

  if (!candidate || typeof candidate !== "object") {
    return { ok: false, errors: ["coverage_manifest must be an object"] };
  }

  if (candidate.schema_version !== "visible-hidden-coverage-v0") {
    errors.push("coverage_manifest.schema_version must be visible-hidden-coverage-v0");
  }

  if (candidate.task_id !== input.task_id) {
    errors.push("coverage_manifest.task_id must match task_id");
  }

  if (candidate.task_version !== input.task_version) {
    errors.push("coverage_manifest.task_version must match task_version");
  }

  if (!Array.isArray(candidate.entries)) {
    errors.push("coverage_manifest.entries must be an array");
    return { ok: errors.length === 0, errors };
  }

  const specRecords = input.canonical_spec.records ?? [];
  const expectedCommitments = specRecords.map((record) => record.commitment_id);
  const actualCommitments = candidate.entries.map((entry) => entry?.commitment_id);

  if (JSON.stringify(actualCommitments) !== JSON.stringify(expectedCommitments)) {
    errors.push("coverage_manifest.entries must match canonical spec commitment order");
  }

  const recordsByCommitment = new Map(specRecords.map((record) => [record.commitment_id, record]));
  errors.push(...findDuplicateFieldErrors(candidate.entries, "commitment_id", "coverage commitment_id"));

  for (const entry of candidate.entries) {
    errors.push(...validateCoverageEntry(input.checkpoints, recordsByCommitment, entry));
  }

  return { ok: errors.length === 0, errors };
}

export function validateFakeAgentValidationPlanJson(
  plan: unknown,
  input: {
    task_id: string;
    task_version: string;
    checkpoints: CheckpointId[];
  }
): TaskPackageJsonValidation {
  const errors: string[] = [];
  const candidate = plan as Partial<FakeAgentValidationPlan>;

  if (!candidate || typeof candidate !== "object") {
    return { ok: false, errors: ["fake_agent_validation_plan must be an object"] };
  }

  if (candidate.schema_version !== "fake-agent-validation-plan-v0") {
    errors.push("fake_agent_validation_plan.schema_version must be fake-agent-validation-plan-v0");
  }

  if (candidate.task_id !== input.task_id) {
    errors.push("fake_agent_validation_plan.task_id must match task_id");
  }

  if (candidate.task_version !== input.task_version) {
    errors.push("fake_agent_validation_plan.task_version must match task_version");
  }

  if (!Array.isArray(candidate.scenarios) || candidate.scenarios.length === 0) {
    errors.push("fake_agent_validation_plan.scenarios must be a non-empty array");
    return { ok: errors.length === 0, errors };
  }

  errors.push(...findDuplicateFieldErrors(candidate.scenarios, "scenario_id", "fake-agent scenario_id"));
  const coveredCheckpoints = new Set<string>();

  for (const scenario of candidate.scenarios) {
    errors.push(...validateFakeAgentScenario(input.checkpoints, scenario));

    if (typeof scenario?.checkpoint_id === "string") {
      coveredCheckpoints.add(scenario.checkpoint_id);
    }
  }

  for (const checkpoint of input.checkpoints) {
    if (!coveredCheckpoints.has(checkpoint)) {
      errors.push(`fake_agent_validation_plan must cover checkpoint ${checkpoint}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateLocalAcceptanceCriteriaJson(
  manifest: unknown,
  input: {
    task_id: string;
    task_version: string;
    checkpoints: CheckpointId[];
    canonical_spec: CanonicalSpecSource;
    coverage_manifest?: CoverageManifest;
    fake_agent_validation_plan?: FakeAgentValidationPlan;
  }
): TaskPackageJsonValidation {
  const errors: string[] = [];
  const candidate = manifest as Partial<LocalAcceptanceCriteriaManifest>;

  if (!candidate || typeof candidate !== "object") {
    return { ok: false, errors: ["local_acceptance_criteria must be an object"] };
  }

  if (candidate.schema_version !== "local-acceptance-criteria-v0") {
    errors.push("local_acceptance_criteria.schema_version must be local-acceptance-criteria-v0");
  }

  if (candidate.task_id !== input.task_id) {
    errors.push("local_acceptance_criteria.task_id must match task_id");
  }

  if (candidate.task_version !== input.task_version) {
    errors.push("local_acceptance_criteria.task_version must match task_version");
  }

  if (!Array.isArray(candidate.criteria) || candidate.criteria.length === 0) {
    errors.push("local_acceptance_criteria.criteria must be a non-empty array");
    return { ok: errors.length === 0, errors };
  }

  errors.push(...findDuplicateFieldErrors(candidate.criteria, "criterion_id", "local acceptance criterion_id"));

  const canonicalCommitments = new Set(input.canonical_spec.records.map((record) => record.commitment_id));
  const coverageCommitments = input.coverage_manifest?.entries.map((entry) => entry.commitment_id) ?? [];
  const fakeScenarioIds =
    input.fake_agent_validation_plan?.scenarios.map((scenario) => scenario.scenario_id) ?? [];
  const fakeScenarioIdSet = new Set(fakeScenarioIds);
  const visibleCoverage = new Set<string>();
  const hiddenCoverage = new Set<string>();
  const fakeCoverage = new Set<string>();

  for (const criterion of candidate.criteria) {
    errors.push(
      ...validateLocalAcceptanceCriterion({
        checkpoints: input.checkpoints,
        canonical_commitments: canonicalCommitments,
        fake_scenario_ids: fakeScenarioIdSet,
        criterion
      })
    );

    if (
      criterion?.target === "visible_feedback_asset" &&
      typeof criterion.commitment_id === "string"
    ) {
      visibleCoverage.add(criterion.commitment_id);
    }

    if (criterion?.target === "hidden_oracle" && typeof criterion.commitment_id === "string") {
      hiddenCoverage.add(criterion.commitment_id);
    }

    if (
      criterion?.target === "fake_agent_validation" &&
      typeof criterion.scenario_id === "string"
    ) {
      fakeCoverage.add(criterion.scenario_id);
    }
  }

  for (const commitment of coverageCommitments) {
    if (!visibleCoverage.has(commitment)) {
      errors.push(`local acceptance criteria must include visible_feedback_asset criterion for ${commitment}`);
    }

    if (!hiddenCoverage.has(commitment)) {
      errors.push(`local acceptance criteria must include hidden_oracle criterion for ${commitment}`);
    }
  }

  for (const scenarioId of fakeScenarioIds) {
    if (!fakeCoverage.has(scenarioId)) {
      errors.push(`local acceptance criteria must include fake_agent_validation criterion for ${scenarioId}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateAnalysisPlanJson(
  manifest: unknown,
  input: {
    task_id: string;
    task_version: string;
  }
): TaskPackageJsonValidation {
  const errors: string[] = [];
  const candidate = manifest as Partial<AnalysisPlanManifest>;

  if (!candidate || typeof candidate !== "object") {
    return { ok: false, errors: ["analysis_plan must be an object"] };
  }

  if (candidate.schema_version !== "analysis-plan-v0") {
    errors.push("analysis_plan.schema_version must be analysis-plan-v0");
  }

  if (candidate.analysis_plan_id !== undefined) {
    collectStringError(candidate.analysis_plan_id, "analysis_plan.analysis_plan_id", errors);
  }

  if (
    candidate.protocol_profile_id !== undefined &&
    !isProtocolProfileId(candidate.protocol_profile_id)
  ) {
    errors.push("analysis_plan.protocol_profile_id must be final-checkpoint-primary-v1 or path-survival-primary-v1");
  }

  if (candidate.provider_execution_profile_id !== undefined) {
    collectStringError(
      candidate.provider_execution_profile_id,
      "analysis_plan.provider_execution_profile_id",
      errors
    );
  }

  if (candidate.status !== "draft" && candidate.status !== "sealed") {
    errors.push("analysis_plan.status must be draft or sealed");
  }

  if (candidate.task_id !== input.task_id) {
    errors.push("analysis_plan.task_id must match task_id");
  }

  if (candidate.task_version !== input.task_version) {
    errors.push("analysis_plan.task_version must match task_version");
  }

  if (!Array.isArray(candidate.conditions) || !sameStringArray(candidate.conditions, CONDITION_IDS)) {
    errors.push("analysis_plan.conditions must exactly match the two pilot condition IDs");
  }

  validateRunClassifications(candidate.run_classifications, errors);
  collectStringError(candidate.primary_metric, "analysis_plan.primary_metric", errors);
  validateStringArray(candidate.secondary_metrics, "analysis_plan.secondary_metrics", errors);
  validateStringArray(candidate.planned_metrics, "analysis_plan.planned_metrics", errors);
  validateAnalysisBudget(candidate.budget, errors);
  validateAnalysisModelProvider(candidate.model_provider, errors);
  validateStringArray(candidate.exclusion_rules, "analysis_plan.exclusion_rules", errors);
  validateAnalysisPoolingRules(candidate.pooling_rules, errors);
  if (
    candidate.protocol_profile_id !== undefined &&
    Array.isArray(candidate.pooling_rules?.compatibility_fields) &&
    !candidate.pooling_rules.compatibility_fields.includes("protocol_profile_id")
  ) {
    errors.push("analysis_plan.pooling_rules.compatibility_fields must include protocol_profile_id");
  }
  validateNonEmptyStringArray(candidate.promotion_gates, "analysis_plan.promotion_gates", errors);
  validateNonEmptyStringArray(candidate.frozen_inputs, "analysis_plan.frozen_inputs", errors);

  return { ok: errors.length === 0, errors };
}

function validateLocalAcceptanceCriterion(input: {
  checkpoints: CheckpointId[];
  canonical_commitments: Set<string>;
  fake_scenario_ids: Set<string>;
  criterion: LocalAcceptanceCriteriaManifest["criteria"][number];
}): string[] {
  const errors: string[] = [];
  const criterion = input.criterion;
  const field =
    typeof criterion?.criterion_id === "string" && criterion.criterion_id.length > 0
      ? `local acceptance criterion ${criterion.criterion_id}`
      : "local acceptance criterion";

  collectStringError(criterion?.criterion_id, `${field}.criterion_id`, errors);
  collectStringError(criterion?.description, `${field}.description`, errors);
  validateLocalEvidenceArray(criterion?.evidence, errors);

  if (!LOCAL_ACCEPTANCE_TARGETS.includes(criterion?.target as any)) {
    errors.push(`${field}.target must be visible_feedback_asset, hidden_oracle, fake_agent_validation, or sealing_gate`);
  }

  if (!LOCAL_ACCEPTANCE_REQUIRED_BEFORE.includes(criterion?.required_before as any)) {
    errors.push(`${field}.required_before must be feedback_assets, hidden_oracle, difficulty_probe, or causal_pilot`);
  }

  if (criterion?.checkpoint_id !== undefined) {
    collectStringError(criterion.checkpoint_id, `${field}.checkpoint_id`, errors);

    if (
      typeof criterion.checkpoint_id === "string" &&
      !input.checkpoints.includes(criterion.checkpoint_id)
    ) {
      errors.push(`${field}.checkpoint_id must reference a known checkpoint`);
    }
  }

  if (criterion?.commitment_id !== undefined) {
    collectStringError(criterion.commitment_id, `${field}.commitment_id`, errors);

    if (
      typeof criterion.commitment_id === "string" &&
      !input.canonical_commitments.has(criterion.commitment_id)
    ) {
      errors.push(`${field}.commitment_id must reference a canonical spec commitment`);
    }
  }

  if (criterion?.scenario_id !== undefined) {
    collectStringError(criterion.scenario_id, `${field}.scenario_id`, errors);

    if (
      typeof criterion.scenario_id === "string" &&
      !input.fake_scenario_ids.has(criterion.scenario_id)
    ) {
      errors.push(`${field}.scenario_id must reference a fake-agent validation scenario`);
    }
  }

  return errors;
}

const LOCAL_ACCEPTANCE_TARGETS = [
  "visible_feedback_asset",
  "hidden_oracle",
  "fake_agent_validation",
  "sealing_gate"
] as const;

const LOCAL_ACCEPTANCE_REQUIRED_BEFORE = [
  "feedback_assets",
  "hidden_oracle",
  "difficulty_probe",
  "causal_pilot"
] as const;

const ANALYSIS_RUN_CLASSIFICATIONS = [
  "calibration",
  "difficulty_probe",
  "causal_pilot",
  "diagnostic_invalid"
] as const;

const ANALYSIS_COMPATIBILITY_FIELDS = [
  "task_id",
  "task_version",
  "protocol_version",
  "renderer_version",
  "task_seal_hash",
  "checkpoint_list_hash",
  "visible_spec_hash",
  "feedback_asset_hash",
  "hidden_oracle_hash",
  "budget_hash",
  "model_provider_hash",
  "provider_execution_profile_hash",
  "metric_definition_hash"
] as const;

function validateLocalEvidenceArray(value: unknown, errors: string[]) {
  validateNonEmptyStringArray(value, "local_acceptance_criteria.evidence", errors);

  if (!Array.isArray(value)) {
    return;
  }

  if (
    value.some((item) => typeof item !== "string" || !item.startsWith("local:"))
  ) {
    errors.push("local acceptance criteria evidence entries must be local evidence references");
  }
}

function validateRunClassifications(value: unknown, errors: string[]) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push("analysis_plan.run_classifications must be a non-empty array");
    return;
  }

  for (const classification of value) {
    if (!ANALYSIS_RUN_CLASSIFICATIONS.includes(classification as any)) {
      errors.push(`analysis_plan.run_classifications includes unsupported classification ${String(classification)}`);
    }
  }

  if (!value.includes("difficulty_probe")) {
    errors.push("analysis_plan.run_classifications must include difficulty_probe before provider promotion");
  }
}

function validateAnalysisBudget(value: unknown, errors: string[]) {
  const budget = value as AnalysisPlanManifest["budget"] | undefined;

  if (!budget || typeof budget !== "object" || Array.isArray(budget)) {
    errors.push("analysis_plan.budget must be an object");
    return;
  }

  if (!Number.isInteger(budget.max_model_turns) || budget.max_model_turns < 2) {
    errors.push("analysis_plan.budget.max_model_turns must be at least 2");
  }

  if (!Number.isInteger(budget.max_feedback_runs) || budget.max_feedback_runs < 0) {
    errors.push("analysis_plan.budget.max_feedback_runs must be a non-negative integer");
  }
}

function validateAnalysisModelProvider(value: unknown, errors: string[]) {
  const provider = value as AnalysisPlanManifest["model_provider"] | undefined;

  if (!provider || typeof provider !== "object" || Array.isArray(provider)) {
    errors.push("analysis_plan.model_provider must be an object");
    return;
  }

  collectStringError(provider.provider, "analysis_plan.model_provider.provider", errors);
  collectStringError(provider.model, "analysis_plan.model_provider.model", errors);
  collectStringError(provider.adapter_id, "analysis_plan.model_provider.adapter_id", errors);
}

function validateAnalysisPoolingRules(value: unknown, errors: string[]) {
  const pooling = value as AnalysisPlanManifest["pooling_rules"] | undefined;

  if (!pooling || typeof pooling !== "object" || Array.isArray(pooling)) {
    errors.push("analysis_plan.pooling_rules must be an object");
    return;
  }

  validateNonEmptyStringArray(
    pooling.compatibility_fields,
    "analysis_plan.pooling_rules.compatibility_fields",
    errors
  );

  if (Array.isArray(pooling.compatibility_fields)) {
    for (const field of ANALYSIS_COMPATIBILITY_FIELDS) {
      if (!pooling.compatibility_fields.includes(field)) {
        errors.push(`analysis_plan.pooling_rules.compatibility_fields must include ${field}`);
      }
    }
  }

  if (typeof pooling.reject_validity_flags !== "boolean") {
    errors.push("analysis_plan.pooling_rules.reject_validity_flags must be a boolean");
  }

  if (
    pooling.reject_unclassified_runs !== undefined &&
    typeof pooling.reject_unclassified_runs !== "boolean"
  ) {
    errors.push("analysis_plan.pooling_rules.reject_unclassified_runs must be a boolean when provided");
  }
}

function validateCoverageEntry(
  checkpoints: CheckpointId[],
  recordsByCommitment: Map<string, SpecRecord>,
  entry: CoverageManifest["entries"][number]
): string[] {
  const errors: string[] = [];
  const field =
    typeof entry?.commitment_id === "string" && entry.commitment_id.length > 0
      ? `coverage ${entry.commitment_id}`
      : "coverage entry";

  collectStringError(entry?.spec_id, `${field}.spec_id`, errors);
  collectStringError(entry?.commitment_id, `${field}.commitment_id`, errors);
  collectStringError(entry?.checkpoint_introduced, `${field}.checkpoint_introduced`, errors);

  const record =
    typeof entry?.commitment_id === "string" ? recordsByCommitment.get(entry.commitment_id) : undefined;

  if (!record) {
    errors.push(`${field}.commitment_id must reference a canonical spec commitment`);
  } else {
    if (entry.spec_id !== record.spec_id) {
      errors.push(`${field}.spec_id must match canonical spec`);
    }

    if (entry.checkpoint_introduced !== record.checkpoint_introduced) {
      errors.push(`${field}.checkpoint_introduced must match canonical spec`);
    }
  }

  if (typeof entry?.checkpoint_introduced === "string" && !checkpoints.includes(entry.checkpoint_introduced)) {
    errors.push(`${field}.checkpoint_introduced must reference a known checkpoint`);
  }

  errors.push(...validateVisibleFeedbackCoverage(field, entry?.visible_feedback));
  errors.push(...validateHiddenOracleCoverage(field, entry?.hidden_oracle));

  return errors;
}

function validateVisibleFeedbackCoverage(
  field: string,
  value: CoverageManifest["entries"][number]["visible_feedback"] | undefined
): string[] {
  const errors: string[] = [];

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [`${field}.visible_feedback must be an object`];
  }

  validateCoverageStatus(value.status, `${field}.visible_feedback.status`, errors);

  if (value.asset_id !== undefined) {
    collectStringError(value.asset_id, `${field}.visible_feedback.asset_id`, errors);
  }

  if (value.relative_path !== undefined) {
    collectStringError(value.relative_path, `${field}.visible_feedback.relative_path`, errors);
  }

  if (value.notes !== undefined) {
    collectStringError(value.notes, `${field}.visible_feedback.notes`, errors);
  }

  return errors;
}

function validateHiddenOracleCoverage(
  field: string,
  value: CoverageManifest["entries"][number]["hidden_oracle"] | undefined
): string[] {
  const errors: string[] = [];

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [`${field}.hidden_oracle must be an object`];
  }

  validateCoverageStatus(value.status, `${field}.hidden_oracle.status`, errors);
  validateNonEmptyStringArray(value.refs, `${field}.hidden_oracle.refs`, errors);
  validateNonEmptyStringArray(value.check_ids, `${field}.hidden_oracle.check_ids`, errors);

  if (value.notes !== undefined) {
    collectStringError(value.notes, `${field}.hidden_oracle.notes`, errors);
  }

  return errors;
}

function validateCoverageStatus(value: unknown, field: string, errors: string[]) {
  if (value !== "planned" && value !== "implemented" && value !== "absent") {
    errors.push(`${field} must be planned, implemented, or absent`);
  }
}

function validateFakeAgentScenario(
  checkpoints: CheckpointId[],
  scenario: FakeAgentValidationPlan["scenarios"][number]
): string[] {
  const errors: string[] = [];
  const field =
    typeof scenario?.scenario_id === "string" && scenario.scenario_id.length > 0
      ? `fake-agent scenario ${scenario.scenario_id}`
      : "fake-agent scenario";

  collectStringError(scenario?.scenario_id, `${field}.scenario_id`, errors);
  collectStringError(scenario?.checkpoint_id, `${field}.checkpoint_id`, errors);
  collectStringError(scenario?.purpose, `${field}.purpose`, errors);
  collectStringError(scenario?.expected_agent_mode, `${field}.expected_agent_mode`, errors);

  if (typeof scenario?.checkpoint_id === "string" && !checkpoints.includes(scenario.checkpoint_id)) {
    errors.push(`${field}.checkpoint_id must reference a known checkpoint`);
  }

  return errors;
}

function validateSpecRecord(checkpoints: CheckpointId[], record: SpecRecord): string[] {
  const errors: string[] = [];
  const specId = typeof record?.spec_id === "string" ? record.spec_id : "unknown spec";
  const introducedIndex =
    typeof record?.checkpoint_introduced === "string"
      ? checkpoints.indexOf(record.checkpoint_introduced)
      : -1;

  collectStringError(record?.spec_id, "spec_id", errors);
  collectStringError(record?.checkpoint_introduced, "checkpoint_introduced", errors);
  collectStringError(record?.commitment_id, "commitment_id", errors);
  collectStringError(record?.title, "title", errors);
  collectStringError(record?.intent, "intent", errors);

  if (typeof record?.checkpoint_introduced === "string" && !checkpoints.includes(record.checkpoint_introduced)) {
    errors.push(`Unknown checkpoint_introduced for ${specId}`);
  }

  if (!Array.isArray(record?.active_checkpoints) || record.active_checkpoints.length === 0) {
    errors.push(`active_checkpoints must be non-empty for ${specId}`);
  } else {
    let hasActiveCheckpointBeforeIntroduction = false;

    for (const checkpoint of record.active_checkpoints) {
      if (!checkpoints.includes(checkpoint)) {
        errors.push(`Unknown active checkpoint ${checkpoint} for ${specId}`);
        continue;
      }

      if (introducedIndex >= 0 && checkpoints.indexOf(checkpoint) < introducedIndex) {
        hasActiveCheckpointBeforeIntroduction = true;
      }
    }

    if (hasActiveCheckpointBeforeIntroduction) {
      errors.push(`active_checkpoints cannot include checkpoints before introduction for ${specId}`);
    }
  }

  if (record?.feedback_binding !== undefined) {
    errors.push(
      ...validateFeedbackBinding(checkpoints, specId, record.checkpoint_introduced, record.feedback_binding)
    );
  }

  return errors;
}

function validateFeedbackBinding(
  checkpoints: CheckpointId[],
  specId: string,
  checkpointIntroduced: unknown,
  binding: SpecRecord["feedback_binding"]
): string[] {
  const errors: string[] = [];

  if (!binding || typeof binding !== "object") {
    errors.push(`feedback_binding must be an object for ${specId}`);
    return errors;
  }

  collectStringError(binding.asset_id, `feedback_binding.asset_id for ${specId}`, errors);

  if (binding.checkpoint_id !== undefined) {
    collectStringError(binding.checkpoint_id, `feedback_binding.checkpoint_id for ${specId}`, errors);

    if (typeof binding.checkpoint_id === "string" && !checkpoints.includes(binding.checkpoint_id)) {
      errors.push(`Unknown feedback binding checkpoint ${binding.checkpoint_id} for ${specId}`);
    } else if (
      typeof binding.checkpoint_id === "string" &&
      typeof checkpointIntroduced === "string" &&
      checkpoints.includes(checkpointIntroduced) &&
      checkpoints.indexOf(binding.checkpoint_id) < checkpoints.indexOf(checkpointIntroduced)
    ) {
      errors.push(`feedback_binding.checkpoint_id cannot be before checkpoint_introduced for ${specId}`);
    }
  }

  return errors;
}

function validateFeedbackAssetRecord(
  checkpoints: CheckpointId[],
  record: FeedbackAssetManifestRecord
): TaskPackageJsonValidation {
  const errors: string[] = [];

  collectStringError(record?.asset_id, "asset_id", errors);
  collectStringError(record?.checkpoint_introduced, "checkpoint_introduced", errors);
  collectStringError(record?.relative_path, "relative_path", errors);
  collectStringError(record?.source_path, "source_path", errors);

  if (typeof record?.checkpoint_introduced === "string" && !checkpoints.includes(record.checkpoint_introduced)) {
    errors.push(`Unknown feedback checkpoint ${record.checkpoint_introduced}`);
  }

  if (typeof record?.relative_path === "string") {
    const normalized = normalize(record.relative_path);

    if (isAbsolute(normalized) || normalized.startsWith("..")) {
      errors.push(`Feedback asset relative_path must stay inside the workspace: ${record.relative_path}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
}

function collectStringError(value: unknown, field: string, errors: string[]) {
  if (typeof value !== "string" || value.length === 0) {
    errors.push(`${field} must be a non-empty string`);
  }
}

function validateNonEmptyStringArray(value: unknown, field: string, errors: string[]) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${field} must be a non-empty array of strings`);
    return;
  }

  for (const item of value) {
    collectStringError(item, field, errors);
  }
}

function validateStringArray(value: unknown, field: string, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array of strings`);
    return;
  }

  for (const item of value) {
    collectStringError(item, field, errors);
  }
}

function sameStringArray(left: unknown, right: readonly string[]): boolean {
  if (!Array.isArray(left) || left.length !== right.length) {
    return false;
  }

  return right.every((item, index) => left[index] === item);
}

function findDuplicateFieldErrors(
  records: unknown[],
  field: string,
  label: string
): string[] {
  const seen = new Set<string>();
  const errors: string[] = [];

  for (const record of records as Array<Record<string, unknown>>) {
    const value = record?.[field];

    if (typeof value !== "string" || value.length === 0) {
      continue;
    }

    if (seen.has(value)) {
      errors.push(`Duplicate ${label} ${value}`);
      continue;
    }

    seen.add(value);
  }

  return errors;
}

function findDuplicateStringErrors(values: unknown[], label: string): string[] {
  const seen = new Set<string>();
  const errors: string[] = [];

  for (const value of values) {
    if (typeof value !== "string" || value.length === 0) {
      continue;
    }

    if (seen.has(value)) {
      errors.push(`Duplicate ${label} ${value}`);
      continue;
    }

    seen.add(value);
  }

  return errors;
}

function assertValid(validation: TaskPackageJsonValidation) {
  if (!validation.ok) {
    throw new Error(validation.errors[0]);
  }
}

function resolveInsidePackage(packagePath: string, childPath: string, label: string): string {
  return resolveInside(packagePath, childPath, label);
}

function resolveInside(root: string, childPath: string, label: string): string {
  const resolved = resolveMaybeRelative(root, childPath);

  if (!isPathInside(root, resolved)) {
    throw new Error(`${label} must stay inside ${root}`);
  }

  return resolved;
}

function resolveMaybeRelative(root: string, childPath: string): string {
  return isAbsolute(childPath) ? resolve(childPath) : resolve(root, childPath);
}

function isPathInside(parent: string, child: string): boolean {
  const resolvedParent = resolve(parent);
  const resolvedChild = resolve(child);

  return resolvedChild === resolvedParent || resolvedChild.startsWith(resolvedParent + sep);
}
