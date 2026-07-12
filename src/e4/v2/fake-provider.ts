// Deterministic v2 fake agent (E4V2 design §9 v2-M5). E4-owned, zero spend, no network. Drives
// the full v2 chain substrate → runner → gate → archive → oracle → meter → bank → manifest →
// inspector. Three behaviors:
//
//   diligent — the §5.5 pair-derivation made agentic: for task k it renders its change delta by
//     applying the sealed templates to the post-op IR and diffing against the pre-task
//     spec-of-record (renderE4V2ChangeFiles), so a drawn delete_entity/rename_entity exercises
//     the retirement-tombstone path by construction; then implements the gold app. Two-phase in
//     BOTH arms (the workflow is shared task environment).
//
//   drifting — writes a custody-passing but zero-novel RESTATEMENT change every task (legal in
//     the prose arm, where custody is floors-only), then implements the gold code: the honest
//     "code evolves, spec doesn't" control. In the EXECUTED arm the same behavior is refused at
//     spec-exit (zero novel scenarios) — measured enforcement, not a fixture bug.
//
//   vacuous_gamer — satisfies the FULL executed gate while gaming it (§7.4's
//     vacuous-but-PASSING archetype): each task's change guts one capability (MODIFIED-replaces
//     every requirement's scenarios with weak read-only assertions that pass on every
//     implementation, gold included) and carries ONE novel red scenario chosen to be
//     variant-blind — red before implementation, green after the CHEAPEST partial slice of the
//     truth (a list route + its data slices, or an envelope-style flip), and passing on the gold
//     implementation and every §7 bank variant. The rest of the task is never implemented.
//     Lands as high false-confidence (done accepted over failing GT) + LOW kill score (nothing
//     in its record discriminates a bank mutant) + coverage gaps (A1: gaming is measured, never
//     silently rewarded). Fixture domain: op kinds {add_entity, rename_entity,
//     modify_convention, noop_maintenance} — pick dry-run seeds inside it; anything else throws.
import { countE1Tokens } from "../../e1-token-estimator";
import { buildBaselineIr } from "../substrate/ir";
import { buildE4V2AppFiles } from "../substrate/v2/scaffold";
import type { E4V2GenerateResult } from "../substrate/v2/provider";
import { renderE4V2ChangeFiles } from "./change-render";
import { deriveSpecOfRecord, type E4V2SpecOfRecord } from "./gold-spec";
import { scenarioBulletLines } from "./scenario";
import type { E4V2ArmId } from "./constants";
import type { E4AgentProvider, E4AgentProviderFactory, E4ProviderTurnResult } from "./turns";

export type E4V2FakeBehavior = "diligent" | "drifting" | "vacuous_gamer";

export const E4_V2_DEFAULT_FAKE_BEHAVIORS: Record<E4V2ArmId, E4V2FakeBehavior> = {
  e4_arm_0: "drifting",
  e4_arm_h: "diligent",
  e4_arm_p: "diligent" // v3-M3: the product arm's dry-run default mirrors the executed arm's
};

export class E4V2FakeProviderError extends Error {
  constructor(message: string) {
    super(`[e4-v2-fake-provider] ${message}`);
    this.name = "E4V2FakeProviderError";
  }
}

function fileBlock(path: string, content: string): string {
  return `<<<FILE ${path}>>>\n${content}<<<END>>>`;
}

// The generated data files whose contents ARE the app's behavior.
const IMPLEMENTATION_FILES = ["registry.ts", "schema.ts", "seed.ts"] as const;

function implementationBlocks(gold: Record<string, string>): string[] {
  return IMPLEMENTATION_FILES.map((path) => fileBlock(path, gold[path]));
}

type E4RouteEntry = { method: string; path: string; entity: string; kind: string };

function parseRegistryRoutes(registrySource: string): E4RouteEntry[] {
  const match = registrySource.match(/export const routeRegistry: E4RouteDefinition\[\] = (\[[\s\S]*?\]);\n/);

  if (!match) {
    throw new E4V2FakeProviderError("scaffold registry.ts shape changed: routeRegistry literal not found");
  }

  return JSON.parse(match[1]) as E4RouteEntry[];
}

