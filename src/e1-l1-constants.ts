export interface E1SealedConstants {
  schema: string;
  version: string;
  supersedes: string;
  status: string;
  condition_ids: ["context_only_spec", "feedback_capable_spec"];
  deferred_before_provider_seal: string[];
  provider_runtime: {
    failure_policy: {
      retryable_failure_kinds: Array<
        "api_error" | "timeout" | "rate_limit" | "malformed_response" | "network_error"
      >;
      max_attempts: 3;
      backoff_ms: [250, 1000, 4000];
      retries_cost_turns: false;
      retries_cost_tokens: false;
      exhausted_classification: "provider_error";
      exhausted_run_policy: "terminate_and_rerun_fresh_identity";
      log_rule: string;
    };
    sampling_defaults: {
      temperature: 0.2;
      top_p: 1;
      max_output_tokens_per_turn: 4000;
      per_model_profile_rule: string;
    };
    seed_semantics: {
      meaning: "pairing_label_not_sampling_seed";
      pairing_label_binds: string[];
      provider_rng_seed_policy: string;
      replay_rule: string;
    };
    cache_breakpoints: {
      breakpoints: ["system_template_boundary", "checkpoint_start_repo_injection"];
      cached_usage_ledger_field: "cached_prefix_tokens";
      debit_policy: "record_not_debit";
      smoke_assertion_rule: string;
    };
    live_mode_gate: {
      explicit_flag_required: true;
      spend_cap_required: true;
      spend_cap_classification: "spend_cap_reached";
      spend_cap_policy: "terminate_and_exclude_from_analysis";
      manifest_rule: string;
    };
    redaction: {
      fail_closed_bundle_check: true;
      secret_value_policy: "never_record_raw";
      recording_fixture_policy: string;
    };
  };
  token_estimator: {
    status: "sealed" | "TBD";
    estimator_id: "js-tiktoken-o200k_base-v1";
    package: "js-tiktoken";
    package_version: "1.0.21";
    encoding: "o200k_base";
    truncation_boundary_rule: string;
    operational_uses: Array<"verification_output_truncation" | "shadow_token_ledger">;
    rule: string;
    divergence_review_threshold: number;
  };
  conversation: {
    thread_scope: "fresh_per_checkpoint";
    prior_checkpoint_memory: "workspace_only";
    checkpoint_start_context: string[];
    rejected_alternative: string;
  };
  arm_difference_allowlist: {
    assembled_conversation_scope: "checkpoint_start";
    context_only_exact_lines: string[];
    feedback_capable_exact_lines: string[];
    feedback_capable_line_prefixes: string[];
    context_only_forbidden_substrings: string[];
  };
  checkpoint_continuation: {
    done: "continue_from_workspace_as_is";
    agent_stalled: "continue_from_workspace_as_is";
    budget_exhausted: "continue_from_workspace_as_is";
    invalid_integrity: "terminate_run";
    provider_error: "terminate_run";
    spend_cap_reached: "terminate_run";
    non_done_scoring_rule: string;
  };
  package_separation: {
    task_package_visibility: "mounted_into_agent_workspaces";
    oracle_package_visibility: "external_never_mounted";
    hash_rule: string;
  };
  oracle_scoring: {
    cadence: "every_turn_snapshot";
    primary_endpoint_subset: "checkpoint_end_snapshots";
    secondary_endpoint_subset: "all_turn_snapshots";
  };
  metrics: {
    regression_free_auc: {
      formula_id: "checkpoint_mean_cumulative_hidden_assertion_pass_rate_v1";
      formula: string;
      checkpoint_weighting: "equal";
      assertion_denominator: "cumulative_hidden_assertions_introduced_through_checkpoint";
    };
  };
  virtual_clock: {
    required: true;
    package_field: "virtual_now";
    real_clock_references_rejected: string[];
  };
  bundle_grading: {
    dev_when_constants_status: "draft-pre-seal";
    evidence_requires_constants_status: "sealed";
    evidence_requires_protocol_document_hash: true;
  };
  turn_protocol: {
    max_turns_per_checkpoint: number;
    max_verification_executions_per_checkpoint: number;
    consecutive_noop_stall_threshold: number;
    stall_classification: string;
    verification_output_token_cap: number;
    truncation_head_tokens: number;
    truncation_tail_tokens: number;
  };
  stall_reporting: { asymmetry_ratio_flag: number; min_stall_rate_flag: number; rule: string };
  block_grammar: {
    encoding: string;
    file_open_regex: string;
    verify_open_literal: string;
    end_literal: string;
    done_literal: string;
    verify_content_rule: string;
    multiple_verify_policy: "first_wins";
    multiple_verify_violation: string;
    duplicate_file_path_policy: "last_wins";
    duplicate_file_path_violation: string;
    unclosed_block_policy: string;
    orphan_end_policy: string;
    done_semantics: string;
    block_validity_vs_command_validity: string;
    noop_definition: string;
    known_limitation: string;
  };
  fence_stripping: {
    rule: string;
    opener_regex: string;
    closer_rule: string;
    one_layer_rule: string;
    inside_protocol_blocks: string;
    unclosed_fence_policy: string;
    rationale: string;
  };
  path_grammar: {
    regex: string;
    max_length: number;
    ascii_only: boolean;
    relative_only: boolean;
    no_leading_dash: boolean;
    no_leading_slash: boolean;
    no_trailing_slash: boolean;
    no_double_slash: boolean;
    forbidden_segments: string[];
    platform: string;
    runtime_note: string;
  };
  command_grammar: {
    separator: string;
    templates: Array<{
      id: string;
      shape: string;
      conditions: Array<"context_only_spec" | "feedback_capable_spec">;
      note?: string;
      k_rule?: string;
    }>;
    scratch_path_rules: { required_prefix: string; allowed_extensions: string[]; inherits: string };
    checkpoint_range: { min: number; max: number };
    refusal_semantics: string;
  };
  audit: Record<string, unknown>;
  environment: Record<string, unknown>;
}

