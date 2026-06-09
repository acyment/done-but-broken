#!/usr/bin/env bun
import { resolve } from "node:path";
import { createFakeAgent, type FakeAgentMode } from "../src/fake-agent";
import {
  DEFAULT_OPENROUTER_ENDPOINT,
  DEFAULT_OPENROUTER_MODEL,
  createOpenRouterAgent
} from "../src/openrouter-agent";
import {
  OPENROUTER_MODEL_LOOP_RESPONSE_SCHEMA_VERSION,
  createOpenAiCompatibleFeedbackLoopAgent,
  createOpenRouterFeedbackLoopAgent,
  type OpenAiCompatibleResponseFormat,
  type OpenRouterResponseFormat
} from "../src/model-loop-agent";
import { createInventoryReservationsOracle } from "../src/inventory-reservations-oracle";
import { createPayrollNetPayOracle } from "../src/payroll-net-pay-oracle";
import { createPricingDiscountOracle } from "../src/pricing-discount-oracle";
import { createRolePermissionsOracle } from "../src/role-permissions-oracle";
import { createSampleCartOracle } from "../src/sample-cart-oracle";
import { createSubscriptionEntitlementsOracle } from "../src/subscription-entitlements-oracle";
import { runPilot, type HiddenOracleAdapter } from "../src/runner";
import { loadTaskPackage } from "../src/task-package";
import {
  buildProviderProfileId,
  MODEL_LOOP_POLICY_VERSION,
  OPENROUTER_CHAT_REQUEST_PARAMETER_VERSION,
  OPENROUTER_RETRY_POLICY_VERSION,
  RENDERER_VERSION,
  RUN_CLASSIFICATIONS,
  type ProviderExecutionProfile,
  type RunClassification
} from "../src/provenance";
import {
  DEFAULT_MODEL_LOOP_PRESET_ID,
  MODEL_LOOP_PRESET_IDS,
  MODEL_LOOP_PRESETS,
  parseModelLoopPresetId,
  resolveModelLoopSettings,
  sanitizeProfileRoute,
  type ModelLoopPresetId
} from "../src/model-provider-presets";
import {
  defaultProtocolProfileId,
  isProtocolProfileId,
  PROTOCOL_PROFILE_IDS,
  type ProtocolProfileId
} from "../src/protocol-profile";

type AgentKind = "fake" | "openrouter" | "openrouter-loop" | "openai-compatible-loop";

type CliOptions = {
  help?: false;
  task: string;
  runs_root: string;
  run_id: string;
  agent: AgentKind;
  fake_agent_mode: FakeAgentMode;
  openrouter_model: string;
  openrouter_endpoint?: string;
  model_loop_preset: ModelLoopPresetId;
  model_loop_provider: string;
  model_loop_model: string;
  model_loop_endpoint: string;
  model_loop_api_key_env: string;
  model_loop_response_format: OpenAiCompatibleResponseFormat;
  max_model_turns: number;
  max_feedback_runs: number;
  condition_concurrency: number;
  run_classification: RunClassification;
  protocol_profile_id: ProtocolProfileId;
  request_timeout_ms: number;
  max_output_tokens: number;
  max_workspace_bytes: number;
  max_feedback_output_bytes: number;
  openrouter_response_format: OpenRouterResponseFormat;
  openrouter_require_parameters: boolean;
  provider_max_retries: number;
  temperature: number;
} | {
  help: true;
};

const DEFAULT_OPENROUTER_PROVIDER_ROUTE = "openrouter-chat-completions";
const DEFAULT_OPENROUTER_RESPONSE_PARSER_VERSION = "openrouter-response-parser-v1";
const DEFAULT_OPENAI_COMPATIBLE_RESPONSE_PARSER_VERSION = "openai-compatible-response-parser-v1";
const OPENAI_COMPATIBLE_CHAT_REQUEST_PARAMETER_VERSION = "openai-compatible-chat-request-max-tokens-v1";
const DEFAULT_CONDITION_CONCURRENCY = 2;

