// E5 probe P1.1 — truth-visible close, split-oracle design. Pre-registration:
// docs/e5/E5-P11-TRUTH-VISIBLE-CLOSE-PREREG-v1.md (committed before any spend). This module is
// PROBE-LAYER machinery, deliberately outside every sealed surface: the E4 task lifecycle
// (runner/gate/oracle-at-close/meter) is byte-untouched, and the probe composes around it via
// the orchestrator's post-task hook. Classification calibration only — nothing here may feed an
// evidence run.
//
// Per closed task the hook runs ONE post-close cycle (prereg §2.1/§2.2):
//   treatment — the agent (fresh conversation, same workspace) sees the SHOWN-half verdicts of
//     the hidden cumulative suite and repairs; held-out ids/details are never rendered.
//   control  — the identical cycle with a content-free re-verify instruction (budget-matched:
//     same turn/verification allowance, same writability).
// Then the FULL cumulative suite re-runs (probe-phase oracle invocation, distinct from the
// sealed at-close run) and before/after held-out + full-key stats are recorded. The repaired
// workspace carries forward in BOTH arms (symmetric; only information differs).
import { cp, readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, normalize, posix, sep } from "node:path";
import { renderE1WorkspaceSnapshot } from "../e1-workspace-snapshot";
import { runE4OracleExecutor, type E4ExecutorConfig, type E4ExecutorVerdict } from "../e4/oracle-executor";
import { createE4TurnParser, type E4AgentProvider } from "../e4/v2/turns";
import { runE4V2Scenario } from "../e4/v2/scenario-executor";
import type { E4V2PostTaskHook } from "../e4/v2/orchestrator";
import type { E4TokenUsage } from "../e4/types";
import { buildBaselineIr } from "../e4/substrate/ir";
import { generateCumulativeTestsV2, generateSeedFixtureV2 } from "../e4/substrate/v2/testgen";

export const E5_P11_PROBE_ID = "e5-p11-truth-visible-close-v1";

export type E5P11Mode = "treatment" | "control";

// Prereg §2.1: the cycle's budget-matched allowance, identical in both arms.
export const E5_P11_CYCLE_TURNS = 4;
export const E5_P11_CYCLE_VERIFICATIONS = 2;

// ---- semantic families (prereg §2.3) ----------------------------------------------------------

// test_id shapes are `${entity}-${suffix}`; entity names never contain hyphens. The whole
// validation group is ONE family per entity (rejection machinery generalizes across fields).
export function e5P11FamilyKey(testId: string): string {
  const dash = testId.indexOf("-");

  if (dash <= 0) {
    return `${testId}:other`; // fail-closed: unrecognized ids form their own family
  }

  const entity = testId.slice(0, dash);
  const rest = testId.slice(dash + 1);
  const group =
    rest === "create" || rest === "create-2"
      ? "create"
      : rest === "read" || rest === "read-missing"
        ? "read"
        : rest === "delete" || rest === "read-after-delete"
          ? "delete"
          : rest === "update"
            ? "update"
            : rest === "list" || rest === "list-filtered"
              ? "list"
              : rest === "analytics"
                ? "analytics"
                : "validation"; // unknown-field, <field>-required, <field>-type, <field>-<kind>-rule

  return `${entity}:${group}`;
}

function familyHashHex(substrateSeed: number, familyKey: string): string {
  return new Bun.CryptoHasher("sha256").update(`e5-p11:${substrateSeed}:${familyKey}`).digest("hex");
}

function rawSide(substrateSeed: number, familyKey: string): E5P11Side {
  const firstByte = Number.parseInt(familyHashHex(substrateSeed, familyKey).slice(0, 2), 16);
  return firstByte % 2 === 0 ? "shown" : "held_out";
}

export type E5P11Side = "shown" | "held_out";

export type E5P11Partition = {
  probe_id: typeof E5_P11_PROBE_ID;
  substrate_seed: number;
  // T0 families with their FINAL side after the balance guard; families minted later resolve
  // by raw hash parity (sideOfFamily), so a later task can never move an earlier family.
  t0_families: Record<string, E5P11Side>;
  t0_shown_fraction: number;
  balance_flips: string[]; // family keys flipped by the guard, in the order applied
};

