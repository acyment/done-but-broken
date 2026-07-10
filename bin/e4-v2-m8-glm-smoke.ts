// E4 v2-M8 GLM 5.2 reasoning-observability smoke harness (scoping doc
// docs/protocols/e4-v2-m8-glm52-replication-scoping-v1.md §5).
//
// BUILD ONLY in the session that authored it — NO live call is made without an explicit,
// separately-authorized `--live`. The default (no `--live`) is PLAN ONLY: it resolves and prints the
// GLM route it WOULD call and exits 0 without constructing a transport or reading a key.
//
// What the live path does (when authorized): a few single-turn calls through the flag-wired GLM
// route (§3), each captured by an E4-side recording transport, then the §4 analysis over the
// recorded bodies:
//   §4(a) reasoning active?      — choices[0].message.reasoning_content present (or reasoning_tokens>0)
//   §4(b) reasoning-token count  — folded into completion_tokens (honest) vs separate/excluded
//                                  (⇒ the §2 E4-side budget adjustment is needed before calibration)
//   §5(iv) truncation            — any response finish_reason === "length" ⇒ max_tokens too small
// Any recorded artifact is `calibration`-grade at most, NEVER evidence, NEVER a task outcome.
//
// §9a defaults are pre-filled (endpoint / model / pricing ≥ actuals). Thinking is ON (Option B):
// GLM's default, so the extra body is empty by default — do NOT pass thinking:{type:"disabled"}.
//
//   PLAN ONLY (safe, default):
//     bun run bin/e4-v2-m8-glm-smoke.ts
//   LIVE (requires separate operator authorization; spends cents):
//     ZHIPU_API_KEY=... bun run bin/e4-v2-m8-glm-smoke.ts --live [--calls 3] \
//       [--reasoning-effort max] [--max-output-tokens 32000] [--out tmp/e4-v2-m8-glm-smoke]
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createFetchE1ProviderTransport } from "../src/e1-live-provider";
import { createE4LiveProviderFactory, type E4LiveProviderConfig } from "../src/e4/live-provider";
import {
  createRecordingTransport,
  extractReasoningSignals,
  type ReasoningSignals
} from "../src/e4/reasoning-observability";

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : null;
}

const repoRoot = resolve(import.meta.dir, "..");
const live = process.argv.includes("--live");

// ---- §9a route facts as defaults (pricing are cap-guardrail OVERestimates; must be >= actuals) ----
const model = argValue("--model") ?? "glm-5.2";
const endpoint = argValue("--endpoint") ?? "https://api.z.ai/api/paas/v4/chat/completions";
const apiKeyEnv = argValue("--api-key-env") ?? "ZHIPU_API_KEY";
const pricing = {
  input: Number(argValue("--pricing-in") ?? "1.4"),
  cached_input: Number(argValue("--pricing-cached") ?? "0.26"),
  output: Number(argValue("--pricing-out") ?? "4.4")
};
// Reasoning headroom (§3.3): the M7 parity 16000 may truncate a thinking-on turn — default larger.
const maxOutputTokens = Number(argValue("--max-output-tokens") ?? "32000");
const calls = Number(argValue("--calls") ?? "3");
// Thinking-ON extras (§3.2). Default: empty (GLM defaults to thinking-on). reasoning_effort is
// optional — `max` is z.ai-recommended for coding (most realistic, most token-hungry); `high` is
// cheaper. NEVER inject thinking:{type:"disabled"}.
const reasoningEffort = argValue("--reasoning-effort"); // null → leave GLM default (max)
const extraBody: Record<string, unknown> = reasoningEffort ? { reasoning_effort: reasoningEffort } : {};
const outRoot = resolve(argValue("--out") ?? join(repoRoot, "tmp", "e4-v2-m8-glm-smoke"));

// The prompt is single-turn and deliberately trivial — this measures the reasoning/usage PLUMBING,
// not model quality. A tiny reasoning-provoking arithmetic question is enough to light up thinking.
const smokePrompt = argValue("--prompt") ?? "In one short sentence: what is 17 * 23? Show the result only.";

