// v2 task gate (E4V2 design §6 as amended; v2-M3). The per-task sequencing state machine for
// BOTH v2 arms — the workflow (propose → custody → implement → done) is a shared task-environment
// property, and custody floors are identical in both arms ("keeping authoring effort symmetric").
// Whether the spec RUNS is the arms' only difference:
//
//   executed arm — custody + CHANGE-LEVEL discriminating red (§6.2.i as amended at Amendment 2:
//     ≥1 novel scenario, ≥1 of them red; all-green novel sets refuse; green novels recorded, not
//     gating) + cumulative green on the done-claim (spec-of-record + change, merged via the REAL
//     archive semantics — previewed in a scratch copy, never re-implemented).
//   prose arm — identical custody (change exists + validates + scenarios parse/bind + A8 floors);
//     scenarios are NEVER executed; done is accepted as in v1's ungated arms.
//
// Like the v1 gate (src/e4/gate.ts, untouched), this module owns WHEN things run and WHAT is done
// with verdicts; execution engines arrive as closures. [R2: R2-3] carries over: the gate consults
// NO meter and NO ground-truth state — its inputs are agent-visible workspace bytes, the sealed
// CLI validator, and the agent's OWN scenarios' verdicts. It enforces custody and discrimination,
// never spec truth (ADR-003; wrongful removals stay the meter's business, §6.2.iv).
import { posix } from "node:path";
import type { E4OpportunityLabel, E4TaskPhase } from "../types";
import { parseOpenSpecScenarioBlocks, type E4ParsedScenario } from "./converter";
import { bindScenario, scenarioFloorViolations } from "./step-table";
import { canonicalScenarioBody, type E4V2Scenario } from "./scenario";
import type { E4V2MergePreview } from "./openspec";
import type { E4V2ScenarioVerdict } from "./scenario-executor";

export type E4V2ArmMode = "executed" | "prose";

export type E4V2GatePhase = E4TaskPhase | "closed";

// Per-novel-scenario red capture (A10, extended by Amendment 2's green_novel recording).
// failure_mode adds "server_unready" to the A10 assertion/route-absent taxonomy for the case
// where the pre-implementation workspace cannot boot at all — capture-enriching only.
export type E4V2NovelScenarioRecord = {
  title: string;
  pre_implementation: "red" | "green";
  failure_mode: "assertion" | "route_absent" | "server_unready" | null; // null when green
};

export type E4V2RedCheckRecord = {
  mode: "executed" | "prose_recorded" | "skipped_behavior_preserving";
  novel_total: number;
  carried_total: number;
  novel_red: number | null; // null when scenarios were not executed (prose arm)
  novel_records: E4V2NovelScenarioRecord[]; // empty when not executed
  green_novel_titles: string[]; // Amendment 2: recorded and echoed, never gating
  prior_green: boolean | null; // carried + prior spec-of-record set, recorded not gating (§6.2.ii)
};

export type E4V2GateEventRecord =
  | { type: "phase_guard_rejection"; phase: E4V2GatePhase; path: string }
  | { type: "custody_failure"; reason: string }
  | { type: "custody_passed"; via: "spec_change" | "behavior_preserving_affirmation" }
  | { type: "discriminating_red_refusal"; novel_total: number; green_novel_titles: string[] }
  | { type: "red_check"; record: E4V2RedCheckRecord }
  | { type: "done_refused"; failing_scenario_titles: string[] }
  | { type: "done_accepted" };

// The manifest projection (v2 analog of E4GateEvents; wired into the v2 manifest at M5).
export type E4V2GateEvents = {
  custody_failures: number;
  discriminating_red_refusals: number;
  refused_done_over_red: number;
  red_check: E4V2RedCheckRecord | null; // null when the task never left the spec phase
};

export type E4V2SpecExitResult =
  | { outcome: "custody_failed"; feedback: string }
  | {
      outcome: "advanced";
      custody_via: "spec_change" | "behavior_preserving_affirmation";
      change_name: string | null; // null on the byte-unchanged affirmation path
      red_check: E4V2RedCheckRecord | null; // null on the affirmation path
    }
  | { outcome: "executor_error"; classification_rationale: string };

