// E4 v2-M8 reasoning-observability instrument — acceptance (no spend, canned transport).
// Scoping: docs/protocols/e4-v2-m8-glm52-replication-scoping-v1.md §4 (setup-time validity checks).
//
// The four required cases (task step 3):
//   (i)   reasoning_content present + reasoning_tokens folded into completion_tokens → active, folded
//   (ii)  reasoning_tokens reported separately/excluded                             → active, separate (adjustment)
//   (iii) no reasoning_content                                                      → not active
//   (iv)  thinking-on extras + max_tokens survive into the request body
// Plus: the recording transport is a faithful passthrough tee, and the adjustment SEAM is inert.
import { describe, expect, test } from "bun:test";
import {
  adjustOutputTokensForReasoning,
  classifyReasoningTokenAccounting,
  createRecordingTransport,
  extractReasoningSignals,
  reasoningIsActive,
  responseWasTruncated
} from "../src/e4/reasoning-observability";
import { createE4LiveProviderFactory } from "../src/e4/live-provider";
import type { E1ProviderTransport, E1ProviderTransportRequest } from "../src/e1-live-provider";

// GLM-shaped bodies. z.ai emits choices[0].message.reasoning_content when thinking is on
// (docs.z.ai/guides/capabilities/thinking-mode); the reasoning-token side count, when present,
// lives at usage.completion_tokens_details.reasoning_tokens (OpenAI-compatible convention).

// (i) reasoning active, reasoning_tokens FOLDED into completion_tokens (completion 220 = 180 reasoning
//     + ~40 visible). Standard/honest accounting.
const FOLDED_BODY = {
  choices: [{ message: { role: "assistant", content: "391", reasoning_content: "17*23 = 17*20 + 17*3 = 340 + 51 = 391" }, finish_reason: "stop" }],
  usage: { prompt_tokens: 60, completion_tokens: 220, completion_tokens_details: { reasoning_tokens: 180 } }
};

// (ii) reasoning active but reasoning_tokens reported SEPARATELY / excluded: reasoning (180) exceeds
//      completion (40, visible only), so folding is impossible → adjustment needed.
const SEPARATE_BODY = {
  choices: [{ message: { role: "assistant", content: "391", reasoning_content: "17*23 ... = 391" }, finish_reason: "stop" }],
  usage: { prompt_tokens: 60, completion_tokens: 40, completion_tokens_details: { reasoning_tokens: 180 } }
};

// (iii) no reasoning_content, no reasoning_tokens → thinking not active.
const NO_REASONING_BODY = {
  choices: [{ message: { role: "assistant", content: "391" }, finish_reason: "stop" }],
  usage: { prompt_tokens: 60, completion_tokens: 5 }
};

describe("E4 v2-M8 reasoning-observability §4 checks (pure, over recorded bodies)", () => {
  test("(i) reasoning_content present + reasoning_tokens folded → active, accounting=folded", () => {
    expect(reasoningIsActive(FOLDED_BODY)).toBe(true);

    const accounting = classifyReasoningTokenAccounting(FOLDED_BODY);
    expect(accounting.accounting).toBe("folded");
    expect(accounting.completion_tokens).toBe(220);
    expect(accounting.reasoning_tokens).toBe(180);

    const signals = extractReasoningSignals(FOLDED_BODY);
    expect(signals.reasoning_active).toBe(true);
    expect(signals.accounting).toBe("folded");
    expect(signals.adjustment_needed).toBe(false); // budget already honest
  });

  test("(ii) reasoning_tokens reported separately/excluded → active, accounting=separate (adjustment needed)", () => {
    expect(reasoningIsActive(SEPARATE_BODY)).toBe(true);

    const accounting = classifyReasoningTokenAccounting(SEPARATE_BODY);
    expect(accounting.accounting).toBe("separate");
    expect(accounting.completion_tokens).toBe(40);
    expect(accounting.reasoning_tokens).toBe(180);

    const signals = extractReasoningSignals(SEPARATE_BODY);
    expect(signals.reasoning_active).toBe(true);
    expect(signals.accounting).toBe("separate");
    expect(signals.adjustment_needed).toBe(true); // §2 E4-side adjustment needed before calibration
  });

  test("(iii) no reasoning_content → not active", () => {
    expect(reasoningIsActive(NO_REASONING_BODY)).toBe(false);

    const signals = extractReasoningSignals(NO_REASONING_BODY);
    expect(signals.reasoning_active).toBe(false);
    expect(signals.reasoning_content_present).toBe(false);
    // No side count to compare → accounting can't be decided from usage alone.
    expect(signals.accounting).toBe("indeterminate");
    expect(signals.adjustment_needed).toBe(false);
  });

  test("edge: reasoning_tokens == completion_tokens with a visible answer reads as separate", () => {
    const body = {
      choices: [{ message: { content: "391", reasoning_content: "..." } }],
      usage: { completion_tokens: 100, completion_tokens_details: { reasoning_tokens: 100 } }
    };
    // A visible answer exists yet completion counts reasoning alone ⇒ visible tokens excluded.
    expect(classifyReasoningTokenAccounting(body).accounting).toBe("separate");
  });

  test("edge: reasoning_tokens == completion_tokens with NO visible answer reads as folded", () => {
    const body = {
      choices: [{ message: { content: "", reasoning_content: "..." } }],
      usage: { completion_tokens: 100, completion_tokens_details: { reasoning_tokens: 100 } }
    };
    // No visible output, so completion == reasoning is consistent with folding.
    expect(classifyReasoningTokenAccounting(body).accounting).toBe("folded");
  });

  test("§5(iv) truncation: finish_reason 'length' is flagged", () => {
    const truncated = { choices: [{ message: { content: "39", reasoning_content: "..." }, finish_reason: "length" }], usage: {} };
    expect(responseWasTruncated(truncated)).toBe(true);
    expect(responseWasTruncated(FOLDED_BODY)).toBe(false);
  });
});

