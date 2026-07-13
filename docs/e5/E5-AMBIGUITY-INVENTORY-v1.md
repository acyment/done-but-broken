# E5 ambiguity inventory (v1) — PM-plausible knobs that deliberately stay undisclosed

**Status: COMMITTED at the P0-V boundary (proposal v2 §2 P0-V item 2, operator-ratified §7
gate).** This is the residual-ambiguity policy made explicit: a hidden convention is unfair
only if NO legitimate channel can resolve it. The two FALSE disclosures (the brief's
"rename … everywhere" line; the `modify_endpoint` phrasing "match the rest of the API") were
corrected at this boundary. Everything below is *ambiguity, not falsity* — knobs a real product
manager plausibly owns, left out of the task request and the workspace README **on purpose**:
they are the measurement material for the ask/brief levers (P1.3 brief auto-injection, P1.4
scripted-PM interactivity). Each is answerable through the brief channel; none is ever
unconditionally disclosed.

The mechanical guarantee behind this table: the determinacy tagger
(`e4-request-determinacy-v2`, `src/e4/v3/ambiguity.ts`) marks each fact underdetermined, and
the census (`test/e4-v3-m0.test.ts`) asserts the PM brief (`e4-pm-brief-v3`) covers every
underdetermined fact. Changing any row is a sealed-surface change (twin re-pin + constants
version bump). [P0V.1: V4] Caveat recorded by the external panel: this guarantee is
per-fact-KIND coverage, not informational sufficiency — a brief line can name a fact without
determining every assertion the hidden suite or drift meter makes about it (row 11 was the
instance). The candidate assertion-level census is design input D10.

| # | Knob | Fact kind | What gold actually does | Brief line that answers it |
|---|------|-----------|-------------------------|----------------------------|
| 1 | **Stored-id policy on renames** | `fixture_migration` (rename_entity) | Stored records keep their ids and values under the new name (M7 "id-migration mirror trap") | "Existing X records keep their current ids and stored values under the new name" |
| 2 | **Initial data for new entities** | `fixture_migration` (add_entity) | New entities start with an empty store | "X starts with no records; do not preload sample data" |
| 3 | **Backfill for added fields** | `fixture_migration` (add_field) | Existing rows carry `null` until updated | "Existing X records carry f = null until they are updated" |
| 4 | **Stored-value conversion on retype** | `fixture_migration` (retype_field) | Sealed conversions: decimal→int truncates toward zero; string→date resets to the sealed literal; bool→string becomes "true"/"false" | per-conversion literal lines |
| 5 | **Linking existing rows on new relationships** | `fixture_migration` (add_relationship) | Positional linking (row n → parent n; unmatched rows get null) | "Link existing records by position …" |
| 6 | **Field sets and types of new entities** | `entity_field_set`, `field_type`, `field_required` | Generator-drawn exact fields | "New entity X with exactly these fields: …" |
| 7 | **Operation surface of new entities** | `entity_operation_surface` | Full CRUD + list (every entity always has a read endpoint) | "X operations to provide: …" |
| 8 | **Required-ness of new/changed fields** | `field_required` | Generator-drawn | field lines state required/optional |
| 9 | **Validation-rule literals** | `validation_rule_detail` | Sealed exact literals (pattern/range/enum) | "Validation on X.f: … (verbatim literal)" |
| 10 | **Update method form (direction of the flip)** | `endpoint_method_form` | `modify_endpoint` flips the update endpoint PUT↔PATCH; semantics stay full-replace either way | "The X update operation becomes METHOD /path …" |
| 11 | **Analytics endpoint shape** | `analytics_endpoint_shape` | `GET /<collection>/stats` returning `{"count": <n>}` (the hidden test asserts status only; the T0 visible spec asserts `count` on the existing analytics endpoint) | [P0V.1: V4] "New endpoint GET /…: returns summary counts … as a JSON body of exactly {\"count\": <number of records>}" — the shape literal was ADDED at P0-V.1; the pre-P0V.1 line pinned method/path/purpose only, so this row's coverage claim was false as written |
| 12 | **Convention statement text** | `convention_statement` | Statement flips between the two sealed error-envelope forms | "The new rule, verbatim: …" |

Notes recorded with the inventory:

- **Row 10 changed class at this boundary.** The determinacy entry for
  `modify_endpoint.endpoint_method_form` moved determined → underdetermined: after correcting
  phrasing variant 2, the pool no longer uniformly states PATCH semantics, and the table's own
  rule ("determined only when every variant states it") forces the honest entry. The brief
  covers it, so it joins this inventory rather than being a rig defect.
- **PATCH semantics are NOT in this table.** "The request body must be the complete record and
  replaces the stored record" is now disclosed unconditionally (README `## Update semantics` +
  the brief's PATCH line) because the old brief line actively promised the opposite — that was
  a false disclosure, not a PM-plausible knob.
- **The E4 record behind each row** [P0V.1: V5 — the earlier "rows 1–5 are the five
  convention families" note claimed a one-to-one mapping that does not exist; per-family
  dispositions replace it]. The five convention families the E4 audits surfaced
  (`E4-ARC-CLOSEOUT-v1.md` §4), each with its actual disposition:
  - *Naive pluralization* — **structurally eliminated** at substrate v2.1 (sealed English
    pluralizer); never an inventory row.
  - *Seed-fixture regeneration* — **structurally eliminated** at substrate v2.1 (seed-data
    carry-forward); the per-op migration questions it hid survive as **brief-answerable**
    rows 1–5.
  - *PATCH/update semantics* — **disclosed unconditionally** at P0-V (README + brief);
    excluded from this table by design (the old brief line was a false disclosure, not a
    PM-plausible knob).
  - *Id stability on renames* — **brief-answerable** (row 1).
  - *Required-ness/backfill* — **brief-answerable** (rows 3 and 8).

  Rows 4 (retype conversion) and 5 (positional linking) are NEW v3-era knobs, not E4-audit
  families; row 10 moved determined → underdetermined at the P0-V boundary and is
  brief-answerable (see the row-10 note above); the remaining rows are brief-answerable by
  construction. The ask levers are measured against this list under these dispositions.