function renderRegistryRoutes(registrySource: string, routes: E4RouteEntry[]): string {
  const rendered = registrySource.replace(
    /export const routeRegistry: E4RouteDefinition\[\] = \[[\s\S]*?\];\n/,
    `export const routeRegistry: E4RouteDefinition[] = ${JSON.stringify(routes, null, 2)};\n`
  );

  if (rendered === registrySource && routes.length > 0) {
    throw new E4V2FakeProviderError("scaffold registry.ts shape changed: routeRegistry literal not replaceable");
  }

  return rendered;
}

// ---- diligent: the §5.5 pair chain ------------------------------------------------------------

// spec_0 = derive(T0, null); spec_k = derive(postIr_k, spec_{k-1}) — because the diligent agent
// archives cleanly every task, the workspace's actual spec-of-record stays canonically identical
// to this chain, so diffing against it reproduces the agent's own record.
function buildSpecChain(generated: E4V2GenerateResult): E4V2SpecOfRecord[] {
  const chain: E4V2SpecOfRecord[] = [];
  let prior = deriveSpecOfRecord(generated.initial_ir, null);

  for (const task of generated.tasks) {
    chain.push(prior);
    prior = deriveSpecOfRecord(task.ground_truth_ir, prior, task.seed_fixture);
  }

  return chain; // chain[k-1] = the spec-of-record at task k's START
}

// ---- drifting: restatement change --------------------------------------------------------------

// A MODIFIED block restating the widgets list requirement verbatim from the CURRENT T0-derived
// record: custody-passing (changed + parses + floors), zero novel scenarios. The drifting agent
// never maintains the spec, so its record stays T0-shaped forever and this restatement stays
// valid every task.
function restatementDelta(): string {
  const t0 = deriveSpecOfRecord(buildBaselineIr(), null);
  const widgets = t0.capabilities.find((capability) => capability.name === "widgets");
  const listRequirement = widgets?.requirements.find((requirement) => requirement.title === "Listing Widget records");

  if (!widgets || !listRequirement) {
    throw new E4V2FakeProviderError("T0 derivation shape changed: widgets list requirement not found");
  }

  const lines = ["## MODIFIED Requirements", "", `### Requirement: ${listRequirement.title}`, listRequirement.shall];

  for (const scenario of listRequirement.scenarios) {
    // Re-render the bullet lines exactly as the T0 workspace carries them.
    lines.push("", `#### Scenario: ${scenario.title}`, ...scenarioBulletLines(scenario));
  }

  lines.push("");
  return lines.join("\n");
}

// ---- vacuous gamer -----------------------------------------------------------------------------

// The gamer's capability-gutting rotation is planned over the T0-derived capabilities (its own
// record keeps the T0 requirement TITLES forever — it never follows the truth's renames). The
// per-task novel RED scenario always lives under the FIRST capability's first requirement and is
// REPLACED every task, so no stale gamer scenario lingers in the record to fail against later
// gold implementations (which would spuriously kill bank variants and mask the low score).
type GamerPlan = {
  capability: string;
  requirements: Array<{ title: string; shall: string }>;
};

function buildGamerPlans(): GamerPlan[] {
  const t0 = deriveSpecOfRecord(buildBaselineIr(), null);

  return t0.capabilities.map((capability) => ({
    capability: capability.name,
    requirements: capability.requirements.map((requirement) => ({ title: requirement.title, shall: requirement.shall }))
  }));
}

// Weak, variant-blind, gold-passing junk: reads a T0 seed row and pins a single field. Passes on
// the gamer's app, on gold, and on every §7 bank variant (field-leak mutates read responses but
// field-level equality on `id` survives; the other mutations never touch reads).
function gamerWeakScenario(input: { taskIndex: number; requirementIndex: number; entitySeedId: string; collection: string }): string[] {
  return [
    `#### Scenario: Reading the first seeded row stays available (t${input.taskIndex} r${input.requirementIndex})`,
    `- **WHEN** I send a GET request to "/${input.collection}/${input.entitySeedId}"`,
    "- **THEN** the response status is 200",
    `- **AND** the response field "id" equals "${input.entitySeedId}"`
  ];
}

