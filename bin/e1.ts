import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ConditionId } from "../src/conditions";
import { loadE1Constants } from "../src/e1-l1-constants";
import {
  E1OpenAICompatibleAgentProvider,
  createFetchE1ProviderTransport,
  type E1ProviderTransport,
  type E1ProviderTransportRequest
} from "../src/e1-live-provider";
import {
  E1_RUN_CLASSIFICATIONS,
  loadE1OraclePackage,
  loadE1TaskPackage,
  runE1TaskPackageProvider,
  type E1RunClassification
} from "../src/e1-package-runner";

type CliOptions = {
  task: string;
  arm: "context" | "feedback" | "both";
  live: boolean;
  transport: "canned" | "live";
  capUsd: number;
  runsRoot: string;
  runId: string;
  checkpoints?: string[];
  model?: string;
  endpoint?: string;
  routeId?: string;
  apiKeyEnv: string;
  maxEstimatedCallCostUsd: number;
  inputUsdPerMillionTokens: number;
  cachedInputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
  maxOutputTokens: number;
  temperature: number;
  classification: E1RunClassification;
};

const repoRoot = resolve(import.meta.dir, "..");
const constantsPath = join(repoRoot, "docs", "protocols", "e1-frontier-sealed-constants-v0.2.json");

try {
  const options = parseArgs(Bun.argv.slice(2));

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const bundlePath = await run(options.value);
  console.log(`bundle=${bundlePath}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function run(options: CliOptions): Promise<string> {
  const { taskPackagePath, oraclePackagePath } = resolveTask(options.task);
  const constants = await loadE1Constants(constantsPath);
  const taskPackage = await loadE1TaskPackage(taskPackagePath);
  const oraclePackage = await loadE1OraclePackage(oraclePackagePath);
  const conditions = armConditions(options.arm);
  const apiKey = options.transport === "live" ? Bun.env[options.apiKeyEnv]?.trim() ?? "" : "sk-canned-cartcalc";

  if (options.transport === "live" && !apiKey) {
    throw new Error(`${options.apiKeyEnv} is required when --transport=live`);
  }

  const transport = options.transport === "live" ? createFetchE1ProviderTransport() : createCannedCartCalcTransport();
  const providers = new Map<ConditionId, E1OpenAICompatibleAgentProvider>();

  await mkdir(join(options.runsRoot, options.runId), { recursive: true });

  const bundle = await runE1TaskPackageProvider({
    constants,
    taskPackage,
    oraclePackage,
    runsRoot: options.runsRoot,
    runId: options.runId,
    conditions,
    checkpoints: options.checkpoints,
    runClassification: options.classification,
    providerFactory: ({ conditionId }) => {
      const existing = providers.get(conditionId);

      if (existing) {
        return existing;
      }

      const provider = makeProvider({ options, apiKey, transport });
      providers.set(conditionId, provider);

      return provider;
    },
    redactionSecrets: [{ id: "api_key", value: apiKey }]
  });
  const usage = bundle.provider_usage_totals;

  console.log(`run_id=${options.runId}`);
  console.log(`run_classification=${bundle.run_classification}`);
  console.log(`invalid_run=${bundle.invalid_run}`);
  console.log(`status=${bundle.provider_run.run_summary.status}`);
  console.log(`conditions=${conditions.join(",")}`);
  console.log(`checkpoints=${bundle.checkpoints.join(",")}`);
  console.log(`provider_route_id=${bundle.run_identity.provider_route_id}`);
  console.log(`provider_usage=${JSON.stringify(usage.provider)}`);
  console.log(`cached_input_tokens=${usage.provider.cached_input_tokens}`);
  console.log(`spend_usd=${usage.spend.actual_spend_usd.toFixed(9)}`);
  console.log(`cost_of_record_source=${usage.spend.cost_of_record_source}`);
  console.log(`provider_reported_spend_usd=${formatOptionalUsd(usage.spend.provider_reported_spend_usd)}`);
  console.log(`derived_spend_usd=${usage.spend.derived_spend_usd.toFixed(9)}`);
  console.log(`spend_usd_basis=${usage.spend.cost_basis}`);
  console.log(`pricing_usd_per_million_tokens=${JSON.stringify(usage.spend.pricing_usd_per_million_tokens)}`);

  return join(options.runsRoot, options.runId, "e1-task-package-provider-bundle.json");
}

function formatOptionalUsd(value: number | null): string {
  return value === null ? "none" : value.toFixed(9);
}

function makeProvider(input: {
  options: CliOptions;
  apiKey: string;
  transport: E1ProviderTransport;
}): E1OpenAICompatibleAgentProvider {
  const model = input.options.model ?? (input.options.transport === "live" ? "" : "canned/cartcalc-fixture");
  const endpoint =
    input.options.endpoint ??
    (input.options.transport === "live"
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://provider.invalid/v1/chat/completions");
  const routeId = input.options.routeId ?? defaultProviderRouteId(input.options.transport, endpoint);

  if (!model) {
    throw new Error("--model is required when --transport=live");
  }

  return new E1OpenAICompatibleAgentProvider({
    providerId: `e1-cartcalc-${input.options.transport}-${sanitizeProfileId(routeId)}-${sanitizeProfileId(model)}`,
    providerRouteId: routeId,
    model,
    endpoint,
    apiKey: input.apiKey,
    transport: input.transport,
    liveMode: input.options.live,
    spendCapUsd: input.options.capUsd,
    maxEstimatedCallCostUsd: input.options.maxEstimatedCallCostUsd,
    pricingUsdPerMillionTokens: {
      input: input.options.inputUsdPerMillionTokens,
      cached_input: input.options.cachedInputUsdPerMillionTokens,
      output: input.options.outputUsdPerMillionTokens
    },
    temperature: input.options.temperature,
    maxOutputTokens: input.options.maxOutputTokens,
    sleep: async () => {}
  });
}

function createCannedCartCalcTransport(): E1ProviderTransport {
  return {
    transport_kind: "canned",
    async send(request: E1ProviderTransportRequest) {
      const checkpoint = detectCheckpoint(request);

      return {
        status: 200,
        body: {
          choices: [{ message: { content: cartCalcImplementation(checkpoint) } }],
          usage: {
            prompt_tokens: 1200 + checkpoint * 100,
            completion_tokens: 220,
            cost: 0.0005 + checkpoint / 1_000_000,
            prompt_tokens_details: { cached_tokens: 120 + checkpoint }
          }
        }
      };
    }
  };
}

function cartCalcImplementation(checkpoint: number): string {
  const discount =
    checkpoint >= 3
      ? "  const uncapped = Math.floor((subtotal * discountBps) / 10000);\n  return Math.min(uncapped, input.discountCapCents ?? uncapped);"
      : checkpoint >= 2
        ? "  return Math.floor((subtotal * discountBps) / 10000);"
        : "  return 0;";

  return [
    "<<<FILE src/cartcalc.ts>>>",
    "export type LineItem = { sku: string; unitCents: number; quantity: number };",
    "export type QuoteInput = { items: LineItem[]; discountBps?: number; discountCapCents?: number };",
    "",
    "export function lineSubtotalCents(item: LineItem): number {",
    "  return item.unitCents * item.quantity;",
    "}",
    "",
    "export function subtotalCents(items: LineItem[]): number {",
    "  return items.reduce((sum, item) => sum + lineSubtotalCents(item), 0);",
    "}",
    "",
    "export function discountCents(input: QuoteInput): number {",
    "  const subtotal = subtotalCents(input.items);",
    "  const discountBps = input.discountBps ?? 0;",
    discount,
    "}",
    "",
    "export function totalCents(input: QuoteInput): number {",
    "  return subtotalCents(input.items) - discountCents(input);",
    "}",
    "<<<END>>>",
    "<<<DONE>>>"
  ].join("\n");
}

function detectCheckpoint(request: E1ProviderTransportRequest): number {
  const text = request.body.messages.map((message) => message.content).join("\n");
  const match = /^Checkpoint: (\d+)/m.exec(text);

  return match ? Number(match[1]) : 1;
}

function resolveTask(task: string): { taskPackagePath: string; oraclePackagePath: string } {
  if (task !== "cartcalc") {
    throw new Error("--task must be cartcalc for the E1 runner");
  }

  return {
    taskPackagePath: join(repoRoot, "tasks", "e1-cartcalc", "task-package"),
    oraclePackagePath: join(repoRoot, "tasks", "e1-cartcalc", "oracle-package")
  };
}

function armConditions(arm: CliOptions["arm"]): ConditionId[] {
  if (arm === "context") {
    return ["context_only_spec"];
  }

  if (arm === "feedback") {
    return ["feedback_capable_spec"];
  }

  return ["context_only_spec", "feedback_capable_spec"];
}

function parseArgs(args: string[]): { help: true } | { help: false; value: CliOptions } {
  const flags = new Map<string, string | true>();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      return { help: true };
    }

    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }

    const equals = arg.indexOf("=");

    if (equals !== -1) {
      flags.set(arg.slice(2, equals), arg.slice(equals + 1));
      continue;
    }

    const key = arg.slice(2);

    if (key === "live") {
      flags.set(key, true);
      continue;
    }

    const value = args[index + 1];

    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    flags.set(key, value);
    index += 1;
  }

  return {
    help: false,
    value: {
      task: requiredString(flags, "task"),
      arm: parseArm(optionalString(flags, "arm") ?? "both"),
      live: flags.get("live") === true,
      transport: parseTransport(optionalString(flags, "transport") ?? "canned"),
      capUsd: requiredNumber(flags, "cap"),
      runsRoot: resolve(optionalString(flags, "runs-root") ?? join(repoRoot, "runs")),
      runId: optionalString(flags, "run-id") ?? `e1-cartcalc-${Date.now()}`,
      checkpoints: parseCheckpoints(optionalString(flags, "checkpoint") ?? optionalString(flags, "checkpoints")),
      model: optionalString(flags, "model") ?? Bun.env.E1_MODEL,
      endpoint: optionalString(flags, "endpoint") ?? Bun.env.E1_ENDPOINT,
      routeId: optionalString(flags, "route-id") ?? Bun.env.E1_ROUTE_ID,
      apiKeyEnv: optionalString(flags, "api-key-env") ?? "OPENROUTER_API_KEY",
      maxEstimatedCallCostUsd: optionalNumber(flags, "max-call-cost") ?? 0.01,
      inputUsdPerMillionTokens: optionalNumber(flags, "input-usd-per-mtok") ?? 1,
      cachedInputUsdPerMillionTokens: optionalNumber(flags, "cached-input-usd-per-mtok") ?? 0.1,
      outputUsdPerMillionTokens: optionalNumber(flags, "output-usd-per-mtok") ?? 2,
      maxOutputTokens: optionalInteger(flags, "max-output-tokens") ?? 4000,
      temperature: optionalNumber(flags, "temperature") ?? 0.2,
      classification: parseClassification(optionalString(flags, "classification") ?? "calibration")
    }
  };
}

function parseClassification(value: string): E1RunClassification {
  if ((E1_RUN_CLASSIFICATIONS as readonly string[]).includes(value)) {
    return value as E1RunClassification;
  }

  throw new Error(`--classification must be one of ${E1_RUN_CLASSIFICATIONS.join(", ")}`);
}

function printHelp(): void {
  console.log(
    [
      "Usage: bun run e1 -- --task=cartcalc --arm=context --live --cap=1.00",
      "",
      "Options:",
      "  --task=cartcalc",
      "  --arm=context | feedback | both",
      "  --live                      Enables the live-mode spend gate.",
      "  --transport=canned | live   Defaults to canned.",
      "  --cap=<usd>                 Required run spend cap.",
      "  --checkpoint=<id>           Optional single checkpoint, e.g. 1.",
      "  --checkpoints=<ids>         Optional comma-separated checkpoints.",
      "  --runs-root <path>",
      "  --run-id <id>",
      "  --model <id>                Required for --transport=live.",
      "  --endpoint <url>            Defaults to OpenRouter for --transport=live.",
      "  --route-id <id>             Stable route identity stamped into bundle manifests.",
      "  --api-key-env <name>        Defaults to OPENROUTER_API_KEY.",
      "  --classification <value>    Precommitted run classification: calibration (default),",
      "                              difficulty_probe, causal_pilot, or diagnostic_invalid."
    ].join("\n")
  );
}

function requiredString(flags: Map<string, string | true>, key: string): string {
  const value = optionalString(flags, key);

  if (!value) {
    throw new Error(`--${key} is required`);
  }

  return value;
}

function optionalString(flags: Map<string, string | true>, key: string): string | undefined {
  const value = flags.get(key);

  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function requiredNumber(flags: Map<string, string | true>, key: string): number {
  const value = optionalNumber(flags, key);

  if (value === undefined) {
    throw new Error(`--${key} must be a number`);
  }

  return value;
}

function optionalNumber(flags: Map<string, string | true>, key: string): number | undefined {
  const raw = optionalString(flags, key);

  if (raw === undefined) {
    return undefined;
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`--${key} must be a non-negative number`);
  }

  return value;
}

function optionalInteger(flags: Map<string, string | true>, key: string): number | undefined {
  const value = optionalNumber(flags, key);

  if (value !== undefined && !Number.isInteger(value)) {
    throw new Error(`--${key} must be an integer`);
  }

  return value;
}

function parseArm(value: string): CliOptions["arm"] {
  if (value === "context" || value === "feedback" || value === "both") {
    return value;
  }

  throw new Error("--arm must be context, feedback, or both");
}

function parseTransport(value: string): CliOptions["transport"] {
  if (value === "canned" || value === "live") {
    return value;
  }

  throw new Error("--transport must be canned or live");
}

function parseCheckpoints(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const checkpoints = value.split(",").map((checkpoint) => checkpoint.trim()).filter(Boolean);

  if (checkpoints.length === 0) {
    throw new Error("--checkpoint/--checkpoints must name at least one checkpoint");
  }

  return checkpoints;
}

function sanitizeProfileId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function defaultProviderRouteId(transport: CliOptions["transport"], endpoint: string): string {
  if (transport === "canned") {
    return "canned-cartcalc-transport";
  }

  if (endpoint === "https://openrouter.ai/api/v1/chat/completions") {
    return "openrouter-chat-completions";
  }

  if (endpoint === "http://localhost:4000/v1/chat/completions") {
    return "litellm-chat-completions";
  }

  return `openai-compatible-chat-completions-${sanitizeProfileId(endpoint)}`;
}
