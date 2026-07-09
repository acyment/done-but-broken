// E4 run CLI (IMPLEMENTATION-PLAN.md M6 dry-run harness + M6.5 live calibration wiring).
//
// Dry run (fake agent, zero spend — the M6 default):
//   bun run bin/e4.ts --run-root <dir> [--seeds 42,43] [--tasks 3] [--resume]
//                     [--crash-at <arm>:<taskIndex>]   (test seam: simulated harness crash)
//
// Live calibration (M6.5, SPEND-GATED — runs only under explicit operator authorization):
//   bun run bin/e4.ts --run-root <dir> --live --classification calibration --arms e4_arm_h
//                     --tasks 6 --seeds <seed> --model <id> --endpoint <url> --api-key-env <ENV>
//                     [--pricing-in <usd/M>] [--pricing-cached <usd/M>] [--pricing-out <usd/M>]
//                     [--max-output-tokens N] [--disable-thinking] [--resume]
//
// Classification gates (deliberate):
//   dry_run      → fake provider only; --live is refused.
//   calibration  → live provider required; non-evidence by classification (result schema and
//                  go/no-go exclude it structurally).
//   pilot        → REFUSED here. M7 launches only at its own gate, with the pre-registered
//                  analysis committed first; this guard is removed at that gate, not before.
import { join, resolve } from "node:path";
import { loadE4Constants } from "../src/e4/constants";
import { runE4Run } from "../src/e4/run-orchestrator";
import { buildE4FakeProviderFactory } from "../src/e4/fake-provider";
import { createE4LiveProviderFactory } from "../src/e4/live-provider";
import { e4ProceduralRestV1Provider, type E4SubstrateConfig } from "../src/e4/substrate/provider";
import type { E4ArmId, E4RunClassification } from "../src/e4/types";

const repoRoot = resolve(import.meta.dir, "..");
const CONSTANTS_PATH = join(repoRoot, "docs", "protocols", "e4-sealed-constants-v0.json");

