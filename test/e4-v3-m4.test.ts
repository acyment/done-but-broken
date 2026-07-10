// v3-M4 acceptance (E4V3-PRODUCT-LOOP-PROPOSAL.md §5): the v3 constants freeze + the CLI gates
// + THE fixture the whole redesign exists for — the vacuous gamer (the M8 green-and-weak
// signature made deterministic) is measured-not-blocked on the naked-execution arm and BLOCKED
// by the product gate on the product arm, in the same dry run.
import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { E4_V2_CONSTANTS_PATH, loadE4V2Constants } from "../src/e4/v2/constants";
import { E4_V3_CONSTANTS_PATH, loadE4V3Constants, validateE4V3Constants } from "../src/e4/v3/constants";
import { buildE4V2FakeProviderFactory } from "../src/e4/v2/fake-provider";
import { runE4V2Sequences } from "../src/e4/v2/orchestrator";
import { e4ProceduralRestV2Provider } from "../src/e4/substrate/v2/provider";

const REPO_ROOT = resolve(import.meta.dir, "..");

// [v3-M4] v0 FREEZE: the full-file sha256 of the v3 constants file. Any edit is a new gate.
// [v3-M5] budgets RATIFIED UNCHANGED on glm-5.2 thinking-on (seed-37 e4_arm_p calibration, no
// wall hit); version 0.1 -> 0.2 marks that ratification event. This hash is the v3 constants
// identity a v3-M6 evidence run must be checked against.
const FROZEN_V3_CONSTANTS_SHA256 = "aec35e3d7db94e5be953b2bb5f318ab33d3fa3da96609579994633ffba8cf85a";

describe("v3-M4: constants freeze", () => {
  test("[FREEZE] the v3 constants file hash is pinned", () => {
    const bytes = readFileSync(join(REPO_ROOT, E4_V3_CONSTANTS_PATH));

    expect(createHash("sha256").update(bytes).digest("hex")).toBe(FROZEN_V3_CONSTANTS_SHA256);
  });

  test("loads, validates, and pins the frozen v2 base", async () => {
    const { constants } = await loadE4V3Constants({
      v3Path: join(REPO_ROOT, E4_V3_CONSTANTS_PATH),
      v2Path: join(REPO_ROOT, E4_V2_CONSTANTS_PATH)
    });

    expect(constants.version).toBe("0.2");
    expect(constants.product_gate.mutation_kill_floor).toBeCloseTo(5 / 6, 10);
    expect(constants.product_gate.blocking_checks).not.toContain("field_never_exercised");
    // the sealed ids match the modules' own exported ids
    expect(constants.compatibility_boundary.turn_protocol_id).toBe("e4-turn-protocol-v2");
    expect(constants.compatibility_boundary.product_gate_id).toBe("e4-product-gate-v1");
  });

  test("code twins: every sealed v3 module's bytes hash to the recorded value", async () => {
    const { constants } = await loadE4V3Constants({
      v3Path: join(REPO_ROOT, E4_V3_CONSTANTS_PATH),
      v2Path: join(REPO_ROOT, E4_V2_CONSTANTS_PATH)
    });
    const twins = Object.entries(constants.code_twins);

    expect(twins.length).toBe(8);

    for (const [path, recorded] of twins) {
      const live = createHash("sha256").update(readFileSync(join(REPO_ROOT, path))).digest("hex");

      expect(`${path}:${live}`).toBe(`${path}:${recorded}`);
    }
  });

  test("validator rejects a tampered kill floor and unknown blocking checks", async () => {
    const raw = JSON.parse(readFileSync(join(REPO_ROOT, E4_V3_CONSTANTS_PATH), "utf8"));

    expect(() => validateE4V3Constants({ ...raw, product_gate: { ...raw.product_gate, mutation_kill_floor: 0 } })).toThrow();
    expect(() =>
      validateE4V3Constants({ ...raw, product_gate: { ...raw.product_gate, blocking_checks: ["nonsense"] } })
    ).toThrow();
    expect(() => validateE4V3Constants({ ...raw, arms: ["e4_arm_0", "e4_arm_h"] })).toThrow();
  });
});

