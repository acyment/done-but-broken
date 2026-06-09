# AWS Bedrock vs OpenRouter Price Notes

Checked: 2026-06-08

This is operator guidance, not a sealed pricing source. Recheck provider pricing and model metadata before freezing any new provider profile.

## Short Answer

For Claude Sonnet 4.6, AWS Bedrock direct and OpenRouter currently show the same list token price: `$3.00 / 1M input tokens` and `$15.00 / 1M output tokens`. OpenRouter is not meaningfully cheaper for that ceiling/control path; the choice is mostly reliability, routing transparency, auth/ops overhead, and whether we want to remove OpenRouter as an experiment confound.

For other models, do not compare by provider name alone. Bedrock and OpenRouter often expose different model versions, regions, service tiers, and routing layers.

## Claude Sonnet 4.6

| Path | Input | Output | Cache read | Cache write | Batch input | Batch output | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| AWS Bedrock Marketplace listing | `$3.00 / 1M` | `$15.00 / 1M` | `$0.30 / 1M` | `$3.75 / 1M` | `$1.50 / 1M` | `$7.50 / 1M` | AWS listing also shows long-context dimensions at the same standard and batch prices. |
| OpenRouter endpoint metadata | `$3.00 / 1M` | `$15.00 / 1M` | `$0.30 / 1M` | `$3.75 / 1M` | Not shown in the endpoint metadata checked | Not shown in the endpoint metadata checked | OpenRouter exposed multiple Sonnet 4.6 endpoints, including Anthropic, AWS Bedrock, Google Vertex, and Azure, at the same token price. |
| Anthropic public pricing page | `$3.00 / 1M` | `$15.00 / 1M` | up to 90% savings via prompt caching | not itemized on page | 50% savings via batch processing | 50% savings via batch processing | Useful cross-check because Sonnet 4.6 is available natively, Bedrock, Vertex, and Microsoft Foundry. |

Read: price parity. If we use Sonnet 4.6 for a strong control, Bedrock direct is not a cost move; it is a reliability/control move. It may reduce OpenRouter malformed-response/routing ambiguity, but it adds AWS account, region, model-access, quota, and Bedrock auth setup.

## Bedrock Direct vs OpenRouter Routed Bedrock

OpenRouter can route Sonnet 4.6 to an AWS Bedrock backend. That is not equivalent to using Bedrock directly:

- Direct Bedrock fixes the provider account, region, endpoint, auth, and AWS service tier in our profile.
- OpenRouter adds its routing, parameter translation, availability, and provider-selection behavior unless tightly pinned.
- Even when the token price is identical, the failure modes are not identical.

For clean evidence, direct Bedrock or direct Anthropic is preferable to OpenRouter if the model is available and the adapter path is stable.

## Other Bedrock Models

AWS Bedrock currently documents broad model-provider support and OpenAI-compatible API support through the `ChatCompletions` family. Bedrock model cards also show `bedrock-mantle` endpoints for Chat Completions-compatible access.

Relevant model-card facts checked:

- DeepSeek V3.2 is available on Bedrock with model ID `deepseek.v3.2`, a 164K context window, and a `bedrock-mantle` endpoint.
- OpenAI `gpt-oss-120b` is available on Bedrock with model ID `openai.gpt-oss-120b`, a 128K context window, and a `bedrock-mantle` endpoint.

These are not direct substitutes for the OpenRouter models we have been discussing:

- Bedrock `deepseek.v3.2` is not the same as OpenRouter `deepseek/deepseek-v4-pro`.
- Bedrock `openai.gpt-oss-120b` is an open-weight model path, not a GPT-5.x day-to-day coding ceiling.
- Bedrock pricing can vary by region, service tier, marketplace listing, and model. Verify exact prices from AWS immediately before sealing.

## Recommendation

For this project:

1. Use direct provider or LiteLLM smoke tests to reduce OpenRouter as a confound before spending on more causal pilots.
2. For strong controls, prefer direct Anthropic or Bedrock/Vertex-hosted Sonnet only after a clean smoke proves the adapter path.
3. Use Bedrock for controlled enterprise-style provider evidence, not because it is cheaper than OpenRouter for Sonnet 4.6.
4. Keep OpenRouter available for model discovery and quick triage, but do not rely on it as the default evidence path when direct access exists.

## Sources

- AWS Marketplace Claude Sonnet 4.6 listing: https://aws.amazon.com/marketplace/pp/prodview-o6w4hyizv7g64
- OpenRouter Claude Sonnet 4.6 pricing: https://openrouter.ai/anthropic/claude-sonnet-4.6/pricing
- OpenRouter Claude Sonnet 4.6 endpoint metadata: https://openrouter.ai/api/v1/models/anthropic/claude-sonnet-4.6/endpoints
- Anthropic Claude Sonnet 4.6 page: https://www.anthropic.com/claude/sonnet
- AWS Bedrock API compatibility: https://docs.aws.amazon.com/bedrock/latest/userguide/models-api-compatibility.html
- AWS Bedrock DeepSeek V3.2 model card: https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-deepseek-deepseek-v3-2.html
- AWS Bedrock OpenAI gpt-oss-120b model card: https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-openai-gpt-oss-120b.html