type CliArgs = {
  runRoot: string;
  seeds: number[];
  tasks: number;
  resume: boolean;
  live: boolean;
  classification: E4RunClassification;
  arms: E4ArmId[] | null;
  crashAt: { arm: E4ArmId; task_index: number } | null;
  model: string | null;
  endpoint: string;
  apiKeyEnv: string;
  pricing: { input: number; cached_input: number; output: number };
  maxOutputTokens: number;
  disableThinking: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const get = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };

  const runRoot = get("--run-root");

  if (!runRoot) {
    throw new Error("usage: bun run bin/e4.ts --run-root <dir> [...] (see file header)");
  }

  const crashAtRaw = get("--crash-at");
  let crashAt: { arm: E4ArmId; task_index: number } | null = null;

  if (crashAtRaw) {
    const [arm, task] = crashAtRaw.split(":");
    crashAt = { arm: arm as E4ArmId, task_index: Number(task) };
  }

  return {
    runRoot,
    seeds: (get("--seeds") ?? "42").split(",").map((seed) => Number(seed.trim())),
    tasks: Number(get("--tasks") ?? "3"),
    resume: argv.includes("--resume"),
    live: argv.includes("--live"),
    classification: (get("--classification") ?? "dry_run") as E4RunClassification,
    arms: get("--arms") ? (get("--arms")!.split(",").map((arm) => arm.trim()) as E4ArmId[]) : null,
    crashAt,
    model: get("--model") ?? null,
    endpoint: get("--endpoint") ?? "https://api.deepseek.com/chat/completions",
    apiKeyEnv: get("--api-key-env") ?? "DEEPSEEK_API_KEY",
    // Conservative OVERestimates for the derived-cost cap guardrail when the provider does not
    // report cost; observed token counts (not these prices) are what ratifies the budgets.
    pricing: {
      input: Number(get("--pricing-in") ?? "0.5"),
      cached_input: Number(get("--pricing-cached") ?? "0.05"),
      output: Number(get("--pricing-out") ?? "2.0")
    },
    maxOutputTokens: Number(get("--max-output-tokens") ?? "16000"),
    disableThinking: argv.includes("--disable-thinking")
  };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const { constants, hash: constantsHash } = await loadE4Constants(CONSTANTS_PATH);

  if (constants.op_mix === null || constants.compatibility_boundary.substrate_config_id === null) {
    throw new Error("sealed constants are pre-M1: op_mix / substrate_config_id missing");
  }

  if (args.classification === "pilot") {
    throw new Error(
      "M7 pilot launch is gated: the pre-registered analysis must be committed and the launch explicitly authorized at the M7 gate — this guard is removed there, not here."
    );
  }

  if (args.classification === "calibration" && !args.live) {
    throw new Error("calibration runs are live-model runs: pass --live (budgets are never frozen from fake-agent observation)");
  }

  if (args.classification === "dry_run" && args.live) {
    throw new Error("--live is not valid for dry_run: the dry-run harness is the zero-spend fake agent");
  }

  if (args.live && !args.model) {
    throw new Error("--model is required for a live run");
  }

  for (const seed of args.seeds) {
    const config: E4SubstrateConfig = {
      substrate_config_id: constants.compatibility_boundary.substrate_config_id,
      substrate_seed: seed,
      task_count: args.tasks,
      op_mix: { weights: constants.op_mix.weights }
    };

    let providerFactory;
    let model: { preset: string; model_id: string; route_id: string };
    let secrets: Array<{ id: string; value: string }> = [];

    if (args.live) {
      const live = createE4LiveProviderFactory({
        config: {
          preset: "direct-openai-compatible",
          model: args.model!,
          endpoint: args.endpoint,
          api_key_env: args.apiKeyEnv,
          route_id: `direct-${args.apiKeyEnv.toLowerCase().replaceAll("_", "-")}`,
          pricing_usd_per_million_tokens: args.pricing,
          sealed_spend_cap_usd: constants.budgets!.spend_cap_usd,
          max_estimated_call_cost_usd: 0.25,
          max_output_tokens: args.maxOutputTokens,
          ...(args.disableThinking ? { extra_body: { thinking: { type: "disabled" } } } : {})
        }
      });
      providerFactory = live.factory;
      model = live.model;
      secrets = live.secrets;
    } else {
      // The factory is scripted from the same deterministic generate() the orchestrator re-runs
      // internally — identical output by generator determinism (Feature 1).
      const generated = await e4ProceduralRestV1Provider.generate(config);
      providerFactory = buildE4FakeProviderFactory({
        generated,
        smoke_command: constants.feedback!.smoke_command,
        ...(args.crashAt ? { crash_at: args.crashAt } : {})
      });
      model = { preset: "fake-deterministic", model_id: "e4-fake-agent-v1", route_id: "none" };
    }

    const { manifests } = await runE4Run({
      runRoot: join(args.runRoot, `seed-${seed}`),
      constants,
      constantsHash,
      substrate: e4ProceduralRestV1Provider,
      config,
      pairing_label: `pair-${args.classification.replaceAll("_", "")}-seed-${seed}`,
      run_classification: args.classification,
      model,
      providerFactory,
      resume: args.resume,
      ...(args.arms ? { arms: args.arms } : {}),
      ...(secrets.length > 0 ? { secrets } : {})
    });

    for (const arm of Object.keys(manifests).sort() as E4ArmId[]) {
      const manifest = manifests[arm]!;
      console.log(
        `seed ${seed} ${arm}: tasks=${manifest.tasks.length}/${args.tasks} ` +
          `chain_replay_valid=${manifest.replay_validity.chain_replay_valid} ` +
          `spend_usd=${manifest.usage_totals.spend_usd.toFixed(6)}`
      );

      for (const task of manifest.tasks) {
        console.log(
          `  task ${task.task_index}: ${task.termination} phase=${task.phase_at_termination} ` +
            `turns=${task.usage.turns} tokens=${task.usage.tokens.fresh_input_tokens + task.usage.tokens.cached_input_tokens + task.usage.tokens.output_tokens} ` +
            `oracle=${task.oracle.cumulative_pass}/${task.oracle.cumulative_total} spend=${task.usage.spend_usd.toFixed(6)}`
        );
      }
    }
  }

  return 0;
}

process.exit(await main());