async function main() {
  const options = parseArgs(Bun.argv.slice(2));

  if (options.help) {
    console.log(usage());
    return;
  }

  const task = await loadTaskPackage(resolve(options.task));
  const result = await runPilot({
    task,
    run_id: options.run_id,
    runs_root: resolve(options.runs_root),
    agent: createAgent(options),
    hidden_oracle: createHiddenOracle(task.task_id),
    run_classification: options.run_classification,
    budget: createRunBudget(options),
    model_provider: createModelProvider(options),
    provider_execution_profile: createProviderExecutionProfile(options),
    protocol_profile_id: options.protocol_profile_id
  });
  const resultRecord = result.result_record_path
    ? JSON.parse(await Bun.file(result.result_record_path).text())
    : undefined;
  const finalDelta = resultRecord?.primary_metric?.delta_feedback_minus_context ?? "n/a";

  console.log(`run_id=${result.run_id}`);
  console.log(`manifest=${result.run_manifest_path}`);
  console.log(`result=${result.result_record_path ?? "none"}`);
  console.log(`summary=${result.result_summary_path ?? "none"}`);
  console.log(`final_delta=${finalDelta}`);
}

function parseArgs(args: string[]): CliOptions {
  if (args.includes("--help") || args.includes("-h")) {
    return { help: true };
  }

  const options: Partial<CliOptions> = {};

  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];

    if (!value) {
      throw new Error(`Missing value for ${flag}`);
    }

    if (flag === "--task") {
      options.task = value;
    } else if (flag === "--runs-root") {
      options.runs_root = value;
    } else if (flag === "--run-id") {
      options.run_id = value;
    } else if (flag === "--agent") {
      if (value !== "fake" && value !== "openrouter" && value !== "openrouter-loop" && value !== "openai-compatible-loop") {
        throw new Error(`Unknown agent: ${value}`);
      }

      options.agent = value;
    } else if (flag === "--fake-agent-mode") {
      if (value !== "normal" && value !== "context-i03-item-name-drift") {
        throw new Error(`Unknown fake agent mode: ${value}`);
      }

      options.fake_agent_mode = value;
    } else if (flag === "--openrouter-model") {
      options.openrouter_model = value;
    } else if (flag === "--openrouter-endpoint") {
      options.openrouter_endpoint = value;
    } else if (flag === "--model-loop-preset") {
      options.model_loop_preset = parseModelLoopPresetId(value);
    } else if (flag === "--model-loop-provider") {
      options.model_loop_provider = value;
    } else if (flag === "--model-loop-model") {
      options.model_loop_model = value;
    } else if (flag === "--model-loop-endpoint") {
      options.model_loop_endpoint = value;
    } else if (flag === "--model-loop-api-key-env") {
      options.model_loop_api_key_env = value;
    } else if (flag === "--model-loop-response-format") {
      if (value !== "none" && value !== "json_schema") {
        throw new Error("--model-loop-response-format must be none or json_schema");
      }

      options.model_loop_response_format = value;
    } else if (flag === "--run-classification") {
      if (!RUN_CLASSIFICATIONS.includes(value as RunClassification)) {
        throw new Error(
          `--run-classification must be one of: ${RUN_CLASSIFICATIONS.join(", ")}`
        );
      }

      options.run_classification = value as RunClassification;
    } else if (flag === "--protocol-profile-id") {
      if (!isProtocolProfileId(value)) {
        throw new Error(`--protocol-profile-id must be one of: ${PROTOCOL_PROFILE_IDS.join(", ")}`);
      }

      options.protocol_profile_id = value;
    } else if (flag === "--max-model-turns") {
      options.max_model_turns = parsePositiveInteger(value, flag);
    } else if (flag === "--max-feedback-runs") {
      options.max_feedback_runs = parseNonNegativeInteger(value, flag);
    } else if (flag === "--condition-concurrency") {
      options.condition_concurrency = parsePositiveInteger(value, flag);
    } else if (flag === "--request-timeout-ms") {
      options.request_timeout_ms = parsePositiveInteger(value, flag);
    } else if (flag === "--max-output-tokens") {
      options.max_output_tokens = parsePositiveInteger(value, flag);
    } else if (flag === "--max-workspace-bytes") {
      options.max_workspace_bytes = parsePositiveInteger(value, flag);
    } else if (flag === "--max-feedback-output-bytes") {
      options.max_feedback_output_bytes = parsePositiveInteger(value, flag);
    } else if (flag === "--openrouter-response-format") {
      if (value !== "none" && value !== "json_schema") {
        throw new Error("--openrouter-response-format must be none or json_schema");
      }

      options.openrouter_response_format = value;
    } else if (flag === "--openrouter-require-parameters") {
      options.openrouter_require_parameters = parseBoolean(value, flag);
    } else if (flag === "--provider-max-retries") {
      options.provider_max_retries = parseNonNegativeInteger(value, flag);
    } else if (flag === "--temperature") {
      options.temperature = parseNonNegativeNumber(value, flag);
    } else {
      throw new Error(`Unknown argument: ${flag}`);
    }
  }

  if (!options.task || !options.runs_root || !options.run_id) {
    throw new Error(usage());
  }

  const openrouterResponseFormat = options.openrouter_response_format ?? "none";
  const agent = options.agent ?? "fake";
  const modelLoopPreset = resolveModelLoopPresetOption(options.model_loop_preset);
  const modelLoopSettings = resolveModelLoopSettings({
    preset_id: modelLoopPreset,
    env: Bun.env,
    overrides: {
      provider: options.model_loop_provider,
      model: options.model_loop_model,
      endpoint: options.model_loop_endpoint,
      api_key_env: options.model_loop_api_key_env
    }
  });
  const modelLoopModel = modelLoopSettings.model;

  if (agent === "openai-compatible-loop" && !modelLoopModel) {
    throw new Error(
      "--model-loop-model, MODEL_LOOP_MODEL, or a preset default model is required for --agent openai-compatible-loop."
    );
  }

  return {
    task: options.task,
    runs_root: options.runs_root,
    run_id: options.run_id,
    agent,
    fake_agent_mode: options.fake_agent_mode ?? "normal",
    openrouter_model: options.openrouter_model ?? Bun.env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL,
    openrouter_endpoint: options.openrouter_endpoint,
    model_loop_preset: modelLoopPreset,
    model_loop_provider: modelLoopSettings.provider,
    model_loop_model: modelLoopModel,
    model_loop_endpoint: modelLoopSettings.endpoint,
    model_loop_api_key_env: modelLoopSettings.api_key_env,
    model_loop_response_format: options.model_loop_response_format ?? "none",
    max_model_turns: options.max_model_turns ?? 3,
    max_feedback_runs: options.max_feedback_runs ?? 2,
    condition_concurrency: options.condition_concurrency ?? DEFAULT_CONDITION_CONCURRENCY,
    run_classification: options.run_classification ?? "calibration",
    protocol_profile_id: options.protocol_profile_id ?? defaultProtocolProfileId(),
    request_timeout_ms: options.request_timeout_ms ?? 60_000,
    max_output_tokens: options.max_output_tokens ?? 16_000,
    max_workspace_bytes: options.max_workspace_bytes ?? 256_000,
    max_feedback_output_bytes: options.max_feedback_output_bytes ?? 12_000,
    openrouter_response_format: openrouterResponseFormat,
    openrouter_require_parameters:
      options.openrouter_require_parameters ?? openrouterResponseFormat === "json_schema",
    provider_max_retries: options.provider_max_retries ?? 0,
    temperature: options.temperature ?? 0.2,
    help: false
  };
}