export type E4V2DoneClaimResult =
  | { outcome: "accepted"; enforcement_outcome: "accepted"; scenarios_pass: number; scenarios_total: number }
  | {
      outcome: "refused";
      enforcement_outcome: "refused";
      scenarios_pass: number;
      scenarios_total: number;
      failing_scenario_titles: string[];
      feedback: string;
    }
  | { outcome: "executor_error"; classification_rationale: string };

export class E4V2GateStateError extends Error {
  constructor(message: string) {
    super(`[e4-v2-gate] ${message}`);
    this.name = "E4V2GateStateError";
  }
}

function normalizeWorkspacePath(path: string): string | null {
  const normalized = posix.normalize(path.replaceAll("\\", "/"));

  if (normalized.startsWith("/") || normalized === ".." || normalized.startsWith("../")) {
    return null;
  }

  return normalized;
}

function isUnder(normalized: string, prefix: string): boolean {
  return normalized === prefix || normalized.startsWith(`${prefix}/`);
}

const CHANGE_PATH_PATTERN = /^openspec\/changes\/([^/]+)\//;

// Extracts the scenarios an OpenSpec change delta CONTRIBUTES: every scenario under an ADDED or
// MODIFIED requirements section. Scenarios under REMOVED (or RENAMED) sections play no role in
// the red check (§6.2.iv — removed coverage is the meter's business).
export function extractChangeDeltaScenarios(deltaText: string): E4ParsedScenario[] {
  const contributingLines: string[] = [];
  let contributing = false;

  for (const line of deltaText.split(/\r\n|\r|\n/)) {
    const sectionHeader = line.match(/^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$/i);

    if (sectionHeader) {
      contributing = /^(ADDED|MODIFIED)$/i.test(sectionHeader[1]);
      continue;
    }

    if (contributing) {
      contributingLines.push(line);
    }
  }

  return parseOpenSpecScenarioBlocks(contributingLines.join("\n"));
}

export type E4V2GateInput = {
  arm_mode: E4V2ArmMode;
  opportunity_labels: E4OpportunityLabel[];
  // Full openspec/** file map (workspace-relative path → bytes) captured at task start.
  task_start_openspec: Record<string, string>;
  // Closures over the live workspace (the gate never touches disk or spawns processes itself):
  validateChange: (changeName: string) => Promise<{ ok: boolean; detail: string }>;
  previewMergedScenarios: (changeName: string | null) => Promise<E4V2MergePreview>;
  // Hermetic per-scenario execution against the CURRENT workspace. Never called in prose mode.
  runScenarios: (scenarios: E4V2Scenario[]) => Promise<E4V2ScenarioVerdict[]>;
};

export class E4V2TaskGate {
  private phaseState: E4V2GatePhase = "spec";
  private custodyFailures = 0;
  private discriminatingRedRefusals = 0;
  private refusedDoneOverRed = 0;
  private redCheckRecord: E4V2RedCheckRecord | null = null;
  private acceptedChangeName: string | null = null;
  private affirmationExit = false;
  private smokeInvocations: Record<E4TaskPhase, number> = { spec: 0, implementation: 0 };
  private readonly eventLog: E4V2GateEventRecord[] = [];

  constructor(private readonly input: E4V2GateInput) {}

  phase(): E4V2GatePhase {
    return this.phaseState;
  }

  changeName(): string | null {
    return this.acceptedChangeName;
  }

  events(): readonly E4V2GateEventRecord[] {
    return [...this.eventLog];
  }

  summary(): E4V2GateEvents {
    return {
      custody_failures: this.custodyFailures,
      discriminating_red_refusals: this.discriminatingRedRefusals,
      refused_done_over_red: this.refusedDoneOverRed,
      red_check: this.redCheckRecord
    };
  }

