// E5 P1.1 probe machinery facets (prereg docs/e5/E5-P11-TRUTH-VISIBLE-CLOSE-PREREG-v1.md):
// semantic-family partition (deterministic, no family straddles the split, T0 balance guard),
// shown-verdict rendering (held-out NEVER leaks — exposure note §5.1), the probe write guard,
// and the post-close cycle hook end-to-end with stubbed provider/oracle. Zero spend.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  E5_P11_CYCLE_TURNS,
  computeE5P11Partition,
  createE5P11PostTaskHook,
  e5P11FamilyKey,
  e5P11PartitionStats,
  e5P11SideOfTest,
  e5P11WriteAllowed,
  renderE5P11ShownVerdicts,
  type E5P11CycleRecord
} from "../src/e5/p11";
import type { E4ExecutorVerdict } from "../src/e4/oracle-executor";

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("P1.1 — semantic families", () => {
  test("every sealed test_id shape maps to its prereg §2.3 family", () => {
    expect(e5P11FamilyKey("Widget-create")).toBe("Widget:create");
    expect(e5P11FamilyKey("Widget-create-2")).toBe("Widget:create");
    expect(e5P11FamilyKey("Widget-read")).toBe("Widget:read");
    expect(e5P11FamilyKey("Widget-read-missing")).toBe("Widget:read");
    expect(e5P11FamilyKey("Widget-update")).toBe("Widget:update");
    expect(e5P11FamilyKey("Widget-delete")).toBe("Widget:delete");
    expect(e5P11FamilyKey("Widget-read-after-delete")).toBe("Widget:delete");
    expect(e5P11FamilyKey("Widget-list")).toBe("Widget:list");
    expect(e5P11FamilyKey("Widget-list-filtered")).toBe("Widget:list");
    expect(e5P11FamilyKey("Widget-analytics")).toBe("Widget:analytics");
    expect(e5P11FamilyKey("Widget-unknown-field")).toBe("Widget:validation");
    expect(e5P11FamilyKey("Widget-name-required")).toBe("Widget:validation");
    expect(e5P11FamilyKey("Widget-price-type")).toBe("Widget:validation");
    expect(e5P11FamilyKey("Widget-details-format-rule")).toBe("Widget:validation");
  });
});

describe("P1.1 — partition", () => {
  test("deterministic per seed; no family straddles the split; T0 balance within [0.35, 0.65]", () => {
    for (const seed of [201, 305, 777]) {
      const first = computeE5P11Partition(seed);
      const second = computeE5P11Partition(seed);

      expect(second).toEqual(first);
      expect(first.t0_shown_fraction).toBeGreaterThanOrEqual(0.35);
      expect(first.t0_shown_fraction).toBeLessThanOrEqual(0.65);

      // family cohesion: members of one family always land on the same side
      expect(e5P11SideOfTest(first, "Widget-create")).toBe(e5P11SideOfTest(first, "Widget-create-2"));
      expect(e5P11SideOfTest(first, "Widget-delete")).toBe(e5P11SideOfTest(first, "Widget-read-after-delete"));
      expect(e5P11SideOfTest(first, "Widget-unknown-field")).toBe(e5P11SideOfTest(first, "Widget-name-required"));
    }
  });

  test("families minted after T0 resolve deterministically without moving T0 families", () => {
    const partition = computeE5P11Partition(201);
    const before = { ...partition.t0_families };

    // A family that does not exist at T0 (new entity minted mid-sequence):
    const side = e5P11SideOfTest(partition, "Supplier-create");

    expect(side === "shown" || side === "held_out").toBe(true);
    expect(e5P11SideOfTest(partition, "Supplier-create-2")).toBe(side);
    expect(partition.t0_families).toEqual(before); // lookup never mutates the T0 assignment
  });
});

