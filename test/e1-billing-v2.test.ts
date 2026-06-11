import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { ScriptedAgentProvider } from "../src/e1-no-provider-runner";
import { loadE1OpenSpecProfile, type E1OpenSpecProfile } from "../src/e1-openspec-constants";
import {
  loadE1OraclePackage,
  loadE1TaskPackage,
  runE1ModuleCallCases,
  runE1TaskPackageNoProvider,
  type E1ModuleCallOracleCase,
  type E1OraclePackage,
  type E1TaskPackage,
  type E1TaskPackageNoProviderBundle
} from "../src/e1-package-runner";

const ROOT = join(import.meta.dir, "..", "tasks", "e1-billing-v2");
const PROFILE_PATH = join(import.meta.dir, "..", "docs", "protocols", "e1-openspec-workflow-constants-v0.json");
const CHECKPOINTS = Array.from({ length: 18 }, (_, index) => String(index + 1));

const CHANGE_NAMES: Record<string, string> = {
  "5": "cp05-upgrade-proration",
  "6": "cp06-downgrade-at-period-end",
  "7": "cp07-percent-coupon",
  "8": "cp08-fixed-coupon-stacking",
  "9": "cp09-plan-change-with-coupon",
  "10": "cp10-partial-refunds",
  "11": "cp11-refund-discount-allocation",
  "12": "cp12-dunning-on-payment-failure",
  "13": "cp13-entitlement-gating",
  "14": "cp14-cancellation-during-dunning",
  "15": "cp15-v2-serializer",
  "16": "cp16-invoice-finalization",
  "17": "cp17-replay-determinism",
  "18": "cp18-webhook-idempotency"
};

const CHANGE_TITLES: Record<string, string> = {
  "5": "Mid-period upgrade proration",
  "6": "Downgrade at period end",
  "7": "Percent coupons with largest-remainder allocation",
  "8": "Fixed coupons stack after percent coupons",
  "9": "Coupons on prorated invoices",
  "10": "Partial refunds with a hard cap",
  "11": "Refund allocation across discounted lines",
  "12": "Dunning on payment failure",
  "13": "Entitlement gating during dunning",
  "14": "Cancellation including during dunning",
  "15": "v2 serializer beside a byte-stable v1",
  "16": "Finalized invoices are immutable",
  "17": "Deterministic audit replay",
  "18": "Webhook idempotency for every event type"
};

// The two precommitted naive regressions (design doc): a careless CP07 invoice rewrite whose
// subtotal forgets proration lines, and a CP15 serializer regeneration that "modernizes" v1.
const NAIVE_CP07_INVOICE_PATCH = {
  find: "const subtotal = lines.reduce((sum, line) => {",
  replace:
    'const subtotal = lines.filter((line) => line.kind === "plan" || line.kind === "usage").reduce((sum, line) => {'
};
const NAIVE_CP15_SERIALIZER_PATCH = {
  find: "  parts.push(`\"total\":${invoice.total_cents}`);\n\n  return `{${parts.join(\",\")}}`;",
  replace:
    "  parts.push(`\"total\":${invoice.total_cents}`);\n  parts.push(`\"captured\":${invoice.captured_cents}`);\n  parts.push(`\"refunded\":${invoice.refunded_cents}`);\n\n  return `{${parts.join(\",\")}}`;"
};

type Mutation = { id: string; phase: string; file: string; find: string; replace: string };