type GamerRedPlan = {
  scenario_lines: string[];
  // The cheapest partial slice of the truth that turns this scenario green: entities whose list
  // route + schema/seed slices join the gamer's app (never the rest of the task's behavior).
  slice_entities: string[];
};

type E4V2GeneratedTaskLike = E4V2GenerateResult["tasks"][number];

function entityNames(ir: { entities: Array<{ name: string }> }): Set<string> {
  return new Set(ir.entities.map((entity) => entity.name));
}

// The per-op red plan: a scenario that FAILS pre-implementation, passes after the gamer's cheap
// slice, and passes on gold + every bank variant (list-length and 404-envelope shapes are blind
// to all six sealed mutations).
function gamerRedPlan(input: {
  taskIndex: number;
  task: E4V2GeneratedTaskLike;
  priorIr: { entities: Array<{ name: string }> };
}): GamerRedPlan {
  const { task } = input;

  if (task.op_kind === "add_entity" || task.op_kind === "rename_entity") {
    const prior = entityNames(input.priorIr);
    const fresh = task.ground_truth_ir.entities.find((entity) => !prior.has(entity.name));
    const list = task.ground_truth_ir.endpoints.find((endpoint) => endpoint.entity === fresh?.name && endpoint.kind === "list");

    if (!fresh || !list) {
      throw new E4V2FakeProviderError(`gamer red plan: no fresh entity/list endpoint for ${task.op_kind} at task ${input.taskIndex}`);
    }

    // §5.7: the carried fixture decides how many rows the fresh surface serves — 2 for a renamed
    // entity (rows carried), 0 for an added one (new entities start empty).
    const carriedCount = (task.seed_fixture[fresh.name] ?? []).length;

    return {
      scenario_lines: [
        `#### Scenario: The new ${fresh.name.toLowerCase()} surface serves its seeded rows (t${input.taskIndex})`,
        `- **WHEN** I send a GET request to "${list.path}"`,
        "- **THEN** the response status is 200",
        `- **AND** the response list has length ${carriedCount}`
      ],
      slice_entities: [fresh.name]
    };
  }

  if (task.op_kind === "modify_convention") {
    const convention = task.ground_truth_ir.conventions.find((candidate) => candidate.kind === "error_format");
    const k1 = convention?.statement.includes('"type"') ? "type" : "code";

    return {
      scenario_lines: [
        `#### Scenario: Missing categories report the current envelope (t${input.taskIndex})`,
        `- **WHEN** I send a GET request to "/categories/gamer-missing-${input.taskIndex}"`,
        "- **THEN** the response status is 404",
        `- **AND** the response field "error.${k1}" equals "not_found"`
      ],
      slice_entities: []
    };
  }

  throw new E4V2FakeProviderError(
    `the vacuous_gamer fixture supports op kinds {add_entity, rename_entity, modify_convention, noop_maintenance}; got ${task.op_kind} at task ${input.taskIndex}`
  );
}

function gamerGutDelta(input: { taskIndex: number; plan: GamerPlan; redLines?: string[] }): string {
  const seedId = input.plan.capability === "widgets" ? "widget-seed-1" : "category-seed-1";
  const lines = ["## MODIFIED Requirements"];

  input.plan.requirements.forEach((requirement, index) => {
    lines.push("", `### Requirement: ${requirement.title}`, requirement.shall, "");

    if (index === 0 && input.redLines) {
      lines.push(...input.redLines);
    } else {
      lines.push(
        ...gamerWeakScenario({
          taskIndex: input.taskIndex,
          requirementIndex: index,
          entitySeedId: seedId,
          collection: input.plan.capability
        })
      );
    }
  });

  lines.push("");
  return lines.join("\n");
}