const config: E4LiveProviderConfig = {
  preset: "direct-openai-compatible",
  model,
  endpoint,
  api_key_env: apiKeyEnv,
  route_id: `direct-${apiKeyEnv.toLowerCase().replaceAll("_", "-")}`,
  pricing_usd_per_million_tokens: pricing,
  sealed_spend_cap_usd: 5,
  max_estimated_call_cost_usd: 0.25,
  max_output_tokens: maxOutputTokens,
  ...(Object.keys(extraBody).length > 0 ? { extra_body: extraBody } : {})
};

if (endpoint.includes("openrouter.ai")) {
  throw new Error("OpenRouter routes are retired (operator decision 2026-06-11)");
}

if (!live) {
  // PLAN ONLY — no transport, no key, no network. Print the resolved route for inspection.
  console.log("E4 v2-M8 GLM smoke — PLAN ONLY (no --live; no live call, no key read, no spend).");
  console.log(
    JSON.stringify(
      {
        mode: "plan-only",
        route: {
          model: config.model,
          endpoint: config.endpoint,
          api_key_env: config.api_key_env,
          route_id: config.route_id,
          pricing_usd_per_million_tokens: config.pricing_usd_per_million_tokens,
          max_output_tokens: config.max_output_tokens,
          extra_body: config.extra_body ?? {},
          thinking: "ON (GLM default; no disable switch injected)"
        },
        would_do: { calls, prompt: smokePrompt, analysis: ["§4a reasoning_active", "§4b token accounting", "§5iv truncation"] },
        note: "The §5 smoke, §6 calibration, and pre-registration each need separate explicit authorization."
      },
      null,
      2
    )
  );
  process.exit(0);
}

// ---- LIVE path (separately authorized only) ----
const recorder = createRecordingTransport(createFetchE1ProviderTransport());
const { factory } = createE4LiveProviderFactory({ config, transport: recorder.transport });

for (let i = 0; i < calls; i += 1) {
  const provider = factory({ arm: "e4_arm_h", pairing_label: "m8-glm-smoke", task_index: i });
  const result = await provider.runTurn({ messages: [{ role: "user", content: smokePrompt }] });
  console.log(`call ${i}: text_len=${result.text.length} output_tokens=${result.usage.output_tokens} spend_usd=${result.spend_usd}`);
}

const perCall: Array<{ call: number; signals: ReasoningSignals }> = recorder.records.map((record, call) => ({
  call,
  signals: extractReasoningSignals(record.response.body)
}));

const anyActive = perCall.some((entry) => entry.signals.reasoning_active);
const anyTruncated = perCall.some((entry) => entry.signals.truncated);
const accountingSet = [...new Set(perCall.map((entry) => entry.signals.accounting))];
const adjustmentNeeded = perCall.some((entry) => entry.signals.adjustment_needed);

const report = {
  schema: "e4-v2-m8-glm-reasoning-smoke-v1",
  classification: "calibration", // calibration-grade at most; never evidence, never a task outcome
  route: { model: config.model, endpoint: config.endpoint, route_id: config.route_id, extra_body: config.extra_body ?? {}, max_output_tokens: config.max_output_tokens },
  checks: {
    reasoning_active_4a: anyActive, // §4(a): must be true, else "thinking-on" label is false → §8 fallback
    accounting_4b: accountingSet, // §4(b): "folded" honest as-is; "separate" → E4-side adjustment before calibration
    adjustment_needed: adjustmentNeeded,
    truncated_5iv: anyTruncated // §5(iv): any true → raise --max-output-tokens
  },
  per_call: perCall
};

await mkdir(outRoot, { recursive: true });
const outPath = join(outRoot, "reasoning-smoke-report.json");
await writeFile(outPath, JSON.stringify(report, null, 2));

console.log("\n== §4/§5 analysis ==");
console.log(`§4(a) reasoning active:        ${anyActive}`);
console.log(`§4(b) token accounting:        ${accountingSet.join(", ")}${adjustmentNeeded ? "  → E4-side adjustment needed" : ""}`);
console.log(`§5(iv) any truncation:         ${anyTruncated}`);
console.log(`report: ${outPath}`);

if (!anyActive) {
  console.error("\n§4(a) FAILED: reasoning not confirmed active — 'thinking-on' label is false. Do not proceed; trigger the §8 fallback review.");
  process.exit(2);
}