  // Phase writability (shared workflow guards, both arms): spec phase — only the agent's change
  // surface (openspec/changes/**, never the harness-owned archive/) is writable; implementation
  // phase — everything EXCEPT openspec/**. The spec-of-record (openspec/specs/**) is agent
  // read-only in every phase: the harness-run archive step is its only mutator (the E1 OpenSpec
  // profile's spec_of_record_mutation_rule, carried into the v2 shared environment).
  evaluateWriteAccess(path: string): { allowed: boolean } {
    const normalized = normalizeWorkspacePath(path);
    let allowed: boolean;

    if (normalized === null || this.phaseState === "closed") {
      allowed = false;
    } else if (isUnder(normalized, "openspec/specs") || isUnder(normalized, "openspec/changes/archive")) {
      allowed = false;
    } else if (this.phaseState === "spec") {
      // Writable spec surface = files inside a named change directory only.
      allowed = CHANGE_PATH_PATTERN.test(normalized);
    } else {
      allowed = !isUnder(normalized, "openspec");
    }

    if (!allowed) {
      this.eventLog.push({ type: "phase_guard_rejection", phase: this.phaseState, path });
    }

    return { allowed };
  }

  recordSmokeInvocation(): void {
    if (this.phaseState === "closed") {
      throw new E4V2GateStateError("smoke invocation recorded after task close");
    }

    this.smokeInvocations[this.phaseState] += 1;
  }

