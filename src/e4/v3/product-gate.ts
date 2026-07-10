// E4 v3-M3 (E4V3-PRODUCT-LOOP-PROPOSAL.md §3): the product arm's gate — the HIT-SDD loop as it
// would ship. Composes the UNCHANGED v2 task gate (the naked-execution arm keeps using that
// class directly; scenario execution semantics are byte-identical) with the product checks:
//
//   spec exit — PM spec review (pm-review.ts) runs BEFORE delegation: flags are a refusal with
//     feedback and the phase stays "spec" (the v2 gate advances state on success, so pre-checks
//     are the only clean composition point). Malformed change shapes skip review and fall
//     through to the inner gate's proper custody failure.
//   done claim — reconciliation (reconcile.ts, blocking-check subset) then agent-side mutation
//     (mutation.ts, sealed kill floor) run before delegation; either failing is a refusal with
//     feedback and the phase stays "implementation". A baseline-red suite skips the product
//     refusals (the inner gate's failing-scenario feedback is the primary signal there).
//
// Like the v2 gate, this class never reads ground truth: the PM review's inputs are bounded by
// what was communicated (request-determined facts + the delivered brief), and reconciliation and
// mutation read only the agent's own artifacts. Product events are recorded SEPARATELY from the
// v2 gate-event summary (manifest additions are additive).
import type { E4SurfaceDumpResult } from "../meter/types";
import { extractChangeDeltaScenarios, E4V2TaskGate, type E4V2DoneClaimResult, type E4V2GateEvents, type E4V2GateInput, type E4V2GatePhase, type E4V2SpecExitResult } from "../v2/gate";
import { bindScenario } from "../v2/step-table";
import type { E4V2Scenario } from "../v2/scenario";
import { reconcileE4SpecAndCode, type E4V3ReconcileCheck, type E4V3ReconcileFinding } from "./reconcile";
import type { E4V3MutationReport } from "./mutation";
import { reviewE4ProposedScenarios, type E4V3PmReviewFlag } from "./pm-review";
import type { E4TaskDelta } from "./task-delta";

export const E4_V3_PRODUCT_GATE_ID = "e4-product-gate-v1";

export type E4V3ProductGateConfig = {
  mutation_kill_floor: number; // sealed below the T0 anchor (1.0) at the v3 constants freeze
  blocking_checks: E4V3ReconcileCheck[];
};

// DRAFT values (v3-M3); ratified and sealed into the v3 constants file at the v3-M4 freeze.
// Kill floor 5/6 = one survivor tolerated (T0 anchor kills 6/6; the adjudication addendum pins
// "sealed below the anchor"). field_never_exercised is advisory-only (noisy on optional fields).
export const E4_V3_DRAFT_PRODUCT_CONFIG: E4V3ProductGateConfig = {
  mutation_kill_floor: 5 / 6,
  blocking_checks: [
    "route_without_scenario",
    "scenario_route_absent",
    "rule_without_rejection_scenario",
    "rejection_scenario_without_rule",
    "scenario_field_unknown",
    "scenario_floor",
    "create_round_trip_missing",
    "rejection_case_missing"
  ]
};

// The product arm's declared policy-channel addition (appended to the executed-arm gate
// protocol). Draft wording; seals under the v3 constants protocol_text at the freeze.
export const E4_V3_PRODUCT_GATE_PROTOCOL_TEXT = [
  "Additionally, this workspace runs a product quality gate on your done-claims:",
  "- The spec and the implementation must reconcile: every route needs a scenario, every scenario's route must exist, every enforced validation rule needs a rejection scenario (and vice versa), and scenarios may only use fields the code carries. Each entity needs a create-and-read-back scenario and a rejection scenario.",
  "- Your scenario suite must be strong enough to fail on deliberately broken variants of your implementation (wrong statuses, ignored writes, leaked fields, ignored filters, empty lists, accepted invalid input). If it is too weak, the done-claim is refused with the variants it missed.",
  "- Before implementation starts, the product manager reviews your proposed scenarios against the communicated requirements and refuses approval on contradictions or missed communicated operations."
].join("\n");

