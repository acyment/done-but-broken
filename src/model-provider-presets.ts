export const MODEL_LOOP_PRESET_IDS = ["litellm", "deepseek", "alibaba-qwen"] as const;

export type ModelLoopPresetId = (typeof MODEL_LOOP_PRESET_IDS)[number];

export type ModelLoopPreset = {
  provider: string;
  model?: string;
  endpoint: string;
  api_key_env: string;
  provider_route: string;
};

export type ModelLoopSettings = {
  preset_id: ModelLoopPresetId;
  provider: string;
  model: string;
  endpoint: string;
  api_key_env: string;
  provider_route: string;
};

export const DEFAULT_MODEL_LOOP_PRESET_ID: ModelLoopPresetId = "litellm";

export const MODEL_LOOP_PRESETS: Record<ModelLoopPresetId, ModelLoopPreset> = {
  litellm: {
    provider: "litellm",
    endpoint: "http://localhost:4000/v1/chat/completions",
    api_key_env: "LITELLM_API_KEY",
    provider_route: "litellm-chat-completions"
  },
  deepseek: {
    provider: "deepseek",
    model: "deepseek-v4-pro",
    endpoint: "https://api.deepseek.com/chat/completions",
    api_key_env: "DEEPSEEK_API_KEY",
    provider_route: "deepseek-direct-chat-completions"
  },
  "alibaba-qwen": {
    provider: "alibaba-qwen",
    model: "qwen-plus",
    endpoint: "https://dashscope-us.aliyuncs.com/compatible-mode/v1/chat/completions",
    api_key_env: "DASHSCOPE_API_KEY",
    provider_route: "alibaba-qwen-direct-us-virginia-chat-completions"
  }
};

export function isModelLoopPresetId(value: string): value is ModelLoopPresetId {
  return MODEL_LOOP_PRESET_IDS.includes(value as ModelLoopPresetId);
}

export function parseModelLoopPresetId(value: string): ModelLoopPresetId {
  if (!isModelLoopPresetId(value)) {
    throw new Error(`--model-loop-preset must be one of: ${MODEL_LOOP_PRESET_IDS.join(", ")}`);
  }

  return value;
}

export function resolveModelLoopSettings(input: {
  preset_id: ModelLoopPresetId;
  env?: Record<string, string | undefined>;
  overrides?: {
    provider?: string;
    model?: string;
    endpoint?: string;
    api_key_env?: string;
  };
}): ModelLoopSettings {
  const env = input.env ?? {};
  const preset = MODEL_LOOP_PRESETS[input.preset_id];
  const provider = input.overrides?.provider ?? env.MODEL_LOOP_PROVIDER ?? preset.provider;
  const model = input.overrides?.model ?? env.MODEL_LOOP_MODEL ?? preset.model ?? "";
  const endpoint = input.overrides?.endpoint ?? env.MODEL_LOOP_ENDPOINT ?? preset.endpoint;
  const apiKeyEnv = input.overrides?.api_key_env ?? env.MODEL_LOOP_API_KEY_ENV ?? preset.api_key_env;

  return {
    preset_id: input.preset_id,
    provider,
    model,
    endpoint,
    api_key_env: apiKeyEnv,
    provider_route:
      provider === preset.provider && endpoint === preset.endpoint
        ? preset.provider_route
        : `${sanitizeProfileRoute(provider)}-chat-completions-${sanitizeProfileRoute(endpoint)}`
  };
}

export function sanitizeProfileRoute(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized.length > 0 ? sanitized : "unknown";
}