const TOP_LEVEL_KEYS = [
  "schema",
  "version",
  "supersedes",
  "status",
  "condition_ids",
  "deferred_before_provider_seal",
  "provider_runtime",
  "token_estimator",
  "conversation",
  "arm_difference_allowlist",
  "checkpoint_continuation",
  "package_separation",
  "oracle_scoring",
  "metrics",
  "virtual_clock",
  "bundle_grading",
  "turn_protocol",
  "stall_reporting",
  "block_grammar",
  "fence_stripping",
  "path_grammar",
  "command_grammar",
  "audit",
  "environment"
] as const;

export class E1ConstantsValidationError extends Error {
  constructor(message: string) {
    super(`[e1-sealed-constants] ${message}`);
    this.name = "E1ConstantsValidationError";
  }
}

export function validateE1Constants(raw: unknown): E1SealedConstants {
  if (!isRecord(raw)) {
    throw new E1ConstantsValidationError("root must be a JSON object");
  }

  for (const key of TOP_LEVEL_KEYS) {
    if (!(key in raw)) {
      throw new E1ConstantsValidationError(`missing required key: ${key}`);
    }
  }

  for (const key of Object.keys(raw)) {
    if (!(TOP_LEVEL_KEYS as readonly string[]).includes(key)) {
      throw new E1ConstantsValidationError(`unknown top-level key: ${key}`);
    }
  }

  const constants = raw as unknown as E1SealedConstants;

  if (constants.schema !== "e1-sealed-constants") {
    throw new E1ConstantsValidationError(`schema mismatch: ${String(constants.schema)}`);
  }

  if (!/^\d+\.\d+\.\d+$/.test(constants.version)) {
    throw new E1ConstantsValidationError("version must be a semver string");
  }

  if (
    JSON.stringify(constants.condition_ids) !==
    JSON.stringify(["context_only_spec", "feedback_capable_spec"])
  ) {
    throw new E1ConstantsValidationError("condition_ids must match the active two-arm protocol");
  }

  if (constants.deferred_before_provider_seal.length !== 0) {
    throw new E1ConstantsValidationError("deferred_before_provider_seal must be empty before provider runs");
  }

  validateProviderRuntime(constants);

  if (constants.token_estimator.status !== "sealed") {
    throw new E1ConstantsValidationError("token_estimator.status must be sealed before provider runs");
  }

  if (
    constants.token_estimator.estimator_id !== "js-tiktoken-o200k_base-v1" ||
    constants.token_estimator.package !== "js-tiktoken" ||
    constants.token_estimator.package_version !== "1.0.21" ||
    constants.token_estimator.encoding !== "o200k_base"
  ) {
    throw new E1ConstantsValidationError("token_estimator must seal js-tiktoken o200k_base v1");
  }

  if (
    !constants.token_estimator.operational_uses.includes("verification_output_truncation") ||
    !constants.token_estimator.operational_uses.includes("shadow_token_ledger")
  ) {
    throw new E1ConstantsValidationError(
      "token_estimator operational uses must include truncation and shadow ledger"
    );
  }

  if (constants.conversation.thread_scope !== "fresh_per_checkpoint") {
    throw new E1ConstantsValidationError("conversation.thread_scope must be fresh_per_checkpoint");
  }

  if (constants.conversation.prior_checkpoint_memory !== "workspace_only") {
    throw new E1ConstantsValidationError("conversation.prior_checkpoint_memory must be workspace_only");
  }

  if (constants.arm_difference_allowlist.assembled_conversation_scope !== "checkpoint_start") {
    throw new E1ConstantsValidationError(
      "arm_difference_allowlist.assembled_conversation_scope must be checkpoint_start"
    );
  }

  if (!constants.arm_difference_allowlist.context_only_forbidden_substrings.includes("bun run spec")) {
    throw new E1ConstantsValidationError(
      "arm_difference_allowlist.context_only_forbidden_substrings must include bun run spec"
    );
  }

  if (
    constants.checkpoint_continuation.agent_stalled !== "continue_from_workspace_as_is" ||
    constants.checkpoint_continuation.budget_exhausted !== "continue_from_workspace_as_is"
  ) {
    throw new E1ConstantsValidationError(
      "non-integrity checkpoint terminations must continue from workspace as-is"
    );
  }

  if (constants.checkpoint_continuation.invalid_integrity !== "terminate_run") {
    throw new E1ConstantsValidationError("invalid_integrity must terminate the run");
  }

  if (constants.checkpoint_continuation.provider_error !== "terminate_run") {
    throw new E1ConstantsValidationError("provider_error must terminate the run");
  }

  if (constants.checkpoint_continuation.spend_cap_reached !== "terminate_run") {
    throw new E1ConstantsValidationError("spend_cap_reached must terminate the run");
  }

  if (constants.package_separation.oracle_package_visibility !== "external_never_mounted") {
    throw new E1ConstantsValidationError("oracle package must be external and never mounted");
  }

  if (constants.oracle_scoring.cadence !== "every_turn_snapshot") {
    throw new E1ConstantsValidationError("oracle_scoring.cadence must be every_turn_snapshot");
  }

  if (
    constants.metrics.regression_free_auc.formula_id !==
    "checkpoint_mean_cumulative_hidden_assertion_pass_rate_v1"
  ) {
    throw new E1ConstantsValidationError("regression_free_auc formula_id is not sealed");
  }

  if (constants.virtual_clock.required !== true) {
    throw new E1ConstantsValidationError("virtual_clock.required must be true");
  }

  if (constants.bundle_grading.evidence_requires_protocol_document_hash !== true) {
    throw new E1ConstantsValidationError("evidence bundles must require a protocol document hash");
  }

  validateRegex("block_grammar.file_open_regex", constants.block_grammar.file_open_regex);
  const fileProbe = "<<<FILE x.ts>>>".match(new RegExp(constants.block_grammar.file_open_regex));
  if (!fileProbe || fileProbe.length !== 2) {
    throw new E1ConstantsValidationError("file_open_regex must capture exactly one path group");
  }

  validateRegex("fence_stripping.opener_regex", constants.fence_stripping.opener_regex);
  validateRegex("path_grammar.regex", constants.path_grammar.regex);

  if (
    constants.turn_protocol.truncation_head_tokens +
      constants.turn_protocol.truncation_tail_tokens !==
    constants.turn_protocol.verification_output_token_cap
  ) {
    throw new E1ConstantsValidationError(
      "truncation_head_tokens + truncation_tail_tokens must equal verification_output_token_cap"
    );
  }

  if (constants.block_grammar.multiple_verify_policy !== "first_wins") {
    throw new E1ConstantsValidationError("multiple_verify_policy must be first_wins");
  }

  if (constants.block_grammar.duplicate_file_path_policy !== "last_wins") {
    throw new E1ConstantsValidationError("duplicate_file_path_policy must be last_wins");
  }

  const checkpointRange = constants.command_grammar.checkpoint_range;
  if (
    !Number.isInteger(checkpointRange.min) ||
    !Number.isInteger(checkpointRange.max) ||
    checkpointRange.min < 1 ||
    checkpointRange.max < checkpointRange.min
  ) {
    throw new E1ConstantsValidationError("command_grammar.checkpoint_range is invalid");
  }

  for (const template of constants.command_grammar.templates) {
    if (
      !template.conditions.every(
        (condition) => condition === "context_only_spec" || condition === "feedback_capable_spec"
      )
    ) {
      throw new E1ConstantsValidationError(`template ${template.id} uses a non-protocol condition id`);
    }
  }

  return constants;
}

