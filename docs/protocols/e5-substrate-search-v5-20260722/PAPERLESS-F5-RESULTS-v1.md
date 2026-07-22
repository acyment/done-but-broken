# paperless-ngx #11868 → #11869 — F5 live end-to-end repro (RESULTS v1)

Run 2026-07-22 by Claude Code under `E5-SUBSTRATE-SEARCH-V5-BRIEF-v1.md` §3 (F5) and the
operator's F5 build-session prompt (falsification framing: the session's job was to find
the reason this candidate is OUT). Zero external spend: local compute, git, GitHub reads
(`gh`), local docker builds only. No model experiments, no runs. F0–F4 verdicts
(`PAPERLESS-SCREEN-v1.md`) were not re-litigated; the two pinned facts were re-anchored
locally before building (§1).

**VERDICT: PASS on all four required legs. No kill found. Paperless #11868→#11869 is the
second F5-verified primary-slot candidate (latent class — memorization probe MANDATORY
before any design-phase use; #10256 of 2025-06-24 is inside the training window).**

Evidence: `raw-paperless-f5/` (raw HTTP captures, DB diagnostics, suite/build logs,
fixture script, environment manifest). The repro replays from the archived
`fixture.sh` — everything through the public REST API.

## 1. Re-anchor of the two pinned facts (pre-build, per Batch-A discipline)

1. **Fix diff**: `gh pr diff 11869` is exactly the one-token change in
   `src/documents/data_models.py::DocumentMetadataOverrides.from_document()`:
   `custom_field.id: custom_field.value` → `custom_field.field.id: custom_field.value`
   (+1/−1, single file). At the BUGGY checkout the buggy keying line is present
   (in-container check: `data_models.py:118`), and `doc.custom_fields` is the
   `CustomFieldInstance` related manager (`models.py:868`, `related_name="custom_fields"`)
   — so the map is keyed by the join-table instance PK, as screened.
2. **Consumer**: read at the BUGGY checkout, not assumed —
   `src/documents/consumer.py:725-737`:
   `CustomField.objects.filter(id__in=self.metadata.custom_fields.keys()).distinct()`,
   then `value_field_name: self.metadata.custom_fields.get(field.id, None)`. Unknown keys
   are **silently dropped** (no log, no error); a key that collides with a *different*
   field's definition id writes the stored value onto that other field. Both predicted
   wrongness forms live in this one loop.
3. Path from the public surface: `POST /api/documents/bulk_edit/` method `merge` with
   `parameters.metadata_document_id` → `bulk_edit.merge()` (`bulk_edit.py:372`) →
   `DocumentMetadataOverrides.from_document(metadata_document)` (`bulk_edit.py:425`) →
   celery `consume_file` → the consumer loop above. This is the operation the users in
   #10256/#11868 ran.

## 2. Pinned states (resolved this session)

| State | SHA | How pinned |
|---|---|---|
| FIXED | `32d04e1fd3be7b3256b76ac86dbb3e50f362e4b1` | `gh pr view 11869 --json mergeCommit`; merged 2026-01-23T23:49:22Z |
| BUGGY | `56c744fd5620b072e1724990eda892673bbda9e4` | sole parent of FIXED (squash merge); buggy line verified present |

No pre-culprit leg: the culprit is pre-window (2023–24 custom-fields/merge feature era);
the fix's parent has been buggy for the fossil's whole life — the latent shape, per the
screen doc.

Builds: full repo `Dockerfile` at each checkout (node 20 frontend stage + uv/python3.12
trixie stage), images `paperless-f5:buggy` / `paperless-f5:fixed`, commit recorded as an
image label and re-verified in-container (`grep data_models.py`: buggy shows
`custom_field.id`, fixed shows `custom_field.field.id` at line 118). Stack per build:
webserver+worker container (s6), Postgres 18, Redis 8 (compose files archived; digests in
`environment-manifest.txt`).

## 3. The fixture (black-box, REST API only)

Archived as `raw-paperless-f5/fixture.sh`; identical recipe run against both builds. No
DB pokes, no Django shell — admin user comes from first-boot env
(`PAPERLESS_ADMIN_USER`), auth via `POST /api/token/`.

1. Four `string` custom-field definitions `field-A..field-D` → definition ids 1–4 (read
   back from the API, not assumed).
2. Three documents ingested via `POST /api/documents/post_document/` (repo sample PDFs;
   async consume awaited via `GET /api/tasks/?task_id=` polling): `scratch`, `source`,
   `other`.
3. **Aging**: assign A,B,C to `scratch` (burns instance ids 1–3), then clear them — the
   serializer hard-deletes removed instances after update (`serialisers.py:1198`,
   "hard delete custom field instances that were soft deleted"), so the id sequence stays
   advanced while the rows vanish: real create-and-delete aging, as specified.
4. `source` then gets field-A (instance id **4**) and field-B (instance id **5**).
5. Merge `source`+`other` with `metadata_document_id=source`; poll for the produced
   document; read back its `custom_fields`.

**Both wrongness forms engineered and achieved** (diagnostic read-only `psql` SELECT
archived per build, labeled diagnostic-only — not part of the repro path):

- **Collision**: source instance id 4 (field-A, "alpha-val") == definition id of
  field-D → on BUGGY the value lands on field-D.
- **Divergence**: source instance id 5 (field-B, "beta-val") matches no definition id →
  on BUGGY the value silently vanishes.

`diagnostic-id-spread.txt` (buggy): defs 1–4; instances 4 (field 1, doc `source`),
5 (field 2, doc `source`); after merge, instance 6 = **field 4** on the merged doc —
the collision materialized in the row exactly as at the API surface.

## 4. Leg results

### (i) Wrong value live at the public surface, BUGGY build — PASS (bug reproduces)

Source doc (`GET /api/documents/2/`): `[{field:1,"alpha-val"},{field:2,"beta-val"}]`.
Merge response: `{"result":"OK"}` (HTTP 200, 108 ms). Merged doc
(`GET /api/documents/4/`): **`[{"value":"alpha-val","field":4}]`** — field-A's value
mis-assigned onto field-D (collision) AND field-B's value gone (divergence), in one
observation. Silent end to end: webserver log tail archived, zero
error/traceback/exception lines; celery task logs
`Success. New document id 4 created`. Reproduced identically in the warm loop
(`warm-merged-doc.json`, second merge after deleting the first product).

Batch-A corollaries: the fix's behavioral delta reaches this exact surface (leg ii is a
same-request payload diff, archived as `custom-fields-payload.diff`), and the live path
produces the diverged ids via ordinary API usage only (integer PKs end to end; no
driver/type layer exists to neutralize the spread — confirmed empirically by the
diagnostic).