// The balance guard evaluates on the T0 cumulative suite (baseline IR is fixed, so the T0 test
// set is seed-independent; the HASH is seed-dependent). Prereg: both sides within [35%, 65%] of
// T0 checks, flipping families one at a time in ascending hash order from the heavy side.
export function computeE5P11Partition(substrateSeed: number): E5P11Partition {
  const baseline = buildBaselineIr();
  const t0Tests = generateCumulativeTestsV2(baseline, generateSeedFixtureV2(baseline));
  const countsByFamily = new Map<string, number>();

  for (const test of t0Tests) {
    const family = e5P11FamilyKey(test.test_id);
    countsByFamily.set(family, (countsByFamily.get(family) ?? 0) + 1);
  }

  const total = t0Tests.length;
  const sides = new Map<string, E5P11Side>(
    [...countsByFamily.keys()].map((family) => [family, rawSide(substrateSeed, family)])
  );
  const shownCount = (): number =>
    [...countsByFamily.entries()].reduce((sum, [family, count]) => sum + (sides.get(family) === "shown" ? count : 0), 0);
  const byHashAscending = [...countsByFamily.keys()].toSorted((a, b) =>
    familyHashHex(substrateSeed, a).localeCompare(familyHashHex(substrateSeed, b))
  );
  const flips: string[] = [];

  for (let guard = 0; guard < byHashAscending.length; guard += 1) {
    const fraction = shownCount() / total;

    if (fraction >= 0.35 && fraction <= 0.65) {
      break;
    }

    const heavy: E5P11Side = fraction > 0.65 ? "shown" : "held_out";
    const candidate = byHashAscending.find((family) => sides.get(family) === heavy && !flips.includes(family));

    if (!candidate) {
      break; // cannot rebalance further; record the honest fraction
    }

    sides.set(candidate, heavy === "shown" ? "held_out" : "shown");
    flips.push(candidate);
  }

  return {
    probe_id: E5_P11_PROBE_ID,
    substrate_seed: substrateSeed,
    t0_families: Object.fromEntries([...sides.entries()].toSorted(([a], [b]) => a.localeCompare(b))),
    t0_shown_fraction: shownCount() / total,
    balance_flips: flips
  };
}

export function e5P11SideOfFamily(partition: E5P11Partition, familyKey: string): E5P11Side {
  return partition.t0_families[familyKey] ?? rawSide(partition.substrate_seed, familyKey);
}

export function e5P11SideOfTest(partition: E5P11Partition, testId: string): E5P11Side {
  return e5P11SideOfFamily(partition, e5P11FamilyKey(testId));
}

// ---- verdict rendering + scoring --------------------------------------------------------------

export type E5P11PartitionStats = {
  held_out_pass: number;
  held_out_total: number;
  full_pass: number;
  full_total: number;
};

export function e5P11PartitionStats(partition: E5P11Partition, verdicts: E4ExecutorVerdict[]): E5P11PartitionStats {
  const heldOut = verdicts.filter((verdict) => e5P11SideOfTest(partition, verdict.test_id) === "held_out");

  return {
    held_out_pass: heldOut.filter((verdict) => verdict.passed).length,
    held_out_total: heldOut.length,
    full_pass: verdicts.filter((verdict) => verdict.passed).length,
    full_total: verdicts.length
  };
}

// Exposure note §5.1: ONLY shown checks are rendered — no held-out id, count, or failure text.
export function renderE5P11ShownVerdicts(partition: E5P11Partition, verdicts: E4ExecutorVerdict[]): string {
  const shown = verdicts.filter((verdict) => e5P11SideOfTest(partition, verdict.test_id) === "shown");
  const lines = shown.map((verdict) =>
    verdict.passed
      ? `- ${verdict.test_id}: PASS`
      : `- ${verdict.test_id}: FAIL — ${(verdict.failures ?? []).join("; ") || "assertion failed"}`
  );

  return [
    `Acceptance check results for the checks you are allowed to see (${shown.length} checks):`,
    ...lines
  ].join("\n");
}

// ---- post-close repair cycle ------------------------------------------------------------------

const E5_P11_PROTOCOL = [
  "Protocol:",
  "- To replace a file completely, output a block of the form:",
  "<<<FILE path/relative/to/workspace>>>",
  "...the entire new file content...",
  "<<<END>>>",
  "- To run the verification (smoke) command, output a block of the form:",
  "<<<VERIFY>>>",
  "bun run smoke",
  "<<<END>>>",
  "- When you are finished, output exactly this on its own line:",
  "<<<DONE>>>",
  "- Delimiters are recognized only at the start of a line. Files under openspec/ are frozen and cannot be changed."
].join("\n");

