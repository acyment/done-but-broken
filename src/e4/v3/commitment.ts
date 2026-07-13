// E5 P0-V item 7 (proposal §2): commitment-vs-gold scorer, built for probe P1.5 (request-echo
// at close) and the deferred commitment-sheet designs. Measurement-side only: given a
// STRUCTURED commitment sheet (what the agent claims the task asked for / what it committed
// to deliver) and the task's ground-truth delta, score every claim and every gold fact. The
// sheet's shape mirrors the parked-v4 sketch (fields, required-ness, operations, renames,
// removals, rule literals, convention statements); how an agent is made to EMIT a sheet is the
// probe's design question, not this module's.
//
// Matching discipline follows the reconcile machinery: endpoints match by method + the sealed
// §7.5 dispatcher segment rules (a {param} pattern segment matches any request segment,
// literals must equal — via reconcile's exported matcher); value facts (types, required-ness,
// rule literals, convention statements) compare exactly — a vague or wrong value is a
// contradiction, not a match. Verdicts:
//   matched        — the claim states a gold fact correctly;
//   contradicted   — the claim addresses a gold fact but states it wrongly;
//   invented       — the claim corresponds to nothing in the gold delta;
//   missed         — a gold fact no claim addresses (reported per gold fact).
import type { E4TaskDelta } from "./task-delta";
import { pathSegmentsMatch } from "./reconcile";

export const E4_V3_COMMITMENT_SCORER_ID = "e4-commitment-vs-gold-v1";

export type E4V3CommittedField = { name: string; type: string; required: boolean };

export type E4V3CommitmentSheet = {
  added_entities?: Array<{ name: string; fields: E4V3CommittedField[] }>;
  removed_entities?: string[];
  renamed_entities?: Array<{ old_name: string; new_name: string }>;
  added_fields?: Array<{ entity: string; field: E4V3CommittedField }>;
  removed_fields?: Array<{ entity: string; field_name: string }>;
  renamed_fields?: Array<{ entity: string; old_name: string; new_name: string }>;
  retyped_fields?: Array<{ entity: string; field_name: string; new_type: string }>;
  added_endpoints?: Array<{ method: string; path: string }>;
  removed_endpoints?: Array<{ method: string; path: string }>;
  changed_endpoints?: Array<{ old_method: string; new_method: string; path: string }>;
  added_rules?: Array<{ entity: string; field: string; kind: string; detail?: Record<string, unknown> }>;
  removed_rules?: Array<{ entity: string; field: string; kind: string }>;
  changed_conventions?: Array<{ convention_id: string; new_statement: string }>;
  no_change?: boolean;
};

export type E4V3CommitmentVerdict = "matched" | "contradicted" | "invented";

export type E4V3ScoredClaim = {
  category: string;
  claim: string;
  verdict: E4V3CommitmentVerdict;
  detail: string | null;
};

export type E4V3MissedFact = { category: string; fact: string };

export type E4V3CommitmentScore = {
  commitment_scorer_id: typeof E4_V3_COMMITMENT_SCORER_ID;
  claims: E4V3ScoredClaim[];
  missed: E4V3MissedFact[];
  counts: { matched: number; contradicted: number; invented: number; missed: number };
};

function ruleDetailEquals(claimDetail: Record<string, unknown>, goldDetail: unknown): boolean {
  return JSON.stringify(normalize(claimDetail)) === JSON.stringify(normalize(goldDetail));

  function normalize(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map(normalize);
    }

    if (value !== null && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .toSorted(([a], [b]) => a.localeCompare(b))
          .map(([key, entry]) => [key, normalize(entry)])
      );
    }

    return value;
  }
}