function createAgent(options: Exclude<CliOptions, { help: true }>) {
  if (options.agent === "fake") {
    return createFakeAgent({ mode: options.fake_agent_mode });
  }

  if (options.agent === "openrouter-loop") {
    return createOpenRouterFeedbackLoopAgent({
      apiKey: Bun.env.OPENROUTER_API_KEY ?? "",
      model: options.openrouter_model,
      endpoint: options.openrouter_endpoint,
      appTitle: "hit-sdd-bench",
      max_model_turns: options.max_model_turns,
      max_feedback_runs: options.max_feedback_runs,
      requestTimeoutMs: options.request_timeout_ms,
      maxTokens: options.max_output_tokens,
      maxWorkspaceBytes: options.max_workspace_bytes,
      maxFeedbackOutputBytes: options.max_feedback_output_bytes,
      responseFormat: options.openrouter_response_format,
      requireParameters: options.openrouter_require_parameters,
      maxProviderRetries: options.provider_max_retries,
      temperature: options.temperature
    });
  }

  if (options.agent === "openai-compatible-loop") {
    const apiKey = Bun.env[options.model_loop_api_key_env] ?? "";

    if (!apiKey.trim()) {
      throw new Error(`${options.model_loop_api_key_env} is required for --agent openai-compatible-loop.`);
    }

    return createOpenAiCompatibleFeedbackLoopAgent({
      provider: options.model_loop_provider,
      apiKey,
      model: options.model_loop_model,
      endpoint: options.model_loop_endpoint,
      max_model_turns: options.max_model_turns,
      max_feedback_runs: options.max_feedback_runs,
      requestTimeoutMs: options.request_timeout_ms,
      maxTokens: options.max_output_tokens,
      maxWorkspaceBytes: options.max_workspace_bytes,
      maxFeedbackOutputBytes: options.max_feedback_output_bytes,
      responseFormat: options.model_loop_response_format,
      maxProviderRetries: options.provider_max_retries,
      temperature: options.temperature
    });
  }

  if (options.provider_max_retries > 0) {
    throw new Error("--provider-max-retries currently requires --agent openrouter-loop or openai-compatible-loop.");
  }

  if (options.openrouter_response_format !== "none" || options.openrouter_require_parameters) {
    throw new Error("--openrouter-response-format and --openrouter-require-parameters require --agent openrouter-loop.");
  }

  if (options.model_loop_response_format !== "none") {
    throw new Error("--model-loop-response-format requires --agent openai-compatible-loop.");
  }

  return createOpenRouterAgent({
    apiKey: Bun.env.OPENROUTER_API_KEY ?? "",
    model: options.openrouter_model,
    endpoint: options.openrouter_endpoint,
    appTitle: "hit-sdd-bench",
    requestTimeoutMs: options.request_timeout_ms,
    maxTokens: options.max_output_tokens,
    maxWorkspaceBytes: options.max_workspace_bytes,
    temperature: options.temperature
  });
}