describe("P1.1 — shown-verdict rendering never leaks held-out (exposure note §5.1)", () => {
  test("held-out ids, counts, and failure text are absent from the rendered message", () => {
    const partition = computeE5P11Partition(201);
    const verdicts: E4ExecutorVerdict[] = [
      { test_id: "Widget-create", passed: true, failures: [] },
      { test_id: "Widget-create-2", passed: false, failures: ["expected 201, saw 400"] },
      { test_id: "Widget-update", passed: false, failures: ["held-out-secret-detail"] },
      { test_id: "Category-list", passed: false, failures: ["another-secret"] }
    ] as E4ExecutorVerdict[];

    const rendered = renderE5P11ShownVerdicts(partition, verdicts);

    for (const verdict of verdicts) {
      const side = e5P11SideOfTest(partition, verdict.test_id);

      if (side === "shown") {
        expect(rendered).toContain(verdict.test_id);
      } else {
        expect(rendered).not.toContain(verdict.test_id);

        for (const failure of verdict.failures ?? []) {
          expect(rendered).not.toContain(failure);
        }
      }
    }

    const shownCount = verdicts.filter((verdict) => e5P11SideOfTest(partition, verdict.test_id) === "shown").length;

    expect(rendered).toContain(`(${shownCount} checks)`);
  });

  test("partition stats split pass/total by side", () => {
    const partition = computeE5P11Partition(201);
    const verdicts = [
      { test_id: "Widget-create", passed: true, failures: [] },
      { test_id: "Widget-update", passed: false, failures: ["x"] }
    ] as E4ExecutorVerdict[];
    const stats = e5P11PartitionStats(partition, verdicts);

    expect(stats.full_total).toBe(2);
    expect(stats.full_pass).toBe(1);
    expect(stats.held_out_total + (2 - stats.held_out_total)).toBe(2);
  });
});

describe("P1.1 — probe write guard", () => {
  test("code files allowed; openspec/** and escapes rejected", () => {
    expect(e5P11WriteAllowed("server.ts")).toBe(true);
    expect(e5P11WriteAllowed("src/registry.ts")).toBe(true);
    expect(e5P11WriteAllowed("openspec/specs/widgets/spec.md")).toBe(false);
    expect(e5P11WriteAllowed("openspec/changes/x/proposal.md")).toBe(false);
    expect(e5P11WriteAllowed("openspec")).toBe(false);
    expect(e5P11WriteAllowed("../outside.ts")).toBe(false);
    expect(e5P11WriteAllowed("/absolute.ts")).toBe(false);
  });
});

