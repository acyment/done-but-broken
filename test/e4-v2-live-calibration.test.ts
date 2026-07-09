// v2-M6 wiring acceptance (no spend): bin/e4-v2.ts's --live calibration path refuses every unsafe
// classification/flag combination before any provider is constructed. The unconditional `pilot`
// refusal was lifted at the v2-M7 gate (operator-authorized, 2026-07-09; record:
// docs/protocols/e4-v2-m7-pilot-preregistration-v1.md) — pilot is now gated as a live-model
// classification exactly like calibration. The live-provider
// adapter itself (src/e4/live-provider.ts) is exercised by test/e4-live-provider.test.ts and is
// reused here verbatim (E4-owned, not v1-specific); this file covers only the v2 CLI surface and
// the v2 manifest/orchestrator model-stamping this milestone adds.
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { runE4V2Sequences } from "../src/e4/v2/orchestrator";
import { buildE4V2FakeProviderFactory } from "../src/e4/v2/fake-provider";
import { E4V2ManifestError, validateE4V2Manifest } from "../src/e4/v2/manifest";
import { E4_V2_CONSTANTS_PATH, loadE4V2Constants } from "../src/e4/v2/constants";
import { e4ProceduralRestV2Provider } from "../src/e4/substrate/v2/provider";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");

describe("v2-M6 CLI classification gates (no run is launched)", () => {
  async function runCliExpectingError(args: string[]): Promise<string> {
    const proc = Bun.spawn(["bun", "run", join(repoRoot, "bin", "e4-v2.ts"), ...args], {
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe"
    });
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).not.toBe(0);

    return stderr;
  }

  test("pilot without --live is refused (the unconditional refusal was lifted at the v2-M7 gate)", async () => {
    expect(await runCliExpectingError(["--classification", "pilot", "--run-root", "tmp/never"])).toContain(
      "pilot runs are live-model runs"
    );
  });

  test("calibration without --live, and dry_run with --live, are both refused", async () => {
    expect(
      await runCliExpectingError(["--classification", "calibration", "--run-root", "tmp/never"])
    ).toContain("calibration runs are live-model runs");
    expect(await runCliExpectingError(["--live", "--run-root", "tmp/never"])).toContain(
      "--live is not valid for dry_run"
    );
  });

  test("a live run without --model is refused before any provider is constructed", async () => {
    expect(
      await runCliExpectingError(["--live", "--classification", "calibration", "--run-root", "tmp/never"])
    ).toContain("--model is required for a live run");
  });
}, 30_000);

describe("v2-M6 manifest carries a model identity", () => {
  const tempRoots: string[] = [];

  test("validateE4V2Manifest rejects a manifest missing the model field", async () => {
    const { constants, hash } = await loadE4V2Constants(join(repoRoot, E4_V2_CONSTANTS_PATH));
    const substrateConfig = {
      substrate_config_id: constants.compatibility_boundary.substrate_config_id,
      substrate_seed: 45,
      task_count: 1,
      op_mix: { weights: constants.op_mix.weights }
    };
    const generated = await e4ProceduralRestV2Provider.generate(substrateConfig);
    const providerFactory = buildE4V2FakeProviderFactory({ generated, smoke_command: constants.feedback.smoke_command });
    const runRoot = await mkdtemp(join(tmpdir(), "e4-v2-model-field-"));
    tempRoots.push(runRoot);

    const { manifests } = await runE4V2Sequences({
      repoRoot,
      runRoot,
      run_classification: "dry_run",
      pairing_label: "pair-dryrun-model-field",
      substrate_config: substrateConfig,
      constants,
      constants_hash: hash,
      providerFactory,
      executor_config: constants.executor,
      arms: ["e4_arm_h"]
    });

    // Dry-run default: no explicit model passed, orchestrator stamps the fake-agent identity.
    expect(manifests.e4_arm_h.model).toEqual({ preset: "fake-deterministic", model_id: "e4-fake-agent-v1", route_id: "none" });
    expect(() => validateE4V2Manifest(manifests.e4_arm_h)).not.toThrow();

    const stripped = structuredClone(manifests.e4_arm_h) as Record<string, unknown>;
    delete stripped.model;
    expect(() => validateE4V2Manifest(stripped)).toThrow(E4V2ManifestError);
    expect(() => validateE4V2Manifest(stripped)).toThrow(/model is incomplete/);

    await rm(runRoot, { recursive: true, force: true });
  }, 120_000);

  test("an explicit model identity overrides the dry-run default and is stamped into the manifest", async () => {
    const { constants, hash } = await loadE4V2Constants(join(repoRoot, E4_V2_CONSTANTS_PATH));
    const substrateConfig = {
      substrate_config_id: constants.compatibility_boundary.substrate_config_id,
      substrate_seed: 45,
      task_count: 1,
      op_mix: { weights: constants.op_mix.weights }
    };
    const generated = await e4ProceduralRestV2Provider.generate(substrateConfig);
    const providerFactory = buildE4V2FakeProviderFactory({ generated, smoke_command: constants.feedback.smoke_command });
    const runRoot = await mkdtemp(join(tmpdir(), "e4-v2-model-field-explicit-"));
    tempRoots.push(runRoot);

    const { manifests } = await runE4V2Sequences({
      repoRoot,
      runRoot,
      run_classification: "dry_run",
      pairing_label: "pair-dryrun-model-field-explicit",
      substrate_config: substrateConfig,
      constants,
      constants_hash: hash,
      providerFactory,
      executor_config: constants.executor,
      arms: ["e4_arm_h"],
      model: { preset: "direct-openai-compatible", model_id: "deepseek-v4-pro", route_id: "direct-deepseek-api-key" }
    });

    expect(manifests.e4_arm_h.model).toEqual({
      preset: "direct-openai-compatible",
      model_id: "deepseek-v4-pro",
      route_id: "direct-deepseek-api-key"
    });

    await rm(runRoot, { recursive: true, force: true });
  }, 120_000);
});
