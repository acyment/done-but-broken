import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  E1OpenAICompatibleAgentProvider,
  type E1ProviderTransport,
  type E1ProviderTransportRequest
} from "../src/e1-live-provider";
import { runE1NoProviderCheckpoint } from "../src/e1-no-provider-runner";
import { E1LiveModeRequiredError } from "../src/e1-provider-runtime";
import { loadE1Constants, type E1SealedConstants } from "../src/e1-l1-constants";
import { ScriptedAgentProvider } from "../src/e1-no-provider-runner";

const CONSTANTS_PATH = join(
  import.meta.dir,
  "..",
  "docs",
  "protocols",
  "e1-frontier-sealed-constants-v1.0.json"
);
const API_KEY = "sk-test-redaction-secret-123456";
const tempRoots: string[] = [];
let constants: E1SealedConstants;

beforeAll(async () => {
  constants = await loadE1Constants(CONSTANTS_PATH);
});

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("E1 live provider client seam", () => {
  test("uses injectable transport and records redacted exchange fixtures", async () => {
    const requests: E1ProviderTransportRequest[] = [];
    const provider = makeProvider({
      transport: {
        transport_kind: "canned",
        async send(request) {
          requests.push(request);

          return {
            status: 200,
            body: {
              choices: [{ message: { content: "<<<DONE>>>" } }],
              usage: {
                prompt_tokens: 100,
                completion_tokens: 7,
                cost: 0.000123,
                prompt_tokens_details: { cached_tokens: 40 }
              }
            }
          };
        }
      }
    });

    const response = await provider.nextTurn({
      conditionId: "context_only_spec",
      checkpointId: "1",
      turnIndex: 1,
      workspacePath: "/tmp/e1",
      messages: [{ role: "user", content: "hello" }]
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].headers.authorization).toBe(`Bearer ${API_KEY}`);
    expect(response.text).toBe("<<<DONE>>>");
    expect(response.usage?.provider).toMatchObject({
      fresh_input_tokens: 60,
      cached_input_tokens: 40,
      output_tokens: 7
    });
    expect(response.provider_attempts).toEqual([{ attempt: 1, outcome: "success" }]);
    expect(response.provider_spend).toMatchObject({
      cost_basis: "provider_reported_when_available_else_derived",
      cost_of_record_source: "provider_reported",
      cost_of_record_usd: 0.000123,
      actual_call_cost_usd: 0.000123,
      provider_reported_cost_usd: 0.000123,
      derived_call_cost_usd: 0.000078,
      pricing_usd_per_million_tokens: {
        input: 1,
        cached_input: 0.1,
        output: 2
      }
    });
    expect(response.provider_exchange?.redacted_request.headers.authorization).toBe(
      "Bearer [REDACTED:api_key]"
    );
    expect(JSON.stringify(response)).not.toContain(API_KEY);
  });

  test("retries malformed canned responses before returning a clean turn", async () => {
    let calls = 0;
    const provider = makeProvider({
      transport: {
        transport_kind: "canned",
        async send() {
          calls += 1;

          if (calls === 1) {
            return { status: 200, body: { choices: [] } };
          }

          return {
            status: 200,
            body: {
              choices: [{ message: { content: "<<<DONE>>>" } }],
              usage: { prompt_tokens: 10, completion_tokens: 2 }
            }
          };
        }
      }
    });

    const response = await provider.nextTurn({
      conditionId: "context_only_spec",
      checkpointId: "1",
      turnIndex: 1,
      workspacePath: "/tmp/e1",
      messages: [{ role: "user", content: "hello" }]
    });

    expect(response.text).toBe("<<<DONE>>>");
    expect(response.provider_spend).toMatchObject({
      cost_basis: "provider_reported_when_available_else_derived",
      cost_of_record_source: "derived",
      actual_call_cost_usd: 0.000014,
      derived_call_cost_usd: 0.000014
    });
    expect(response.provider_attempts?.map((attempt) => attempt.outcome)).toEqual([
      "retryable_failure",
      "success"
    ]);
    expect(response.provider_attempts?.[0].failure_kind).toBe("malformed_response");
  });

  test("live transport cannot run unless live_mode is explicitly enabled", async () => {
    let called = false;
    const provider = makeProvider({
      liveMode: false,
      transport: {
        transport_kind: "live",
        async send() {
          called = true;

          return { status: 200, body: {} };
        }
      }
    });

    await expect(
      provider.nextTurn({
        conditionId: "context_only_spec",
        checkpointId: "1",
        turnIndex: 1,
        workspacePath: "/tmp/e1",
        messages: [{ role: "user", content: "hello" }]
      })
    ).rejects.toThrow(E1LiveModeRequiredError);
    expect(called).toBe(false);
  });

  test("spend cap terminates before transport invocation and is stamped in the manifest", async () => {
    let called = false;
    const workspace = await setupWorkspace();
    const provider = makeProvider({
      spendCapUsd: 0.001,
      maxEstimatedCallCostUsd: 0.01,
      transport: {
        transport_kind: "canned",
        async send() {
          called = true;

          return { status: 200, body: {} };
        }
      }
    });

    const bundle = await runE1NoProviderCheckpoint({
      constants,
      workspacePath: workspace,
      conditionId: "context_only_spec",
      checkpointId: "1",
      checkpoints: ["1"],
      provider,
      prompt: basePrompt(),
      redactionSecrets: [{ id: "api_key", value: API_KEY }]
    });

    expect(called).toBe(false);
    expect(bundle.termination?.classification).toBe("spend_cap_reached");
    expect(bundle.turn_records).toHaveLength(0);
    expect(bundle.spend_cap_reached?.spend).toMatchObject({
      live_mode: true,
      spend_cap_usd: 0.001,
      estimated_max_call_cost_usd: 0.01
    });
    expect(bundle.run_manifest.provider_profile).toMatchObject({
      provider_kind: "openai_compatible",
      provider_route_id: "test-openai-compatible-route",
      live_mode: { spend_cap_usd: 0.001, estimated_max_call_cost_usd: 0.01 }
    });
    expect(JSON.stringify(bundle)).not.toContain(API_KEY);
  });

  test("bundle redaction fails closed when a configured secret appears in artifacts", async () => {
    const workspace = await setupWorkspace();
    const provider = new ScriptedAgentProvider({
      providerId: "scripted-secret-leak",
      script: [`<<<DONE>>>\n${API_KEY}`]
    });

    await expect(
      runE1NoProviderCheckpoint({
        constants,
        workspacePath: workspace,
        conditionId: "context_only_spec",
        checkpointId: "1",
        checkpoints: ["1"],
        provider,
        prompt: basePrompt(),
        redactionSecrets: [{ id: "api_key", value: API_KEY }]
      })
    ).rejects.toThrow("E1 redaction check failed");
  });
});

