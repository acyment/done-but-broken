export interface E1SealedConstants {
  schema: string;
  version: string;
  supersedes: string;
  status: string;
  condition_ids: ["context_only_spec", "feedback_capable_spec"];
  deferred_before_provider_seal: string[];
  token_estimator: { status: string; rule: string; divergence_review_threshold: number };
  conversation: {
    thread_scope: "fresh_per_checkpoint";
    prior_checkpoint_memory: "workspace_only";
    checkpoint_start_context: string[];
    rejected_alternative: string;
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
  "token_estimator",
  "conversation",
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

  if (constants.conversation.thread_scope !== "fresh_per_checkpoint") {
    throw new E1ConstantsValidationError("conversation.thread_scope must be fresh_per_checkpoint");
  }

  if (constants.conversation.prior_checkpoint_memory !== "workspace_only") {
    throw new E1ConstantsValidationError("conversation.prior_checkpoint_memory must be workspace_only");
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