export type E4V3ProductGateSummary = {
  pm_review_refusals: number;
  reconcile_refusals: number;
  mutation_refusals: number;
  pm_review_flags_total: number;
  last_reconcile_finding_count: number | null;
  last_kill_score: number | null;
  reconcile_unavailable_count: number; // dump extraction failed — recorded, never a refusal
};

const MAX_FEEDBACK_ITEMS = 10;

function formatFindings(findings: E4V3ReconcileFinding[]): string {
  const lines = findings.slice(0, MAX_FEEDBACK_ITEMS).map((finding) => `- ${finding.message}`);

  if (findings.length > MAX_FEEDBACK_ITEMS) {
    lines.push(`- (${findings.length - MAX_FEEDBACK_ITEMS} more)`);
  }

  return lines.join("\n");
}

const MUTANT_DESCRIPTIONS: Record<string, string> = {
  "accept-invalid": "a version of the app that ACCEPTS invalid write requests instead of rejecting them",
  "status-swap": "a version of the app that returns 200 where 201/404 are expected",
  "swallow-write": "a version of the app whose updates and deletes silently do nothing",
  "field-leak": "a version of the app that leaks an undocumented field in its responses",
  "strip-filter": "a version of the app that ignores list query filters",
  "empty-list": "a version of the app whose list endpoints return empty results"
};

export class E4V3ProductTaskGate {
  private readonly inner: E4V2TaskGate;
  private custodyVia: "spec_change" | "behavior_preserving_affirmation" | null = null;
  private summaryState: E4V3ProductGateSummary = {
    pm_review_refusals: 0,
    reconcile_refusals: 0,
    mutation_refusals: 0,
    pm_review_flags_total: 0,
    last_reconcile_finding_count: null,
    last_kill_score: null,
    reconcile_unavailable_count: 0
  };

  constructor(
    private readonly input: E4V2GateInput & {
      delta: E4TaskDelta;
      briefDelivered: () => boolean;
      extractDump: () => Promise<E4SurfaceDumpResult>;
      runMutationAnalysis: (scenarios: E4V2Scenario[]) => Promise<E4V3MutationReport>;
      productConfig: E4V3ProductGateConfig;
    }
  ) {
    this.inner = new E4V2TaskGate(input);
  }

  phase(): E4V2GatePhase {
    return this.inner.phase();
  }

  changeName(): string | null {
    return this.inner.changeName();
  }

  summary(): E4V2GateEvents {
    return this.inner.summary();
  }

  productSummary(): E4V3ProductGateSummary {
    return { ...this.summaryState };
  }

  evaluateWriteAccess(path: string): { allowed: boolean } {
    return this.inner.evaluateWriteAccess(path);
  }

  recordSmokeInvocation(): void {
    this.inner.recordSmokeInvocation();
  }

  async attemptSpecExit(currentOpenspec: Record<string, string>): Promise<E4V2SpecExitResult> {
    const flags = this.pmReviewFlags(currentOpenspec);

    if (flags.length > 0) {
      this.summaryState.pm_review_refusals += 1;
      this.summaryState.pm_review_flags_total += flags.length;

      const lines = flags.slice(0, MAX_FEEDBACK_ITEMS).map((flag) => `- ${flag.message}`);

      return {
        outcome: "custody_failed",
        feedback: `spec review: the product manager reviewed the proposed scenarios against the communicated requirements and cannot approve them yet:\n${lines.join("\n")}`
      };
    }

    const result = await this.inner.attemptSpecExit(currentOpenspec);

    if (result.outcome === "advanced") {
      this.custodyVia = result.custody_via;
    }

    return result;
  }

