// §5.7 Amendment 3: sealed English pluralizer for minted collection segments.
//
// The v2.0 naive rule (`lowercase(name) + "s"`) minted paths like /entrys and /categorys/stats
// that contradicted both natural English and the T0 baseline's own visible style (/categories) —
// the fixture-migration verification showed it fully explained 9 M6 + 3 learning-run
// false-confidence events and co-drove 8 more. The sealed rule below reproduces the T0 baseline
// byte-identically (category→categories, widget→widgets) and is unambiguous over every sealed
// name pool (Supplier, Warehouse, Promotion, Review, Tag, Product, Item, Record, Resource,
// Entry, Listing, Asset).
export function pluralizeEntityName(entityName: string): string {
  const lower = entityName.toLowerCase();

  if (/[^aeiou]y$/.test(lower)) {
    return `${lower.slice(0, -1)}ies`;
  }
  if (/(s|x|z|ch|sh)$/.test(lower)) {
    return `${lower}es`;
  }
  return `${lower}s`;
}
