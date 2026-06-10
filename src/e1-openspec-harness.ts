import { readFile, readdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { runOpenSpecArchive, type E1OpenSpecCommandResult } from "./e1-openspec-workflow";
import { hashText } from "./snapshot";

export const E1_OPENSPEC_SCENARIO_CANONICALIZER_ID = "e1-openspec-scenario-canonicalizer-v1" as const;

export type E1OpenSpecScenario = {
  spec: string;
  requirement: string;
  scenario: string;
  canonical_body: string;
};

export type E1OpenSpecSurvivalLedger = {
  metric_role: "secondary_descriptive";
  scenarios_before: number;
  scenarios_after: number;
  dropped_scenarios: Array<{ spec: string; requirement: string; scenario: string }>;
  added_scenarios: Array<{ spec: string; requirement: string; scenario: string }>;
  changed_scenarios: Array<{ spec: string; requirement: string; scenario: string }>;
};

export type E1OpenSpecArchiveStepRecord = {
  change_name: string;
  archive_ok: boolean;
  failure_reason?: string;
  exit_code: number;
  stdout_hash: string;
  pre_spec_of_record_hash: string;
  post_spec_of_record_hash: string;
  survival_ledger: E1OpenSpecSurvivalLedger;
};

// Reads every openspec/specs/**/spec.md and returns the concatenated, path-labeled spec-of-record.
export async function readOpenSpecSpecOfRecord(workspacePath: string): Promise<Record<string, string>> {
  const specsRoot = join(workspacePath, "openspec", "specs");
  const specs: Record<string, string> = {};
  let entries: Awaited<ReturnType<typeof readdir>>;

  try {
    entries = await readdir(specsRoot, { withFileTypes: true });
  } catch {
    return specs;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    try {
      specs[entry.name] = await readFile(join(specsRoot, entry.name, "spec.md"), "utf8");
    } catch {
      // capability directory without spec.md
    }
  }

  return specs;
}

export function parseOpenSpecScenarios(specs: Record<string, string>): E1OpenSpecScenario[] {
  const scenarios: E1OpenSpecScenario[] = [];

  for (const [spec, content] of Object.entries(specs)) {
    let requirement = "";
    let scenario: string | null = null;
    let body: string[] = [];

    const flush = () => {
      if (scenario !== null) {
        scenarios.push({
          spec,
          requirement,
          scenario,
          canonical_body: canonicalizeOpenSpecScenarioText(body.join("\n"))
        });
      }

      scenario = null;
      body = [];
    };

    for (const line of content.split("\n")) {
      const requirementMatch = line.match(/^###\s*Requirement:\s*(.+?)\s*$/);

      if (requirementMatch) {
        flush();
        requirement = requirementMatch[1];
        continue;
      }

      const scenarioMatch = line.match(/^####\s*Scenario:\s*(.+?)\s*$/);

      if (scenarioMatch) {
        flush();
        scenario = scenarioMatch[1];
        continue;
      }

      if (scenario !== null) {
        body.push(line);
      }
    }

    flush();
  }

  return scenarios.toSorted((left, right) => scenarioKey(left).localeCompare(scenarioKey(right)));
}

// Canonical form for cross-arm scenario parity: Gherkin-style keywords, markdown emphasis,
// bullets, case, and whitespace are presentation; the canonical body is the semantic content.
export function canonicalizeOpenSpecScenarioText(text: string): string {
  return text
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s*[-*]\s*/, "")
        .replace(/\*\*/g, "")
        .replace(/^(GIVEN|WHEN|THEN|AND|BUT)\b\s*/i, "")
        .trim()
        .toLowerCase()
    )
    .filter((line) => line !== "")
    .join("\n");
}

export function buildOpenSpecSurvivalLedger(
  before: E1OpenSpecScenario[],
  after: E1OpenSpecScenario[]
): E1OpenSpecSurvivalLedger {
  const beforeByKey = new Map(before.map((scenario) => [scenarioKey(scenario), scenario]));
  const afterByKey = new Map(after.map((scenario) => [scenarioKey(scenario), scenario]));
  const dropped = before.filter((scenario) => !afterByKey.has(scenarioKey(scenario)));
  const added = after.filter((scenario) => !beforeByKey.has(scenarioKey(scenario)));
  const changed = after.filter((scenario) => {
    const previous = beforeByKey.get(scenarioKey(scenario));

    return previous !== undefined && previous.canonical_body !== scenario.canonical_body;
  });

  return {
    metric_role: "secondary_descriptive",
    scenarios_before: before.length,
    scenarios_after: after.length,
    dropped_scenarios: dropped.map(stripBody),
    added_scenarios: added.map(stripBody),
    changed_scenarios: changed.map(stripBody)
  };
}

// Runs the pinned `openspec archive <change> --yes` as the harness-owned checkpoint-end step.
// Failure is detected from the output text and the un-archived change directory, never the exit
// code (the pinned CLI exits 0 on abort). The dated archive directory is renamed to the plain
// change name immediately so workspace state stays replay-deterministic across days.
export async function runE1OpenSpecArchiveStep(input: {
  repoRoot: string;
  workspacePath: string;
  changeName: string;
  timeoutMs?: number;
}): Promise<E1OpenSpecArchiveStepRecord> {
  const before = await readOpenSpecSpecOfRecord(input.workspacePath);
  const result = await runOpenSpecArchive({
    repoRoot: input.repoRoot,
    workspacePath: input.workspacePath,
    changeName: input.changeName,
    timeoutMs: input.timeoutMs
  });
  const failureReason = await detectArchiveFailure(input.workspacePath, input.changeName, result);

  if (!failureReason) {
    await renameArchivedChangeDeterministically(input.workspacePath, input.changeName);
  }

  const after = await readOpenSpecSpecOfRecord(input.workspacePath);

  return {
    change_name: input.changeName,
    archive_ok: !failureReason,
    ...(failureReason ? { failure_reason: failureReason } : {}),
    exit_code: result.exit_code,
    stdout_hash: result.stdout_hash,
    pre_spec_of_record_hash: hashText(JSON.stringify(before)),
    post_spec_of_record_hash: hashText(JSON.stringify(after)),
    survival_ledger: buildOpenSpecSurvivalLedger(parseOpenSpecScenarios(before), parseOpenSpecScenarios(after))
  };
}

export type E1OpenSpecScenarioParityResult = {
  ok: boolean;
  context_only_scenarios: string[];
  feedback_only_scenarios: string[];
  diverged_scenarios: string[];
};

// Both arms must hold canonically identical scenario content in their spec-of-record at
// checkpoint start; spec-of-record divergence would mean the arms are no longer answering
// the same question.
export async function validateE1OpenSpecScenarioParity(input: {
  contextWorkspacePath: string;
  feedbackWorkspacePath: string;
}): Promise<E1OpenSpecScenarioParityResult> {
  const context = parseOpenSpecScenarios(await readOpenSpecSpecOfRecord(input.contextWorkspacePath));
  const feedback = parseOpenSpecScenarios(await readOpenSpecSpecOfRecord(input.feedbackWorkspacePath));
  const contextByKey = new Map(context.map((scenario) => [scenarioKey(scenario), scenario]));
  const feedbackByKey = new Map(feedback.map((scenario) => [scenarioKey(scenario), scenario]));
  const contextOnly = context.filter((scenario) => !feedbackByKey.has(scenarioKey(scenario)));
  const feedbackOnly = feedback.filter((scenario) => !contextByKey.has(scenarioKey(scenario)));
  const diverged = context.filter((scenario) => {
    const other = feedbackByKey.get(scenarioKey(scenario));

    return other !== undefined && other.canonical_body !== scenario.canonical_body;
  });

  return {
    ok: contextOnly.length === 0 && feedbackOnly.length === 0 && diverged.length === 0,
    context_only_scenarios: contextOnly.map(scenarioKey),
    feedback_only_scenarios: feedbackOnly.map(scenarioKey),
    diverged_scenarios: diverged.map(scenarioKey)
  };
}

async function detectArchiveFailure(
  workspacePath: string,
  changeName: string,
  result: E1OpenSpecCommandResult
): Promise<string | undefined> {
  if (result.normalized_stdout.includes("Aborted. No files were changed.")) {
    return "archive aborted without changes";
  }

  if (result.exit_code !== 0) {
    return `archive exited ${result.exit_code}`;
  }

  try {
    await readdir(join(workspacePath, "openspec", "changes", changeName));

    return "change directory still present after archive";
  } catch {
    return undefined;
  }
}

async function renameArchivedChangeDeterministically(
  workspacePath: string,
  changeName: string
): Promise<void> {
  const archiveRoot = join(workspacePath, "openspec", "changes", "archive");
  const entries = await readdir(archiveRoot, { withFileTypes: true });
  const dated = entries.find(
    (entry) => entry.isDirectory() && entry.name.endsWith(`-${changeName}`) && entry.name !== changeName
  );

  if (dated) {
    await rename(join(archiveRoot, dated.name), join(archiveRoot, changeName));
  }
}

function scenarioKey(scenario: { spec: string; requirement: string; scenario: string }): string {
  return `${scenario.spec} :: ${scenario.requirement} :: ${scenario.scenario}`;
}

function stripBody(scenario: E1OpenSpecScenario): { spec: string; requirement: string; scenario: string } {
  return { spec: scenario.spec, requirement: scenario.requirement, scenario: scenario.scenario };
}
