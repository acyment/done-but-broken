// v3-M0 census (E4V3-PRODUCT-LOOP-PROPOSAL.md §5): for every op kind the substrate can draw and
// both phrasing-verbatim variants, request ∪ PM brief fully determines the task delta — every
// fact the ambiguity tagger marks underdetermined is covered by the brief, non-vacuously (exact
// literals appear in the text). Plus determinism, leakage, and delta-shape checks.
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { buildBaselineIr, type E4SchemaIR } from "../src/e4/substrate/ir";
import { createE4Prng } from "../src/e4/substrate/prng";
import type { E4ChangeOpKind } from "../src/e4/substrate/ops";
import { drawE4V2TaskSequence, type E4DrawnTask } from "../src/e4/substrate/v2/draw";
import { E4_V2_CONSTANTS_PATH, loadE4V2Constants } from "../src/e4/v2/constants";
import { computeE4TaskDelta, type E4TaskDelta } from "../src/e4/v3/task-delta";
import { tagE4RequestDeterminacy, underdeterminedFacts } from "../src/e4/v3/ambiguity";
import { renderE4PmBrief } from "../src/e4/v3/pm-brief";

const repoRoot = join(import.meta.dir, "..");
const { constants } = await loadE4V2Constants(join(repoRoot, E4_V2_CONSTANTS_PATH));

const ALL_OP_KINDS: E4ChangeOpKind[] = [
  "add_entity",
  "delete_entity",
  "rename_entity",
  "add_field",
  "rename_field",
  "retype_field",
  "delete_field",
  "add_endpoint",
  "modify_endpoint",
  "add_validation_rule",
  "modify_convention",
  "add_relationship",
  "noop_maintenance"
];

type DrawnCase = { seed: number; task: E4DrawnTask; preIr: E4SchemaIR; delta: E4TaskDelta };

// Deterministic corpus: scan seeds until every op kind has been drawn at least once. The scan
// itself is pure (substrate draw is a pure function of the seed), so the corpus is stable.
function buildCorpus(): { cases: DrawnCase[]; byKind: Map<E4ChangeOpKind, DrawnCase[]> } {
  const cases: DrawnCase[] = [];
  const byKind = new Map<E4ChangeOpKind, DrawnCase[]>();
  const missing = new Set<E4ChangeOpKind>(ALL_OP_KINDS);

  for (let seed = 1; seed <= 300 && missing.size > 0; seed++) {
    const baseline = buildBaselineIr();
    const prng = createE4Prng(seed);
    const tasks = drawE4V2TaskSequence({
      baselineIr: baseline,
      taskCount: 6,
      opMix: { weights: constants.op_mix.weights },
      prng
    });

    let preIr = baseline;

    for (const task of tasks) {
      const delta = computeE4TaskDelta(preIr, task.ground_truth_ir);
      const drawn: DrawnCase = { seed, task, preIr, delta };

      cases.push(drawn);
      const list = byKind.get(task.op_kind) ?? [];
      list.push(drawn);
      byKind.set(task.op_kind, list);
      missing.delete(task.op_kind);
      preIr = task.ground_truth_ir;
    }
  }

  return { cases, byKind };
}

const corpus = buildCorpus();

describe("v3-M0 census: corpus", () => {
  test("every op kind is drawn at least once in the scan range", () => {
    for (const kind of ALL_OP_KINDS) {
      expect(corpus.byKind.has(kind)).toBe(true);
    }
  });

  test("non-noop tasks have non-empty deltas; noop tasks are empty", () => {
    for (const drawn of corpus.cases) {
      if (drawn.task.op_kind === "noop_maintenance") {
        expect(drawn.delta.is_empty).toBe(true);
      } else {
        expect(drawn.delta.is_empty).toBe(false);
      }
    }
  });
});