function createRunBudget(options: Exclude<CliOptions, { help: true }>) {
  const budget = {} as {
    max_model_turns?: number;
    max_feedback_runs?: number;
    condition_concurrency?: number;
  };

  if (isModelLoopAgent(options.agent)) {
    budget.max_model_turns = options.max_model_turns;
    budget.max_feedback_runs = options.max_feedback_runs;
  }

  if (options.condition_concurrency !== 1) {
    budget.condition_concurrency = options.condition_concurrency;
  }

  return budget;
}

function createModelProvider(options: Exclude<CliOptions, { help: true }>) {
  if (options.agent === "fake") {
    return {
      provider: "fake",
      model: options.fake_agent_mode,
      adapter_id: "fake-agent"
    };
  }

  if (options.agent === "openrouter-loop") {
    return {
      provider: "openrouter",
      model: options.openrouter_model,
      adapter_id: "openrouter-loop"
    };
  }

  if (options.agent === "openai-compatible-loop") {
    return {
      provider: options.model_loop_provider,
      model: options.model_loop_model,
      adapter_id: "openai-compatible-loop"
    };
  }

  return {
    provider: "openrouter",
    model: options.openrouter_model,
    adapter_id: "openrouter"
  };
}

function createProviderExecutionProfile(
  options: Exclude<CliOptions, { help: true }>
): ProviderExecutionProfile {
  if (options.agent === "fake") {
    return {
      provider_profile_id: "fake-agent-v1",
      per_call_timeout_ms: 0,
      retry_policy: {
        max_retries: 0,
        retryable_errors: []
      },
      prompt_renderer_version: RENDERER_VERSION,
      feedback_summary_version: "none"
    };
  }

  const isOpenAiCompatibleLoop = options.agent === "openai-compatible-loop";
  const isOpenRouterLoop = options.agent === "openrouter-loop";
  const adapter = isOpenAiCompatibleLoop
    ? "openai-compatible-loop"
    : isOpenRouterLoop
      ? "openrouter-loop"
      : "openrouter-single-shot";
  const route = providerRoute(options);
  const endpoint = isOpenAiCompatibleLoop
    ? options.model_loop_endpoint
    : options.openrouter_endpoint ?? DEFAULT_OPENROUTER_ENDPOINT;
  const modelId = isOpenAiCompatibleLoop ? options.model_loop_model : options.openrouter_model;
  const maxRetries = isModelLoopAgent(options.agent) ? options.provider_max_retries : 0;
  const retryPolicyVersion = maxRetries > 0 ? OPENROUTER_RETRY_POLICY_VERSION : undefined;
  const modelLoopPolicyVersion = isModelLoopAgent(options.agent) ? MODEL_LOOP_POLICY_VERSION : undefined;
  const responseFormatVersion =
    (isOpenRouterLoop && options.openrouter_response_format === "json_schema") ||
    (isOpenAiCompatibleLoop && options.model_loop_response_format === "json_schema")
      ? OPENROUTER_MODEL_LOOP_RESPONSE_SCHEMA_VERSION
      : undefined;
  const providerRequireParameters =
    isOpenRouterLoop && (responseFormatVersion || options.openrouter_require_parameters)
      ? options.openrouter_require_parameters
      : undefined;
  const profileIdInput = {
    adapter_id: adapter,
    model_id: modelId,
    provider_route: route,
    response_parser_version: isOpenAiCompatibleLoop
      ? DEFAULT_OPENAI_COMPATIBLE_RESPONSE_PARSER_VERSION
      : DEFAULT_OPENROUTER_RESPONSE_PARSER_VERSION,
    request_parameter_version: isOpenAiCompatibleLoop
      ? OPENAI_COMPATIBLE_CHAT_REQUEST_PARAMETER_VERSION
      : OPENROUTER_CHAT_REQUEST_PARAMETER_VERSION,
    response_format_version: responseFormatVersion,
    provider_require_parameters: providerRequireParameters,
    retry_policy_version: retryPolicyVersion,
    model_loop_policy_version: modelLoopPolicyVersion,
    per_call_timeout_ms: options.request_timeout_ms,
    max_output_tokens: options.max_output_tokens,
    max_workspace_bytes: options.max_workspace_bytes,
    max_feedback_output_bytes: isModelLoopAgent(options.agent)
      ? options.max_feedback_output_bytes
      : undefined,
    temperature: options.temperature,
    max_retries: maxRetries
  };

  return {
    provider_profile_id: buildProviderProfileId(profileIdInput),
    model_id: modelId,
    provider_route: route,
    provider_endpoint: endpoint,
    response_parser_version: isOpenAiCompatibleLoop
      ? DEFAULT_OPENAI_COMPATIBLE_RESPONSE_PARSER_VERSION
      : DEFAULT_OPENROUTER_RESPONSE_PARSER_VERSION,
    request_parameter_version: isOpenAiCompatibleLoop
      ? OPENAI_COMPATIBLE_CHAT_REQUEST_PARAMETER_VERSION
      : OPENROUTER_CHAT_REQUEST_PARAMETER_VERSION,
    response_format_version: responseFormatVersion,
    provider_require_parameters: providerRequireParameters,
    retry_policy_version: retryPolicyVersion,
    model_loop_policy_version: modelLoopPolicyVersion,
    per_call_timeout_ms: options.request_timeout_ms,
    retry_policy: {
      max_retries: maxRetries,
      retryable_errors:
        maxRetries > 0
          ? ["timeout", "socket", "rate_limit_transient", "malformed_response"]
          : ["timeout", "socket", "rate_limit_transient"]
    },
    max_output_tokens: options.max_output_tokens,
    max_workspace_bytes: options.max_workspace_bytes,
    max_feedback_output_bytes: isModelLoopAgent(options.agent)
      ? options.max_feedback_output_bytes
      : undefined,
    temperature: options.temperature,
    prompt_renderer_version: RENDERER_VERSION,
    feedback_summary_version: isModelLoopAgent(options.agent) ? "public-feedback-summary-v0" : "none"
  };
}