const MUTATIONS: Mutation[] = [
  { id: "A-audit-seq-offset", phase: "A", file: "src/events/audit.ts", find: "entries.length + 1", replace: "entries.length + 2" },
  {
    id: "A-usage-rounding-trunc",
    phase: "A",
    file: "src/domain/invoice.ts",
    find: "mulDivHalfEven(seed.unit_price_cents, seed.quantity_milli, 1000)",
    replace: "Math.trunc((seed.unit_price_cents * seed.quantity_milli) / 1000)"
  },
  {
    id: "A-v1-field-reorder",
    phase: "A",
    file: "src/api/serializers.ts",
    find: '`"subscription":${jsonString(invoice.subscription_id)}`,\n    `"status":${jsonString(invoice.status)}`,',
    replace: '`"status":${jsonString(invoice.status)}`,\n    `"subscription":${jsonString(invoice.subscription_id)}`,'
  },
  {
    id: "B-per-line-discount-rounding",
    phase: "B",
    file: "src/domain/invoice.ts",
    find: "const shares = allocateLargestRemainder(\n    discount_total_cents,\n    positiveIndexes.map(({ line }) => line.amount_cents)\n  );",
    replace:
      "const base = positiveIndexes.reduce((sum, { line }) => sum + line.amount_cents, 0);\n  const shares = positiveIndexes.map(({ line }) => Math.round((discount_total_cents * line.amount_cents) / base));"
  },
  { id: "B-subtotal-forgets-proration", phase: "B", file: "src/domain/invoice.ts", ...NAIVE_CP07_INVOICE_PATCH },
  {
    id: "B-discount-hits-credits",
    phase: "B",
    file: "src/domain/invoice.ts",
    find: ".filter(({ line }) => line.amount_cents > 0);",
    replace: ".filter(({ line }) => line.amount_cents !== 0);"
  },
  {
    id: "C-refund-cap-dropped",
    phase: "C",
    file: "src/domain/refunds.ts",
    find: "if (invoice.refunded_cents + amount_cents > invoice.captured_cents) {",
    replace: "if (false) {"
  },
  { id: "C-grace-extends", phase: "C", file: "src/domain/dunning.ts", find: "<= GRACE_MAX_ATTEMPTS", replace: "<= GRACE_MAX_ATTEMPTS + 1" },
  { id: "C-grace-reports-full", phase: "C", file: "src/domain/dunning.ts", find: '? "grace" : "none"', replace: '? "full" : "none"' },
  { id: "D-v1-gains-fields", phase: "D", file: "src/api/serializers.ts", ...NAIVE_CP15_SERIALIZER_PATCH },
  {
    id: "D-view-drops-finalized",
    phase: "D",
    file: "src/domain/invoice.ts",
    find: "...(invoice.finalized ? { finalized: true } : {}),",
    replace: ""
  },
  {
    id: "D-v2-drops-captured",
    phase: "D",
    file: "src/api/serializers.ts",
    find: '`"captured":${invoice.captured_cents}`,\n    `"refunded":${invoice.refunded_cents}`',
    replace: '`"refunded":${invoice.refunded_cents}`'
  }
];

const tempRoots: string[] = [];
let profile: E1OpenSpecProfile;
let taskPackage: E1TaskPackage;
let oraclePackage: E1OraclePackage;
let referenceFiles: Record<string, string>;
let referenceBundle: E1TaskPackageNoProviderBundle;
let naiveBundle: E1TaskPackageNoProviderBundle;

beforeAll(async () => {
  profile = await loadE1OpenSpecProfile(PROFILE_PATH);
  taskPackage = await loadE1TaskPackage(join(ROOT, "task-package"));
  oraclePackage = await loadE1OraclePackage(join(ROOT, "oracle-package"));
  referenceFiles = await readTree(join(ROOT, "reference", "src"), "src");

  const runsRoot = join(tmpdir(), `hit-sdd-billing-gates-${Date.now()}`);
  tempRoots.push(runsRoot);
  await mkdir(runsRoot, { recursive: true });

  referenceBundle = await runFixture(runsRoot, "billing-reference", referenceFiles, {});
  naiveBundle = await runFixture(runsRoot, "billing-naive", referenceFiles, {
    "7": { "src/domain/invoice.ts": patch(referenceFiles["src/domain/invoice.ts"], [NAIVE_CP07_INVOICE_PATCH]) },
    "15": { "src/api/serializers.ts": patch(referenceFiles["src/api/serializers.ts"], [NAIVE_CP15_SERIALIZER_PATCH]) }
  });
}, 240000);