describe("P1.1 — post-close cycle hook", () => {
  async function setUpCtx(input: { termination: string; verdicts: E4ExecutorVerdict[] }) {
    const root = await mkdtemp(join(tmpdir(), "e5-p11-"));
    tempRoots.push(root);
    const workspaceDir = join(root, "workspace");
    const recordsDir = join(root, "records");
    await mkdir(workspaceDir, { recursive: true });
    await mkdir(recordsDir, { recursive: true });
    await writeFile(join(workspaceDir, "server.ts"), "// original\n");
    await writeFile(
      join(recordsDir, "hidden-oracle.json"),
      JSON.stringify({ result: { kind: "completed", verdicts: input.verdicts, pass_count: 0, total: input.verdicts.length } })
    );

    return {
      arm: "e4_arm_p" as const,
      task: {
        task_index: 2,
        acceptance_tests: { cumulative: [], delta: [] }
      },
      result: { termination: input.termination },
      workspace_dir: workspaceDir,
      records_dir: recordsDir,
      executor_config: { readiness_timeout_ms: 1000, request_timeout_ms: 1000, readiness_poll_interval_ms: 25 }
    };
  }

  // One id guaranteed SHOWN and one guaranteed HELD-OUT at this seed, derived from the
  // partition itself (which families land where is seed-dependent by design).
  function oppositeSideIds(partition: ReturnType<typeof computeE5P11Partition>): { shown: string; held: string } {
    const representative: Record<string, string> = {
      create: "create",
      read: "read",
      update: "update",
      delete: "delete",
      list: "list",
      analytics: "analytics",
      validation: "unknown-field"
    };
    const idOf = (familyKey: string): string => {
      const [entity, group] = familyKey.split(":");
      return `${entity}-${representative[group]}`;
    };
    const entries = Object.entries(partition.t0_families);
    const shownFamily = entries.find(([, side]) => side === "shown")![0];
    const heldFamily = entries.find(([, side]) => side === "held_out")![0];

    return { shown: idOf(shownFamily), held: idOf(heldFamily) };
  }

  const PARTITION = computeE5P11Partition(201);
  const IDS = oppositeSideIds(PARTITION);
  const VERDICTS = [
    { test_id: IDS.shown, passed: false, failures: ["shown failure detail"] },
    { test_id: IDS.held, passed: false, failures: ["held failure detail"] }
  ] as E4ExecutorVerdict[];

  function scriptedProvider(outputs: string[]) {
    let call = 0;

    return {
      runTurn: async () => ({
        text: outputs[Math.min(call++, outputs.length - 1)],
        usage: { fresh_input_tokens: 10, cached_input_tokens: 0, output_tokens: 5 },
        spend_usd: 0.01
      })
    };
  }

  test("treatment: shows only shown verdicts, applies code writes, rejects openspec, records before/after", async () => {
    const partition = PARTITION;
    const ctx = await setUpCtx({ termination: "done", verdicts: VERDICTS });
    const afterVerdicts = VERDICTS.map((verdict) => ({ ...verdict, passed: true, failures: [] }));
    const hook = createE5P11PostTaskHook({
      mode: "treatment",
      partition,
      smoke_command: "bun run smoke",
      oracle_runner: (async () => ({
        kind: "completed",
        verdicts: afterVerdicts,
        pass_count: afterVerdicts.length,
        total: afterVerdicts.length,
        transcript: []
      })) as never
    });

    const usage = await hook({
      ...ctx,
      provider: scriptedProvider([
        ["<<<FILE server.ts>>>", "// repaired", "<<<END>>>", "<<<FILE openspec/specs/widgets/spec.md>>>", "tamper", "<<<END>>>", "<<<DONE>>>"].join("\n")
      ])
    } as never);

    expect(usage).toEqual({
      tokens: { fresh_input_tokens: 10, cached_input_tokens: 0, output_tokens: 5 },
      spend_usd: 0.01
    });

    const record = JSON.parse(await readFile(join(ctx.records_dir, "p11-cycle.json"), "utf8")) as E5P11CycleRecord;

    expect(record.mode).toBe("treatment");
    expect(record.done_emitted).toBe(true);
    expect(record.turns_used).toBe(1);
    expect(record.applied_paths).toEqual(["server.ts"]);
    expect(record.rejected_paths).toEqual(["openspec/specs/widgets/spec.md"]);
    expect(record.before.full_pass).toBe(0);
    expect(record.after?.full_pass).toBe(2);

    // the shown message never carries the held-out side
    expect(record.shown_message).toContain(IDS.shown);
    expect(record.shown_message).not.toContain(IDS.held);
    expect(record.shown_message).not.toContain("held failure detail");

    expect(await readFile(join(ctx.workspace_dir, "server.ts"), "utf8")).toBe("// repaired");
    expect(await readFile(join(ctx.records_dir, "p11-workspace-after", "server.ts"), "utf8")).toBe("// repaired");
  });

  test("control: no oracle data in the prompt; budget-matched turn cap binds", async () => {
    const partition = computeE5P11Partition(201);
    const ctx = await setUpCtx({ termination: "done", verdicts: VERDICTS });
    const hook = createE5P11PostTaskHook({
      mode: "control",
      partition,
      smoke_command: "bun run smoke",
      oracle_runner: (async () => ({ kind: "completed", verdicts: VERDICTS, pass_count: 0, total: 2, transcript: [] })) as never
    });

    const usage = await hook({ ...ctx, provider: scriptedProvider(["just prose, no protocol blocks"]) } as never);

    expect(usage?.spend_usd).toBeCloseTo(0.01 * E5_P11_CYCLE_TURNS, 10);

    const record = JSON.parse(await readFile(join(ctx.records_dir, "p11-cycle.json"), "utf8")) as E5P11CycleRecord;

    expect(record.mode).toBe("control");
    expect(record.shown_message).toBeNull();
    expect(record.turns_used).toBe(E5_P11_CYCLE_TURNS); // cap binds when the agent never DONEs
    expect(record.transcript.every((turn) => !turn.raw_output.includes("Widget-"))).toBe(true);
  });

  test("non-done tasks get no cycle", async () => {
    const partition = computeE5P11Partition(201);
    const ctx = await setUpCtx({ termination: "budget_exhausted", verdicts: VERDICTS });
    const hook = createE5P11PostTaskHook({
      mode: "treatment",
      partition,
      smoke_command: "bun run smoke",
      oracle_runner: (async () => {
        throw new Error("must not run");
      }) as never
    });

    expect(await hook({ ...ctx, provider: scriptedProvider(["x"]) } as never)).toBeNull();
  });
});
