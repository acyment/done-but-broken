// Sealed violating-value tables (E4V2 design §5.5, Amendment 2 — part of the `e4-t0-gold-spec-v1`
// code twin). The §5.5 spec templates embed these as JSON literals, the §5.6.7 GT negative tests
// send them as request-body values, and the §5.6.1 server enforces the mirror checks — the v2-M2
// executed in-sync check cross-verifies the three. Sealed literals, not ordinals.
import type { E4ValidationRule } from "../ir";

// Type-violating values per §5.5: `string`/`ref` fields get no entry — any JSON string is
// type-valid for them, so no violating literal exists inside the sealed vocabulary.
export const TYPE_VIOLATING_VALUES = {
  int: 1.5,
  decimal: "1.5",
  bool: "yes",
  date: "not-a-date"
} as const;

// The substrate's format-pattern pool and its sealed non-matching literal per pattern. The only
// pattern the v2 op space mints is the v1 add_validation_rule pattern; an unknown pattern is a
// fail-loud error (a new pool entry requires extending this sealed table, never guessing).
export const FORMAT_PATTERN_VIOLATIONS: Record<string, string> = {
  "^[\\w -]{1,80}$": "!"
};

export const ENUM_VIOLATING_VALUE = "__not_a_member__";

// Rule-violating value per §5.5: range → min − 1 (or max + 1 when only a max is pinned),
// format → the sealed non-matching literal for the rule's pattern, enum → the sealed non-member.
export function ruleViolatingValue(rule: Pick<E4ValidationRule, "kind" | "detail">): unknown {
  if (rule.kind === "range") {
    if (typeof rule.detail.min === "number") {
      return rule.detail.min - 1;
    }
    if (typeof rule.detail.max === "number") {
      return rule.detail.max + 1;
    }
    throw new Error("range rule pins neither min nor max — no violating value exists");
  }

  if (rule.kind === "format") {
    const pattern = rule.detail.pattern;
    const literal = typeof pattern === "string" ? FORMAT_PATTERN_VIOLATIONS[pattern] : undefined;
    if (literal === undefined) {
      throw new Error(`format pattern not in the sealed violation table: ${String(pattern)}`);
    }
    return literal;
  }

  if (rule.kind === "enum") {
    return ENUM_VIOLATING_VALUE;
  }

  throw new Error(`no violating-value rule for validation rule kind: ${rule.kind}`);
}
