// Arm-H gate sequencing state machine (ADR-003; IMPLEMENTATION-PLAN.md M3; architecture Feature 3).
// The gate is the E4 acceptance oracle run inverted in time: this module owns WHEN the shared
// executor runs and WHAT is done with the verdict — phase guards, custody, red check, and the
// done-over-red refusal (the Claim-B/B1 lever). It contains no execution engine of its own.
//
// [R2: R2-3] Tautology defense, enforced by construction and by test: the gate — the no-change
// affirmation included — consults NO meter and NO ground-truth state at any point. Its only inputs
// are the agent-visible spec artifact bytes, the harness-generated acceptance test sets, and the
// shared executor's verdicts. test/e4-gate.test.ts asserts this module never imports the meter,
// the IR, or the substrate provider; the conventions-grammar check below is a deliberate local
// re-implementation of the ADR-004 line grammar, NOT an import from src/e4/meter/extract.ts.
//
// The gate enforces custody and sequencing, never spec accuracy (Gate-1 change 2a): an agent can
// satisfy every check here while writing a wrong or stale spec, and that drift is scored by the
// post-task meter exactly as in arms 0/M.
import { posix } from "node:path";
import type { E4GateEvents } from "./manifest";
import type { E4HttpTest } from "./substrate/testgen";
import type { E4OpportunityLabel, E4TaskPhase } from "./types";
import type { E4ExecutorCompleted, E4ExecutorResult } from "./oracle-executor";

export type E4GatePhase = E4TaskPhase | "closed";

export type E4SpecArtifactSnapshot = {
  openapi_json: string;
  conventions_md: string;
};

// The gate never touches disk or spawns servers itself: the runner (M4) supplies the executor as
// a closure over the live workspace, so red check, green check, and the hidden oracle are one
// engine (ADR-006 — the E3 gate/scorer-parity caveat, designed out).
export type E4GateExecutorRunner = (tests: E4HttpTest[]) => Promise<E4ExecutorResult>;

export type E4GateRedCheckOutcome = "red" | "green_anomaly" | "skipped_behavior_preserving";

export type E4GateEventRecord =
  | { type: "phase_guard_rejection"; phase: E4GatePhase; path: string }
  | { type: "custody_failure"; reason: string }
  | { type: "custody_passed"; via: "spec_change" | "behavior_preserving_affirmation" }
  | { type: "behavior_preserving_affirmed" }
  | { type: "red_check"; result: E4GateRedCheckOutcome; delta_failures: number; prior_cumulative_green: boolean | null }
  | { type: "gate_anomaly_green_red_check" }
  | { type: "done_refused"; failing_test_ids: string[] }
  | { type: "done_accepted" };

export type E4OracleCounts = {
  delta_pass: number;
  delta_total: number;
  cumulative_pass: number;
  cumulative_total: number;
};

export type E4SpecExitResult =
  | { outcome: "custody_failed"; feedback: string }
  | {
      outcome: "advanced";
      custody_via: "spec_change" | "behavior_preserving_affirmation";
      red_check: E4GateRedCheckOutcome;
      delta_failures: number;
      prior_cumulative_green: boolean | null; // null when the red check was skipped
    }
  | { outcome: "executor_error"; classification_rationale: string };

export type E4DoneClaimResult =
  | { outcome: "accepted"; enforcement_outcome: "accepted"; oracle: E4OracleCounts }
  | {
      outcome: "refused";
      enforcement_outcome: "refused";
      oracle: E4OracleCounts;
      failing_test_ids: string[];
      feedback: string; // the failing results, injected back into the turn loop (ADR-003 step 4)
    }
  | { outcome: "executor_error"; classification_rationale: string };

export class E4GateStateError extends Error {
  constructor(message: string) {
    super(`[e4-gate] ${message}`);
    this.name = "E4GateStateError";
  }
}