function e5P11SystemPrompt(mode: E5P11Mode): string {
  return [
    "You are a software engineer. You just completed a task on a small TypeScript HTTP API workspace and closed it.",
    mode === "treatment"
      ? "Before the task is finalized, you get ONE short repair window. Part of the acceptance suite has been run; you will see the results of the checks you are allowed to see. Other checks exist that you will not see."
      : "Before the task is finalized, you get ONE short re-verification window. Re-check your implementation and repair anything you find. No additional check results are available.",
    `You have up to ${E5_P11_CYCLE_TURNS} turns and ${E5_P11_CYCLE_VERIFICATIONS} verification runs. Only code files may be changed; everything under openspec/ is frozen.`,
    E5_P11_PROTOCOL
  ].join("\n\n");
}

// Probe-layer write guard (the task gate is closed post-done, so its guard cannot be reused):
// code files only, never openspec/**, never escaping the workspace.
export function e5P11WriteAllowed(path: string): boolean {
  const normalized = posix.normalize(path.replaceAll("\\", "/"));

  if (normalized.startsWith("/") || normalized === ".." || normalized.startsWith("../")) {
    return false;
  }

  return normalized !== "openspec" && !normalized.startsWith("openspec/");
}

export type E5P11CycleRecord = {
  probe_id: typeof E5_P11_PROBE_ID;
  mode: E5P11Mode;
  task_index: number;
  shown_message: string | null; // treatment only; recorded verbatim for the D9 screen
  turns_used: number;
  verifications_used: number;
  applied_paths: string[];
  rejected_paths: string[];
  done_emitted: boolean;
  // Provider failure inside the cycle (retries already exhausted inside the provider stack):
  // the cycle ends early, the after-oracle still runs, and the SEQUENCE continues — a probe
  // cycle must never abort the sealed task chain.
  provider_error: string | null;
  before: E5P11PartitionStats;
  after: E5P11PartitionStats | null; // null when the post-cycle oracle did not complete
  after_oracle_kind: string;
  transcript: Array<{ turn: number; raw_output: string; feedback: string }>;
  tokens: E4TokenUsage;
  spend_usd: number;
};

export type E5P11HookInput = {
  mode: E5P11Mode;
  partition: E5P11Partition;
  smoke_command: string;
  // Test seam (runner precedent): the probe-phase oracle engine, defaulting to the real executor.
  oracle_runner?: typeof runE4OracleExecutor;
};

