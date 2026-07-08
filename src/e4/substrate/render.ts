// Deterministic NL renderer (architecture §4; IMPLEMENTATION-PLAN.md M1). Templates from IR deltas
// to business-natural change requests — the rendered text never names spec files or testing
// practice (arms differ only via their policy channel, never via what the task text says).
// Phrasing pools are seed-drawn for variety but fixed given the seed.
import type { E4ChangeOpKind } from "./ops";
import type { E4Prng } from "./prng";

type PhrasingVariant = {
  render(ctx: Record<string, string>): string;
  // [R2: R2-10] tags whether THIS variant names the changed item verbatim vs. paraphrases it —
  // the NL-opacity proxy reads this directly rather than re-guessing from the rendered string.
  namesItemVerbatim: boolean;
};

// Every op kind gets a named phrasing-pool identifier (sealed at M1, §4 protocol_text lineage —
// a one-word wording edit is a substrate_version change, never a silent drift) plus 2-3 template
// variants so repeated op kinds in one sequence don't read identically.
const PHRASING_POOLS: Record<E4ChangeOpKind, { pool_id: string; variants: PhrasingVariant[] }> = {
  add_entity: {
    pool_id: "add-entity-v1",
    variants: [
      { render: (ctx) => `We're launching ${ctx.entity} as a new resource — customers need to be able to track it.`, namesItemVerbatim: true },
      { render: (ctx) => `Product wants a ${ctx.entity} list added so the team can start recording them.`, namesItemVerbatim: true }
    ]
  },
  delete_entity: {
    pool_id: "delete-entity-v1",
    variants: [
      { render: (ctx) => `${ctx.entity} tracking is being retired — remove it from the product entirely.`, namesItemVerbatim: true },
      { render: (ctx) => `We no longer need ${ctx.entity}; take it out of the system.`, namesItemVerbatim: true }
    ]
  },
  rename_entity: {
    pool_id: "rename-entity-v1",
    variants: [
      { render: (ctx) => `Rebrand ${ctx.old_name} as ${ctx.new_name} everywhere it appears to customers.`, namesItemVerbatim: true },
      { render: (ctx) => `The business now calls ${ctx.old_name} "${ctx.new_name}" — update accordingly.`, namesItemVerbatim: true }
    ]
  },
  add_field: {
    pool_id: "add-field-v1",
    variants: [
      { render: (ctx) => `Add a ${ctx.field} field to ${ctx.entity} so we can capture that detail.`, namesItemVerbatim: true },
      { render: (ctx) => `Customers are asking for a ${ctx.field} on each ${ctx.entity} — add it.`, namesItemVerbatim: true },
      { render: () => `There's a new detail the business wants captured that isn't tracked yet.`, namesItemVerbatim: false }
    ]
  },
  rename_field: {
    pool_id: "rename-field-v1",
    variants: [
      { render: (ctx) => `Rename the ${ctx.old_name} detail on ${ctx.entity} to ${ctx.new_name}.`, namesItemVerbatim: true },
      { render: (ctx) => `${ctx.entity}'s ${ctx.old_name} should now be called ${ctx.new_name}.`, namesItemVerbatim: true }
    ]
  },
  retype_field: {
    pool_id: "retype-field-v1",
    variants: [
      { render: (ctx) => `${ctx.entity}'s ${ctx.field} needs to support a wider range of values — change how it's represented.`, namesItemVerbatim: true },
      { render: (ctx) => `Update how ${ctx.entity}'s ${ctx.field} is stored so it accepts the values the business now needs.`, namesItemVerbatim: true }
    ]
  },
  delete_field: {
    pool_id: "delete-field-v1",
    variants: [
      { render: (ctx) => `Drop the ${ctx.field} detail from ${ctx.entity} — it's no longer collected.`, namesItemVerbatim: true },
      { render: (ctx) => `We stopped tracking ${ctx.field} for ${ctx.entity}; remove it.`, namesItemVerbatim: true }
    ]
  },
  add_endpoint: {
    pool_id: "add-endpoint-v1",
    variants: [
      { render: (ctx) => `The team wants a quick summary view over all ${ctx.entity} records.`, namesItemVerbatim: true },
      { render: (ctx) => `Give the front-end a way to see aggregate numbers for ${ctx.entity}.`, namesItemVerbatim: true }
    ]
  },
  modify_endpoint: {
    pool_id: "modify-endpoint-v1",
    variants: [
      { render: (ctx) => `Updating a ${ctx.entity} should follow the newer partial-update convention the API now uses.`, namesItemVerbatim: true },
      { render: (ctx) => `Switch how clients update a ${ctx.entity} record to match the rest of the API.`, namesItemVerbatim: true },
      { render: () => `One of our update endpoints needs to follow the newer partial-update convention.`, namesItemVerbatim: false }
    ]
  },
  add_validation_rule: {
    pool_id: "add-validation-rule-v1",
    variants: [
      { render: (ctx) => `${ctx.entity}'s ${ctx.field} needs stricter input rules — bad data has been getting through.`, namesItemVerbatim: true },
      { render: (ctx) => `Tighten up what counts as a valid ${ctx.field} on ${ctx.entity}.`, namesItemVerbatim: true }
    ]
  },
  modify_convention: {
    pool_id: "modify-convention-v1",
    variants: [
      { render: () => `We're revising how the API communicates certain details to clients — bring it up to date.`, namesItemVerbatim: false },
      { render: () => `A cross-cutting API convention changed company-wide; apply the update here too.`, namesItemVerbatim: false }
    ]
  },
  add_relationship: {
    pool_id: "add-relationship-v1",
    variants: [
      { render: (ctx) => `Every ${ctx.from} should be linkable to a ${ctx.to} going forward.`, namesItemVerbatim: true },
      { render: (ctx) => `We need to associate ${ctx.from} records with a ${ctx.to}.`, namesItemVerbatim: true }
    ]
  },
  noop_maintenance: {
    pool_id: "noop-maintenance-v1",
    variants: [
      { render: () => `Double-check that everything is still behaving as documented; no changes needed if it is.`, namesItemVerbatim: false },
      { render: () => `Do a quick review of current behavior against what's documented — flag anything that's actually broken.`, namesItemVerbatim: false }
    ]
  }
};

export type E4RenderedTask = {
  text: string;
  pool_id: string;
  names_item_verbatim: boolean;
};

export function renderTaskText(input: { opKind: E4ChangeOpKind; renderContext: Record<string, string> }, prng: E4Prng): E4RenderedTask {
  const pool = PHRASING_POOLS[input.opKind];
  const variant = prng.pick(pool.variants);

  return { text: variant.render(input.renderContext), pool_id: pool.pool_id, names_item_verbatim: variant.namesItemVerbatim };
}

export function phrasingPoolId(opKind: E4ChangeOpKind): string {
  return PHRASING_POOLS[opKind].pool_id;
}

export function phrasingPoolIds(): string[] {
  return Object.values(PHRASING_POOLS)
    .map((pool) => pool.pool_id)
    .toSorted();
}