describe("v3-M4: CLI classification gates (no run, no spend)", () => {
  async function runCli(args: string[]): Promise<{ exitCode: number; stderr: string }> {
    const proc = Bun.spawn(["bun", "run", "bin/e4-v3.ts", ...args], {
      cwd: REPO_ROOT,
      stdout: "pipe",
      stderr: "pipe"
    });
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    return { exitCode, stderr };
  }

  test("pilot without --live is refused (the unconditional refusal was lifted at the v3-M6 gate)", async () => {
    // The v2-M7 lift pattern (3571a08): pilot is now gated as a live-model classification
    // exactly like calibration; the lift is the v3-M6 gate commit's recorded action
    // (docs/protocols/e4-v3-m6-pilot-preregistration-v1.md).
    const { exitCode, stderr } = await runCli(["--classification", "pilot", "--run-root", "tmp/never"]);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("pilot runs are live-model runs");
  });

  test("calibration without --live and dry_run with --live are refused", async () => {
    const calibration = await runCli(["--classification", "calibration"]);

    expect(calibration.exitCode).not.toBe(0);
    expect(calibration.stderr).toContain("pass --live");

    const dryLive = await runCli(["--live", "--model", "x"]);

    expect(dryLive.exitCode).not.toBe(0);
    expect(dryLive.stderr).toContain("not valid for dry_run");
  });
});

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("v3-M4: the gamer is blocked by the product gate and only there", () => {
  test(
    "vacuous gamer on both executed arms: measured on e4_arm_h, refused on e4_arm_p",
    async () => {
      const runRoot = await mkdtemp(join(tmpdir(), "e4-v3-gamer-"));
      tempRoots.push(runRoot);
      const { constants, hash } = await loadE4V2Constants(join(REPO_ROOT, E4_V2_CONSTANTS_PATH));
      const { constants: v3Constants } = await loadE4V3Constants({
        v3Path: join(REPO_ROOT, E4_V3_CONSTANTS_PATH),
        v2Path: join(REPO_ROOT, E4_V2_CONSTANTS_PATH)
      });
      const substrateConfig = {
        substrate_config_id: constants.compatibility_boundary.substrate_config_id,
        substrate_seed: 50,
        task_count: 4,
        op_mix: { weights: constants.op_mix.weights }
      };
      const generated = await e4ProceduralRestV2Provider.generate(substrateConfig);
      const providerFactory = buildE4V2FakeProviderFactory({
        generated,
        smoke_command: constants.feedback.smoke_command,
        behaviorByArm: { e4_arm_h: "vacuous_gamer", e4_arm_p: "vacuous_gamer" }
      });

      const result = await runE4V2Sequences({
        repoRoot: REPO_ROOT,
        runRoot,
        run_classification: "dry_run",
        pairing_label: "pair-v3-m4-gamer",
        substrate_config: substrateConfig,
        constants,
        constants_hash: hash,
        providerFactory,
        executor_config: constants.executor,
        v3: { product_config: v3Constants.product_gate }
      });

      // Naked-execution arm: the M8 signature — the gamer closes done with false confidence,
      // measured, never blocked (the v2 dry-run fixture's established behavior).
      const armH = result.manifests.e4_arm_h.tasks;
      const armHFalseConfident = armH.filter((task) => task.false_confidence.event).length;

      expect(armHFalseConfident).toBeGreaterThan(0);

      // Product arm: the gate refuses the gamer — at least one product refusal fires, and the
      // gamer never lands a false-confident done on any task where the product gate refused it.
      const armP = result.manifests.e4_arm_p.tasks;
      const productRefusals = armP.reduce(
        (sum, task) =>
          sum +
          (task.product_gate
            ? task.product_gate.pm_review_refusals +
              task.product_gate.reconcile_refusals +
              task.product_gate.mutation_refusals
            : 0),
        0
      );

      expect(productRefusals).toBeGreaterThan(0);

      const armPFalseConfident = armP.filter((task) => task.false_confidence.event).length;

      expect(armPFalseConfident).toBeLessThan(armHFalseConfident);
    },
    600000
  );
});
