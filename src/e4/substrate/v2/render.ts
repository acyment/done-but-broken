// v2 NL renderer override (E5 P0-V item 2, proposal §2; extended at P0-V.1). The v1 renderer
// and its sealed pools are untouched (they belong to the v1 substrate lineage); v2 carries its
// own copy of exactly ONE pool — modify_endpoint — because the v3-M7 external adjudication
// verified variant 1's "match the rest of the API" points OPPOSITE to gold whenever the flipped
// endpoint diverges from the surrounding surface (the common PUT→PATCH first flip).
// [P0V.1: V2] The P0-V external panel then verified the same direction-falsity in the OTHER two
// variants: op kinds may repeat within a sequence, so PATCH→PUT draws are reachable, and on
// that direction "the newer partial-update convention the API now uses" points opposite to
// gold too — and every "partial-update" mention contradicts the README's disclosed full-replace
// semantics ("there are no partial updates in this API"). All three variants are now
// direction-neutral statements true on BOTH flip directions, with no partial-update language.
//
// PRNG discipline: renderTaskTextV2 consumes the stream exactly like the v1 renderer (one
// prng.pick over a same-length variant array per task), so every seed's draw, every other op's
// rendered text, and the modify_endpoint variant INDEX selection are byte-identical across the
// substrate boundary — only the modify_endpoint texts differ. Census-tested.
import type { E4ChangeOpKind } from "../ops";
import type { E4Prng } from "../prng";
import { renderTaskText, type E4RenderedTask } from "../render";

export type { E4RenderedTask } from "../render";

export const MODIFY_ENDPOINT_POOL_ID_V2 = "modify-endpoint-v2";

type PhrasingVariantV2 = {
  render(ctx: Record<string, string>): string;
  namesItemVerbatim: boolean;
};

// [P0V.1: V2] All three variants are direction-neutral (true whichever way the method flips)
// and never mention partial updates. Same variant COUNT and namesItemVerbatim flags as the v1
// pool, so index selection and the nl_opacity diagnostics stay aligned across the boundary.
const MODIFY_ENDPOINT_VARIANTS_V2: PhrasingVariantV2[] = [
  {
    render: (ctx) => `The way clients update a ${ctx.entity} is changing — use a different request method for those updates from now on.`,
    namesItemVerbatim: true
  },
  {
    render: (ctx) => `Switch how clients update a ${ctx.entity} record — the request method for updates is changing.`,
    namesItemVerbatim: true
  },
  { render: () => `One of our update endpoints needs its request method changed.`, namesItemVerbatim: false }
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