function providerRoute(options: Exclude<CliOptions, { help: true }>): string {
  if (options.agent === "openai-compatible-loop") {
    const preset = MODEL_LOOP_PRESETS[options.model_loop_preset];

    if (options.model_loop_provider === preset.provider && options.model_loop_endpoint === preset.endpoint) {
      return preset.provider_route;
    }

    return `${sanitizeProfileRoute(options.model_loop_provider)}-chat-completions-${sanitizeProfileRoute(options.model_loop_endpoint)}`;
  }

  const endpoint = options.openrouter_endpoint ?? DEFAULT_OPENROUTER_ENDPOINT;

  if (endpoint === DEFAULT_OPENROUTER_ENDPOINT) {
    return DEFAULT_OPENROUTER_PROVIDER_ROUTE;
  }

  return `custom-${sanitizeProfileRoute(endpoint)}`;
}

function isModelLoopAgent(agent: AgentKind): boolean {
  return agent === "openrouter-loop" || agent === "openai-compatible-loop";
}

function parsePositiveInteger(value: string, flag: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive integer`);
  }

  return parsed;
}

function resolveModelLoopPresetOption(option?: ModelLoopPresetId): ModelLoopPresetId {
  const envPreset = Bun.env.MODEL_LOOP_PRESET;

  if (option) {
    return option;
  }

  if (!envPreset) {
    return DEFAULT_MODEL_LOOP_PRESET_ID;
  }

  return parseModelLoopPresetId(envPreset);
}

function parseNonNegativeNumber(value: string, flag: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${flag} must be a non-negative number`);
  }

  return parsed;
}