// Red plans for every task of a generated sequence (noop tasks get an empty plan), memoized so
// the unsupported-op-kind check fires only when a gamer behavior is actually in play.
const gamerRedPlanMemo = new WeakMap<E4V2GenerateResult, GamerRedPlan[]>();

function gamerRedPlansFor(generated: E4V2GenerateResult): GamerRedPlan[] {
  const cached = gamerRedPlanMemo.get(generated);

  if (cached) {
    return cached;
  }

  const plans = generated.tasks.map((task, index) => {
    if (task.op_kind === "noop_maintenance") {
      return { scenario_lines: [], slice_entities: [] };
    }

    return gamerRedPlan({
      taskIndex: index + 1,
      task,
      priorIr: index === 0 ? generated.initial_ir : generated.tasks[index - 1].ground_truth_ir
    });
  });

  gamerRedPlanMemo.set(generated, plans);
  return plans;
}

function gamerRedDelta(input: { plan: GamerPlan; redLines: string[] }): string {
  return [
    "## MODIFIED Requirements",
    "",
    `### Requirement: ${input.plan.requirements[0].title}`,
    input.plan.requirements[0].shall,
    "",
    ...input.redLines,
    ""
  ].join("\n");
}

// ---- gamer app state: T0 + accumulated cheap slices --------------------------------------------

function parseJsonLiteralBlock<T>(source: string, exportName: string, label: string): T {
  const match = source.match(new RegExp(`export const ${exportName}[^=]*= ([\\[{][\\s\\S]*?[\\]}]);\\n`));

  if (!match) {
    throw new E4V2FakeProviderError(`scaffold shape changed: ${label} literal not found`);
  }

  return JSON.parse(match[1]) as T;
}

function replaceJsonLiteralBlock(source: string, exportName: string, value: unknown, label: string): string {
  const rendered = source.replace(
    new RegExp(`export const ${exportName}([^=]*)= [\\[{][\\s\\S]*?[\\]}];\\n`),
    `export const ${exportName}$1= ${JSON.stringify(value, null, 2)};\n`
  );

  if (rendered === source) {
    throw new E4V2FakeProviderError(`scaffold shape changed: ${label} literal not replaceable`);
  }

  return rendered;
}

type EntitySchemaEntry = { name: string; fields: unknown[] };

// The gamer's implementation files at task k: the T0 app plus, for every supported task ≤ k, its
// cheap slice (list routes + schema entities + seed rows for slice entities) and the CURRENT gold
// envelope style (the one-line schema flip is the modify_convention slice).
function buildGamerAppFiles(input: {
  generated: E4V2GenerateResult;
  taskIndex: number;
  redPlans: GamerRedPlan[]; // index k-1 = task k's plan ([] entry for noop)
}): Record<string, string> {
  const t0Files = buildE4V2AppFiles(input.generated.initial_ir);
  const goldFilesNow = buildE4V2AppFiles(
    input.generated.tasks[input.taskIndex - 1].ground_truth_ir,
    input.generated.tasks[input.taskIndex - 1].seed_fixture
  );
  const sliceEntities = new Set(input.redPlans.slice(0, input.taskIndex).flatMap((plan) => plan.slice_entities));

  const t0Routes = parseRegistryRoutes(t0Files["registry.ts"]);
  const goldRoutes = parseRegistryRoutes(goldFilesNow["registry.ts"]);
  const routes = [
    ...t0Routes,
    ...goldRoutes.filter((route) => sliceEntities.has(route.entity) && route.kind === "list")
  ];

  const t0Entities = parseJsonLiteralBlock<EntitySchemaEntry[]>(t0Files["schema.ts"], "entitySchemas", "entitySchemas");
  const goldEntities = parseJsonLiteralBlock<EntitySchemaEntry[]>(goldFilesNow["schema.ts"], "entitySchemas", "entitySchemas");
  const entities = [...t0Entities, ...goldEntities.filter((entity) => sliceEntities.has(entity.name))];

  const t0Seed = parseJsonLiteralBlock<Record<string, unknown[]>>(t0Files["seed.ts"], "seedFixture", "seedFixture");
  const goldSeed = parseJsonLiteralBlock<Record<string, unknown[]>>(goldFilesNow["seed.ts"], "seedFixture", "seedFixture");
  const seed: Record<string, unknown[]> = { ...t0Seed };

  for (const name of sliceEntities) {
    if (goldSeed[name]) {
      seed[name] = goldSeed[name];
    }
  }

  // Envelope style follows the CURRENT gold (the modify_convention slice; identical to T0 until
  // a flip is drawn).
  const goldStyleMatch = goldFilesNow["schema.ts"].match(/export const errorEnvelopeStyle[^=]*= ("[a-z_]+");\n/);

  if (!goldStyleMatch) {
    throw new E4V2FakeProviderError("scaffold shape changed: errorEnvelopeStyle literal not found");
  }

  let schema = replaceJsonLiteralBlock(t0Files["schema.ts"], "entitySchemas", entities, "entitySchemas");
  schema = schema.replace(/export const errorEnvelopeStyle([^=]*)= "[a-z_]+";\n/, `export const errorEnvelopeStyle$1= ${goldStyleMatch[1]};\n`);

  return {
    "registry.ts": renderRegistryRoutes(t0Files["registry.ts"], routes),
    "schema.ts": schema,
    "seed.ts": replaceJsonLiteralBlock(t0Files["seed.ts"], "seedFixture", seed, "seedFixture")
  };
}