### (ii) Correct behavior, FIXED build — PASS

Same fixture recipe, same requests, FIXED image: merged doc
**`[{"value":"alpha-val","field":1},{"value":"beta-val","field":2}]`** — all source
fields present, correct values, correct fields. Diagnostic: merged-doc instances carry
field_ids 1,2. Payload diff BUGGY↔FIXED archived; the delta is precisely the missing
field-B entry and field 4→1 on the alpha entry.

### (iii) Decoy property — native suite green on BUGGY w.r.t. this bug — PASS (see §5)

### (iv) Evidence archive — `raw-paperless-f5/`; script-replayable; tokens scrubbed.

## 5. Leg (iii): native suite on BUGGY — scope and results

**Scope rationale.** Upstream CI (`.github/workflows/ci.yml` at the pinned commit) runs
`uv sync --group testing --frozen` + `uv run --dev --frozen pytest` (pyproject testpaths:
documents, paperless, paperless_mail, paperless_tesseract, paperless_tika,
paperless_text) on Python 3.10–3.12 with live Gotenberg+Tika sidecars and
`PAPERLESS_CI_TEST=1`. This session mirrored the 3.12 leg exactly: the pinned tree
mounted into a container of the session's own image (same Debian trixie, Python 3.12.12,
tesseract/gs/qpdf stack, ImageMagick policy), deps from the repo's `uv.lock` (`--frozen
--dev --group testing`), Gotenberg 8.25 + Tika sidecars up, `PAPERLESS_CI_TEST=1`, full
pytest (xdist, per pyproject addopts). That covers, as required: the bulk-edit modules
(merge/split/edit_pdf/remove_password), the consumer pipeline, and everything adjacent to
`data_models` — plus the rest of the suite.

**Results.**

- **BUGGY full suite: 18 failed, 1404 passed, 5 skipped, 6 errors** (5m33s;
  `suite-buggy-run1.log`).
- **Every test in the bulk-edit / consumer / workflows / custom-fields area passed on
  BUGGY: 215/215** (junit-verified), including `TestPDFActions::test_merge`,
  `TestBulkEditAPI::test_merge`, and all `*custom_field*` tests.
- **Attribution of the 18 failures (gitea §5 procedure):**
  1. Quiet serial re-run of the failing set on BUGGY: 18 persist, 2 pass (the two
     mock-failure mail-parser tests — parallel-run artifacts).
  2. **Controlled comparison: identical tests on the FIXED tree in the identical
     environment (fresh container of the fixed image, same sidecars, same lock): outcome
     sets identical name-for-name.** The two mounted trees differ in exactly one file —
     `data_models.py`, the one-token fix (`diff -r` verified) — so failure-set invariance
     attributes every failure to environment, not code.
  3. **Full suite on FIXED: 18 failed, 1404 passed, 5 skipped, 6 errors — the identical
     failure list name-for-name** (`suite-fixed-run1.log`; diff of FAILED/ERROR sets is
     empty).
  4. Strengthening probe: re-run of the failing set as the non-root `paperless` user on a
     container-local tree — the 9 permission-semantics tests (sanity_check no-access ×3,
     importer/exporter permissions ×3, file_handling permissions, paths_check, plus one)
     all pass; they fail under root only because root ignores file modes. The residue is
     honestly environmental by inspection AND by invariance: `test_system_status` asserts
     `'bare-metal'` install type (we run in the container image; also expects a local
     redis), the URL-canary tests need external internet (sandboxed network), the RTL
     tesseract assertion and Gotenberg PDF-render comparisons differ from CI's runner
     binaries.
- **Native coverage of `from_document()` metadata copying, verified precisely:** no test
  in the tree references `from_document` directly (grep empty). It IS exercised
  indirectly — `TestPDFActions::test_merge` calls `bulk_edit.merge` with
  `metadata_document_id` — but that test's fixture documents carry **zero custom
  fields** and it mocks `consume_file`, asserting only title/created. So the suite runs
  the buggy line with an empty map and never runs the consumer filter at all. This is
  the fresh-fixture blindness the screen predicted, in an even stronger form: the decoy
  is structural (empty-fixture + mocked consumer), not coincidental. Recorded as
  strengthening the decoy; not a kill.

**Leg (iii) verdict: decoy property holds.** No native test fails because of this bug;
the full-suite failure set is byte-identical across the one-token delta, and every
merge/custom-field test is green on the buggy code.

## 6. Loop measurement (§8 <60 s bar; async wait reported separately as required)

| Loop | Wall-clock |
|---|---|
| Cold: `compose down -v` → boot (incl. migrations) → seed → merge → assert | **34.5 s** buggy (34.1 s fixed) |
| — of which stack boot + first-boot migrations | 24.3 s |
| — seed (4 defs + 3 async ingests + aging + assignments) | 6.7 s |
| — merge HTTP request | 0.11 s |
| — **celery merge round-trip (async wait, the screen's flagged risk)** | **1.3 s** (2.6 s fixed) |
| Warm: delete merged doc → re-merge → assert on running server | **1.7 s** |

Comfortably under the 60 s bar; the flagged celery risk did not materialize (the merged
PDF is small and OCR-skippable). The dominant cold cost is first-boot Django migrations;
a template-DB reset (the Immich dev-watch pattern, brief §8) would cut most of it.

## 7. Standings line

Paperless #11868→#11869: **F5 PASS (all four legs). Second F5-verified primary-slot
candidate — latent class.** Control returns to the operator. Design-phase machinery
remains parked; for this candidate the **memorization probe comes first** (mandatory:
prior report #10256, 2025-06-24, is inside the training window — a model may already
"know" merge loses custom fields), before blind-author probe, Three Amigos, or any
prereg drafting.
