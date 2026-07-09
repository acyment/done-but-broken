// M6 acceptance — dry-run integration harness (IMPLEMENTATION-PLAN.md §2 M6, Gherkin verbatim):
// one seeded command runs a full 3-arm sequence with no spend; the go/no-go executable is
// three-valued over emitted manifests; crash-resume works end-to-end through the CLI; and the
// registry-bypass fixture exercises the live executor→meter reconciliation path ([R1-S6]).
import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { validateE4Constants, hashE4ConstantsBytes } from "../src/e4/constants";
import { buildE4FakeProviderFactory, pickE4BypassRoute, E4_DEFAULT_FAKE_BEHAVIORS } from "../src/e4/fake-provider";
import { validateE4RunManifest, type E4RunManifest } from "../src/e4/manifest";
import { runE4Run } from "../src/e4/run-orchestrator";
import { renderEndpointItemId, type E4EndpointKind } from "../src/e4/substrate/ir";
import { e4ProceduralRestV1Provider, type E4SubstrateConfig } from "../src/e4/substrate/provider";
import type { E4ArmId } from "../src/e4/types";

const repoRoot = resolve(import.meta.dir, "..");
const scratchRoot = join(repoRoot, "tmp", "e4-dryrun-tests");
const constantsBytes = readFileSync(join(repoRoot, "docs", "protocols", "e4-sealed-constants-v0.json"));
const constants = validateE4Constants(JSON.parse(constantsBytes.toString("utf8")));
const constantsHash = hashE4ConstantsBytes(constantsBytes);

// Seeds probed for the fixture: both draws contain >= 1 drift_opportunity task (so velocity has a
// denominator) and a behavior_preserving task (so the affirmation path runs live).
const SEEDS = [45, 46];
const TASKS = 3;

afterAll(async () => {
  await rm(scratchRoot, { recursive: true, force: true });
});

async function freshRoot(prefix: string): Promise<string> {
  await mkdir(scratchRoot, { recursive: true });
  return mkdtemp(join(scratchRoot, `${prefix}-`));
}

type CliResult = { exitCode: number; stdout: string; stderr: string };

async function runCli(args: string[]): Promise<CliResult> {
  const proc = Bun.spawn(["bun", "run", ...args], { cwd: repoRoot, stdout: "pipe", stderr: "pipe" });
  const exitCode = await proc.exited;

  return {
    exitCode,
    stdout: await new Response(proc.stdout).text(),
    stderr: await new Response(proc.stderr).text()
  };
}

async function readManifest(runRoot: string, seed: number, arm: E4ArmId): Promise<E4RunManifest> {
  return validateE4RunManifest(
    JSON.parse(await readFile(join(runRoot, `seed-${seed}`, "manifests", `${arm}.json`), "utf8"))
  );
}

function substrateConfig(seed: number, taskCount: number): E4SubstrateConfig {
  return {
    substrate_config_id: constants.compatibility_boundary.substrate_config_id!,
    substrate_seed: seed,
    task_count: taskCount,
    op_mix: { weights: constants.op_mix!.weights }
  };
}