function jsonParses(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

// Gate-local ADR-004 grammar check (custody pin): every line that ATTEMPTS the normative bullet
// grammar (prefix "- `") must fully match `- \`<convention-id>\`: <statement>`, and at least one
// conforming bullet must exist. Free prose — including plain "- " bullets — stays permitted and
// unchecked (ADR-004). A file with zero conforming bullets carries no meterable normative items
// and therefore fails custody parsing.
export function e4ConventionsGrammarOk(markdown: string): boolean {
  const attempted = markdown.split("\n").filter((line) => line.startsWith("- `"));

  if (attempted.length === 0) {
    return false;
  }

  return attempted.every((line) => /^- `[^`]+`: .+$/.test(line));
}

function normalizeWorkspacePath(path: string): string | null {
  const normalized = posix.normalize(path.replaceAll("\\", "/"));

  // Absolute paths and traversal out of the workspace are never writable in a gated task — the
  // guard decision must be a pure function of the workspace-relative path.
  if (normalized.startsWith("/") || normalized === ".." || normalized.startsWith("../")) {
    return null;
  }

  return normalized;
}

function isSpecPath(normalized: string): boolean {
  return normalized === "specs" || normalized.startsWith("specs/");
}

const AFFIRMATION_CONDITIONS_TEXT =
  "the no-change exit requires all of: (i) both spec artifacts parse cleanly, " +
  "(ii) both spec artifacts are byte-identical to task start, and " +
  "(iii) the designated verification (smoke) command was invoked at least once during the spec phase";

export class E4ArmHTaskGate {
  private phaseState: E4GatePhase = "spec";
  private custodyFailures = 0;
  private refusedDoneOverRed = 0;
  private redCheckOutcome: E4GateRedCheckOutcome | null = null;
  private smokeInvocations: Record<E4TaskPhase, number> = { spec: 0, implementation: 0 };
  private readonly eventLog: E4GateEventRecord[] = [];

  constructor(
    private readonly input: {
      opportunity_labels: E4OpportunityLabel[];
      task_start_spec: E4SpecArtifactSnapshot;
      tests: {
        delta: E4HttpTest[];
        cumulative: E4HttpTest[];
        // Task k-1's cumulative set (T0's for the first task): the red check asserts it stays
        // green while the delta set fails (ADR-003 step 2).
        prior_cumulative: E4HttpTest[];
      };
      runExecutor: E4GateExecutorRunner;
    }
  ) {}

  phase(): E4GatePhase {
    return this.phaseState;
  }

  events(): readonly E4GateEventRecord[] {
    return [...this.eventLog];
  }

  // Manifest projection (E4GateEvents, M0 type). red_check is null only when the task never left
  // the spec phase (budget exhaustion in spec phase — plan §2 M3 / ADR-003 edge case); the M4
  // runner records phase_at_termination alongside, which disambiguates.
  summary(): { custody_failures: number; red_check: E4GateEvents["red_check"] | null; refused_done_over_red: number } {
    return {
      custody_failures: this.custodyFailures,
      red_check: this.redCheckOutcome,
      refused_done_over_red: this.refusedDoneOverRed
    };
  }

  // ADR-003 phase writability, whitelist semantics: spec phase — only specs/ paths are writable;
  // implementation phase — everything EXCEPT specs/ is writable (single-mutator custody rule per
  // phase). This decision supersedes the prefix-list skeleton in arm-policy.ts for Arm H; the M4
  // runner must route every FILE-replacement path through here when gate_enabled.
  evaluateWriteAccess(path: string): { allowed: boolean } {
    const normalized = normalizeWorkspacePath(path);
    let allowed: boolean;

    if (normalized === null || this.phaseState === "closed") {
      allowed = false;
    } else if (this.phaseState === "spec") {
      allowed = isSpecPath(normalized);
    } else {
      allowed = !isSpecPath(normalized);
    }

    if (!allowed) {
      this.eventLog.push({ type: "phase_guard_rejection", phase: this.phaseState, path });
    }

    return { allowed };
  }

  // Condition (iii) of the §3.3 affirmation handshake is fed from here: the runner reports every
  // invocation of the sealed verification (smoke) command, and the gate counts it per phase.
  recordSmokeInvocation(): void {
    if (this.phaseState === "closed") {
      throw new E4GateStateError("smoke invocation recorded after task close");
    }

    this.smokeInvocations[this.phaseState] += 1;
  }

  // Custody + red check (ADR-003 steps 2–3): the runner calls this when the agent emits the
  // done_literal during the spec phase (the protocol's phase-exit request — no new grammar token).
  async attemptSpecExit(currentSpec: E4SpecArtifactSnapshot): Promise<E4SpecExitResult> {
    if (this.phaseState !== "spec") {
      throw new E4GateStateError(`attemptSpecExit called in phase ${this.phaseState}`);
    }

    const behaviorPreserving = this.input.opportunity_labels.includes("behavior_preserving");
    const changed =
      currentSpec.openapi_json !== this.input.task_start_spec.openapi_json ||
      currentSpec.conventions_md !== this.input.task_start_spec.conventions_md;
    const parsesCleanly = jsonParses(currentSpec.openapi_json) && e4ConventionsGrammarOk(currentSpec.conventions_md);

    let custodyVia: "spec_change" | "behavior_preserving_affirmation";

    if (behaviorPreserving && !changed) {
      // §3.3 affirmation via the existing verification channel. [R2: R2-3] deliberately consults
      // no meter or ground-truth state: inherited staleness never blocks the affirmation.
      if (!parsesCleanly) {
        return this.custodyFailure(
          `custody affirmation refused: the spec artifacts do not parse cleanly (specs/openapi.json must parse as JSON; ` +
            `specs/CONVENTIONS.md must conform to the bullet grammar). Note: ${AFFIRMATION_CONDITIONS_TEXT}.`
        );
      }

      if (this.smokeInvocations.spec < 1) {
        return this.custodyFailure(
          `custody affirmation refused: the verification (smoke) command was not invoked during the spec phase. ` +
            `Note: ${AFFIRMATION_CONDITIONS_TEXT}.`
        );
      }

      this.eventLog.push({ type: "behavior_preserving_affirmed" });
      custodyVia = "behavior_preserving_affirmation";
    } else {
      // Ordinary custody path (ADR-003 step 2): changed AND parseable, never "correct". An agent
      // that edited the spec on a behavior-preserving task lands here too ([R2: R2-3]).
      if (!changed) {
        return this.custodyFailure(
          "custody check failed: the spec artifacts are unchanged since task start. Update specs/openapi.json and/or " +
            "specs/CONVENTIONS.md to describe the requested change, then request the gate check again."
        );
      }

      if (!parsesCleanly) {
        return this.custodyFailure(
          "custody check failed: the spec artifacts do not parse cleanly (specs/openapi.json must parse as JSON; " +
            "specs/CONVENTIONS.md bullets must match the grammar `- \\`<convention-id>\\`: <statement>`)."
        );
      }

      custodyVia = "spec_change";
    }

    this.eventLog.push({ type: "custody_passed", via: custodyVia });

    // Behavior-preserving tasks skip the red check regardless of custody path (ADR-003 edge case:
    // the label controls the skip, custody still ran above).
    if (behaviorPreserving) {
      this.redCheckOutcome = "skipped_behavior_preserving";
      this.eventLog.push({
        type: "red_check",
        result: "skipped_behavior_preserving",
        delta_failures: 0,
        prior_cumulative_green: null
      });
      this.phaseState = "implementation";
      return {
        outcome: "advanced",
        custody_via: custodyVia,
        red_check: "skipped_behavior_preserving",
        delta_failures: 0,
        prior_cumulative_green: null
      };
    }

    const deltaRun = await this.input.runExecutor(this.input.tests.delta);

    if (deltaRun.kind === "executor_error") {
      return { outcome: "executor_error", classification_rationale: deltaRun.classification_rationale };
    }

    const priorRun = await this.input.runExecutor(this.input.tests.prior_cumulative);

    if (priorRun.kind === "executor_error") {
      return { outcome: "executor_error", classification_rationale: priorRun.classification_rationale };
    }

    // [R1-B1] an agent-caused readiness failure scores every test in the set as failed — at the
    // red check that reads as "delta red" (the sequence continues; it is never laundered into
    // executor_error).
    const deltaFailures =
      deltaRun.kind === "completed" ? deltaRun.verdicts.filter((verdict) => !verdict.passed).length : this.input.tests.delta.length;
    const priorCumulativeGreen = priorRun.kind === "completed" && priorRun.pass_count === priorRun.total;

    let redCheck: E4GateRedCheckOutcome;

    if (deltaFailures === 0) {
      // Green delta pre-implementation: vacuous task or guard breach (ADR-003 edge case). The
      // task proceeds; the sequence is flagged for review via this recorded anomaly.
      redCheck = "green_anomaly";
      this.eventLog.push({ type: "gate_anomaly_green_red_check" });
    } else {
      redCheck = "red";
    }

    this.redCheckOutcome = redCheck;
    this.eventLog.push({ type: "red_check", result: redCheck, delta_failures: deltaFailures, prior_cumulative_green: priorCumulativeGreen });
    this.phaseState = "implementation";

    return {
      outcome: "advanced",
      custody_via: custodyVia,
      red_check: redCheck,
      delta_failures: deltaFailures,
      prior_cumulative_green: priorCumulativeGreen
    };
  }

  // Green check on the done-claim (ADR-003 step 4, the Claim-B/B1 lever): done over green is
  // accepted; done over red is REFUSED — the failing results are returned as feedback and the
  // turn loop continues until green or budget exhaustion.
  async submitDoneClaim(): Promise<E4DoneClaimResult> {
    if (this.phaseState === "spec") {
      throw new E4GateStateError("done-claim submitted in spec phase — route the done_literal to attemptSpecExit");
    }

    if (this.phaseState === "closed") {
      throw new E4GateStateError("done-claim submitted after task close");
    }

    const run = await this.input.runExecutor(this.input.tests.cumulative);

    if (run.kind === "executor_error") {
      return { outcome: "executor_error", classification_rationale: run.classification_rationale };
    }

    const oracle = this.oracleCounts(run.kind === "completed" ? run : null);

    if (run.kind === "readiness_failed") {
      // Agent-broken server at the green check: every test fails, the claim is refused, the loop
      // continues ([R1-B1] — this stays in agent-behavior accounting).
      const failingIds = this.input.tests.cumulative.map((test) => test.test_id);
      this.refusedDoneOverRed += 1;
      this.eventLog.push({ type: "done_refused", failing_test_ids: failingIds });

      return {
        outcome: "refused",
        enforcement_outcome: "refused",
        oracle,
        failing_test_ids: failingIds,
        feedback: `done-claim refused: the app failed to become ready (${run.reason}); every acceptance check is failing.`
      };
    }

    const failing = run.verdicts.filter((verdict) => !verdict.passed);

    if (failing.length === 0) {
      this.eventLog.push({ type: "done_accepted" });
      this.phaseState = "closed";
      return { outcome: "accepted", enforcement_outcome: "accepted", oracle };
    }

    this.refusedDoneOverRed += 1;
    const failingIds = failing.map((verdict) => verdict.test_id);
    this.eventLog.push({ type: "done_refused", failing_test_ids: failingIds });

    const failureLines = failing.map((verdict) => `- ${verdict.test_id}: ${verdict.failures.join("; ")}`);

    return {
      outcome: "refused",
      enforcement_outcome: "refused",
      oracle,
      failing_test_ids: failingIds,
      feedback: `done-claim refused: ${failing.length} acceptance check(s) are failing:\n${failureLines.join("\n")}`
    };
  }

  private custodyFailure(feedback: string): E4SpecExitResult {
    this.custodyFailures += 1;
    this.eventLog.push({ type: "custody_failure", reason: feedback });
    return { outcome: "custody_failed", feedback };
  }

  private oracleCounts(run: E4ExecutorCompleted | null): E4OracleCounts {
    const deltaIds = new Set(this.input.tests.delta.map((test) => test.test_id));

    if (run === null) {
      return {
        delta_pass: 0,
        delta_total: this.input.tests.delta.length,
        cumulative_pass: 0,
        cumulative_total: this.input.tests.cumulative.length
      };
    }

    return {
      delta_pass: run.verdicts.filter((verdict) => deltaIds.has(verdict.test_id) && verdict.passed).length,
      delta_total: this.input.tests.delta.length,
      cumulative_pass: run.pass_count,
      cumulative_total: run.total
    };
  }
}