  async submitDoneClaim(): Promise<E4V2DoneClaimResult> {
    if (this.inner.phase() !== "implementation") {
      return this.inner.submitDoneClaim(); // proper state errors stay the inner gate's business
    }

    const preview = await this.input.previewMergedScenarios(
      this.custodyVia === "behavior_preserving_affirmation" ? null : this.inner.changeName()
    );

    if (!preview.ok) {
      return this.inner.submitDoneClaim(); // executor_error path, same as inner would produce
    }

    // 1. Reconciliation (static, cheap). Dump extraction failure is recorded and skipped — the
    // gate adds no failure class beyond v2's; workspace breakage stays the meter's measurement.
    const dump = await this.input.extractDump();

    if ("extraction_failed" in dump) {
      this.summaryState.reconcile_unavailable_count += 1;
    } else {
      const report = reconcileE4SpecAndCode({ dump, scenarios: preview.scenarios });
      const blocking = report.findings.filter((finding) =>
        this.input.productConfig.blocking_checks.includes(finding.check)
      );

      this.summaryState.last_reconcile_finding_count = blocking.length;

      if (blocking.length > 0) {
        this.summaryState.reconcile_refusals += 1;

        return {
          outcome: "refused",
          enforcement_outcome: "refused",
          scenarios_pass: 0,
          scenarios_total: preview.scenarios.length,
          failing_scenario_titles: [],
          feedback: `done-claim refused by the product gate: the spec and the implementation do not reconcile:\n${formatFindings(blocking)}`
        };
      }
    }

    // 2. Agent-side mutation adequacy. A baseline-red suite defers to the inner gate's standard
    // failing-scenario refusal (the primary signal); unevaluable mutants count against the floor
    // (fail-closed).
    const mutation = await this.input.runMutationAnalysis(preview.scenarios);

    this.summaryState.last_kill_score = mutation.kill_score;

    const baselineRed = mutation.baseline_failed_titles.length > 0 || mutation.baseline_non_completed_titles.length > 0;

    if (!baselineRed && (mutation.kill_score === null || mutation.kill_score < this.input.productConfig.mutation_kill_floor)) {
      this.summaryState.mutation_refusals += 1;

      const survivors = mutation.mutants
        .filter((mutant) => mutant.status !== "killed")
        .map((mutant) => `- ${MUTANT_DESCRIPTIONS[mutant.mutant_id] ?? mutant.mutant_id} passed every scenario`);

      return {
        outcome: "refused",
        enforcement_outcome: "refused",
        scenarios_pass: preview.scenarios.length,
        scenarios_total: preview.scenarios.length,
        failing_scenario_titles: [],
        feedback:
          `done-claim refused by the product gate: the scenario suite is too weak to catch broken implementations. ` +
          `It failed to distinguish:\n${survivors.join("\n")}\nStrengthen the scenarios (value assertions, round-trips, rejection and list cases) so they fail on such implementations.`
      };
    }

    return this.inner.submitDoneClaim();
  }

  // Best-effort extraction of the change's proposed scenarios for review. Any shape problem
  // (no change dir, several, unbindable scenarios) returns [] — the inner gate owns those
  // failure modes and their proper custody feedback.
  private pmReviewFlags(currentOpenspec: Record<string, string>): E4V3PmReviewFlag[] {
    const changedPaths = Object.keys({ ...this.input.task_start_openspec, ...currentOpenspec }).filter(
      (path) => this.input.task_start_openspec[path] !== currentOpenspec[path]
    );
    const changeNames = new Set<string>();

    for (const path of changedPaths) {
      const match = path.match(/^openspec\/changes\/([^/]+)\//);

      if (match && match[1] !== "archive") {
        changeNames.add(match[1]);
      }
    }

    if (changeNames.size !== 1) {
      return [];
    }

    const changeName = [...changeNames][0];
    const scenarios: E4V2Scenario[] = [];

    for (const path of Object.keys(currentOpenspec).toSorted()) {
      if (!path.startsWith(`openspec/changes/${changeName}/specs/`) || !path.endsWith(".md")) {
        continue;
      }

      for (const parsed of extractChangeDeltaScenarios(currentOpenspec[path])) {
        const bound = bindScenario(parsed);

        if (!bound.ok) {
          return []; // the inner gate produces the proper custody failure
        }

        scenarios.push(bound.scenario);
      }
    }

    if (scenarios.length === 0) {
      return [];
    }

    return reviewE4ProposedScenarios({
      delta: this.input.delta,
      briefDelivered: this.input.briefDelivered(),
      scenarios
    });
  }
}