// The orchestrator post-task hook. Fires only on tasks that CLOSED (termination "done") — the
// lever is about the close; non-closes carry no cycle and are reported as-is.
export function createE5P11PostTaskHook(input: E5P11HookInput): E4V2PostTaskHook {
  const oracleRunner = input.oracle_runner ?? runE4OracleExecutor;

  return async (ctx) => {
    if (ctx.result.termination !== "done") {
      return null;
    }

    // The sealed close already ran the oracle exactly once; reuse its recorded verdicts as the
    // BEFORE state (prereg §2.2 — never re-run the at-close oracle).
    const hiddenOracleRaw = await readFile(join(ctx.records_dir, "hidden-oracle.json"), "utf8");
    const hiddenOracle = JSON.parse(hiddenOracleRaw) as { result: { kind: string; verdicts?: E4ExecutorVerdict[] } };

    if (hiddenOracle.result.kind !== "completed" || !hiddenOracle.result.verdicts) {
      return null; // no scored close state → no cycle (recorded by absence; readout counts it)
    }

    const beforeVerdicts = hiddenOracle.result.verdicts;
    const before = e5P11PartitionStats(input.partition, beforeVerdicts);
    const shownMessage = input.mode === "treatment" ? renderE5P11ShownVerdicts(input.partition, beforeVerdicts) : null;

    const parser = createE4TurnParser();
    const snapshot = await renderE1WorkspaceSnapshot(ctx.workspace_dir, { includedRoots: [""] });
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: e5P11SystemPrompt(input.mode) },
      {
        role: "user",
        content: [
          input.mode === "treatment" ? shownMessage : "Re-verify your implementation now; repair anything you find.",
          `Current workspace state:\n${snapshot.text}`
        ].join("\n\n")
      }
    ];

    const record: E5P11CycleRecord = {
      probe_id: E5_P11_PROBE_ID,
      mode: input.mode,
      task_index: ctx.task.task_index,
      shown_message: shownMessage,
      turns_used: 0,
      verifications_used: 0,
      applied_paths: [],
      rejected_paths: [],
      done_emitted: false,
      provider_error: null,
      before,
      after: null,
      after_oracle_kind: "not_run",
      transcript: [],
      tokens: { fresh_input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 },
      spend_usd: 0
    };

    for (let turn = 1; turn <= E5_P11_CYCLE_TURNS; turn += 1) {
      let turnResult: Awaited<ReturnType<typeof ctx.provider.runTurn>>;

      try {
        turnResult = await ctx.provider.runTurn({ messages });
      } catch (error) {
        // The provider stack already retried internally (E1ProviderExhaustedError et al.).
        record.provider_error = String(error);
        break;
      }

      record.turns_used = turn;
      record.tokens.fresh_input_tokens += turnResult.usage.fresh_input_tokens;
      record.tokens.cached_input_tokens += turnResult.usage.cached_input_tokens;
      record.tokens.output_tokens += turnResult.usage.output_tokens;
      record.spend_usd += turnResult.spend_usd;
      messages.push({ role: "assistant", content: turnResult.text });

      const parsed = parser.parse(turnResult.text);
      const feedbackParts: string[] = [];

      for (const replacement of parsed.replacements) {
        if (!e5P11WriteAllowed(replacement.path)) {
          record.rejected_paths.push(replacement.path);
          feedbackParts.push(`rejected: ${replacement.path} (openspec/ is frozen in the repair window)`);
          continue;
        }

        const absolute = join(ctx.workspace_dir, normalize(replacement.path).replaceAll("/", sep));
        await mkdir(dirname(absolute), { recursive: true });
        await writeFile(absolute, replacement.content);
        record.applied_paths.push(replacement.path);
        feedbackParts.push(`applied: ${replacement.path}`);
      }

      if (parsed.verification !== null) {
        if (record.verifications_used >= E5_P11_CYCLE_VERIFICATIONS) {
          feedbackParts.push("verification refused: the repair window's verification allowance is exhausted.");
        } else if (parsed.verification.raw !== input.smoke_command) {
          feedbackParts.push(`verification refused: the only valid verification command is \`${input.smoke_command}\`.`);
        } else {
          record.verifications_used += 1;
          const smoke = await runE4V2Scenario({
            workspace_dir: ctx.workspace_dir,
            scenario: { title: "smoke", steps: [] },
            config: ctx.executor_config
          });
          feedbackParts.push(
            smoke.kind === "completed"
              ? "smoke: the server started and answered the readiness probe (ok)."
              : "smoke: the server failed to become ready."
          );
        }
      }

      const feedback = feedbackParts.join("\n");
      record.transcript.push({ turn, raw_output: turnResult.text, feedback });

      if (parsed.done) {
        record.done_emitted = true;
        break;
      }

      if (turn < E5_P11_CYCLE_TURNS) {
        messages.push({ role: "user", content: feedback.length > 0 ? feedback : "continue." });
      }
    }

    // Probe-phase oracle re-run over the FULL cumulative suite (prereg §2.2).
    const after = await oracleRunner({
      workspace_dir: ctx.workspace_dir,
      tests: ctx.task.acceptance_tests.cumulative,
      config: ctx.executor_config
    });

    record.after_oracle_kind = after.kind;

    if (after.kind === "completed") {
      record.after = e5P11PartitionStats(input.partition, after.verdicts);
    }

    await writeFile(join(ctx.records_dir, "p11-cycle.json"), `${JSON.stringify(record, null, 2)}\n`);
    // Probe-layer retention: the sealed chain-replay flag is false by construction for probe
    // runs (the cycle mutates the workspace after the close snapshot), so the probe keeps its
    // own full post-cycle state per task.
    await cp(ctx.workspace_dir, join(ctx.records_dir, "p11-workspace-after"), { recursive: true });

    return { tokens: record.tokens, spend_usd: record.spend_usd };
  };
}

export type { E4AgentProvider as E5P11Provider, E4ExecutorConfig as E5P11ExecutorConfig };
