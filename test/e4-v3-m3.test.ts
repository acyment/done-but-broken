// v3-M3 acceptance (E4V3-PRODUCT-LOOP-PROPOSAL.md §5): the product loop integrated —
//   (a) e4-turn-protocol-v2's ASK_PM pre-pass leaves the sealed v1 grammar untouched;
//   (b) the PM spec review flags only communicated-requirement violations, brief-gated rules
//       stay silent without the brief;
//   (c) the product gate composes the UNCHANGED v2 gate: PM-review refusals keep the phase in
//       "spec"; reconcile/mutation refusals keep it in "implementation"; a clean loop delegates
//       and closes; product events are recorded separately from the v2 gate summary;
//   (d) the three-arm dry run (fake agents, zero spend) completes replay-valid under profile
//       e4-openspec-workflow-v2 with the product arm green through the full product gate.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { E4_V2_CONSTANTS_PATH, loadE4V2Constants } from "../src/e4/v2/constants";
import { buildE4V2FakeProviderFactory } from "../src/e4/v2/fake-provider";
import { validateE4V2Manifest } from "../src/e4/v2/manifest";
import { runE4V2Sequences } from "../src/e4/v2/orchestrator";
import type { E4V2Scenario } from "../src/e4/v2/scenario";
import type { E4V2ScenarioVerdict } from "../src/e4/v2/scenario-executor";
import { scenarioBulletLines } from "../src/e4/v2/scenario";
import { extractAskPm, E4_V3_ASK_PM_LITERAL } from "../src/e4/v3/turn-protocol";
import { reviewE4ProposedScenarios } from "../src/e4/v3/pm-review";
import { E4V3ProductTaskGate, E4_V3_DRAFT_PRODUCT_CONFIG } from "../src/e4/v3/product-gate";
import type { E4TaskDelta } from "../src/e4/v3/task-delta";
import type { E4V3MutationReport } from "../src/e4/v3/mutation";
import type { E4SurfaceDump } from "../src/e4/meter/types";

const REPO_ROOT = resolve(import.meta.dir, "..");

function emptyDelta(): E4TaskDelta {
  return {
    added_entities: [],
    removed_entities: [],
    renamed_entities: [],
    added_fields: [],
    removed_fields: [],
    renamed_fields: [],
    retyped_fields: [],
    added_endpoints: [],
    removed_endpoints: [],
    changed_endpoints: [],
    added_rules: [],
    removed_rules: [],
    changed_conventions: [],
    is_empty: true
  };
}

function scenarioMarkdown(scenarios: E4V2Scenario[]): string {
  const blocks = scenarios.map(
    (scenario) => `#### Scenario: ${scenario.title}\n${scenarioBulletLines(scenario).join("\n")}`
  );

  return `## ADDED Requirements\n### Requirement: Test surface\nThe system SHALL behave as scenarioed.\n\n${blocks.join("\n\n")}\n`;
}

const READ_PROMOTION: E4V2Scenario = {
  title: "Reading a Promotion works",
  steps: [
    { kind: "request", method: "GET", path: "/promotions/promotion-spec-1" },
    { kind: "assert_status", status: 200 },
    { kind: "assert_field_equals", json_path: "id", literal_json: '"promotion-spec-1"' }
  ]
};

const PROMOTION_TOMBSTONE: E4V2Scenario = {
  title: "Retired promotions endpoints return 404",
  steps: [
    { kind: "request", method: "GET", path: "/promotions/promotion-spec-1" },
    { kind: "assert_status", status: 404 },
    { kind: "assert_field_equals", json_path: "error.code", literal_json: '"not_found"' }
  ]
};

function removalDelta(): E4TaskDelta {
  return {
    ...emptyDelta(),
    removed_entities: [{ semantic_item_uid: "uid-x", name: "Promotion", fields: [] }],
    removed_endpoints: [
      { semantic_item_uid: "uid-y", entity: "Promotion", kind: "read", method: "GET", path: "/promotions/{id}" }
    ],
    is_empty: false
  };
}

describe("v3-M3 (a): ASK_PM pre-pass", () => {
  test("strips exactly the ASK_PM lines and reports the ask", () => {
    const raw = `thinking...\n${E4_V3_ASK_PM_LITERAL}\n<<<VERIFY>>>\nbun run smoke\n<<<END>>>\n`;
    const pre = extractAskPm(raw);

    expect(pre.ask_pm).toBe(true);
    expect(pre.text).not.toContain(E4_V3_ASK_PM_LITERAL);
    expect(pre.text).toContain("<<<VERIFY>>>");
  });

  test("non-matching output passes through byte-identical", () => {
    const raw = `prefix ${E4_V3_ASK_PM_LITERAL} not at line start\n<<<DONE>>>`;
    const pre = extractAskPm(raw);

    expect(pre.ask_pm).toBe(false);
    expect(pre.text).toBe(raw);
  });
});