  // Custody + change-level discriminating red (§6.1–§6.2). `currentOpenspec` is the live
  // openspec/** file map at the moment the agent requests the phase exit.
  async attemptSpecExit(currentOpenspec: Record<string, string>): Promise<E4V2SpecExitResult> {
    if (this.phaseState !== "spec") {
      throw new E4V2GateStateError(`attemptSpecExit called in phase ${this.phaseState}`);
    }

    const behaviorPreserving = this.input.opportunity_labels.includes("behavior_preserving");
    const changedPaths = this.diffOpenSpecPaths(currentOpenspec);

    // §3.3 byte-unchanged affirmation path (both arms, behavior-preserving tasks only).
    if (behaviorPreserving && changedPaths.length === 0) {
      if (this.bindCurrentSpecOfRecord(currentOpenspec) === null) {
        return this.custodyFailure(
          "custody affirmation refused: the spec-of-record contains scenarios that do not parse under the sealed step grammar."
        );
      }

      if (this.smokeInvocations.spec < 1) {
        return this.custodyFailure(
          "custody affirmation refused: the verification (smoke) command was not invoked during the spec phase. " +
            "The no-change exit requires a byte-unchanged openspec/ tree plus at least one smoke invocation."
        );
      }

      this.eventLog.push({ type: "custody_passed", via: "behavior_preserving_affirmation" });
      this.affirmationExit = true;
      this.phaseState = "implementation";
      return { outcome: "advanced", custody_via: "behavior_preserving_affirmation", change_name: null, red_check: null };
    }

    // Ordinary custody: the change must be exactly one openspec/changes/<name>/ directory.
    if (changedPaths.length === 0) {
      return this.custodyFailure(
        "custody check failed: the openspec/ tree is unchanged since task start. Propose the change under " +
          "openspec/changes/<change-name>/ (proposal.md, tasks.md, and delta specs), then request the gate check again."
      );
    }

    const outsideChangePaths = changedPaths.filter((path) => !CHANGE_PATH_PATTERN.test(path));

    if (outsideChangePaths.length > 0) {
      return this.custodyFailure(
        `custody check failed: files outside openspec/changes/ were modified (${outsideChangePaths.join(", ")}); ` +
          "the spec-of-record is updated only by the harness-run archive step."
      );
    }

    const changeNames = [...new Set(changedPaths.map((path) => path.match(CHANGE_PATH_PATTERN)![1]))].toSorted();

    if (changeNames.includes("archive")) {
      return this.custodyFailure("custody check failed: openspec/changes/archive/ is harness-owned and never a task change.");
    }

    if (changeNames.length !== 1) {
      return this.custodyFailure(
        `custody check failed: expected exactly one change directory for this task, found ${changeNames.length} ` +
          `(${changeNames.join(", ")}).`
      );
    }

    const changeName = changeNames[0];
    const deltaSpecPaths = Object.keys(currentOpenspec)
      .filter((path) => path.startsWith(`openspec/changes/${changeName}/specs/`) && path.endsWith(".md"))
      .toSorted();

    if (deltaSpecPaths.length === 0) {
      return this.custodyFailure(
        `custody check failed: change "${changeName}" contains no delta specs under specs/<capability>/spec.md.`
      );
    }

    // Parse + bind every contributed scenario; A8 floors per scenario (§6.1).
    const changeScenarios: E4V2Scenario[] = [];

    for (const path of deltaSpecPaths) {
      for (const parsed of extractChangeDeltaScenarios(currentOpenspec[path])) {
        const bound = bindScenario(parsed);

        if (!bound.ok) {
          const first = bound.violations[0];
          return this.custodyFailure(
            `custody check failed: scenario "${first.scenario_title}" has an illegal step — "${first.step_text}" ` +
              `(${first.reason}). Every step must match the sealed step vocabulary documented in README.md.`
          );
        }

        const floorViolations = scenarioFloorViolations(bound.scenario);

        if (floorViolations.length > 0) {
          return this.custodyFailure(
            `custody check failed: scenario "${bound.scenario.title}" violates the scenario floors: ${floorViolations.join("; ")}.`
          );
        }

        changeScenarios.push(bound.scenario);
      }
    }

    if (changeScenarios.length === 0) {
      return this.custodyFailure(
        `custody check failed: change "${changeName}" adds or modifies no scenarios; every change must carry executable scenarios.`
      );
    }

    // openspec validate <change> --strict (§6.1 "openspec validate passes", wired live).
    const validation = await this.input.validateChange(changeName);

    if (!validation.ok) {
      return this.custodyFailure(`custody check failed: openspec validate rejected change "${changeName}": ${validation.detail}`);
    }

    // Archive-preview: the change must be mechanically archivable (the pinned CLI aborts whole
    // archives on e.g. MODIFIED-against-missing-requirement or an empty capability rebuild).
    const preview = await this.input.previewMergedScenarios(changeName);

    if (!preview.ok) {
      return this.custodyFailure(`custody check failed: change "${changeName}" is not archivable: ${preview.reason}.`);
    }

    this.eventLog.push({ type: "custody_passed", via: "spec_change" });

    // §6.2 novelty under the pinned canonicalizer semantics: canonical-form membership against
    // the CURRENT spec-of-record, regardless of ADDED/MODIFIED block position.
    const specOfRecordScenarios = this.bindTaskStartSpecOfRecord();
    const recordCanonical = new Set(specOfRecordScenarios.map((scenario) => canonicalScenarioBody(scenario)));
    const novel = changeScenarios.filter((scenario) => !recordCanonical.has(canonicalScenarioBody(scenario)));
    const carried = changeScenarios.filter((scenario) => recordCanonical.has(canonicalScenarioBody(scenario)));

    // §6.2 is the EXECUTED arm's machinery: the ≥1-novel requirement (like the ≥1-red rule) never
    // gates the prose arm, whose custody is floors-only (§6 prose-arm paragraph — "spec must
    // change, parse, floors pass"). A zero-novel prose change is measured drift, not a refusal.
    if (this.input.arm_mode === "executed" && !behaviorPreserving && novel.length === 0) {
      this.discriminatingRedRefusals += 1;
      this.eventLog.push({ type: "discriminating_red_refusal", novel_total: 0, green_novel_titles: [] });
      return {
        outcome: "custody_failed",
        feedback:
          "spec-exit refused: the change adds no scenario that discriminates the requested change — every scenario in the " +
          "change already exists in the spec-of-record. Add at least one new scenario describing the changed behavior."
      };
    }

    if (this.input.arm_mode === "prose") {
      // Prose arm: custody only; scenarios are never executed (§6, prose-arm paragraph).
      this.redCheckRecord = {
        mode: "prose_recorded",
        novel_total: novel.length,
        carried_total: carried.length,
        novel_red: null,
        novel_records: [],
        green_novel_titles: [],
        prior_green: null
      };
      this.eventLog.push({ type: "red_check", record: this.redCheckRecord });
      this.acceptedChangeName = changeName;
      this.phaseState = "implementation";
      return { outcome: "advanced", custody_via: "spec_change", change_name: changeName, red_check: this.redCheckRecord };
    }

    // Executed arm: run every novel scenario against the current (pre-implementation) workspace
    // and record red/green + failure mode (§6.2, A10).
    const novelVerdicts = await this.input.runScenarios(novel);
    const executorError = novelVerdicts.find((verdict) => verdict.kind === "executor_error");

    if (executorError && executorError.kind === "executor_error") {
      return { outcome: "executor_error", classification_rationale: executorError.classification_rationale };
    }

    const novelRecords: E4V2NovelScenarioRecord[] = novelVerdicts.map((verdict) => {
      if (verdict.kind === "readiness_failed") {
        return { title: verdict.title, pre_implementation: "red", failure_mode: "server_unready" };
      }

      if (verdict.kind === "completed" && !verdict.passed) {
        return { title: verdict.title, pre_implementation: "red", failure_mode: verdict.failure_mode ?? "assertion" };
      }

      return { title: verdict.title, pre_implementation: "green", failure_mode: null };
    });
    const greenNovelTitles = novelRecords.filter((record) => record.pre_implementation === "green").map((record) => record.title);
    const novelRed = novelRecords.length - greenNovelTitles.length;

    // §6.2.ii: carried scenarios + the prior spec-of-record set — executed and RECORDED, never
    // gating (the agent may be mid-flight; done-claim cumulative green is the enforcement point).
    const priorVerdicts = await this.input.runScenarios([...carried, ...specOfRecordScenarios]);
    const priorGreen = priorVerdicts.every((verdict) => verdict.kind === "completed" && verdict.passed);

    if (!behaviorPreserving && novelRed === 0) {
      // Change-level all-green refusal (A2's anti-tautology core, change-level per Amendment 2).
      this.discriminatingRedRefusals += 1;
      this.eventLog.push({ type: "discriminating_red_refusal", novel_total: novel.length, green_novel_titles: greenNovelTitles });
      return {
        outcome: "custody_failed",
        feedback:
          "spec-exit refused: the change adds no scenario that discriminates the requested change — every novel scenario " +
          `already passes on the current implementation (${greenNovelTitles.join(", ")}). At least one new scenario must fail ` +
          "before the implementation exists."
      };
    }

    this.redCheckRecord = {
      mode: behaviorPreserving ? "skipped_behavior_preserving" : "executed",
      novel_total: novel.length,
      carried_total: carried.length,
      novel_red: novelRed,
      novel_records: novelRecords,
      green_novel_titles: greenNovelTitles,
      prior_green: priorGreen
    };
    this.eventLog.push({ type: "red_check", record: this.redCheckRecord });
    this.acceptedChangeName = changeName;
    this.phaseState = "implementation";

    return { outcome: "advanced", custody_via: "spec_change", change_name: changeName, red_check: this.redCheckRecord };
  }

