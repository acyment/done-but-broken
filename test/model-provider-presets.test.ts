import { describe, expect, test } from "bun:test";
import {
  DEFAULT_MODEL_LOOP_PRESET_ID,
  MODEL_LOOP_PRESETS,
  isModelLoopPresetId,
  resolveModelLoopSettings
} from "../src/model-provider-presets";

describe("model provider presets", () => {
  test("keeps LiteLLM as the default OpenAI-compatible loop preset", () => {
    const settings = resolveModelLoopSettings({
      preset_id: DEFAULT_MODEL_LOOP_PRESET_ID,
      env: {
        MODEL_LOOP_MODEL: "anthropic/claude-sonnet-4.6"
      }
    });

    expect(settings).toEqual({
      preset_id: "litellm",
      provider: "litellm",
      model: "anthropic/claude-sonnet-4.6",
      endpoint: "http://localhost:4000/v1/chat/completions",
      api_key_env: "LITELLM_API_KEY",
      provider_route: "litellm-chat-completions"
    });
  });

  test("resolves direct DeepSeek defaults without OpenRouter or LiteLLM", () => {
    const settings = resolveModelLoopSettings({
      preset_id: "deepseek",
      env: {}
    });

    expect(settings).toEqual({
      preset_id: "deepseek",
      provider: "deepseek",
      model: "deepseek-v4-pro",
      endpoint: "https://api.deepseek.com/chat/completions",
      api_key_env: "DEEPSEEK_API_KEY",
      provider_route: "deepseek-direct-chat-completions"
    });
  });

  test("resolves direct Alibaba Qwen defaults to the DashScope OpenAI-compatible endpoint", () => {
    const settings = resolveModelLoopSettings({
      preset_id: "alibaba-qwen",
      env: {}
    });

    expect(settings).toEqual({
      preset_id: "alibaba-qwen",
      provider: "alibaba-qwen",
      model: "qwen-plus",
      endpoint: "https://dashscope-us.aliyuncs.com/compatible-mode/v1/chat/completions",
      api_key_env: "DASHSCOPE_API_KEY",
      provider_route: "alibaba-qwen-direct-us-virginia-chat-completions"
    });
  });

  test("lets explicit flags override preset and env defaults", () => {
    const settings = resolveModelLoopSettings({
      preset_id: "alibaba-qwen",
      env: {
        MODEL_LOOP_MODEL: "qwen-plus",
        MODEL_LOOP_ENDPOINT: "https://dashscope-us.aliyuncs.com/compatible-mode/v1/chat/completions"
      },
      overrides: {
        model: "qwen-coder-plus",
        endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
        api_key_env: "QWEN_API_KEY"
      }
    });

    expect(settings.model).toBe("qwen-coder-plus");
    expect(settings.endpoint).toBe("https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions");
    expect(settings.api_key_env).toBe("QWEN_API_KEY");
    expect(settings.provider_route).toBe("alibaba-qwen-chat-completions-https-dashscope-intl.aliyuncs.com-compatible-mode-v1-chat-completions");
  });

  test("rejects unknown preset IDs", () => {
    expect(isModelLoopPresetId("deepseek")).toBe(true);
    expect(isModelLoopPresetId("qwen")).toBe(false);
    expect(MODEL_LOOP_PRESETS.deepseek.model).toBe("deepseek-v4-pro");
  });
});