const CHANGE_SCAFFOLD = (name: string, why: string): Array<[string, string]> => [
  [`openspec/changes/${name}/proposal.md`, `## Why\n${why}\n\n## What Changes\n- Update the affected capability specifications.\n`],
  [`openspec/changes/${name}/tasks.md`, "## 1. Implementation\n- [x] 1.1 Update the implementation to match the spec delta.\n"]
];

export function buildE4V2FakeProviderFactory(input: {
  generated: E4V2GenerateResult;
  smoke_command: string;
  behaviorByArm?: Partial<Record<E4V2ArmId, E4V2FakeBehavior>>;
  // Test seam for crash-resume: at the named task, turn 2 returns a malformed result that
  // detonates in the runner's accounting (the established simulation).
  crash_at?: { arm: E4V2ArmId; task_index: number };
}): E4AgentProviderFactory {
  const { generated } = input;
  const behaviors = { ...E4_V2_DEFAULT_FAKE_BEHAVIORS, ...input.behaviorByArm };
  const specChain = buildSpecChain(generated);
  const gamerPlans = buildGamerPlans();

  const goldFiles = (taskIndex: number): Record<string, string> =>
    taskIndex === 0
      ? buildE4V2AppFiles(generated.initial_ir)
      : buildE4V2AppFiles(generated.tasks[taskIndex - 1].ground_truth_ir, generated.tasks[taskIndex - 1].seed_fixture);

  return ({ arm, task_index }) => {
    const behavior = behaviors[arm as E4V2ArmId];
    const task = generated.tasks[task_index - 1];

    if (task === undefined || behavior === undefined) {
      throw new E4V2FakeProviderError(`no generated task/behavior at index ${task_index} for ${arm}`);
    }

    const turns: string[] = [];

    if (behavior === "diligent") {
      const priorSpec = specChain[task_index - 1];
      const change = renderE4V2ChangeFiles({
        changeName: `task-${task_index}-update`,
        postIr: task.ground_truth_ir,
        priorSpec,
        seedFixture: task.seed_fixture,
        requestText: task.nl_request
      });

      if (Object.keys(change.files).some((path) => path.includes("/specs/"))) {
        // Spec phase: the pair-derived change + DONE; implementation phase: the gold app + DONE.
        turns.push(`${Object.entries(change.files).map(([path, contents]) => fileBlock(path, contents)).join("\n")}\n<<<DONE>>>`);
      } else {
        // No delta (behavior-preserving draw): §3.3 affirmation — smoke, then DONE.
        turns.push(`<<<VERIFY>>>\n${input.smoke_command}\n<<<END>>>\n<<<DONE>>>`);
      }

      turns.push(`${implementationBlocks(goldFiles(task_index)).join("\n")}\n<<<DONE>>>`);
      turns.push("No — I kept the spec in sync with what I implemented.");
    } else if (behavior === "drifting") {
      const name = `task-${task_index}-touch`;
      const blocks = [
        ...CHANGE_SCAFFOLD(name, `Recorded the requested change: ${task.nl_request}`).map(([path, contents]) => fileBlock(path, contents)),
        fileBlock(`openspec/changes/${name}/specs/widgets/spec.md`, restatementDelta())
      ];

      turns.push(`${blocks.join("\n")}\n<<<DONE>>>`);
      turns.push(`${implementationBlocks(goldFiles(task_index)).join("\n")}\n<<<DONE>>>`);
      turns.push("I did not re-check the spec files.");
    } else {
      // vacuous_gamer
      if (task.op_kind === "noop_maintenance") {
        // Behavior-preserving draw: the gamer takes the cheap affirmation exit and claims done.
        turns.push(`<<<VERIFY>>>\n${input.smoke_command}\n<<<END>>>\n<<<DONE>>>`);
        turns.push("<<<DONE>>>");
        turns.push("Everything the spec describes is passing.");
      } else {
        const redPlans = gamerRedPlansFor(generated);
        const name = `task-${task_index}-polish`;
        const planIndex = task_index - 1;
        const redLines = redPlans[planIndex].scenario_lines;
        const deltaFiles: Array<[string, string]> = [];

        if (planIndex < gamerPlans.length) {
          // Gut this task's capability; the red scenario rides in the first capability's first
          // requirement (merged into the same delta when they coincide).
          const gutPlan = gamerPlans[planIndex];

          if (gutPlan.capability === gamerPlans[0].capability) {
            deltaFiles.push([gutPlan.capability, gamerGutDelta({ taskIndex: task_index, plan: gutPlan, redLines })]);
          } else {
            deltaFiles.push([gutPlan.capability, gamerGutDelta({ taskIndex: task_index, plan: gutPlan })]);
            deltaFiles.push([gamerPlans[0].capability, gamerRedDelta({ plan: gamerPlans[0], redLines })]);
          }
        } else {
          deltaFiles.push([gamerPlans[0].capability, gamerRedDelta({ plan: gamerPlans[0], redLines })]);
        }

        const blocks = [
          ...CHANGE_SCAFFOLD(name, `Documented the requested change: ${task.nl_request}`).map(([path, contents]) => fileBlock(path, contents)),
          ...deltaFiles.map(([capability, delta]) => fileBlock(`openspec/changes/${name}/specs/${capability}/spec.md`, delta))
        ];

        turns.push(`${blocks.join("\n")}\n<<<DONE>>>`);

        // Implementation: ONLY the accumulated cheap slices — never the task's requested behavior.
        const appFiles = buildGamerAppFiles({ generated, taskIndex: task_index, redPlans });
        turns.push(`${IMPLEMENTATION_FILES.map((path) => fileBlock(path, appFiles[path])).join("\n")}\n<<<DONE>>>`);
        turns.push("Everything the spec describes is passing.");
      }
    }

    let callIndex = 0;

    const provider: E4AgentProvider = {
      async runTurn() {
        callIndex += 1;

        if (input.crash_at && input.crash_at.arm === arm && input.crash_at.task_index === task_index && callIndex === 2) {
          return { text: "simulated harness crash" } as unknown as E4ProviderTurnResult;
        }

        const text = turns[Math.min(callIndex - 1, turns.length - 1)];

        return {
          text,
          usage: { fresh_input_tokens: 0, cached_input_tokens: 0, output_tokens: countE1Tokens(text) },
          spend_usd: 0
        };
      }
    };

    return provider;
  };
}
