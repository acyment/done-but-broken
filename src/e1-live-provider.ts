import type {
  E1AgentProvider,
  E1AgentProviderContext,
  E1AgentProviderResponse,
  E1ConversationMessage
} from "./e1-no-provider-runner";
import {
  E1LiveModeRequiredError,
  E1ProviderFailureError,
  E1SpendCapReachedError,
  callE1ProviderWithRetries,
  type E1SpendCapSnapshot
} from "./e1-provider-runtime";
import {
  assertE1NoSecretsInJson,
  redactE1SecretsInJson,
  type E1RedactionReport,
  type E1RedactionSecret
} from "./e1-redaction";
import { countE1Tokens } from "./e1-token-estimator";
import { hashText } from "./snapshot";

export type E1ProviderTransportKind = "canned" | "live";

export type E1ProviderTransportRequest = {
  endpoint: string;
  headers: Record<string, string>;
  body: {
    model: string;
    messages: E1ConversationMessage[];
    temperature: number;
    top_p: number;
    max_tokens: number;
  };
};

export type E1ProviderTransportResponse = {
  status: number;
  body: unknown;
};

export interface E1ProviderTransport {
  readonly transport_kind: E1ProviderTransportKind;
  send(request: E1ProviderTransportRequest): Promise<E1ProviderTransportResponse>;
}

export type E1ProviderExchangeRecord = {
  schema_version: "e1-provider-exchange-record-v0";
  transport_kind: E1ProviderTransportKind;
  request_hash: string;
  response_hash: string;
  redacted_request: E1ProviderTransportRequest;
  redacted_response: E1ProviderTransportResponse;
  redaction: E1RedactionReport;
};

export type E1ProviderSpendRecord = E1SpendCapSnapshot & {
  cost_basis: "derived_from_provider_usage_and_configured_prices";
  pricing_usd_per_million_tokens: E1OpenAICompatibleProviderOptions["pricingUsdPerMillionTokens"];
  actual_call_cost_usd: number;
};

export type E1OpenAICompatibleProviderProfile = {
  provider_kind: "openai_compatible";
  provider_profile_id: string;
  model: string;
  endpoint: string;
  transport_kind: E1ProviderTransportKind;
  sampling: {
    temperature: number;
    top_p: number;
    max_output_tokens_per_turn: number;
  };
  live_mode: E1SpendCapSnapshot;
  cost_accounting: {
    basis: "derived_from_provider_usage_and_configured_prices";
    pricing_usd_per_million_tokens: E1OpenAICompatibleProviderOptions["pricingUsdPerMillionTokens"];
  };
  redaction: {
    checked: true;
    secret_ids: string[];
  };
};

export type E1OpenAICompatibleProviderOptions = {
  providerId: string;
  model: string;
  endpoint: string;
  apiKey: string;
  transport: E1ProviderTransport;
  liveMode: boolean;
  spendCapUsd: number;
  maxEstimatedCallCostUsd: number;
  pricingUsdPerMillionTokens: {
    input: number;
    cached_input: number;
    output: number;
  };
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  secrets?: E1RedactionSecret[];
  sleep?: (ms: number) => Promise<void>;
};

export class E1OpenAICompatibleAgentProvider implements E1AgentProvider {
  readonly provider_id: string;
  readonly provider_metadata: E1OpenAICompatibleProviderProfile;
  private estimatedSpendUsd = 0;

  constructor(private readonly options: E1OpenAICompatibleProviderOptions) {
    this.provider_id = options.providerId;
    this.provider_metadata = this.buildProviderMetadata();
    assertE1NoSecretsInJson(this.provider_metadata, this.redactionSecrets());
  }

  async nextTurn(context: E1AgentProviderContext): Promise<E1AgentProviderResponse> {
    this.enforceLiveGate();
    const request = this.buildRequest(context.messages);
    const response = await callE1ProviderWithRetries({
      maxAttempts: 3,
      backoffMs: [250, 1000, 4000],
      sleep: this.options.sleep,
      operation: async () => {
        const transportResponse = await this.options.transport.send(request);

        if (transportResponse.status === 429) {
          throw new E1ProviderFailureError({
            failureKind: "rate_limit",
            message: "provider returned HTTP 429",
            providerStatus: 429
          });
        }

        if (transportResponse.status < 200 || transportResponse.status >= 300) {
          throw new E1ProviderFailureError({
            failureKind: "api_error",
            message: `provider returned HTTP ${transportResponse.status}`,
            providerStatus: transportResponse.status
          });
        }

        extractOpenAICompatibleText(transportResponse.body);
        return transportResponse;
      }
    });
    const text = extractOpenAICompatibleText(response.value.body);
    const usage = extractOpenAICompatibleUsage(response.value.body);
    const actualCallCostUsd = estimateOpenAICompatibleCostUsd({
      usage,
      pricingUsdPerMillionTokens: this.options.pricingUsdPerMillionTokens
    });

    this.estimatedSpendUsd += actualCallCostUsd;

    return {
      text,
      usage: {
        provider: {
          fresh_input_tokens: Math.max(0, (usage.prompt_tokens ?? 0) - (usage.cached_input_tokens ?? 0)),
          cached_input_tokens: usage.cached_input_tokens,
          output_tokens: usage.completion_tokens
        },
        estimator: {
          fresh_input_tokens: countMessagesTokens(request.body.messages),
          output_tokens: countE1Tokens(text)
        }
      },
      provider_attempts: response.attempts,
      provider_spend: {
        ...this.spendSnapshot(),
        cost_basis: "derived_from_provider_usage_and_configured_prices",
        pricing_usd_per_million_tokens: this.options.pricingUsdPerMillionTokens,
        actual_call_cost_usd: actualCallCostUsd
      },
      provider_exchange: this.recordExchange(request, response.value)
    };
  }

