# Provider Connections

Updated: 2026-06-08

This repo now has two model-loop provider paths:

- `openrouter-loop`: historical OpenRouter adapter. Keep it for replaying sealed runs and OpenRouter-specific controls.
- `openai-compatible-loop`: generic Chat Completions adapter for direct provider endpoints and self-hosted LiteLLM proxy endpoints.

No provider run is authorized by this document. Provider execution still requires an explicit run matrix, frozen provider profile, and operator authorization.

## OpenAI-Compatible Loop

The generic adapter sends a non-streaming Chat Completions request with:

- `model`
- `messages`
- `temperature`
- `max_tokens`
- optional `response_format: { type: "json_schema", ... }`

It records provider, model, adapter ID, endpoint, response parser version, request parameter version, response format version, timeout, retry policy, prompt caps, and loop budget in the provider execution profile. It does not record secret values or secret env-var names.

Example LiteLLM proxy invocation:

```bash
LITELLM_API_KEY=sk-local \
bun run pilot:run \
  --task tasks/pricing-discount-lifecycle-content-controlled \
  --runs-root runs \
  --run-id <run-id> \
  --agent openai-compatible-loop \
  --model-loop-provider litellm \
  --model-loop-model anthropic/claude-sonnet-4.6 \
  --model-loop-endpoint http://localhost:4000/v1/chat/completions \
  --model-loop-api-key-env LITELLM_API_KEY \
  --model-loop-response-format json_schema \
  --provider-max-retries 1 \
  --request-timeout-ms 120000 \
  --max-output-tokens 4000 \
  --max-workspace-bytes 64000 \
  --max-feedback-output-bytes 4000 \
  --temperature 0.2
```

Named presets are available for the common OpenAI-compatible routes:

| Preset | Provider label | Default model | Default endpoint | Key env | Provider route |
| --- | --- | --- | --- | --- | --- |
| `litellm` | `litellm` | none; set `MODEL_LOOP_MODEL` or `--model-loop-model` | `http://localhost:4000/v1/chat/completions` | `LITELLM_API_KEY` | `litellm-chat-completions` |
| `deepseek` | `deepseek` | `deepseek-v4-pro` | `https://api.deepseek.com/chat/completions` | `DEEPSEEK_API_KEY` | `deepseek-direct-chat-completions` |
| `alibaba-qwen` | `alibaba-qwen` | `qwen-plus` | `https://dashscope-us.aliyuncs.com/compatible-mode/v1/chat/completions` | `DASHSCOPE_API_KEY` | `alibaba-qwen-direct-us-virginia-chat-completions` |

Explicit flags still override preset defaults. Use overrides when freezing a specific Qwen SKU, DashScope region, custom LiteLLM route, or nonstandard key env. Preset IDs are part of operator ergonomics only; causal compatibility is still determined by the recorded provider execution profile.

Direct DeepSeek smoke shape:

```bash
DEEPSEEK_API_KEY=sk-... \
bun run pilot:run \
  --task tasks/pricing-discount-lifecycle-content-controlled \
  --runs-root runs \
  --run-id <run-id> \
  --agent openai-compatible-loop \
  --model-loop-preset deepseek \
  --run-classification diagnostic_invalid \
  --protocol-profile-id path-survival-primary-v1 \
  --max-model-turns 2 \
  --max-feedback-runs 1 \
  --condition-concurrency 2 \
  --provider-max-retries 1 \
  --request-timeout-ms 120000 \
  --max-output-tokens 4000 \
  --max-workspace-bytes 64000 \
  --max-feedback-output-bytes 4000 \
  --temperature 0.2
```

Direct Alibaba/Qwen smoke shape:

```bash
DASHSCOPE_API_KEY=sk-... \
bun run pilot:run \
  --task tasks/pricing-discount-lifecycle-content-controlled \
  --runs-root runs \
  --run-id <run-id> \
  --agent openai-compatible-loop \
  --model-loop-preset alibaba-qwen \
  --model-loop-model <sealed-qwen-model-id> \
  --run-classification diagnostic_invalid \
  --protocol-profile-id path-survival-primary-v1 \
  --max-model-turns 2 \
  --max-feedback-runs 1 \
  --condition-concurrency 2 \
  --provider-max-retries 1 \
  --request-timeout-ms 120000 \
  --max-output-tokens 4000 \
  --max-workspace-bytes 64000 \
  --max-feedback-output-bytes 4000 \
  --temperature 0.2
```

For direct provider smokes, keep `--model-loop-response-format none` unless a provider-specific smoke has already shown that its structured-output dialect accepts this harness's JSON schema request shape. The prompt still requires JSON; the parser and retry path remain active.

## LiteLLM Proxy

LiteLLM is useful when the provider is not natively Chat Completions compatible, or when auth requires provider-specific handling. LiteLLM's docs describe it as translating requests to many providers while returning an OpenAI-format response, with retry/fallback, spend tracking, and OpenAI-compatible exception mapping.

Use LiteLLM as a controlled gateway, not as an invisible replacement for a provider. Any LiteLLM run must have a distinct `provider_route`, endpoint, model ID, response format, timeout, retry policy, and compatibility boundary. Do not pool LiteLLM runs with OpenRouter or direct-provider runs.

Recommended LiteLLM use in this project:

- Anthropic direct API through LiteLLM until a native `anthropic-loop` adapter is added.
- Google Vertex AI through LiteLLM when OAuth refresh and Vertex-specific auth should stay outside the benchmark harness.
- Multiple-provider triage where changing providers is the goal and the gateway itself is part of the frozen profile.