describe("v3-M3 (b): PM spec review", () => {
  test("flags a scenario expecting success from removed surface; tombstones are clean", () => {
    const flags = reviewE4ProposedScenarios({
      delta: removalDelta(),
      briefDelivered: false,
      scenarios: [READ_PROMOTION, PROMOTION_TOMBSTONE]
    });

    expect(flags).toHaveLength(1);
    expect(flags[0].rule).toBe("contradicted_removal");
    expect(flags[0].subject).toContain("Reading a Promotion works");
  });

  test("brief-gated rules fire only when the brief was delivered", () => {
    const delta: E4TaskDelta = {
      ...emptyDelta(),
      added_entities: [
        {
          semantic_item_uid: "uid-e",
          name: "Promotion",
          fields: [{ semantic_item_uid: "uid-f", name: "name", type: "string", required: true }]
        }
      ],
      added_endpoints: [
        { semantic_item_uid: "uid-c", entity: "Promotion", kind: "create", method: "POST", path: "/promotions" },
        { semantic_item_uid: "uid-r", entity: "Promotion", kind: "read", method: "GET", path: "/promotions/{id}" }
      ],
      is_empty: false
    };
    const invented: E4V2Scenario = {
      title: "Creating a Promotion stores the discount",
      steps: [
        {
          kind: "request_body",
          method: "POST",
          path: "/promotions",
          body_json: JSON.stringify({ name: "promo", discount_percent: 10 })
        },
        { kind: "assert_status", status: 201 },
        { kind: "assert_field_equals", json_path: "discount_percent", literal_json: "10" }
      ]
    };

    const withoutBrief = reviewE4ProposedScenarios({ delta, briefDelivered: false, scenarios: [invented] });

    expect(withoutBrief).toHaveLength(0);

    const withBrief = reviewE4ProposedScenarios({ delta, briefDelivered: true, scenarios: [invented] });
    const rules = withBrief.map((flag) => flag.rule).toSorted();

    // invented field + the communicated GET /promotions/{id} never exercised
    expect(rules).toEqual(["missed_communicated_operation", "unknown_field_on_added_entity"]);
  });
});

