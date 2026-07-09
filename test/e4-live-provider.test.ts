// M6.5 wiring acceptance (no spend): the live-provider adapter maps the allowlisted E1 provider
// onto the E4 provider interface through a canned transport; calibration runs are structurally
// non-evidence; the CLI's classification gates refuse the unsafe combinations.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { validateE4Constants, hashE4ConstantsBytes } from "../src/e4/constants";
import { createE4LiveProviderFactory, E4LiveProviderError } from "../src/e4/live-provider";
import { computeE4GoNoGo, E4GoNoGoError } from "../src/e4/gonogo";
import { computeE4HypothesisReport } from "../src/e4/result-schema";
import { validateE4RunManifest, type E4RunManifest } from "../src/e4/manifest";
import type { E1ProviderTransport, E1ProviderTransportRequest } from "../src/e1-live-provider";

const repoRoot = resolve(import.meta.dir, "..");
const constantsBytes = readFileSync(join(repoRoot, "docs", "protocols", "e4-sealed-constants-v0.json"));
const constants = validateE4Constants(JSON.parse(constantsBytes.toString("utf8")));
const constantsHash = hashE4ConstantsBytes(constantsBytes);

function cannedTransport(capture: E1ProviderTransportRequest[]): E1ProviderTransport {
  return {
    transport_kind: "canned",
    async send(request) {
      capture.push(request);

      return {
        status: 200,
        body: {
          choices: [{ message: { content: "<<<DONE>>>" } }],
          usage: { prompt_tokens: 120, prompt_tokens_details: { cached_tokens: 20 }, completion_tokens: 7 }
        }
      };
    }
  };
}

const LIVE_CONFIG = {
  preset: "direct-openai-compatible",
  model: "deepseek-v4-flash",
  endpoint: "https://api.deepseek.com/chat/completions",
  api_key_env: "E4_TEST_FAKE_KEY",
  route_id: "direct-deepseek-api-key",
  pricing_usd_per_million_tokens: { input: 0.5, cached_input: 0.05, output: 2.0 },
  sealed_spend_cap_usd: 5,
  max_estimated_call_cost_usd: 0.25,
  max_output_tokens: 16000
};

describe("M6.5 live-provider adapter (canned transport, zero spend)", () => {
  test("maps text/usage/spend onto the E4 provider interface and surfaces the api key as a redaction secret", async () => {
    const capture: E1ProviderTransportRequest[] = [];
    const { factory, secrets, model } = createE4LiveProviderFactory({
      config: LIVE_CONFIG,
      env: { E4_TEST_FAKE_KEY: "sk-fake-testing-key-12345" },
      transport: cannedTransport(capture)
    });

    const provider = factory({ arm: "e4_arm_h", pairing_label: "pair-x", task_index: 1 });
    const result = await provider.runTurn({
      messages: [
        { role: "system", content: "protocol" },
        { role: "user", content: "task" }
      ]
    });

    expect(result.text).toBe("<<<DONE>>>");
    // prompt 120 with 20 cached → 100 fresh; completion 7.
    expect(result.usage).toEqual({ fresh_input_tokens: 100, cached_input_tokens: 20, output_tokens: 7 });
    // Derived cost from configured pricing: 100*0.5/1e6 + 20*0.05/1e6 + 7*2.0/1e6.
    expect(result.spend_usd).toBeCloseTo((100 * 0.5 + 20 * 0.05 + 7 * 2.0) / 1_000_000, 12);
    expect(secrets).toEqual([{ id: "api_key", value: "sk-fake-testing-key-12345" }]);
    expect(model).toEqual({
      preset: "direct-openai-compatible",
      model_id: "deepseek-v4-flash",
      route_id: "direct-deepseek-api-key"
    });
    // The request carried the model and the sealed-provider request shape.
    expect(capture[0].body.model).toBe("deepseek-v4-flash");
    expect(capture[0].body.max_tokens).toBe(16000);
  });

  test("extra_body injection (thinking-disable) reaches the wire without touching the E1 request builder", async () => {
    const capture: E1ProviderTransportRequest[] = [];
    const { factory } = createE4LiveProviderFactory({
      config: { ...LIVE_CONFIG, extra_body: { thinking: { type: "disabled" } } },
      env: { E4_TEST_FAKE_KEY: "sk-fake-testing-key-12345" },
      transport: cannedTransport(capture)
    });

    await factory({ arm: "e4_arm_h", pairing_label: "pair-x", task_index: 1 }).runTurn({
      messages: [{ role: "user", content: "task" }]
    });

    expect((capture[0].body as Record<string, unknown>).thinking).toEqual({ type: "disabled" });
  });

  test("a missing api key or a retired OpenRouter route fails closed before any call", () => {
    expect(() =>
      createE4LiveProviderFactory({ config: LIVE_CONFIG, env: {}, transport: cannedTransport([]) })
    ).toThrow(E4LiveProviderError);
    expect(() =>
      createE4LiveProviderFactory({
        config: { ...LIVE_CONFIG, endpoint: "https://openrouter.ai/api/v1/chat/completions" },
        env: { E4_TEST_FAKE_KEY: "sk-fake-testing-key-12345" },
        transport: cannedTransport([])
      })
    ).toThrow(/OpenRouter routes are retired/);
  });
});