describe("M6 scenario: one command runs full 3-arm sequences with no spend", () => {
  test("bun run bin/e4.ts executes all arms across 2 seeds; every manifest validates, replays, and spends nothing", async () => {
    const runRoot = await freshRoot("go");
    const cli = await runCli(["bin/e4.ts", "--run-root", runRoot, "--seeds", SEEDS.join(","), "--tasks", String(TASKS)]);

    expect(cli.exitCode).toBe(0);

    for (const seed of SEEDS) {
      for (const arm of ["e4_arm_0", "e4_arm_m", "e4_arm_h"] as const) {
        const manifest = await readManifest(runRoot, seed, arm);

        expect(manifest.tasks.length).toBe(TASKS);
        expect(manifest.tasks.every((task) => task.status === "complete")).toBe(true);
        expect(manifest.replay_validity.chain_replay_valid).toBe(true);
        // Zero spend: the fake provider never touches a network and reports spend_usd 0.
        expect(manifest.usage_totals.spend_usd).toBe(0);
        expect(manifest.run_classification).toBe("dry_run");
      }

      // The diligent Arm-H sequence exits the gate cleanly: full oracle pass, zero drift.
      const armH = await readManifest(runRoot, seed, "e4_arm_h");

      expect(armH.tasks.every((task) => task.termination === "done")).toBe(true);
      expect(armH.tasks.every((task) => task.oracle.cumulative_pass === task.oracle.cumulative_total)).toBe(true);
      expect(armH.tasks.every((task) => task.drift.discrepancies.length === 0)).toBe(true);

      // The drifting Arm 0 accumulates spec-side drift while still passing the oracle.
      const arm0 = await readManifest(runRoot, seed, "e4_arm_0");

      expect(arm0.tasks.at(-1)!.drift.discrepancies.length).toBeGreaterThan(0);
      expect(arm0.tasks.every((task) => task.oracle.cumulative_pass === task.oracle.cumulative_total)).toBe(true);
    }

    // ---- M6 scenario: the go/no-go executable over these manifests → GO (exit 0) ----

    const gonogo = await runCli(["bin/e4-gonogo.ts", runRoot]);

    expect(gonogo.exitCode).toBe(0);
    expect(gonogo.stdout).toContain("verdict: go");
    expect(gonogo.stdout).toContain("(a) arm-0 drifts: true");
    expect(gonogo.stdout).toContain("(b) meter stamp: true");
    expect(gonogo.stdout).toContain("c1 true");
    // [R1-S8] the class-composition diagnostic is present, never a gate.
    expect(gonogo.stdout).toContain("diagnostic e4_arm_0 drift composition:");

    // ---- M6 scenario (three-valued): a single surviving seed is inconclusive (exit 2) ----

    const inconclusive = await runCli(["bin/e4-gonogo.ts", join(runRoot, `seed-${SEEDS[0]}`)]);

    expect(inconclusive.exitCode).toBe(2);
    expect(inconclusive.stdout).toContain("verdict: inconclusive_uninterpretable");
    expect(inconclusive.stdout).toContain("insufficient_valid_data: FIRED");
  }, 300_000);

  test("no-go (exit 1): arms separate-able data where the H1 signal is absent fails predicate (a) without firing a trigger", async () => {
    const runRoot = await freshRoot("nogo");

    // Arm 0 diligent (velocity 0 — H1 absent), Arm M drifting (its velocity > 0 defuses the
    // substrate_not_validated trigger), Arm H diligent (no spec stall).
    for (const seed of SEEDS) {
      const config = substrateConfig(seed, TASKS);
      const generated = await e4ProceduralRestV1Provider.generate(config);

      await runE4Run({
        runRoot: join(runRoot, `seed-${seed}`),
        constants,
        constantsHash,
        substrate: e4ProceduralRestV1Provider,
        config,
        pairing_label: `pair-nogo-seed-${seed}`,
        run_classification: "dry_run",
        model: { preset: "fake-deterministic", model_id: "e4-fake-agent-v1", route_id: "none" },
        providerFactory: buildE4FakeProviderFactory({
          generated,
          smoke_command: constants.feedback!.smoke_command,
          behaviorByArm: { e4_arm_0: "diligent_h" }
        })
      });
    }

    const gonogo = await runCli(["bin/e4-gonogo.ts", runRoot]);

    expect(gonogo.exitCode).toBe(1);
    expect(gonogo.stdout).toContain("verdict: no-go");
    expect(gonogo.stdout).toContain("(a) Arm-0 drift velocity");
    expect(gonogo.stdout).toContain("substrate_not_validated: clear");
  }, 300_000);
});

describe("M6 scenario: crash-resume works end-to-end through the CLI", () => {
  test("a run interrupted during task 3 resumes from snapshot 2 and completes chain-replay-valid", async () => {
    const runRoot = await freshRoot("resume");
    const baseArgs = ["bin/e4.ts", "--run-root", runRoot, "--seeds", String(SEEDS[0]), "--tasks", String(TASKS)];

    const crashed = await runCli([...baseArgs, "--crash-at", "e4_arm_0:3"]);

    expect(crashed.exitCode).not.toBe(0);

    // Durable state stops at task 2 for arm 0.
    const partial = await readManifest(runRoot, SEEDS[0], "e4_arm_0");

    expect(partial.tasks.length).toBe(2);

    const resumed = await runCli([...baseArgs, "--resume"]);

    expect(resumed.exitCode).toBe(0);

    const manifest = await readManifest(runRoot, SEEDS[0], "e4_arm_0");

    expect(manifest.tasks.length).toBe(TASKS);
    expect(manifest.resume_events).toEqual([
      {
        restored_snapshot_task_index: 2,
        restored_snapshot_hash: partial.tasks[1].snapshot.hash,
        resumed_at_task_index: 3,
        aborted_task_index: 3
      }
    ]);
    expect(manifest.replay_validity.chain_replay_valid).toBe(true);
  }, 300_000);
});

