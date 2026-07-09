// Deterministic fake agent for the M6 dry-run integration harness (IMPLEMENTATION-PLAN.md M6;
// [R1-S6]). E4-owned — never the forbidden legacy src/fake-agent.ts. Drives the full chain
// substrate → runner → gate → oracle → meter → manifest → inspector with ZERO provider spend and
// no network call of any kind.
//
// The behaviors are scripted from the substrate's own generator output: for task k the fixture
// derives the GOLD workspace by re-running the scaffold codegen over the task's post-op
// ground-truth IR (buildE4WorkspaceFiles — the same function that built T0). This stays entirely
// harness-side fixture machinery: nothing here is an agent-visible channel, and no real arm ever
// receives gold. Three behaviors ([R1-S6]):
//   - diligent_h    : spec-first (custody-passing gold spec edits; §3.3 no-change affirmation on
//                     behavior-preserving tasks), then gold implementation → accepted done.
//   - drifting      : implements the gold code change but never touches specs/ — the honest
//                     "accepts done over a stale spec" control behavior (arms 0/M).
//   - registry_bypass: drifting, plus serves one ground-truth route via code directly wired into
//                     server.ts while REMOVING it from registry.ts — the live executor→meter
//                     reconciliation fixture (Gate-1 change 1): behavior exists, registry lies.
import { countE1Tokens } from "../e1-token-estimator";
import { buildE4WorkspaceFiles } from "./substrate/scaffold";
import type { E4GenerateResult } from "./substrate/provider";
import type { E4AgentProvider, E4AgentProviderFactory, E4ProviderTurnResult } from "./turns";
import type { E4ArmId } from "./types";

export type E4FakeBehavior = "diligent_h" | "drifting" | "registry_bypass";

export const E4_DEFAULT_FAKE_BEHAVIORS: Record<E4ArmId, E4FakeBehavior> = {
  e4_arm_0: "drifting",
  e4_arm_m: "drifting", // ignores the standing instruction — the H3 leak-signature control
  e4_arm_h: "diligent_h"
};

export class E4FakeProviderError extends Error {
  constructor(message: string) {
    super(`[e4-fake-provider] ${message}`);
    this.name = "E4FakeProviderError";
  }
}

type E4RouteEntry = { method: string; path: string; entity: string; kind: string };

function fileBlock(path: string, content: string): string {
  return `<<<FILE ${path}>>>\n${content}<<<END>>>`;
}

function parseRegistryRoutes(registrySource: string): E4RouteEntry[] {
  const match = registrySource.match(/export const routeRegistry: E4RouteDefinition\[\] = (\[[\s\S]*?\]);\n/);

  if (!match) {
    throw new E4FakeProviderError("scaffold registry.ts shape changed: routeRegistry literal not found");
  }

  return JSON.parse(match[1]) as E4RouteEntry[];
}

function renderRegistryRoutes(registrySource: string, routes: E4RouteEntry[]): string {
  const rendered = registrySource.replace(
    /export const routeRegistry: E4RouteDefinition\[\] = \[[\s\S]*?\];\n/,
    `export const routeRegistry: E4RouteDefinition[] = ${JSON.stringify(routes, null, 2)};\n`
  );

  if (rendered === registrySource && routes.length > 0) {
    throw new E4FakeProviderError("scaffold registry.ts shape changed: routeRegistry literal not replaceable");
  }

  return rendered;
}

// Direct-wire one route into the generic dispatcher: the route object joins the dispatch table as
// a server-local const, so the served behavior is byte-identical to registry dispatch while the
// registry (the meter's code-side surface) no longer declares it.
function directWireIntoServer(serverSource: string, route: E4RouteEntry): string {
  const anchor = "const routesBySpecificity = [...routeRegistry].sort(";
  const replacement =
    `const bypassRoutes: E4RouteDefinition[] = ${JSON.stringify([route])};\n` +
    "const routesBySpecificity = [...routeRegistry, ...bypassRoutes].sort(";

  if (!serverSource.includes(anchor)) {
    throw new E4FakeProviderError("scaffold server.ts shape changed: dispatch-table anchor not found");
  }

  return serverSource.replace(anchor, replacement);
}

// The bypassed route must be one whose spec-side documentation is still accurate (present and
// unchanged since T0), so the fixture isolates the reconciliation path: the ONLY discrepancy for
// that item is registry-absence with executor-green behavior.
export function pickE4BypassRoute(input: { goldRoutes: E4RouteEntry[]; t0Routes: E4RouteEntry[] }): E4RouteEntry {
  const t0Keys = new Set(input.t0Routes.map((route) => `${route.method} ${route.path} ${route.entity} ${route.kind}`));
  const candidate = input.goldRoutes.find((route) =>
    t0Keys.has(`${route.method} ${route.path} ${route.entity} ${route.kind}`)
  );

  if (!candidate) {
    throw new E4FakeProviderError("no baseline-stable route available to bypass");
  }

  return candidate;
}