describe("E4 v2-M8 recording transport (passthrough tee)", () => {
  test("forwards the base response unchanged, preserves transport_kind, and captures each exchange", async () => {
    const base: E1ProviderTransport = {
      transport_kind: "canned",
      async send() {
        return { status: 200, body: FOLDED_BODY };
      }
    };
    const { transport, records } = createRecordingTransport(base);

    expect(transport.transport_kind).toBe("canned"); // a live base would stay live

    const request = { endpoint: "x", headers: {}, body: { model: "glm-5.2", messages: [], temperature: 0.2, top_p: 1, max_tokens: 32000 } };
    const response = await transport.send(request as unknown as E1ProviderTransportRequest);

    expect(response.body).toBe(FOLDED_BODY); // unchanged
    expect(records).toHaveLength(1);
    expect(records[0].response.body).toBe(FOLDED_BODY);
    expect(reasoningIsActive(records[0].response.body)).toBe(true);
  });
});

describe("E4 v2-M8 adjustment SEAM is inert (task 4 — not built yet)", () => {
  test("returns output tokens unchanged even when adjustment_needed is true", () => {
    const result = adjustOutputTokensForReasoning({
      output_tokens: 40,
      signals: { accounting: "separate", reasoning_tokens: 180, adjustment_needed: true }
    });
    expect(result.adjusted).toBe(false);
    expect(result.output_tokens).toBe(40); // inert: no reasoning tokens added yet
  });
});

describe("E4 v2-M8 §3.2 thinking-on wiring (canned transport, zero spend)", () => {
  function cannedTransport(capture: E1ProviderTransportRequest[]): E1ProviderTransport {
    return {
      transport_kind: "canned",
      async send(request) {
        capture.push(request);
        return { status: 200, body: FOLDED_BODY };
      }
    };
  }

  test("(iv) reasoning_effort extra + max_tokens survive into the request body", async () => {
    const capture: E1ProviderTransportRequest[] = [];
    const { factory } = createE4LiveProviderFactory({
      config: {
        preset: "direct-openai-compatible",
        model: "glm-5.2",
        endpoint: "https://api.z.ai/api/paas/v4/chat/completions",
        api_key_env: "E4_TEST_FAKE_KEY",
        route_id: "direct-zhipu-api-key",
        pricing_usd_per_million_tokens: { input: 1.4, cached_input: 0.26, output: 4.4 },
        sealed_spend_cap_usd: 5,
        max_estimated_call_cost_usd: 0.25,
        max_output_tokens: 32000,
        extra_body: { reasoning_effort: "max" }
      },
      env: { E4_TEST_FAKE_KEY: "sk-fake-testing-key-12345" },
      transport: cannedTransport(capture)
    });

    await factory({ arm: "e4_arm_h", pairing_label: "m8-glm-smoke", task_index: 0 }).runTurn({
      messages: [{ role: "user", content: "task" }]
    });

    const body = capture[0].body as Record<string, unknown>;
    expect(body.reasoning_effort).toBe("max"); // thinking-on extra reached the wire
    expect(body.max_tokens).toBe(32000); // headroom survived
    // Critically, no disable switch was injected.
    expect(body.thinking).toBeUndefined();
  });
});