describe("M6 scenario: registry bypass is classified live end-to-end ([R1-S6])", () => {
  test("a ground-truth route served by direct-wired code absent from the registry lands in the conventions channel", async () => {
    const runRoot = await freshRoot("bypass");
    const config = substrateConfig(SEEDS[0], 1);
    const generated = await e4ProceduralRestV1Provider.generate(config);

    const { manifests } = await runE4Run({
      runRoot: join(runRoot, `seed-${SEEDS[0]}`),
      constants,
      constantsHash,
      substrate: e4ProceduralRestV1Provider,
      config,
      pairing_label: `pair-bypass-seed-${SEEDS[0]}`,
      run_classification: "dry_run",
      model: { preset: "fake-deterministic", model_id: "e4-fake-agent-v1", route_id: "none" },
      providerFactory: buildE4FakeProviderFactory({
        generated,
        smoke_command: constants.feedback!.smoke_command,
        behaviorByArm: { e4_arm_0: "registry_bypass" }
      })
    });

    // Recompute which route the fixture bypassed, and its meter item id.
    const goldRegistry = JSON.parse(
      /export const routeRegistry: E4RouteDefinition\[\] = (\[[\s\S]*?\]);\n/.exec(
        (await import("../src/e4/substrate/scaffold")).buildE4WorkspaceFiles(generated.tasks[0].ground_truth_ir)["registry.ts"]
      )![1]
    ) as Array<{ method: string; path: string; entity: string; kind: string }>;
    const t0Registry = JSON.parse(
      /export const routeRegistry: E4RouteDefinition\[\] = (\[[\s\S]*?\]);\n/.exec(generated.initial_workspace["registry.ts"])![1]
    ) as Array<{ method: string; path: string; entity: string; kind: string }>;
    const bypassRoute = pickE4BypassRoute({ goldRoutes: goldRegistry, t0Routes: t0Registry });
    const bypassItemId = renderEndpointItemId(bypassRoute.entity, bypassRoute.kind as E4EndpointKind);

    const record = manifests.e4_arm_0!.tasks[0];

    // The behavior exists (executor green across the full surface — evidence for reconciliation).
    expect(record.oracle.cumulative_pass).toBe(record.oracle.cumulative_total);

    // A registry_bypass event is recorded and attributed to the conventions channel…
    expect(record.drift.registry_bypass).toEqual([{ item_id: bypassItemId }]);
    const reclassified = record.drift.discrepancies.filter((discrepancy) => discrepancy.item_id === bypassItemId);

    expect(reclassified.length).toBeGreaterThan(0);
    expect(
      reclassified.every(
        (discrepancy) =>
          discrepancy.kind === "convention" &&
          discrepancy.class === "contradiction" &&
          discrepancy.detail.found === "registry_bypass"
      )
    ).toBe(true);

    // …and no API-channel discrepancy is reported for that route.
    expect(
      record.drift.discrepancies.some((discrepancy) => discrepancy.kind === "endpoint" && discrepancy.item_id === bypassItemId)
    ).toBe(false);

    // The surgically modified workspace still replays byte-exactly.
    expect(manifests.e4_arm_0!.replay_validity.chain_replay_valid).toBe(true);
  }, 300_000);
});

describe("M6 defaults", () => {
  test("the default behavior map is the [R1-S6] triad shape: drifting controls, diligent treatment", () => {
    expect(E4_DEFAULT_FAKE_BEHAVIORS).toEqual({
      e4_arm_0: "drifting",
      e4_arm_m: "drifting",
      e4_arm_h: "diligent_h"
    });
  });
});