function makeProvider(input: {
  transport: E1ProviderTransport;
  liveMode?: boolean;
  spendCapUsd?: number;
  maxEstimatedCallCostUsd?: number;
}): E1OpenAICompatibleAgentProvider {
  return new E1OpenAICompatibleAgentProvider({
    providerId: "openai-compatible-test-profile",
    providerRouteId: "test-openai-compatible-route",
    model: "test/model",
    endpoint: "https://provider.example.test/v1/chat/completions",
    apiKey: API_KEY,
    transport: input.transport,
    liveMode: input.liveMode ?? true,
    spendCapUsd: input.spendCapUsd ?? 1,
    maxEstimatedCallCostUsd: input.maxEstimatedCallCostUsd ?? 0.01,
    pricingUsdPerMillionTokens: {
      input: 1,
      cached_input: 0.1,
      output: 2
    },
    sleep: async () => {}
  });
}

function basePrompt() {
  return {
    taskId: "stub-task",
    visibleSpecText: "Feature: stub\n  Scenario: visible behavior",
    checkpointSpecText: "Checkpoint 1: implement the visible behavior.",
    workspaceSnapshotText: "src/, scratch/, specs/",
    readmeText: "Use the E1 protocol blocks."
  };
}

async function setupWorkspace(): Promise<string> {
  const root = join(tmpdir(), `hit-sdd-e1-live-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "scratch"), { recursive: true });
  await mkdir(join(root, "specs", "steps"), { recursive: true });
  await writeFile(join(root, "package.json"), "{\"type\":\"module\"}\n");
  await writeFile(join(root, "bunfig.toml"), "");
  await writeFile(join(root, "specs", "visible.feature"), "Feature: visible\n");
  return root;
}