describe("M6.5 calibration runs are structurally non-evidence", () => {
  function manifestFixture(classification: "dry_run" | "calibration"): E4RunManifest {
    return validateE4RunManifest({
      schema: "e4-run-manifest",
      schema_version: "e4-run-manifest-v1",
      run_id: `${classification}-fixture`,
      run_classification: classification,
      compatibility_boundary: {
        constants_version: constants.version,
        constants_hash: constantsHash,
        meter_version: constants.compatibility_boundary.meter_version!,
        substrate_config_id: constants.compatibility_boundary.substrate_config_id!,
        substrate_kind: "procedural-rest-v1",
        substrate_version: constants.compatibility_boundary.substrate_version!
      },
      substrate_seed: 45,
      substrate_config: { task_count: 1, op_mix: { weights: constants.op_mix!.weights } },
      pairing_label: `pair-${classification}`,
      arm: "e4_arm_h",
      model: { preset: "x", model_id: "y", route_id: "z" },
      budgets: constants.budgets!,
      prompt_overhead_tokens: { estimator_id: "js-tiktoken-o200k_base-v1", system_prompt_tokens: 1, arm_channel_tokens: 0 },
      tasks: [],
      resume_events: [],
      replay_validity: { substrate_regeneration_ok: true, per_task_replay_ok: [], chain_replay_valid: true },
      usage_totals: { turns: 0, tokens: { fresh_input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 }, wall_clock_ms: 0, spend_usd: 0 }
    });
  }

  test("the go/no-go computation excludes calibration manifests; a calibration-only set refuses to evaluate", () => {
    expect(() =>
      computeE4GoNoGo({ manifests: [manifestFixture("calibration")], constants, constantsHash })
    ).toThrow(E4GoNoGoError);
    expect(() =>
      computeE4GoNoGo({ manifests: [manifestFixture("calibration")], constants, constantsHash })
    ).toThrow(/calibration-classified \(non-evidence\)/);
  });

  test("the hypothesis report refuses a calibration manifest on any arm", () => {
    const calibration = manifestFixture("calibration");
    const evidence = manifestFixture("dry_run");

    expect(() =>
      computeE4HypothesisReport({
        manifests: { arm_0: evidence, arm_m: evidence, arm_h: calibration },
        constants: { convention_aggregation_min_items: constants.meter_rules.convention_aggregation_min_items! }
      })
    ).toThrow(/non-evidence/);
  });
});

describe("M6.5 CLI classification gates (no run is launched)", () => {
  async function runCliExpectingError(args: string[]): Promise<string> {
    const proc = Bun.spawn(["bun", "run", join(repoRoot, "bin", "e4.ts"), ...args], {
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe"
    });
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).not.toBe(0);

    return stderr;
  }

  test("pilot classification is refused until the M7 gate", async () => {
    const stderr = await runCliExpectingError(["--run-root", "tmp/never", "--classification", "pilot"]);

    expect(stderr).toContain("M7 pilot launch is gated");
  });

  test("calibration without --live and dry_run with --live are both refused", async () => {
    expect(await runCliExpectingError(["--run-root", "tmp/never", "--classification", "calibration"])).toContain(
      "never frozen from fake-agent observation"
    );
    expect(await runCliExpectingError(["--run-root", "tmp/never", "--live"])).toContain("--live is not valid for dry_run");
  });
});