  // Done-claim (§6.3): executed arm — the FULL cumulative scenario set (spec-of-record + this
  // change, merged via real archive semantics) must pass; prose arm — accepted as in v1's
  // ungated arms.
  async submitDoneClaim(): Promise<E4V2DoneClaimResult> {
    if (this.phaseState === "spec") {
      throw new E4V2GateStateError("done-claim submitted in spec phase — route the done_literal to attemptSpecExit");
    }

    if (this.phaseState === "closed") {
      throw new E4V2GateStateError("done-claim submitted after task close");
    }

    if (this.input.arm_mode === "prose") {
      this.eventLog.push({ type: "done_accepted" });
      this.phaseState = "closed";
      return { outcome: "accepted", enforcement_outcome: "accepted", scenarios_pass: 0, scenarios_total: 0 };
    }

    const preview = await this.input.previewMergedScenarios(this.affirmationExit ? null : this.acceptedChangeName);

    if (!preview.ok) {
      // Custody verified archivability at spec exit and the change is frozen afterwards, so a
      // failing preview here is harness-infrastructure territory.
      return { outcome: "executor_error", classification_rationale: `cumulative merge preview failed at done-claim: ${preview.reason}` };
    }

    const verdicts = await this.input.runScenarios(preview.scenarios);
    const executorError = verdicts.find((verdict) => verdict.kind === "executor_error");

    if (executorError && executorError.kind === "executor_error") {
      return { outcome: "executor_error", classification_rationale: executorError.classification_rationale };
    }

    const failing = verdicts.filter((verdict) => verdict.kind !== "completed" || !verdict.passed);
    const pass = verdicts.length - failing.length;

    if (failing.length === 0) {
      this.eventLog.push({ type: "done_accepted" });
      this.phaseState = "closed";
      return { outcome: "accepted", enforcement_outcome: "accepted", scenarios_pass: pass, scenarios_total: verdicts.length };
    }

    this.refusedDoneOverRed += 1;
    const failingTitles = failing.map((verdict) => verdict.title);
    this.eventLog.push({ type: "done_refused", failing_scenario_titles: failingTitles });

    const failureLines = failing.map((verdict) =>
      verdict.kind === "completed"
        ? `- ${verdict.title}: ${verdict.failures.join("; ")}`
        : `- ${verdict.title}: the app failed to become ready`
    );

    return {
      outcome: "refused",
      enforcement_outcome: "refused",
      scenarios_pass: pass,
      scenarios_total: verdicts.length,
      failing_scenario_titles: failingTitles,
      feedback: `done-claim refused: ${failing.length} scenario(s) in the spec are failing:\n${failureLines.join("\n")}`
    };
  }