describe("v3-M0 census: request ∪ brief determines the delta", () => {
  test("every underdetermined fact is covered by the brief, for both verbatim variants", () => {
    for (const drawn of corpus.cases) {
      const brief = renderE4PmBrief({ opKind: drawn.task.op_kind, delta: drawn.delta });
      const coveredKeys = new Set(brief.covered.map((c) => `${c.fact_kind}::${c.subject}`));

      for (const namesItemVerbatim of [true, false]) {
        const facts = tagE4RequestDeterminacy({
          opKind: drawn.task.op_kind,
          namesItemVerbatim,
          delta: drawn.delta
        });

        for (const fact of underdeterminedFacts(facts)) {
          const key =
            fact.fact_kind === "target_identity"
              ? `target_identity::${drawn.task.op_kind}`
              : `${fact.fact_kind}::${fact.subject}`;

          expect(coveredKeys.has(key)).toBe(true);
        }
      }
    }
  });

  test("determined-only ops stay determined under verbatim phrasing", () => {
    for (const kind of ["rename_field", "rename_entity", "delete_field", "delete_entity", "noop_maintenance"] as E4ChangeOpKind[]) {
      for (const drawn of corpus.byKind.get(kind) ?? []) {
        const facts = tagE4RequestDeterminacy({ opKind: kind, namesItemVerbatim: true, delta: drawn.delta });

        expect(underdeterminedFacts(facts)).toHaveLength(0);
      }
    }
  });

  test("paraphrased phrasing makes target identity underdetermined", () => {
    const drawn = corpus.cases[0];
    const facts = tagE4RequestDeterminacy({
      opKind: drawn.task.op_kind,
      namesItemVerbatim: false,
      delta: drawn.delta
    });
    const target = facts.find((fact) => fact.fact_kind === "target_identity");

    expect(target?.determinacy).toBe("underdetermined");
  });
});

describe("v3-M0 census: brief content is non-vacuous", () => {
  test("add_validation_rule brief carries the exact rule literal", () => {
    for (const drawn of corpus.byKind.get("add_validation_rule") ?? []) {
      const brief = renderE4PmBrief({ opKind: "add_validation_rule", delta: drawn.delta });

      for (const rule of drawn.delta.added_rules) {
        const detail = rule.detail as Record<string, unknown>;

        if (rule.kind === "format") {
          expect(brief.text).toContain(String(detail.pattern));
        } else if (rule.kind === "range") {
          expect(brief.text).toContain(String(detail.min));
          expect(brief.text).toContain(String(detail.max));
        } else if (rule.kind === "enum") {
          for (const value of detail.values as unknown[]) {
            expect(brief.text).toContain(String(value));
          }
        }
      }
    }
  });

  test("add_entity brief lists every field and every minted endpoint", () => {
    for (const drawn of corpus.byKind.get("add_entity") ?? []) {
      const brief = renderE4PmBrief({ opKind: "add_entity", delta: drawn.delta });

      for (const entity of drawn.delta.added_entities) {
        for (const field of entity.fields) {
          expect(brief.text).toContain(field.name);
        }
      }

      for (const endpoint of drawn.delta.added_endpoints) {
        expect(brief.text).toContain(`${endpoint.method} ${endpoint.path}`);
      }
    }
  });

  test("modify_convention brief quotes the new statement verbatim", () => {
    for (const drawn of corpus.byKind.get("modify_convention") ?? []) {
      const brief = renderE4PmBrief({ opKind: "modify_convention", delta: drawn.delta });

      for (const convention of drawn.delta.changed_conventions) {
        expect(brief.text).toContain(convention.new_statement);
      }
    }
  });

  test("retype brief states old and new type; noop brief states no change", () => {
    for (const drawn of corpus.byKind.get("retype_field") ?? []) {
      const brief = renderE4PmBrief({ opKind: "retype_field", delta: drawn.delta });

      for (const retype of drawn.delta.retyped_fields) {
        expect(brief.text).toContain(`from ${retype.old_type} to ${retype.new_type}`);
      }
    }

    for (const drawn of corpus.byKind.get("noop_maintenance") ?? []) {
      const brief = renderE4PmBrief({ opKind: "noop_maintenance", delta: drawn.delta });

      expect(brief.text).toContain("No functional change is requested");
    }
  });
});