  private buildRequest(messages: E1ConversationMessage[]): E1ProviderTransportRequest {
    return {
      endpoint: this.options.endpoint,
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        "content-type": "application/json"
      },
      body: {
        model: this.options.model,
        messages,
        temperature: this.options.temperature ?? 0.2,
        top_p: this.options.topP ?? 1,
        max_tokens: this.options.maxOutputTokens ?? 4000
      }
    };
  }

  private enforceLiveGate(): void {
    if (this.options.transport.transport_kind === "live" && !this.options.liveMode) {
      throw new E1LiveModeRequiredError();
    }

    const snapshot = this.spendSnapshot();

    if (snapshot.estimated_max_call_cost_usd > snapshot.remaining_spend_usd) {
      throw new E1SpendCapReachedError({
        message: `spend cap would be exceeded before provider call: remaining ${snapshot.remaining_spend_usd.toFixed(
          6
        )} USD, max call ${snapshot.estimated_max_call_cost_usd.toFixed(6)} USD`,
        spend: snapshot
      });
    }
  }

  private spendSnapshot(): E1SpendCapSnapshot {
    return {
      live_mode: this.options.liveMode,
      spend_cap_usd: this.options.spendCapUsd,
      estimated_spend_usd: roundUsd(this.estimatedSpendUsd),
      estimated_max_call_cost_usd: this.options.maxEstimatedCallCostUsd,
      remaining_spend_usd: roundUsd(Math.max(0, this.options.spendCapUsd - this.estimatedSpendUsd))
    };
  }

  private buildProviderMetadata(): E1OpenAICompatibleProviderProfile {
    return {
      provider_kind: "openai_compatible",
      provider_profile_id: this.options.providerId,
      model: this.options.model,
      endpoint: this.options.endpoint,
      transport_kind: this.options.transport.transport_kind,
      sampling: {
        temperature: this.options.temperature ?? 0.2,
        top_p: this.options.topP ?? 1,
        max_output_tokens_per_turn: this.options.maxOutputTokens ?? 4000
      },
      live_mode: this.spendSnapshot(),
      cost_accounting: {
        basis: "derived_from_provider_usage_and_configured_prices",
        pricing_usd_per_million_tokens: this.options.pricingUsdPerMillionTokens
      },
      redaction: {
        checked: true,
        secret_ids: this.redactionSecrets().map((secret) => secret.id)
      }
    };
  }

  private recordExchange(
    request: E1ProviderTransportRequest,
    response: E1ProviderTransportResponse
  ): E1ProviderExchangeRecord {
    const redacted = redactE1SecretsInJson({ request, response }, this.redactionSecrets());
    const record = {
      schema_version: "e1-provider-exchange-record-v0" as const,
      transport_kind: this.options.transport.transport_kind,
      request_hash: hashText(JSON.stringify(request)),
      response_hash: hashText(JSON.stringify(response)),
      redacted_request: redacted.value.request,
      redacted_response: redacted.value.response,
      redaction: redacted.report
    };

    assertE1NoSecretsInJson(record, this.redactionSecrets());

    return record;
  }

  private redactionSecrets(): E1RedactionSecret[] {
    return [
      { id: "api_key", value: this.options.apiKey },
      ...(this.options.secrets ?? [])
    ];
  }
}

export function createFetchE1ProviderTransport(fetchImpl: typeof fetch = fetch): E1ProviderTransport {
  return {
    transport_kind: "live",
    async send(request) {
      const response = await fetchImpl(request.endpoint, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(request.body)
      });

      return {
        status: response.status,
        body: await response.json()
      };
    }
  };
}

function extractOpenAICompatibleText(body: unknown): string {
  const choice = asRecord(asRecordArray(asRecord(body).choices)[0]).message;
  const content = asRecord(choice).content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        const record = asRecord(part);

        return typeof record.text === "string" ? record.text : "";
      })
      .join("");
  }

  throw new E1ProviderFailureError({
    failureKind: "malformed_response",
    message: "OpenAI-compatible response did not contain message.content"
  });
}

function extractOpenAICompatibleUsage(body: unknown): {
  prompt_tokens?: number;
  completion_tokens?: number;
  cached_input_tokens?: number;
} {
  const usage = asRecord(asRecord(body).usage ?? {});
  const details = asRecord(usage.prompt_tokens_details ?? {});

  return {
    prompt_tokens: optionalInteger(usage.prompt_tokens),
    completion_tokens: optionalInteger(usage.completion_tokens),
    cached_input_tokens: optionalInteger(details.cached_tokens) ?? 0
  };
}

function estimateOpenAICompatibleCostUsd(input: {
  usage: { prompt_tokens?: number; completion_tokens?: number; cached_input_tokens?: number };
  pricingUsdPerMillionTokens: E1OpenAICompatibleProviderOptions["pricingUsdPerMillionTokens"];
}): number {
  const cached = input.usage.cached_input_tokens ?? 0;
  const fresh = Math.max(0, (input.usage.prompt_tokens ?? 0) - cached);
  const output = input.usage.completion_tokens ?? 0;

  return roundUsd(
    (fresh / 1_000_000) * input.pricingUsdPerMillionTokens.input +
      (cached / 1_000_000) * input.pricingUsdPerMillionTokens.cached_input +
      (output / 1_000_000) * input.pricingUsdPerMillionTokens.output
  );
}

function countMessagesTokens(messages: E1ConversationMessage[]): number {
  return countE1Tokens(messages.map((message) => `${message.role}\n${message.content}`).join("\n"));
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}

function optionalInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}
