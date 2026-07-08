// Test fixture only: prints a substrate generate() result as JSON, so
// test/e4-substrate.test.ts can verify byte-identical output across separate OS processes
// (Feature 1's "same seed, same substrate, byte-identical" runs in separate processes).
import { e4ProceduralRestV1Provider } from "../../../src/e4/substrate/provider";

const seed = Number(process.argv[2]);
const result = await e4ProceduralRestV1Provider.generate({
  substrate_config_id: "default",
  substrate_seed: seed,
  task_count: 8,
  op_mix: { weights: { drift_opportunity: 0.5, additive: 0.4, behavior_preserving: 0.1 } }
});

console.log(JSON.stringify(result));