describe("v3-M3 (c): product gate composition", () => {
  function completed(scenarios: E4V2Scenario[], passed: boolean): E4V2ScenarioVerdict[] {
    return scenarios.map((scenario) => ({
      kind: "completed",
      title: scenario.title,
      passed,
      failures: passed ? [] : ["scripted failure"],
      failure_mode: passed ? null : "assertion",
      steps: []
    }));
  }

  function mutationReport(killed: number, greenTitles: string[]): E4V3MutationReport {
    const ids = ["accept-invalid", "status-swap", "swallow-write", "field-leak", "strip-filter", "empty-list"] as const;

    return {
      harness_id: "e4-agent-boundary-mutation-v1",
      baseline_green_titles: greenTitles,
      baseline_failed_titles: [],
      baseline_non_completed_titles: [],
      mutants: ids.map((mutant_id, index) => ({
        mutant_id,
        status: index < killed ? "killed" : "survived",
        killing_scenario_titles: index < killed ? [greenTitles[0] ?? "x"] : [],
        non_completed_titles: []
      })),
      kill_score: killed / ids.length
    };
  }

  // A suite that fully reconciles against WIDGET_DUMP: create round-trip (exercises both
  // routes) + a required-field rejection. Weakness is then purely the mutation report's story.
  const NOVEL: E4V2Scenario = {
    title: "Creating a Widget round-trips",
    steps: [
      { kind: "request_body", method: "POST", path: "/widgets", body_json: '{"id":"widget-spec-9","name":"w"}' },
      { kind: "assert_status", status: 201 },
      { kind: "remember", json_path: "id", name: "wid" },
      { kind: "request", method: "GET", path: "/widgets/{wid}" },
      { kind: "assert_field_equals", json_path: "id", literal_json: '"widget-spec-9"' }
    ]
  };

  const REJECTION: E4V2Scenario = {
    title: "Creating a Widget without name is rejected",
    steps: [
      { kind: "request_body", method: "POST", path: "/widgets", body_json: '{"id":"widget-spec-10"}' },
      { kind: "assert_status", status: 400 },
      { kind: "assert_field_equals", json_path: "error.code", literal_json: '"validation_error"' }
    ]
  };

  const FULL_SUITE: E4V2Scenario[] = [NOVEL, REJECTION];

  function buildGate(input: {
    delta: E4TaskDelta;
    scenarioPass: { value: boolean };
    dump: E4SurfaceDump;
    mutation: () => E4V3MutationReport;
    changeScenarios: E4V2Scenario[];
  }) {
    const changeTree = {
      "openspec/changes/test-change/proposal.md": "test",
      "openspec/changes/test-change/specs/widgets/spec.md": scenarioMarkdown(input.changeScenarios)
    };

    const gate = new E4V3ProductTaskGate({
      arm_mode: "executed",
      opportunity_labels: ["drift_opportunity"],
      task_start_openspec: {},
      validateChange: async () => ({ ok: true, detail: "ok" }),
      previewMergedScenarios: async () => ({ ok: true, scenarios: input.changeScenarios, specs: {} }),
      runScenarios: async (scenarios) => completed(scenarios, input.scenarioPass.value),
      delta: input.delta,
      briefDelivered: () => false,
      extractDump: async () => input.dump,
      runMutationAnalysis: async () => input.mutation(),
      productConfig: E4_V3_DRAFT_PRODUCT_CONFIG
    });

    return { gate, changeTree };
  }

  const WIDGET_DUMP: E4SurfaceDump = {
    routes: [
      { method: "POST", path: "/widgets", entity: "Widget", kind: "create" },
      { method: "GET", path: "/widgets/{id}", entity: "Widget", kind: "read" }
    ],
    entities: [
      {
        name: "Widget",
        fields: [
          { name: "id", type: "string", ref_entity: null, required: true },
          { name: "name", type: "string", ref_entity: null, required: true }
        ]
      }
    ],
    validation_rules: []
  };

  test("PM review refusal keeps the phase in spec; a clean retry advances", async () => {
    const scenarioPass = { value: false }; // red pre-implementation
    const { gate, changeTree } = buildGate({
      delta: removalDelta(),
      scenarioPass,
      dump: WIDGET_DUMP,
      mutation: () => mutationReport(6, [NOVEL.title]),
      changeScenarios: [READ_PROMOTION]
    });

    const refused = await gate.attemptSpecExit(changeTree);

    expect(refused.outcome).toBe("custody_failed");
    expect(refused.outcome === "custody_failed" && refused.feedback).toContain("spec review");
    expect(gate.phase()).toBe("spec");
    expect(gate.productSummary().pm_review_refusals).toBe(1);
    expect(gate.summary().custody_failures).toBe(0); // separate from the v2 event summary

    const cleanTree = {
      "openspec/changes/test-change/proposal.md": "test",
      "openspec/changes/test-change/specs/widgets/spec.md": scenarioMarkdown([NOVEL])
    };
    const advanced = await gate.attemptSpecExit(cleanTree);

    expect(advanced.outcome).toBe("advanced");
    expect(gate.phase()).toBe("implementation");
  });

  test("reconcile and mutation refusals keep the phase in implementation; clean delegates and closes", async () => {
    const scenarioPass = { value: false };
    // change scenario targets a route MISSING from the dump → blocking reconcile finding
    const staleDump: E4SurfaceDump = { ...WIDGET_DUMP, routes: [WIDGET_DUMP.routes[1]] };
    let currentDump = staleDump;
    let currentMutation = mutationReport(3, FULL_SUITE.map((scenario) => scenario.title));
    const { gate } = buildGate({
      delta: emptyDelta(),
      scenarioPass,
      dump: WIDGET_DUMP, // placeholder; overridden below via closure indirection
      mutation: () => currentMutation,
      changeScenarios: [NOVEL]
    });

    // rebuild with dynamic dump closure
    const dynamicGate = new E4V3ProductTaskGate({
      arm_mode: "executed",
      opportunity_labels: ["drift_opportunity"],
      task_start_openspec: {},
      validateChange: async () => ({ ok: true, detail: "ok" }),
      previewMergedScenarios: async () => ({ ok: true, scenarios: FULL_SUITE, specs: {} }),
      runScenarios: async (scenarios) => completed(scenarios, scenarioPass.value),
      delta: emptyDelta(),
      briefDelivered: () => false,
      extractDump: async () => currentDump,
      runMutationAnalysis: async () => currentMutation,
      productConfig: E4_V3_DRAFT_PRODUCT_CONFIG
    });

    const cleanTree = {
      "openspec/changes/test-change/proposal.md": "test",
      "openspec/changes/test-change/specs/widgets/spec.md": scenarioMarkdown(FULL_SUITE)
    };

    expect((await dynamicGate.attemptSpecExit(cleanTree)).outcome).toBe("advanced");
    scenarioPass.value = true; // implementation lands; everything green from here

    const reconcileRefused = await dynamicGate.submitDoneClaim();

    expect(reconcileRefused.outcome).toBe("refused");
    expect(reconcileRefused.outcome === "refused" && reconcileRefused.feedback).toContain("do not reconcile");
    expect(dynamicGate.phase()).toBe("implementation");

    currentDump = WIDGET_DUMP; // reconciles now; mutation still weak (3/6 < 5/6)
    const mutationRefused = await dynamicGate.submitDoneClaim();

    expect(mutationRefused.outcome).toBe("refused");
    expect(mutationRefused.outcome === "refused" && mutationRefused.feedback).toContain("too weak");
    expect(dynamicGate.phase()).toBe("implementation");

    currentMutation = mutationReport(6, FULL_SUITE.map((scenario) => scenario.title)); // strong suite → clean pass-through
    const accepted = await dynamicGate.submitDoneClaim();

    expect(accepted.outcome).toBe("accepted");
    expect(dynamicGate.phase()).toBe("closed");

    const summary = dynamicGate.productSummary();

    expect(summary.reconcile_refusals).toBe(1);
    expect(summary.mutation_refusals).toBe(1);
    expect(summary.last_kill_score).toBe(1);
    expect(gate.phase()).toBe("spec"); // the first gate instance was never advanced
  });
});

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("v3-M3 (d): three-arm dry run", () => {
  test(
    "prose / naked-execution / product arms complete replay-valid under e4-openspec-workflow-v2",
    async () => {
      const runRoot = await mkdtemp(join(tmpdir(), "e4-v3-dryrun-"));
      tempRoots.push(runRoot);
      const { constants, hash } = await loadE4V2Constants(join(REPO_ROOT, E4_V2_CONSTANTS_PATH));
      const substrateConfig = {
        substrate_config_id: constants.compatibility_boundary.substrate_config_id,
        substrate_seed: 50,
        task_count: 4,
        op_mix: { weights: constants.op_mix.weights }
      };
      const { e4ProceduralRestV2Provider } = await import("../src/e4/substrate/v2/provider");
      const generated = await e4ProceduralRestV2Provider.generate(substrateConfig);
      const providerFactory = buildE4V2FakeProviderFactory({
        generated,
        smoke_command: constants.feedback.smoke_command
      });

      const result = await runE4V2Sequences({
        repoRoot: REPO_ROOT,
        runRoot,
        run_classification: "dry_run",
        pairing_label: "pair-v3-m3-dryrun",
        substrate_config: substrateConfig,
        constants,
        constants_hash: hash,
        providerFactory,
        executor_config: constants.executor,
        v3: { product_config: E4_V3_DRAFT_PRODUCT_CONFIG }
      });

      const arms = ["e4_arm_0", "e4_arm_h", "e4_arm_p"] as const;

      for (const arm of arms) {
        const manifest = validateE4V2Manifest(result.manifests[arm]);

        expect(manifest.status).toBe("complete");
        expect(manifest.protocol_profile_id).toBe("e4-openspec-workflow-v2");
        expect(manifest.replay_validity.chain_replay_valid).toBe(true);
        expect(manifest.tasks).toHaveLength(4);

        for (const task of manifest.tasks) {
          expect(task.status).toBe("complete");
          expect(task.pm_brief).toEqual({ requested: false, first_turn: null }); // fake agents never ask
        }
      }

      // product arm: full product gate green for the diligent agent — zero product refusals,
      // kill 1.0 at every close; the other arms carry no product-gate summary.
      for (const task of result.manifests.e4_arm_p.tasks) {
        expect(task.product_gate).not.toBeNull();
        expect(task.product_gate!.pm_review_refusals).toBe(0);
        expect(task.product_gate!.reconcile_refusals).toBe(0);
        expect(task.product_gate!.mutation_refusals).toBe(0);
        expect(task.termination).toBe("done");
      }

      for (const arm of ["e4_arm_0", "e4_arm_h"] as const) {
        for (const task of result.manifests[arm].tasks) {
          expect(task.product_gate).toBeNull();
        }
      }

      // the naked-execution arm's behavior is unchanged by the v3 run shape: diligent closes
      // green with zero drift exactly as in the v2 dry-run fixture
      for (const task of result.manifests.e4_arm_h.tasks) {
        expect(task.termination).toBe("done");
      }
    },
    600000
  );
});