function parseNonNegativeInteger(value: string, flag: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${flag} must be a non-negative integer`);
  }

  return parsed;
}

function parseBoolean(value: string, flag: string): boolean {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`${flag} must be true or false`);
}

function createHiddenOracle(taskId: string): HiddenOracleAdapter | undefined {
  if (taskId === "sample-cart") {
    return createSampleCartOracle();
  }

  if (taskId === "role-permissions-calibration") {
    return createRolePermissionsOracle();
  }

  if (taskId === "subscription-entitlements-lifecycle") {
    return createSubscriptionEntitlementsOracle();
  }

  if (taskId === "inventory-reservations-lifecycle") {
    return createInventoryReservationsOracle();
  }

  if (taskId === "pricing-discount-lifecycle") {
    return createPricingDiscountOracle();
  }

  if (taskId === "pricing-discount-lifecycle-content-controlled") {
    return createPricingDiscountOracle();
  }

  if (taskId === "payroll-net-pay-lifecycle") {
    return createPayrollNetPayOracle();
  }

  if (taskId === "payroll-net-pay-lifecycle-skeleton-seed") {
    return createPayrollNetPayOracle("payroll-net-pay-lifecycle-skeleton-seed");
  }

  return undefined;
}

function usage(): string {
  return [
    "Usage: bun run pilot:run --task <path> --runs-root <path> --run-id <id> [--agent fake|openrouter|openrouter-loop|openai-compatible-loop]",
    "Usage: bun run pilot:fake --task <path> --runs-root <path> --run-id <id> [--fake-agent-mode <mode>]",
    "",
    "Options:",
    "  --task <path>              Task package directory.",
    "  --runs-root <path>         Directory where run artifacts are written.",
    "  --run-id <id>              Stable run identifier under the runs root.",
    "  --agent <kind>             fake | openrouter | openrouter-loop | openai-compatible-loop. Defaults to fake.",
    "  --fake-agent-mode <mode>   normal | context-i03-item-name-drift.",
    `  --openrouter-model <id>    Defaults to OPENROUTER_MODEL or ${DEFAULT_OPENROUTER_MODEL}.`,
    "  --openrouter-endpoint <url>",
    "                             Defaults to https://openrouter.ai/api/v1/chat/completions.",
    `  --model-loop-preset <id>   ${MODEL_LOOP_PRESET_IDS.join(" | ")}. Defaults to MODEL_LOOP_PRESET or ${DEFAULT_MODEL_LOOP_PRESET_ID}.`,
    "  --model-loop-provider <id> Provider label for openai-compatible-loop. Defaults to preset, or MODEL_LOOP_PROVIDER.",
    "  --model-loop-model <id>    Model ID for openai-compatible-loop. Defaults to MODEL_LOOP_MODEL or preset model.",
    "  --model-loop-endpoint <url>",
    "                             Chat Completions URL for openai-compatible-loop. Defaults to MODEL_LOOP_ENDPOINT or preset endpoint.",
    "  --model-loop-api-key-env <name>",
    "                             Env var holding the API key for openai-compatible-loop. Defaults to MODEL_LOOP_API_KEY_ENV or preset key env.",
    "  --run-classification <id>  calibration | difficulty_probe | causal_pilot | diagnostic_invalid.",
    "                             Defaults to calibration.",
    "  --protocol-profile-id <id> final-checkpoint-primary-v1 | path-survival-primary-v1.",
    "                             Defaults to final-checkpoint-primary-v1.",
    "  --max-model-turns <n>      Defaults to 3 for loop adapters.",
    "  --max-feedback-runs <n>    Defaults to 2 for loop adapters.",
    "  --condition-concurrency <n>",
    `                             Condition pipelines to run concurrently. Defaults to ${DEFAULT_CONDITION_CONCURRENCY}; use 1 for sequential arms.`,
    "  --request-timeout-ms <n>   Provider request timeout. Defaults to 60000.",
    "  --max-output-tokens <n>    Provider max completion tokens. Defaults to 16000.",
    "  --max-workspace-bytes <n>  Workspace context byte cap. Defaults to 256000.",
    "  --max-feedback-output-bytes <n>",
    "                             Feedback summary byte cap. Defaults to 12000.",
    "  --openrouter-response-format <id>",
    "                             none | json_schema. Defaults to none.",
    "  --openrouter-require-parameters <bool>",
    "                             Provider require_parameters. Defaults to true with json_schema.",
    "  --model-loop-response-format <id>",
    "                             none | json_schema for openai-compatible-loop. Defaults to none.",
    "  --provider-max-retries <n>",
    "                             Provider retries for loop adapters. Defaults to 0.",
    "  --temperature <n>          Provider sampling temperature. Defaults to 0.2.",
    "  --help                     Print this help text."
  ].join("\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