  private custodyFailure(feedback: string): E4V2SpecExitResult {
    this.custodyFailures += 1;
    this.eventLog.push({ type: "custody_failure", reason: feedback });
    return { outcome: "custody_failed", feedback };
  }

  private diffOpenSpecPaths(currentOpenspec: Record<string, string>): string[] {
    const changed: string[] = [];
    const paths = new Set([...Object.keys(this.input.task_start_openspec), ...Object.keys(currentOpenspec)]);

    for (const path of [...paths].toSorted()) {
      if (this.input.task_start_openspec[path] !== currentOpenspec[path]) {
        changed.push(path);
      }
    }

    return changed;
  }

  private bindTaskStartSpecOfRecord(): E4V2Scenario[] {
    return this.bindRecordScenarios(this.input.task_start_openspec, true) ?? [];
  }

  private bindCurrentSpecOfRecord(currentOpenspec: Record<string, string>): E4V2Scenario[] | null {
    return this.bindRecordScenarios(currentOpenspec, false);
  }

  private bindRecordScenarios(tree: Record<string, string>, failLoud: boolean): E4V2Scenario[] | null {
    const scenarios: E4V2Scenario[] = [];
    const recordPaths = Object.keys(tree)
      .filter((path) => path.startsWith("openspec/specs/") && path.endsWith("spec.md"))
      .toSorted();

    for (const path of recordPaths) {
      for (const parsed of parseOpenSpecScenarioBlocks(tree[path])) {
        const bound = bindScenario(parsed);

        if (!bound.ok) {
          if (failLoud) {
            // Custody binds every change scenario in both arms before it can be archived into the
            // record, and T0 is generator-emitted — an unbindable record scenario is harness
            // corruption, never agent behavior.
            throw new E4V2GateStateError(`spec-of-record scenario failed to bind (${path}): ${JSON.stringify(bound.violations)}`);
          }

          return null;
        }

        scenarios.push(bound.scenario);
      }
    }

    return scenarios;
  }
}
