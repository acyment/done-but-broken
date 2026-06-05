#!/usr/bin/env bun
import { resolve } from "node:path";
import { createFakeAgent, type FakeAgentMode } from "../src/fake-agent";
import {
  DEFAULT_OPENROUTER_MODEL,
  createOpenRouterAgent
} from "../src/openrouter-agent";
import { createOpenRouterFeedbackLoopAgent } from "../src/model-loop-agent";
import { createRolePermissionsOracle } from "../src/role-permissions-oracle";
import { createSampleCartOracle } from "../src/sample-cart-oracle";
import { createSubscriptionEntitlementsOracle } from "../src/subscription-entitlements-oracle";
import { runPilot, type HiddenOracleAdapter } from "../src/runner";
import { loadTaskPackage } from "../src/task-package";
import {
  RENDERER_VERSION,
  RUN_CLASSIFICATIONS,
  type ProviderExecutionProfile,
  type RunClassification
} from "../src/provenance";

type AgentKind = "fake" | "openrouter" | "openrouter-loop";

type CliOptions = {
  help?: false;
  task: string;
  runs_root: string;
  run_id: string;
  agent: AgentKind;
  fake_agent_mode: FakeAgentMode;
  openrouter_model: string;
  openrouter_endpoint?: string;
  max_model_turns: number;
  max_feedback_runs: number;
  run_classification: RunClassification;
  request_timeout_ms: number;
  max_output_tokens: number;
  temperature: number;
} | {
  help: true;
};

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
    provider_execution_profile: createProviderExecutionProfile(options)
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
      if (value !== "fake" && value !== "openrouter" && value !== "openrouter-loop") {
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
    } else if (flag === "--run-classification") {
      if (!RUN_CLASSIFICATIONS.includes(value as RunClassification)) {
        throw new Error(
          `--run-classification must be one of: ${RUN_CLASSIFICATIONS.join(", ")}`
        );
      }

      options.run_classification = value as RunClassification;
    } else if (flag === "--max-model-turns") {
      options.max_model_turns = parsePositiveInteger(value, flag);
    } else if (flag === "--max-feedback-runs") {
      options.max_feedback_runs = parseNonNegativeInteger(value, flag);
    } else if (flag === "--request-timeout-ms") {
      options.request_timeout_ms = parsePositiveInteger(value, flag);
    } else if (flag === "--max-output-tokens") {
      options.max_output_tokens = parsePositiveInteger(value, flag);
    } else if (flag === "--temperature") {
      options.temperature = parseNonNegativeNumber(value, flag);
    } else {
      throw new Error(`Unknown argument: ${flag}`);
    }
  }

  if (!options.task || !options.runs_root || !options.run_id) {
    throw new Error(usage());
  }

  return {
    task: options.task,
    runs_root: options.runs_root,
    run_id: options.run_id,
    agent: options.agent ?? "fake",
    fake_agent_mode: options.fake_agent_mode ?? "normal",
    openrouter_model: options.openrouter_model ?? Bun.env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL,
    openrouter_endpoint: options.openrouter_endpoint,
    max_model_turns: options.max_model_turns ?? 3,
    max_feedback_runs: options.max_feedback_runs ?? 2,
    run_classification: options.run_classification ?? "calibration",
    request_timeout_ms: options.request_timeout_ms ?? 60_000,
    max_output_tokens: options.max_output_tokens ?? 16_000,
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
      temperature: options.temperature
    });
  }

  return createOpenRouterAgent({
    apiKey: Bun.env.OPENROUTER_API_KEY ?? "",
    model: options.openrouter_model,
    endpoint: options.openrouter_endpoint,
    appTitle: "hit-sdd-bench",
    requestTimeoutMs: options.request_timeout_ms,
    maxTokens: options.max_output_tokens,
    temperature: options.temperature
  });
}

function createRunBudget(options: Exclude<CliOptions, { help: true }>) {
  if (options.agent !== "openrouter-loop") {
    return {};
  }

  return {
    max_model_turns: options.max_model_turns,
    max_feedback_runs: options.max_feedback_runs
  };
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

  const adapter = options.agent === "openrouter-loop" ? "openrouter-loop" : "openrouter-single-shot";

  return {
    provider_profile_id: `${adapter}-v1-timeout${options.request_timeout_ms}-output${options.max_output_tokens}-temp${options.temperature}-retry0`,
    per_call_timeout_ms: options.request_timeout_ms,
    retry_policy: {
      max_retries: 0,
      retryable_errors: ["timeout", "socket", "rate_limit_transient"]
    },
    max_output_tokens: options.max_output_tokens,
    temperature: options.temperature,
    prompt_renderer_version: RENDERER_VERSION,
    feedback_summary_version: options.agent === "openrouter-loop" ? "public-feedback-summary-v0" : "none"
  };
}

function parsePositiveInteger(value: string, flag: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive integer`);
  }

  return parsed;
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

  return undefined;
}

function usage(): string {
  return [
    "Usage: bun run pilot:run --task <path> --runs-root <path> --run-id <id> [--agent fake|openrouter|openrouter-loop]",
    "Usage: bun run pilot:fake --task <path> --runs-root <path> --run-id <id> [--fake-agent-mode <mode>]",
    "",
    "Options:",
    "  --task <path>              Task package directory.",
    "  --runs-root <path>         Directory where run artifacts are written.",
    "  --run-id <id>              Stable run identifier under the runs root.",
    "  --agent <kind>             fake | openrouter | openrouter-loop. Defaults to fake.",
    "  --fake-agent-mode <mode>   normal | context-i03-item-name-drift.",
    `  --openrouter-model <id>    Defaults to OPENROUTER_MODEL or ${DEFAULT_OPENROUTER_MODEL}.`,
    "  --openrouter-endpoint <url>",
    "                             Defaults to https://openrouter.ai/api/v1/chat/completions.",
    "  --run-classification <id>  calibration | difficulty_probe | causal_pilot | diagnostic_invalid.",
    "                             Defaults to calibration.",
    "  --max-model-turns <n>      Defaults to 3 for loop adapters.",
    "  --max-feedback-runs <n>    Defaults to 2 for loop adapters.",
    "  --request-timeout-ms <n>   Provider request timeout. Defaults to 60000.",
    "  --max-output-tokens <n>    OpenRouter max completion tokens. Defaults to 16000.",
    "  --temperature <n>          OpenRouter sampling temperature. Defaults to 0.2.",
    "  --help                     Print this help text."
  ].join("\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