describe("v3-M0 census: determinism and leakage", () => {
  test("brief is byte-deterministic", () => {
    for (const drawn of corpus.cases.slice(0, 24)) {
      const first = renderE4PmBrief({ opKind: drawn.task.op_kind, delta: drawn.delta });
      const second = renderE4PmBrief({ opKind: drawn.task.op_kind, delta: drawn.delta });

      expect(second.text).toBe(first.text);
      expect(second.covered).toEqual(first.covered);
    }
  });

  test("brief never mentions measurement machinery", () => {
    for (const drawn of corpus.cases) {
      const text = renderE4PmBrief({ opKind: drawn.task.op_kind, delta: drawn.delta }).text.toLowerCase();

      for (const forbidden of ["oracle", "hidden", "scenario", "adversarial", "drift", "manifest"]) {
        expect(text).not.toContain(forbidden);
      }
    }
  });

  test("brief never names entities outside the task's delta closure", () => {
    const baselineNames = buildBaselineIr().entities.map((entity) => entity.name);

    for (const drawn of corpus.cases) {
      const delta = drawn.delta;
      const closure = new Set<string>();

      for (const entity of [...delta.added_entities, ...delta.removed_entities]) {
        closure.add(entity.name);
      }
      for (const rename of delta.renamed_entities) {
        closure.add(rename.old_name);
        closure.add(rename.new_name);
      }
      for (const { entity, field } of [...delta.added_fields, ...delta.removed_fields]) {
        closure.add(entity);
        if (field.ref_entity) closure.add(field.ref_entity);
      }
      for (const rename of delta.renamed_fields) closure.add(rename.entity);
      for (const retype of delta.retyped_fields) closure.add(retype.entity);
      for (const endpoint of [...delta.added_endpoints, ...delta.removed_endpoints]) {
        closure.add(endpoint.entity);
      }
      for (const change of delta.changed_endpoints) closure.add(change.entity);
      for (const rule of [...delta.added_rules, ...delta.removed_rules]) closure.add(rule.entity);

      const text = renderE4PmBrief({ opKind: drawn.task.op_kind, delta: drawn.delta }).text.toLowerCase();

      for (const name of baselineNames) {
        if (!closure.has(name)) {
          expect(text).not.toContain(name.toLowerCase());
        }
      }
    }
  });
});

describe("v3-M0 delta shapes", () => {
  test("rename_entity produces a rename plus path-following endpoint changes", () => {
    for (const drawn of corpus.byKind.get("rename_entity") ?? []) {
      expect(drawn.delta.renamed_entities.length).toBeGreaterThan(0);
      expect(drawn.delta.changed_endpoints.length).toBeGreaterThan(0);
      expect(drawn.delta.added_entities).toHaveLength(0);
      expect(drawn.delta.removed_entities).toHaveLength(0);
    }
  });

  test("delete_entity removes the entity and its endpoints, adds nothing", () => {
    for (const drawn of corpus.byKind.get("delete_entity") ?? []) {
      expect(drawn.delta.removed_entities.length).toBeGreaterThan(0);
      expect(drawn.delta.removed_endpoints.length).toBeGreaterThan(0);
      expect(drawn.delta.added_entities).toHaveLength(0);
      expect(drawn.delta.added_endpoints).toHaveLength(0);
    }
  });

  test("add_entity mints the full v2 operation surface (create/read/update/delete/list)", () => {
    for (const drawn of corpus.byKind.get("add_entity") ?? []) {
      for (const entity of drawn.delta.added_entities) {
        const kinds = drawn.delta.added_endpoints
          .filter((endpoint) => endpoint.entity === entity.name)
          .map((endpoint) => endpoint.kind)
          .toSorted();

        expect(kinds).toEqual(["create", "delete", "list", "read", "update"]);
      }
    }
  });
});