export async function loadE1Constants(path: string): Promise<E1SealedConstants> {
  const file = Bun.file(path);

  if (!(await file.exists())) {
    throw new E1ConstantsValidationError(`constants file not found: ${path}`);
  }

  try {
    return validateE1Constants(await file.json());
  } catch (error) {
    if (error instanceof E1ConstantsValidationError) {
      throw error;
    }

    throw new E1ConstantsValidationError(`constants file is not valid JSON: ${String(error)}`);
  }
}

export function providerSealBlockers(constants: E1SealedConstants): string[] {
  const blockers: string[] = [];
  const fields = constants as unknown as Record<string, { status?: string }>;

  for (const field of constants.deferred_before_provider_seal) {
    if (!fields[field] || fields[field].status === "TBD") {
      blockers.push(field);
    }
  }

  return blockers;
}

function validateProviderRuntime(constants: E1SealedConstants): void {
  const failurePolicy = constants.provider_runtime.failure_policy;

  if (
    JSON.stringify(failurePolicy.retryable_failure_kinds) !==
    JSON.stringify(["api_error", "timeout", "rate_limit", "malformed_response", "network_error"])
  ) {
    throw new E1ConstantsValidationError("provider retryable failure kinds are not sealed");
  }

  if (
    failurePolicy.max_attempts !== 3 ||
    JSON.stringify(failurePolicy.backoff_ms) !== JSON.stringify([250, 1000, 4000]) ||
    failurePolicy.retries_cost_turns !== false ||
    failurePolicy.retries_cost_tokens !== false ||
    failurePolicy.exhausted_classification !== "provider_error" ||
    failurePolicy.exhausted_run_policy !== "terminate_and_rerun_fresh_identity"
  ) {
    throw new E1ConstantsValidationError("provider failure policy is not sealed");
  }

  const sampling = constants.provider_runtime.sampling_defaults;

  if (
    sampling.temperature !== 0.2 ||
    sampling.top_p !== 1 ||
    sampling.max_output_tokens_per_turn !== 4000
  ) {
    throw new E1ConstantsValidationError("provider sampling defaults are not sealed");
  }

  if (constants.provider_runtime.seed_semantics.meaning !== "pairing_label_not_sampling_seed") {
    throw new E1ConstantsValidationError("seed semantics must be pairing_label_not_sampling_seed");
  }

  const expectedSeedBindings = [
    "task_package_hash",
    "oracle_package_hash",
    "constants_version",
    "prompt_template_hash",
    "checkpoint_sequence",
    "budgets"
  ];

  if (
    JSON.stringify(constants.provider_runtime.seed_semantics.pairing_label_binds) !==
    JSON.stringify(expectedSeedBindings)
  ) {
    throw new E1ConstantsValidationError("seed pairing label bindings are not sealed");
  }

  const cache = constants.provider_runtime.cache_breakpoints;

  if (
    JSON.stringify(cache.breakpoints) !==
    JSON.stringify(["system_template_boundary", "checkpoint_start_repo_injection"]) ||
    cache.cached_usage_ledger_field !== "cached_prefix_tokens" ||
    cache.debit_policy !== "record_not_debit"
  ) {
    throw new E1ConstantsValidationError("cache breakpoint policy is not sealed");
  }

  const liveModeGate = constants.provider_runtime.live_mode_gate;

  if (
    liveModeGate.explicit_flag_required !== true ||
    liveModeGate.spend_cap_required !== true ||
    liveModeGate.spend_cap_classification !== "spend_cap_reached" ||
    liveModeGate.spend_cap_policy !== "terminate_and_exclude_from_analysis"
  ) {
    throw new E1ConstantsValidationError("live mode gate policy is not sealed");
  }

  const redaction = constants.provider_runtime.redaction;

  if (
    redaction.fail_closed_bundle_check !== true ||
    redaction.secret_value_policy !== "never_record_raw"
  ) {
    throw new E1ConstantsValidationError("redaction policy is not sealed");
  }
}

function validateRegex(name: string, pattern: string): void {
  try {
    new RegExp(pattern);
  } catch (error) {
    throw new E1ConstantsValidationError(`${name} does not compile: ${String(error)}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
