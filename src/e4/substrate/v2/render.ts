// v2 NL renderer override (E5 P0-V item 2, proposal §2). The v1 renderer and its sealed pools
// are untouched (they belong to the v1 substrate lineage); v2 carries its own copy of exactly
// ONE pool — modify_endpoint — because the v3-M7 external adjudication verified variant 2's
// "match the rest of the API" points OPPOSITE to gold whenever the flipped endpoint diverges
// from the surrounding surface (the common PUT→PATCH first flip). That is a FALSE statement
// about the goal, not an ambiguity, so it is corrected here; the other variants' business
// vagueness ("partial-update convention") is measurement material and is carried byte-identical.
//
// PRNG discipline: renderTaskTextV2 consumes the stream exactly like the v1 renderer (one
// prng.pick over a same-length variant array per task), so every seed's draw, every other op's
// rendered text, and the modify_endpoint variant INDEX selection are byte-identical across the
// substrate boundary — only the variant-1 text differs. Census-tested.
import type { E4ChangeOpKind } from "../ops";
import type { E4Prng } from "../prng";
import { renderTaskText, type E4RenderedTask } from "../render";

export type { E4RenderedTask } from "../render";

export const MODIFY_ENDPOINT_POOL_ID_V2 = "modify-endpoint-v2";

type PhrasingVariantV2 = {
  render(ctx: Record<string, string>): string;
  namesItemVerbatim: boolean;
};

// Variants 0 and 2 are byte-identical to the v1 pool (census-pinned); variant 1 replaces the
// refuted "match the rest of the API" with a statement true in BOTH flip directions.
const MODIFY_ENDPOINT_VARIANTS_V2: PhrasingVariantV2[] = [
  {
    render: (ctx) => `Updating a ${ctx.entity} should follow the newer partial-update convention the API now uses.`,
    namesItemVerbatim: true
  },
  {
    render: (ctx) => `Switch how clients update a ${ctx.entity} record — the request method for updates is changing.`,
    namesItemVerbatim: true
  },
  { render: () => `One of our update endpoints needs to follow the newer partial-update convention.`, namesItemVerbatim: false }
];

export function renderTaskTextV2(
  input: { opKind: E4ChangeOpKind; renderContext: Record<string, string> },
  prng: E4Prng
): E4RenderedTask {
  if (input.opKind !== "modify_endpoint") {
    return renderTaskText(input, prng);
  }

  const variant = prng.pick(MODIFY_ENDPOINT_VARIANTS_V2);

  return {
    text: variant.render(input.renderContext),
    pool_id: MODIFY_ENDPOINT_POOL_ID_V2,
    names_item_verbatim: variant.namesItemVerbatim
  };
}
