// E4 live-provider adapter (M6.5 wiring; ADR-007 allowlist: e1-live-provider,
// e1-provider-runtime, model-provider-presets are importable provider plumbing). One
// E1OpenAICompatibleAgentProvider instance backs a whole run; the E4 factory wraps it per task.
//
// Spend discipline (two layers, deliberately ordered):
//   1. The RUNNER's sealed per-sequence ledger (budgets.spend_cap_usd) is the experiment's cap —
//      it terminates a task `spend_cap_reached` cleanly, from the per-turn costs returned here.
//   2. The E1 provider's own cap is a BACKSTOP set at 4x the sealed cap: it should never fire
//      (the ledger fires first); if it somehow does, the run crashes loudly rather than spending
//      unboundedly. It is never the classified outcome.
import {
  createFetchE1ProviderTransport,
  E1OpenAICompatibleAgentProvider,
  type E1ProviderTransport
} from "../e1-live-provider";
import type { E1RedactionSecret } from "../e1-redaction";
import type { E4AgentProviderFactory } from "./turns";

export type E4LiveProviderConfig = {
  preset: string; // manifest.model.preset label (e.g. "deepseek-direct")
  model: string;
  endpoint: string;
  api_key_env: string;
  route_id: string;
  pricing_usd_per_million_tokens: { input: number; cached_input: number; output: number };
  sealed_spend_cap_usd: number; // the budgets.spend_cap_usd value; backstop = 4x this
  max_estimated_call_cost_usd: number;
  max_output_tokens: number;
  temperature?: number;
  // Provider-specific extra body fields (E2 precedent: {"thinking": {"type": "disabled"}}).
  // Injected transport-side so the allowlisted E1 request builder stays untouched.
  extra_body?: Record<string, unknown>;
};

export class E4LiveProviderError extends Error {
  constructor(message: string) {
    super(`[e4-live-provider] ${message}`);
    this.name = "E4LiveProviderError";
  }
}

function withExtraBody(transport: E1ProviderTransport, extraBody: Record<string, unknown>): E1ProviderTransport {
  return {
    transport_kind: transport.transport_kind,
    send: (request) =>
      transport.send({
        ...request,
        body: { ...request.body, ...extraBody } as typeof request.body
      })
  };
}

export function createE4LiveProviderFactory(input: {
  config: E4LiveProviderConfig;
  env?: Record<string, string | undefined>;
  transport?: E1ProviderTransport; // test seam: a canned transport instead of live fetch
}): { factory: E4AgentProviderFactory; secrets: E1RedactionSecret[]; model: { preset: string; model_id: string; route_id: string } } {
  const { config } = input;
  const env = input.env ?? process.env;
  const apiKey = env[config.api_key_env]?.trim() ?? "";

  if (apiKey.length === 0) {
    throw new E4LiveProviderError(`${config.api_key_env} is required for a live run`);
  }

  if (config.endpoint.includes("openrouter.ai")) {
    throw new E4LiveProviderError("OpenRouter routes are retired (operator decision 2026-06-11)");
  }

  const baseTransport = input.transport ?? createFetchE1ProviderTransport();
  const transport = config.extra_body ? withExtraBody(baseTransport, config.extra_body) : baseTransport;

  const provider = new E1OpenAICompatibleAgentProvider({
    providerId: `e4-${config.preset}-${config.model}`,
    providerRouteId: config.route_id,
    model: config.model,
    endpoint: config.endpoint,
    apiKey,
    transport,
    liveMode: transport.transport_kind === "live",
    spendCapUsd: config.sealed_spend_cap_usd * 4, // backstop only — the sealed ledger fires first
    maxEstimatedCallCostUsd: config.max_estimated_call_cost_usd,
    pricingUsdPerMillionTokens: config.pricing_usd_per_million_tokens,
    promptCacheBreakpoints: false, // OpenAI-compatible endpoints cache implicitly; no breakpoints
    ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
    maxOutputTokens: config.max_output_tokens
  });

  type NextTurnContext = Parameters<E1OpenAICompatibleAgentProvider["nextTurn"]>[0];

  const factory: E4AgentProviderFactory = () => ({
    async runTurn({ messages }) {
      const response = await provider.nextTurn({ messages } as unknown as NextTurnContext);

      return {
        text: response.text,
        usage: {
          fresh_input_tokens: response.usage.provider.fresh_input_tokens ?? 0,
          cached_input_tokens: response.usage.provider.cached_input_tokens ?? 0,
          output_tokens: response.usage.provider.output_tokens ?? 0
        },
        spend_usd: response.provider_spend.actual_call_cost_usd
      };
    }
  });

  return {
    factory,
    secrets: [{ id: "api_key", value: apiKey }],
    model: { preset: config.preset, model_id: config.model, route_id: config.route_id }
  };
}