afterAll(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("e1-billing-v2 acceptance gates", () => {
  test("gate 1: package loads, parity holds, and the run completes with all archives ok", () => {
    expect(taskPackage.workflow).toBe("openspec");
    expect(taskPackage.checkpoints).toEqual(CHECKPOINTS);
    expect(oraclePackage.oracle_kind).toBe("module-call-json-v1");
    expect(oraclePackage.cases.length).toBeGreaterThanOrEqual(140);
    expect(referenceBundle.no_provider_run.run_summary.status).toBe("completed");

    const workflow = referenceBundle.openspec_workflow!;
    const archives = Object.values(workflow.archive_records).flat();

    expect(archives).toHaveLength(28);
    expect(archives.every((record) => record.archive_ok)).toBe(true);
    expect(workflow.scenario_parity[0]).toEqual({ checkpoint_id: "1", ok: true });
  });

  test("gate 2: the reference scores 100% on the cumulative hidden oracle at every checkpoint", () => {
    for (const conditionId of ["context_only_spec", "feedback_capable_spec"] as const) {
      for (const summary of referenceBundle.oracle_scoring.checkpoint_end[conditionId]) {
        expect(`${conditionId} cp${summary.checkpoint_id}: ${summary.summary.pass_rate}`).toBe(
          `${conditionId} cp${summary.checkpoint_id}: 1`
        );
      }
    }

    expect(referenceBundle.metrics.by_condition.context_only_spec).toBe(1);
    expect(referenceBundle.metrics.by_condition.feedback_capable_spec).toBe(1);
  });

  test("gate 3: the naive agent produces the two precommitted cross-checkpoint, cross-file regressions", () => {
    const passByCheckpoint = checkPassMap(naiveBundle, "context_only_spec");
    const regressed = new Map<string, { introduced: string; failed_at: string; commitment: string }>();

    for (const [checkId, perCheckpoint] of passByCheckpoint) {
      const checkpointsSeen = [...perCheckpoint.entries()];
      const firstPass = checkpointsSeen.find(([, passed]) => passed);
      const failAfterPass = checkpointsSeen.find(
        ([cp, passed]) => !passed && firstPass && Number(cp) > Number(firstPass[0])
      );

      if (firstPass && failAfterPass) {
        const oracleCase = oraclePackage.cases.find((c) => c.check_id === checkId)!;
        regressed.set(checkId, {
          introduced: oracleCase.checkpoint_introduced,
          failed_at: failAfterPass[0],
          commitment: oracleCase.commitment_id
        });
      }
    }

    const cp5RegressedAt7 = [...regressed.values()].filter(
      (r) => r.introduced === "5" && Number(r.failed_at) >= 7
    );
    const cp4RegressedAt15 = [...regressed.values()].filter(
      (r) => r.introduced === "4" && Number(r.failed_at) >= 15
    );

    // (a) CP07 coupon-era invoice rewrite regresses CP05 prorated totals (different file, earlier checkpoint).
    expect(cp5RegressedAt7.length).toBeGreaterThanOrEqual(1);
    // (b) CP15 serializer regeneration regresses CP04 v1 byte stability.
    expect(cp4RegressedAt15.length).toBeGreaterThanOrEqual(1);

    const regressedCommitments = new Set([...regressed.values()].map((r) => r.commitment));

    expect(regressedCommitments.has("I-TOTALS")).toBe(true);
    expect(regressedCommitments.has("I-V1BYTES")).toBe(true);
    expect(regressed.size).toBeGreaterThanOrEqual(2);
    // The reference run shows none of these regressions.
    expect(referenceBundle.metrics.by_condition.context_only_spec).toBe(1);
    expect(naiveBundle.metrics.by_condition.context_only_spec).toBeLessThan(1);
  });

  test("gate 4: frozen baselines fail each sampled checkpoint's new cases and pass everything earlier", async () => {
    const stages: Array<{ k: number; overrides: Record<string, string> }> = [
      { k: 5, overrides: await stageOverrides("cp04") },
      { k: 10, overrides: await stageOverrides("cp09") },
      { k: 15, overrides: await stageOverrides("cp14") }
    ];

    for (const { k, overrides } of stages) {
      const snapshot = await materializeSnapshot({ ...referenceFiles, ...overrides });
      const priorCases = cumulativeCasesThrough(k - 1);
      const newCases = oraclePackage.cases.filter(
        (c) => c.checkpoint_introduced === String(k)
      ) as E1ModuleCallOracleCase[];
      const priorResults = await runE1ModuleCallCases({ snapshotRoot: snapshot, cases: priorCases });
      const newResults = await runE1ModuleCallCases({ snapshotRoot: snapshot, cases: newCases });
      const priorFailures = priorResults.filter((r) => !r.passed);

      expect(`k=${k} prior failures: ${priorFailures.map((r) => r.check_id).join(",")}`).toBe(
        `k=${k} prior failures: `
      );
      expect(newResults.some((r) => !r.passed)).toBe(true);
    }
  }, 120000);

  test("gate 5: the mutation suite is caught at >=90%", async () => {
    let caught = 0;
    const missed: string[] = [];

    for (const mutation of MUTATIONS) {
      const mutated = { ...referenceFiles };

      expect(mutated[mutation.file]).toContain(mutation.find);
      mutated[mutation.file] = mutated[mutation.file].replace(mutation.find, mutation.replace);

      const snapshot = await materializeSnapshot(mutated);
      const results = await runE1ModuleCallCases({
        snapshotRoot: snapshot,
        cases: oraclePackage.cases as E1ModuleCallOracleCase[]
      });

      if (results.some((r) => !r.passed)) {
        caught += 1;
      } else {
        missed.push(mutation.id);
      }
    }

    expect(`caught ${caught}/${MUTATIONS.length}; missed: ${missed.join(",")}`).toBe(
      `caught ${MUTATIONS.length}/${MUTATIONS.length}; missed: `
    );

    for (const phase of ["A", "B", "C", "D"]) {
      expect(MUTATIONS.filter((m) => m.phase === phase).length).toBeGreaterThanOrEqual(3);
    }
  }, 120000);
});

describe("e1-billing-v2 isolated-competence support", () => {
  test("a single checkpoint runs from a stage baseline, is solvable, and replays with the overlay", async () => {
    const { inspectE1Bundle } = await import("../src/e1-inspect");
    const { E1OpenAICompatibleAgentProvider } = await import("../src/e1-live-provider");
    const runsRoot = join(tmpdir(), `hit-sdd-billing-iso-${Date.now()}`);
    tempRoots.push(runsRoot);
    await mkdir(runsRoot, { recursive: true });

    const baselineFiles = { ...referenceFiles, ...(await stageOverrides("cp04")) };
    const solverTurn = [
      ...Object.entries(referenceFiles)
        .sort()
        .map(([path, content]) => fileBlock(path, content)),
      fileBlock(`openspec/changes/${CHANGE_NAMES["5"]}/specs/billing/spec.md`, deltaFor("5")),
      "<<<DONE>>>"
    ].join("\n");

    const makeProvider = (turns: string[]) => {
      let index = 0;

      return new E1OpenAICompatibleAgentProvider({
        providerId: "billing-iso-canned",
        providerRouteId: "canned-isolated-competence",
        model: "canned/billing-fixture",
        endpoint: "https://provider.invalid/v1/chat/completions",
        apiKey: "sk-canned-billing",
        transport: {
          transport_kind: "canned",
          async send() {
            const content = turns[Math.min(index, turns.length - 1)];
            index += 1;

            return {
              status: 200,
              body: {
                choices: [{ message: { content } }],
                usage: { prompt_tokens: 1000, completion_tokens: 200 }
              }
            };
          }
        },
        liveMode: false,
        spendCapUsd: 1,
        maxEstimatedCallCostUsd: 0.01,
        pricingUsdPerMillionTokens: { input: 1, cached_input: 0.1, output: 2 }
      });
    };

    const { runE1TaskPackageProvider } = await import("../src/e1-package-runner");
    const solverBundle = await runE1TaskPackageProvider({
      constants: profile.constants,
      taskPackage,
      oraclePackage,
      runsRoot,
      runId: "billing-iso-solver",
      conditions: ["context_only_spec"],
      checkpoints: ["5"],
      runClassification: "diagnostic_invalid",
      openspecProfile: profile,
      baselineOverlay: { files: baselineFiles },
      providerFactory: () => makeProvider([solverTurn])
    });

    expect(solverBundle.baseline_overlay?.file_count).toBe(Object.keys(baselineFiles).length);
    expect(solverBundle.baseline_overlay?.files_hash).toHaveLength(64);
    expect(solverBundle.content_hash_manifest.baseline_overlay_hash).toBe(
      solverBundle.baseline_overlay!.files_hash
    );
    expect(solverBundle.metrics.by_condition.context_only_spec).toBe(1);

    const idleBundle = await runE1TaskPackageProvider({
      constants: profile.constants,
      taskPackage,
      oraclePackage,
      runsRoot,
      runId: "billing-iso-idle",
      conditions: ["context_only_spec"],
      checkpoints: ["5"],
      runClassification: "diagnostic_invalid",
      openspecProfile: profile,
      baselineOverlay: { files: baselineFiles },
      providerFactory: () => makeProvider(["<<<DONE>>>"])
    });

    // The baseline preserves everything through CP04 but cannot pass CP05's new cases.
    const idleScore = idleBundle.metrics.by_condition.context_only_spec!;
    expect(idleScore).toBeLessThan(1);
    expect(idleScore).toBeGreaterThan(0.5);

    const inspectTmp = join(tmpdir(), `hit-sdd-billing-iso-inspect-${Date.now()}`);
    tempRoots.push(inspectTmp);
    await mkdir(inspectTmp, { recursive: true });

    const report = await inspectE1Bundle({
      constants: profile.constants,
      bundlePath: join(runsRoot, "billing-iso-solver", "e1-task-package-provider-bundle.json"),
      taskPackagePath: join(ROOT, "task-package"),
      oraclePackagePath: join(ROOT, "oracle-package"),
      tmpRoot: inspectTmp,
      openspecProfile: profile
    });

    expect(report.mismatches).toEqual([]);
    expect(report.valid).toBe(true);
    expect(report.run_classification).toBe("diagnostic_invalid");
  }, 120000);
});

function patch(source: string, patches: Array<{ find: string; replace: string }>): string {
  let result = source;

  for (const { find, replace } of patches) {
    if (!result.includes(find)) {
      throw new Error(`patch target not found: ${find.slice(0, 60)}`);
    }

    result = result.replace(find, replace);
  }

  return result;
}

async function runFixture(
  runsRoot: string,
  runId: string,
  files: Record<string, string>,
  overwritesByCheckpoint: Record<string, Record<string, string>>
): Promise<E1TaskPackageNoProviderBundle> {
  const script = (checkpointId: string): string[] => {
    const blocks: string[] = [];

    if (checkpointId === "1") {
      for (const [path, content] of Object.entries(files).sort()) {
        blocks.push(fileBlock(path, content));
      }
    }

    for (const [path, content] of Object.entries(overwritesByCheckpoint[checkpointId] ?? {})) {
      blocks.push(fileBlock(path, content));
    }

    const changeName = CHANGE_NAMES[checkpointId];

    if (changeName) {
      blocks.push(fileBlock(`openspec/changes/${changeName}/specs/billing/spec.md`, deltaFor(checkpointId)));
    }

    blocks.push("<<<DONE>>>");

    return [blocks.join("\n")];
  };

  return runE1TaskPackageNoProvider({
    constants: profile.constants,
    taskPackage,
    oraclePackage,
    runsRoot,
    runId,
    openspecProfile: profile,
    arms: {
      context_only_spec: ({ checkpointId }) =>
        new ScriptedAgentProvider({ providerId: `${runId}-c-${checkpointId}`, script: script(checkpointId) }),
      feedback_capable_spec: ({ checkpointId }) =>
        new ScriptedAgentProvider({ providerId: `${runId}-f-${checkpointId}`, script: script(checkpointId) })
    }
  });
}

function fileBlock(path: string, content: string): string {
  return [`<<<FILE ${path}>>>`, content.replace(/\n$/, ""), "<<<END>>>"].join("\n");
}

function deltaFor(checkpointId: string): string {
  return [
    "## ADDED Requirements",
    "",
    `### Requirement: ${CHANGE_TITLES[checkpointId]}`,
    `The engine SHALL implement checkpoint CP${checkpointId.padStart(2, "0")} (${CHANGE_TITLES[checkpointId]}) as specified.`,
    "",
    "#### Scenario: Behavior matches the checkpoint spec",
    `- **GIVEN** the events documented for CP${checkpointId.padStart(2, "0")}`,
    "- **WHEN** the relevant query is evaluated",
    "- **THEN** the result matches the checkpoint's worked examples"
  ].join("\n");
}

function checkPassMap(
  bundle: E1TaskPackageNoProviderBundle,
  conditionId: "context_only_spec" | "feedback_capable_spec"
): Map<string, Map<string, boolean>> {
  const map = new Map<string, Map<string, boolean>>();

  for (const checkpointId of CHECKPOINTS) {
    const scores = bundle.oracle_scoring.per_turn[conditionId][checkpointId];
    const lastTurn = scores?.at(-1);

    for (const check of lastTurn?.checks ?? []) {
      const perCheckpoint = map.get(check.check_id) ?? new Map<string, boolean>();
      perCheckpoint.set(checkpointId, check.passed);
      map.set(check.check_id, perCheckpoint);
    }
  }

  return map;
}

function cumulativeCasesThrough(k: number): E1ModuleCallOracleCase[] {
  return oraclePackage.cases.filter(
    (c) => Number(c.checkpoint_introduced) <= k
  ) as E1ModuleCallOracleCase[];
}

async function stageOverrides(stage: string): Promise<Record<string, string>> {
  const stagesDir = join(ROOT, "reference", "stages");
  const overrides: Record<string, string> = {};
  const mapping: Record<string, string> = {
    money: "src/domain/money.ts",
    subscription: "src/domain/subscription.ts",
    invoice: "src/domain/invoice.ts",
    audit: "src/events/audit.ts",
    serializers: "src/api/serializers.ts",
    billing: "src/billing.ts"
  };

  for (const entry of await readdir(stagesDir)) {
    const match = entry.match(/^([a-z]+)\.(cp\d+)\.ts$/);

    if (match && match[2] === stage && mapping[match[1]]) {
      overrides[mapping[match[1]]] = await readFile(join(stagesDir, entry), "utf8");
    }
  }

  if (stage === "cp09" || stage === "cp14") {
    overrides["src/api/serializers.ts"] = await readFile(join(stagesDir, "serializers.cp14.ts"), "utf8");
  }

  if (Object.keys(overrides).length === 0) {
    throw new Error(`no stage overrides found for ${stage}`);
  }

  return overrides;
}

async function materializeSnapshot(files: Record<string, string>): Promise<string> {
  const root = join(tmpdir(), `hit-sdd-billing-snap-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tempRoots.push(root);
  await writeFile(join(await mkdirp(root), "package.json"), "{\"type\":\"module\"}\n");

  for (const [path, content] of Object.entries(files)) {
    const target = join(root, path);
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, content);
  }

  return root;
}

async function mkdirp(path: string): Promise<string> {
  await mkdir(path, { recursive: true });

  return path;
}

async function readTree(root: string, prefix: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        files[`${prefix}/${relative(root, full).split(sep).join("/")}`] = await readFile(full, "utf8");
      }
    }
  }

  await walk(root);

  return files;
}