// The generated data files whose contents ARE the app's behavior (server.ts/storage.ts are static
// dispatch plumbing; README.md is untested prose).
const IMPLEMENTATION_FILES = ["registry.ts", "schema.ts", "seed.ts"] as const;

function implementationBlocks(gold: Record<string, string>): string[] {
  return IMPLEMENTATION_FILES.map((path) => fileBlock(path, gold[path]));
}

function specBlocks(gold: Record<string, string>): string[] {
  return [
    fileBlock("specs/openapi.json", gold["specs/openapi.json"]),
    fileBlock("specs/CONVENTIONS.md", gold["specs/CONVENTIONS.md"])
  ];
}

function specsIdentical(a: Record<string, string>, b: Record<string, string>): boolean {
  return (
    a["specs/openapi.json"] === b["specs/openapi.json"] && a["specs/CONVENTIONS.md"] === b["specs/CONVENTIONS.md"]
  );
}

export function buildE4FakeProviderFactory(input: {
  generated: E4GenerateResult;
  smoke_command: string;
  behaviorByArm?: Partial<Record<E4ArmId, E4FakeBehavior>>;
  // Test seam for the M6 crash-resume scenario: at the named task, turn 2 returns a malformed
  // result that detonates in the runner's accounting — an UNCLASSIFIED harness crash, not a
  // provider_error (the M4-established simulation).
  crash_at?: { arm: E4ArmId; task_index: number };
}): E4AgentProviderFactory {
  const { generated } = input;
  const behaviors = { ...E4_DEFAULT_FAKE_BEHAVIORS, ...input.behaviorByArm };

  const goldWorkspace = (taskIndex: number): Record<string, string> =>
    taskIndex === 0
      ? generated.initial_workspace
      : buildE4WorkspaceFiles(generated.tasks[taskIndex - 1].ground_truth_ir);

  return ({ arm, task_index }) => {
    const behavior = behaviors[arm];
    const task = generated.tasks[task_index - 1];

    if (task === undefined) {
      throw new E4FakeProviderError(`no generated task at index ${task_index}`);
    }

    const gold = goldWorkspace(task_index);
    const goldPrev = goldWorkspace(task_index - 1);
    const turns: string[] = [];

    if (behavior === "diligent_h") {
      if (arm === "e4_arm_h") {
        const behaviorPreserving = task.opportunity_labels.includes("behavior_preserving");

        if (behaviorPreserving && specsIdentical(gold, goldPrev)) {
          // §3.3 no-change affirmation: byte-unchanged specs + ≥1 smoke invocation in the spec
          // phase + the done_literal (processing order: verification runs before DONE).
          turns.push(`<<<VERIFY>>>\n${input.smoke_command}\n<<<END>>>\n<<<DONE>>>`);
        } else {
          turns.push(`${specBlocks(gold).join("\n")}\n<<<DONE>>>`);
        }

        turns.push(`${implementationBlocks(gold).join("\n")}\n<<<DONE>>>`);
      } else {
        // Ungated arms have no phase machinery: a diligent agent lands spec + implementation in
        // one turn (this is the "Arm 0 spontaneously maintains the spec" finding-shaped fixture).
        turns.push(`${specBlocks(gold).join("\n")}\n${implementationBlocks(gold).join("\n")}\n<<<DONE>>>`);
      }

      turns.push("No — the spec files matched what I implemented; I kept them in sync.");
    } else {
      const blocks = implementationBlocks(gold);

      if (behavior === "registry_bypass") {
        const goldRoutes = parseRegistryRoutes(gold["registry.ts"]);
        const bypassRoute = pickE4BypassRoute({
          goldRoutes,
          t0Routes: parseRegistryRoutes(generated.initial_workspace["registry.ts"])
        });
        const prunedRegistry = renderRegistryRoutes(
          gold["registry.ts"],
          goldRoutes.filter((route) => route !== bypassRoute)
        );

        blocks[0] = fileBlock("registry.ts", prunedRegistry);
        blocks.push(fileBlock("server.ts", directWireIntoServer(gold["server.ts"], bypassRoute)));
      }

      turns.push(`${blocks.join("\n")}\n<<<DONE>>>`);
      turns.push("I did not look at the spec files.");
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
