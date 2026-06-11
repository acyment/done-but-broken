import { afterEach, describe, expect, test } from "bun:test";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/test$/, "");
const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("E1 CartCalc CLI", () => {
  test("runs the context arm through the canned live-mode transport and emits a complete bundle", async () => {
    const root = mkTempRoot();
    const runId = "cartcalc-canned-context-cp1";
    const process = Bun.spawnSync({
      cmd: [
        "bun",
        "run",
        "e1",
        "--",
        "--task=cartcalc",
        "--arm=context",
        "--live",
        "--cap=1.00",
        "--checkpoint=1",
        "--runs-root",
        join(root, "runs"),
        "--run-id",
        runId
      ],
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe"
    });

    expect(process.exitCode, process.stderr.toString()).toBe(0);
    const stdout = process.stdout.toString();
    expect(stdout).toContain(`bundle=${join(root, "runs", runId, "e1-task-package-provider-bundle.json")}`);
    expect(stdout).toContain("provider_usage=");
    expect(stdout).toContain("provider_route_id=canned-cartcalc-transport");
    expect(stdout).toContain("spend_usd=");
    expect(stdout).toContain("cached_input_tokens=");
    expect(stdout).toContain("cost_of_record_source=provider_reported");
    expect(stdout).toContain("provider_reported_spend_usd=0.000501000");
    expect(stdout).toContain("derived_spend_usd=0.001631100");
    expect(stdout).toContain("spend_usd_basis=provider_reported_when_available_else_derived");
    expect(stdout).toContain("pricing_usd_per_million_tokens=");

    const bundle = JSON.parse(
      await readFile(join(root, "runs", runId, "e1-task-package-provider-bundle.json"), "utf8")
    );

    expect(bundle.schema_version).toBe("e1-task-package-provider-bundle-v0");
    expect(bundle.selected_conditions).toEqual(["context_only_spec"]);
    expect(bundle.checkpoints).toEqual(["1"]);
    expect(bundle.run_identity).toMatchObject({
      model_provider: "openai_compatible",
      provider_profile_id: "e1-cartcalc-canned-canned-cartcalc-transport-canned-cartcalc-fixture",
      provider_route_id: "canned-cartcalc-transport",
      provider_model: "canned/cartcalc-fixture",
      provider_endpoint: "https://provider.invalid/v1/chat/completions",
      provider_transport_kind: "canned"
    });
    expect(bundle.provider_run.condition_bundles.context_only_spec).toHaveLength(1);
    expect(bundle.provider_run.condition_bundles.feedback_capable_spec).toHaveLength(0);
    expect(bundle.provider_usage_totals.provider.cached_input_tokens).toBeGreaterThan(0);
    expect(bundle.provider_usage_totals.spend.cost_basis).toBe(
      "provider_reported_when_available_else_derived"
    );
    expect(bundle.provider_usage_totals.spend.cost_of_record_source).toBe("provider_reported");
    expect(bundle.provider_usage_totals.spend.provider_reported_spend_usd).toBe(0.000501);
    expect(bundle.provider_usage_totals.spend.derived_spend_usd).toBe(0.0016311);
    expect(bundle.provider_usage_totals.spend.pricing_usd_per_million_tokens).toEqual({
      input: 1,
      cached_input: 0.1,
      output: 2
    });
    expect(bundle.provider_usage_totals.spend.actual_spend_usd).toBe(0.000501);
    expect(
      bundle.provider_run.condition_bundles.context_only_spec[0].run_manifest.provider_profile.cost_accounting
    ).toEqual({
      basis: "provider_reported_when_available_else_derived",
      cap_guardrail_basis: "derived_from_provider_usage_and_configured_prices",
      pricing_usd_per_million_tokens: {
        input: 1,
        cached_input: 0.1,
        output: 2
      }
    });
    expect(
      bundle.provider_run.condition_bundles.context_only_spec[0].run_manifest.provider_profile.provider_route_id
    ).toBe("canned-cartcalc-transport");
    expect(bundle.oracle_scoring.checkpoint_end.context_only_spec[0].summary.pass_rate).toBe(1);
  });

  test("refuses OpenRouter endpoints (route retired 2026-06-11)", () => {
    const spawned = Bun.spawnSync({
      cmd: [
        "bun",
        "run",
        "e1",
        "--",
        "--task=cartcalc",
        "--arm=context",
        "--live",
        "--transport=live",
        "--model",
        "anthropic/claude-sonnet-4.6",
        "--endpoint",
        "https://openrouter.ai/api/v1/chat/completions",
        "--api-key-env",
        "E1_TEST_FAKE_KEY",
        "--cap=1.00"
      ],
      cwd: repoRoot,
      env: { ...process.env, E1_TEST_FAKE_KEY: "sk-fake" },
      stdout: "pipe",
      stderr: "pipe"
    });

    expect(spawned.exitCode).not.toBe(0);
    expect(spawned.stderr.toString()).toContain("OpenRouter routes are retired");
  });
});

function mkTempRoot(): string {
  const root = join(tmpdir(), `hit-sdd-e1-cli-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  return root;
}