## Direct Endpoints

Direct endpoints are lower-confound than OpenRouter or LiteLLM when the provider supports Chat Completions cleanly.

### OpenAI

- Endpoint: `https://api.openai.com/v1/chat/completions`
- Env var: `OPENAI_API_KEY`
- Provider label: `openai`
- Model: explicit current model ID from the OpenAI API model docs or the sealed run matrix.

```bash
OPENAI_API_KEY=sk-... bun run pilot:run ... \
  --agent openai-compatible-loop \
  --model-loop-provider openai \
  --model-loop-model <openai-model-id> \
  --model-loop-endpoint https://api.openai.com/v1/chat/completions \
  --model-loop-api-key-env OPENAI_API_KEY
```

### DeepSeek

- Endpoint: `https://api.deepseek.com/chat/completions`
- Env var: `DEEPSEEK_API_KEY`
- Provider label: `deepseek`
- Candidate models from current DeepSeek docs: `deepseek-v4-flash`, `deepseek-v4-pro`.
- Preset: `--model-loop-preset deepseek` defaults to `deepseek-v4-pro`.

```bash
DEEPSEEK_API_KEY=sk-... bun run pilot:run ... \
  --agent openai-compatible-loop \
  --model-loop-preset deepseek
```

### Alibaba Qwen / DashScope

- International endpoint: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions`
- US endpoint: `https://dashscope-us.aliyuncs.com/compatible-mode/v1/chat/completions`
- China endpoint: `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
- Env var: `DASHSCOPE_API_KEY`
- Provider label: `alibaba-qwen`
- Model: exact Qwen model ID must be confirmed from Alibaba/Qwen docs before sealing.
- Preset: `--model-loop-preset alibaba-qwen` defaults to the US/Virginia endpoint and `qwen-plus`.

```bash
DASHSCOPE_API_KEY=sk-... bun run pilot:run ... \
  --agent openai-compatible-loop \
  --model-loop-preset alibaba-qwen \
  --model-loop-model <qwen-model-id>
```

### MiniMax

- Endpoint: `https://api.minimax.io/v1/chat/completions`
- Env var: `MINIMAX_API_KEY`
- Provider label: `minimax`
- Current docs show `MiniMax-M3` for the OpenAI-compatible Chat Completions API.

```bash
MINIMAX_API_KEY=sk-... bun run pilot:run ... \
  --agent openai-compatible-loop \
  --model-loop-provider minimax \
  --model-loop-model MiniMax-M3 \
  --model-loop-endpoint https://api.minimax.io/v1/chat/completions \
  --model-loop-api-key-env MINIMAX_API_KEY
```

### Google Vertex AI

Vertex exposes an OpenAI-compatible Chat Completions endpoint, but the stable operational path depends on Google auth and endpoint naming.

- Endpoint shape: `https://aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/endpoints/{endpoint}/chat/completions`
- Env var: `VERTEX_ACCESS_TOKEN`
- Provider label: `google-vertex`
- Model/endpoint: exact Vertex endpoint must be frozen before a run.

```bash
VERTEX_ACCESS_TOKEN=<oauth-bearer-token> bun run pilot:run ... \
  --agent openai-compatible-loop \
  --model-loop-provider google-vertex \
  --model-loop-model <vertex-model-or-endpoint-model-id> \
  --model-loop-endpoint https://aiplatform.googleapis.com/v1/projects/<project>/locations/<location>/endpoints/<endpoint>/chat/completions \
  --model-loop-api-key-env VERTEX_ACCESS_TOKEN
```

For repeated runs, prefer LiteLLM or a future native Vertex adapter so OAuth refresh does not become an experiment failure mode.

### Anthropic

Anthropic's native API is not the same Chat Completions contract used by this new adapter. Use LiteLLM for Anthropic until a native `anthropic-loop` adapter is introduced and sealed under a new provider profile.

```bash
ANTHROPIC_API_KEY=sk-ant-... \
LITELLM_API_KEY=sk-local \
litellm --model anthropic/claude-sonnet-4.6
```

Then call the LiteLLM proxy with `--agent openai-compatible-loop`.

### AWS Bedrock Mantle

AWS Bedrock's `bedrock-mantle` endpoint exposes an OpenAI-compatible Chat Completions API for supported models.

- Endpoint shape: `https://bedrock-mantle.{region}.api.aws/v1/chat/completions`
- Env var: `BEDROCK_API_KEY` or the project-specific name chosen by the operator.
- Provider label: `aws-bedrock`
- Model: Bedrock model ID, for example `deepseek.v3.2` or `openai.gpt-oss-120b`.

Bedrock direct runs should be separate from OpenRouter's Bedrock-routed endpoints, because endpoint ownership, region, auth, quota, and failure modes differ.

## Sources

- LiteLLM: https://docs.litellm.ai/
- OpenAI Chat Completions: https://platform.openai.com/docs/api-reference/chat/create-chat-completion
- DeepSeek API: https://api-docs.deepseek.com/
- Google Vertex Chat Completions: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/reference/rest/v1/projects.locations.endpoints.chat/completions
- Alibaba Qwen OpenAI Chat API reference: https://www.alibabacloud.com/help/en/model-studio/qwen-api-via-openai-chat-completions
- MiniMax OpenAI-compatible Chat Completions: https://platform.minimax.io/docs/api-reference/text-chat-openai
- AWS Bedrock API compatibility: https://docs.aws.amazon.com/bedrock/latest/userguide/models-api-compatibility.html