export function scoreE4V3CommitmentSheet(input: {
  sheet: E4V3CommitmentSheet;
  delta: E4TaskDelta;
}): E4V3CommitmentScore {
  const { sheet, delta } = input;
  const claims: E4V3ScoredClaim[] = [];
  const missed: E4V3MissedFact[] = [];
  const claimedGoldFacts = new Set<string>();

  const score = (category: string, claim: string, verdict: E4V3CommitmentVerdict, detail: string | null = null) =>
    claims.push({ category, claim, verdict, detail });

  // ---- added entities (field sets compare value-aware, per field) ----

  const goldAdded = new Map(delta.added_entities.map((entity) => [entity.name, entity]));

  for (const claimed of sheet.added_entities ?? []) {
    const gold = goldAdded.get(claimed.name);

    if (!gold) {
      score("added_entity", claimed.name, "invented");
      continue;
    }

    claimedGoldFacts.add(`added_entity:${gold.name}`);
    const goldFields = new Map(gold.fields.map((field) => [field.name, field]));
    let contradiction: string | null = null;

    for (const field of claimed.fields) {
      const goldField = goldFields.get(field.name);

      if (!goldField) {
        contradiction = `claims field ${field.name} the gold entity does not carry`;
        break;
      }

      if (goldField.type !== field.type || goldField.required !== field.required) {
        contradiction = `field ${field.name}: claimed ${field.type}/${field.required ? "required" : "optional"}, gold ${goldField.type}/${goldField.required ? "required" : "optional"}`;
        break;
      }
    }

    if (contradiction === null && claimed.fields.length !== gold.fields.length) {
      const claimedNames = new Set(claimed.fields.map((field) => field.name));
      const missing = gold.fields.filter((field) => !claimedNames.has(field.name)).map((field) => field.name);
      contradiction = `field set incomplete: missing ${missing.join(", ")}`;
    }

    score("added_entity", claimed.name, contradiction === null ? "matched" : "contradicted", contradiction);
  }

  for (const gold of delta.added_entities) {
    if (!claimedGoldFacts.has(`added_entity:${gold.name}`)) {
      missed.push({ category: "added_entity", fact: gold.name });
    }
  }

  // ---- removed entities ----

  const goldRemoved = new Set(delta.removed_entities.map((entity) => entity.name));

  for (const claimed of sheet.removed_entities ?? []) {
    if (goldRemoved.has(claimed)) {
      claimedGoldFacts.add(`removed_entity:${claimed}`);
      score("removed_entity", claimed, "matched");
    } else {
      score("removed_entity", claimed, "invented");
    }
  }

  for (const gold of delta.removed_entities) {
    if (!claimedGoldFacts.has(`removed_entity:${gold.name}`)) {
      missed.push({ category: "removed_entity", fact: gold.name });
    }
  }

  // ---- renamed entities ----

  const goldEntityRenames = new Map(delta.renamed_entities.map((rename) => [rename.old_name, rename]));

  for (const claimed of sheet.renamed_entities ?? []) {
    const gold = goldEntityRenames.get(claimed.old_name);

    if (!gold) {
      score("renamed_entity", `${claimed.old_name} -> ${claimed.new_name}`, "invented");
    } else if (gold.new_name !== claimed.new_name) {
      claimedGoldFacts.add(`renamed_entity:${gold.old_name}`);
      score(
        "renamed_entity",
        `${claimed.old_name} -> ${claimed.new_name}`,
        "contradicted",
        `gold renames to ${gold.new_name}`
      );
    } else {
      claimedGoldFacts.add(`renamed_entity:${gold.old_name}`);
      score("renamed_entity", `${claimed.old_name} -> ${claimed.new_name}`, "matched");
    }
  }

  for (const gold of delta.renamed_entities) {
    if (!claimedGoldFacts.has(`renamed_entity:${gold.old_name}`)) {
      missed.push({ category: "renamed_entity", fact: `${gold.old_name} -> ${gold.new_name}` });
    }
  }

  // ---- added / removed / renamed / retyped fields ----

  const goldAddedFields = new Map(delta.added_fields.map((entry) => [`${entry.entity}.${entry.field.name}`, entry.field]));

  for (const claimed of sheet.added_fields ?? []) {
    const key = `${claimed.entity}.${claimed.field.name}`;
    const gold = goldAddedFields.get(key);

    if (!gold) {
      score("added_field", key, "invented");
    } else if (gold.type !== claimed.field.type || gold.required !== claimed.field.required) {
      claimedGoldFacts.add(`added_field:${key}`);
      score(
        "added_field",
        key,
        "contradicted",
        `claimed ${claimed.field.type}/${claimed.field.required ? "required" : "optional"}, gold ${gold.type}/${gold.required ? "required" : "optional"}`
      );
    } else {
      claimedGoldFacts.add(`added_field:${key}`);
      score("added_field", key, "matched");
    }
  }

  for (const [key] of goldAddedFields) {
    if (!claimedGoldFacts.has(`added_field:${key}`)) {
      missed.push({ category: "added_field", fact: key });
    }
  }

  const goldRemovedFields = new Set(delta.removed_fields.map((entry) => `${entry.entity}.${entry.field.name}`));

  for (const claimed of sheet.removed_fields ?? []) {
    const key = `${claimed.entity}.${claimed.field_name}`;

    if (goldRemovedFields.has(key)) {
      claimedGoldFacts.add(`removed_field:${key}`);
      score("removed_field", key, "matched");
    } else {
      score("removed_field", key, "invented");
    }
  }

  for (const key of goldRemovedFields) {
    if (!claimedGoldFacts.has(`removed_field:${key}`)) {
      missed.push({ category: "removed_field", fact: key });
    }
  }

  const goldFieldRenames = new Map(delta.renamed_fields.map((rename) => [`${rename.entity}.${rename.old_name}`, rename]));

  for (const claimed of sheet.renamed_fields ?? []) {
    const key = `${claimed.entity}.${claimed.old_name}`;
    const gold = goldFieldRenames.get(key);

    if (!gold) {
      score("renamed_field", `${key} -> ${claimed.new_name}`, "invented");
    } else if (gold.new_name !== claimed.new_name) {
      claimedGoldFacts.add(`renamed_field:${key}`);
      score("renamed_field", `${key} -> ${claimed.new_name}`, "contradicted", `gold renames to ${gold.new_name}`);
    } else {
      claimedGoldFacts.add(`renamed_field:${key}`);
      score("renamed_field", `${key} -> ${claimed.new_name}`, "matched");
    }
  }

  for (const [key, gold] of goldFieldRenames) {
    if (!claimedGoldFacts.has(`renamed_field:${key}`)) {
      missed.push({ category: "renamed_field", fact: `${key} -> ${gold.new_name}` });
    }
  }

  const goldRetypes = new Map(delta.retyped_fields.map((retype) => [`${retype.entity}.${retype.field_name}`, retype]));

  for (const claimed of sheet.retyped_fields ?? []) {
    const key = `${claimed.entity}.${claimed.field_name}`;
    const gold = goldRetypes.get(key);

    if (!gold) {
      score("retyped_field", key, "invented");
    } else if (gold.new_type !== claimed.new_type) {
      claimedGoldFacts.add(`retyped_field:${key}`);
      score("retyped_field", key, "contradicted", `claimed ${claimed.new_type}, gold ${gold.new_type}`);
    } else {
      claimedGoldFacts.add(`retyped_field:${key}`);
      score("retyped_field", key, "matched");
    }
  }

  for (const [key] of goldRetypes) {
    if (!claimedGoldFacts.has(`retyped_field:${key}`)) {
      missed.push({ category: "retyped_field", fact: key });
    }
  }

  // ---- endpoints (path matching via the sealed dispatcher segment rules) ----

  const matchEndpoint = <T extends { method: string; path: string }>(
    claimed: { method: string; path: string },
    pool: T[]
  ): T | null =>
    pool.find((gold) => gold.method === claimed.method && pathSegmentsMatch(gold.path, claimed.path)) ?? null;

  for (const claimed of sheet.added_endpoints ?? []) {
    const gold = matchEndpoint(claimed, delta.added_endpoints);

    if (gold) {
      claimedGoldFacts.add(`added_endpoint:${gold.method} ${gold.path}`);
      score("added_endpoint", `${claimed.method} ${claimed.path}`, "matched");
    } else {
      score("added_endpoint", `${claimed.method} ${claimed.path}`, "invented");
    }
  }

  for (const gold of delta.added_endpoints) {
    if (!claimedGoldFacts.has(`added_endpoint:${gold.method} ${gold.path}`)) {
      missed.push({ category: "added_endpoint", fact: `${gold.method} ${gold.path}` });
    }
  }

  for (const claimed of sheet.removed_endpoints ?? []) {
    const gold = matchEndpoint(claimed, delta.removed_endpoints);

    if (gold) {
      claimedGoldFacts.add(`removed_endpoint:${gold.method} ${gold.path}`);
      score("removed_endpoint", `${claimed.method} ${claimed.path}`, "matched");
    } else {
      score("removed_endpoint", `${claimed.method} ${claimed.path}`, "invented");
    }
  }

  for (const gold of delta.removed_endpoints) {
    if (!claimedGoldFacts.has(`removed_endpoint:${gold.method} ${gold.path}`)) {
      missed.push({ category: "removed_endpoint", fact: `${gold.method} ${gold.path}` });
    }
  }

  for (const claimed of sheet.changed_endpoints ?? []) {
    const gold = delta.changed_endpoints.find(
      (candidate) =>
        pathSegmentsMatch(candidate.new.path, claimed.path) || pathSegmentsMatch(candidate.old.path, claimed.path)
    );

    if (!gold) {
      score("changed_endpoint", `${claimed.old_method} -> ${claimed.new_method} ${claimed.path}`, "invented");
    } else if (gold.old.method !== claimed.old_method || gold.new.method !== claimed.new_method) {
      claimedGoldFacts.add(`changed_endpoint:${gold.semantic_item_uid}`);
      score(
        "changed_endpoint",
        `${claimed.old_method} -> ${claimed.new_method} ${claimed.path}`,
        "contradicted",
        `gold changes ${gold.old.method} -> ${gold.new.method}`
      );
    } else {
      claimedGoldFacts.add(`changed_endpoint:${gold.semantic_item_uid}`);
      score("changed_endpoint", `${claimed.old_method} -> ${claimed.new_method} ${claimed.path}`, "matched");
    }
  }

  for (const gold of delta.changed_endpoints) {
    if (!claimedGoldFacts.has(`changed_endpoint:${gold.semantic_item_uid}`)) {
      missed.push({
        category: "changed_endpoint",
        fact: `${gold.old.method} ${gold.old.path} -> ${gold.new.method} ${gold.new.path}`
      });
    }
  }

  // ---- validation rules (detail literals compare exactly; omitted detail on a detail-bearing
  // gold rule is a contradiction — a commitment that names no literal committed to nothing) ----

  const goldAddedRules = new Map(delta.added_rules.map((rule) => [`${rule.entity}.${rule.field}:${rule.kind}`, rule]));

  for (const claimed of sheet.added_rules ?? []) {
    const key = `${claimed.entity}.${claimed.field}:${claimed.kind}`;
    const gold = goldAddedRules.get(key);

    if (!gold) {
      score("added_rule", key, "invented");
    } else if (claimed.detail === undefined || !ruleDetailEquals(claimed.detail, gold.detail)) {
      claimedGoldFacts.add(`added_rule:${key}`);
      score(
        "added_rule",
        key,
        "contradicted",
        claimed.detail === undefined ? "no rule literal committed" : `literal mismatch: gold ${JSON.stringify(gold.detail)}`
      );
    } else {
      claimedGoldFacts.add(`added_rule:${key}`);
      score("added_rule", key, "matched");
    }
  }

  for (const [key] of goldAddedRules) {
    if (!claimedGoldFacts.has(`added_rule:${key}`)) {
      missed.push({ category: "added_rule", fact: key });
    }
  }

  const goldRemovedRules = new Set(delta.removed_rules.map((rule) => `${rule.entity}.${rule.field}:${rule.kind}`));

  for (const claimed of sheet.removed_rules ?? []) {
    const key = `${claimed.entity}.${claimed.field}:${claimed.kind}`;

    if (goldRemovedRules.has(key)) {
      claimedGoldFacts.add(`removed_rule:${key}`);
      score("removed_rule", key, "matched");
    } else {
      score("removed_rule", key, "invented");
    }
  }

  for (const key of goldRemovedRules) {
    if (!claimedGoldFacts.has(`removed_rule:${key}`)) {
      missed.push({ category: "removed_rule", fact: key });
    }
  }

  // ---- conventions (statement verbatim — the brief hands the statement verbatim, so a
  // commitment that restates it loosely has not pinned the convention) ----

  const goldConventions = new Map(delta.changed_conventions.map((convention) => [convention.convention_id, convention]));

  for (const claimed of sheet.changed_conventions ?? []) {
    const gold = goldConventions.get(claimed.convention_id);

    if (!gold) {
      score("changed_convention", claimed.convention_id, "invented");
    } else if (gold.new_statement !== claimed.new_statement) {
      claimedGoldFacts.add(`changed_convention:${gold.convention_id}`);
      score("changed_convention", claimed.convention_id, "contradicted", "statement differs from gold, verbatim");
    } else {
      claimedGoldFacts.add(`changed_convention:${gold.convention_id}`);
      score("changed_convention", claimed.convention_id, "matched");
    }
  }

  for (const gold of delta.changed_conventions) {
    if (!claimedGoldFacts.has(`changed_convention:${gold.convention_id}`)) {
      missed.push({ category: "changed_convention", fact: gold.convention_id });
    }
  }

  // ---- no-change claim ----

  if (sheet.no_change === true) {
    score(
      "no_change",
      "no functional change",
      delta.is_empty ? "matched" : "contradicted",
      delta.is_empty ? null : "the gold delta is non-empty"
    );
  } else if (delta.is_empty) {
    const anyClaim = claims.length > 0;

    if (!anyClaim) {
      missed.push({ category: "no_change", fact: "no functional change" });
    }
  }

  return {
    commitment_scorer_id: E4_V3_COMMITMENT_SCORER_ID,
    claims,
    missed,
    counts: {
      matched: claims.filter((claim) => claim.verdict === "matched").length,
      contradicted: claims.filter((claim) => claim.verdict === "contradicted").length,
      invented: claims.filter((claim) => claim.verdict === "invented").length,
      missed: missed.length
    }
  };
}
