# paperless-ngx #11868 → #11869 — F0–F4 screen (SURVIVOR #2, F5 nominee)

Screened 2026-07-22 in the main loop, falsification-framed. Lead originated from the
service-harvest subagent; every load-bearing fact re-resolved via `gh` in the main loop.

## The fossil

- **Bug:** `DocumentMetadataOverrides.from_document()` (`src/documents/data_models.py`)
  built the custom-fields override map keyed by **`CustomFieldInstance.id`** (the join
  table's PK) instead of **`CustomField.id`** (the field-definition PK). The consumer
  filters `CustomField.objects.filter(id__in=keys)` — unknown keys are **silently
  dropped**, and an instance-id that collides with a *different* field's definition id
  silently writes the value to the wrong field. Every operation that creates documents
  from existing ones is affected (merge, split, edit_pdf, remove_password).
- **The decoy property is structural:** on a fresh database both sequences start at 1 and
  increment together, so the ids coincide and everything works — **fresh-fixture tests are
  blind by construction**; the wrongness appears only on aged data where the sequences have
  diverged (i.e. in every real install). This is the certified form of exactly the
  blindness the program studies.
- **Discovery chain (user-discovery certified twice):** #10256 "[BUG] Merge does not copy
  over custom fields from selected document" (2025-06-24) — **closed as "not a bug"**; then
  #11868 (2026-01-23, author `juls`, author_association **NONE** — genuine outside user)
  re-reported with root-cause analysis; fix PR #11869 "Fix: use correct field id for
  overrides" merged same day (2026-01-23), a **one-character-class diff**
  (`custom_field.id` → `custom_field.field.id`). No regression test in the fix PR
  (recorded demerit).
- **Recency:** fix + discovering issue in-window (2026-01-23, margin to the 2026-01-01 bar
  noted); **culprit pre-window** (`data_models.py` substantive history is 2023–2024;
  custom-fields/merge feature era). **Latent shape — admissible only under the v4
  pre-declared fallback, which fired this session (COMPARISON §1). Memorization probe is
  MANDATORY before any use, and it has a concrete target: #10256 (2025-06-24) is inside
  the training window, so a model may already "know" merge loses custom fields.**

## Filter verdicts

- **F0:** #11868, #11869, #10256 all resolve; diff read (one line in
  `from_document()`); file history read. PASS (with the culprit-commit pin deferred to
  F5 prep — the file history bounds it to pre-2026 conclusively).
- **F1 (layer):** Django server code (`src/documents/data_models.py`), consumed by the
  server-side consumer pipeline; UI untouched. PASS.
- **F2 (behavioral delta):** stated: documents created by merge/split/edit_pdf/
  remove_password change from "custom fields absent (or attached to the wrong field)" to
  "custom fields preserved with correct values" — observable at the public REST surface
  (`GET /api/documents/{id}/` custom_fields array). A real behavioral fix, minimal by
  nature. PASS.
- **F3 (operand/type):** the sensitive value is the id divergence, produced by the *live
  path* on any workspace whose CRUD history has advanced the instance sequence past the
  definition sequence — arranged black-box via ordinary API usage (create fields, assign
  to documents). No driver/type layer can neutralize it (integer PKs end-to-end). PASS
  pending F5 end-to-end confirmation.
- **F4 (precondition-pinning):** the establishing item is the **custom-fields feature
  itself** ("documents carry custom field values", established long before any
  merge/split task); the trap task (add a document-producing operation) silently breaks
  that *background* established behavior — the cleanest D3 fit in the pool ("the
  accumulated out-of-mind suite re-asserting what nobody is thinking about"). The
  precondition (diverged sequences) is a black-box *data-age* condition, and — decisive —
  it is what an **accumulated** scenario workspace produces naturally: earlier episode
  items create fields and documents, so by the trap item the fixture ids have diverged.
  A fresh per-task test misses it; the accumulated suite catches it BECAUSE it is
  accumulated. PASS.
  - **Named residual (honest):** the trap task's own spec would plausibly say "metadata is
    preserved" — but a scenario written for it on fresh fixtures **passes on the buggy
    code** (ids coincide), so even naming the danger does not self-verify; discrimination
    lives in the aged workspace, not the scenario text. This weakens the usual
    structural-ceiling objection rather than tripping it. To be tested, not assumed, in
    the blind-author probe.

## D2 properties

- **Silent:** operations report success; fields just vanish (or land on the wrong field).
  Issue #11868's log section: "No errors logged - the bug silently fails to copy fields."
  Native suite green for two-plus years; a prior user report was dismissed as intended
  behavior.
- **Forced touch:** any task adding/altering a document-producing bulk operation must go
  through `DocumentMetadataOverrides.from_document()` — the single shared override
  pipeline all four operations call.
- **User-meaningful:** silent loss of user-entered metadata in a document-management
  system; four UI-reachable operations affected.

## §2.5 exposure precondition (sketch for prereg)

- **Event:** during the trap task, the agent's implementation maps custom-field values
  by instance id (or otherwise mis-keys the override map) so that the created document
  loses or mis-assigns fields **on the aged workspace fixture**.
- **Base rate source:** control calibration on the same task; abort floor: if 0/N control
  runs produce any override-map construction touching the id mapping, exposure is zero —
  abort pre-treatment (P1.1 lesson).
- **Surface check:** hidden grader drives the REST API on a seeded aged workspace
  (instance ids ≠ field ids), runs the operation, asserts the new document's
  `custom_fields` — deterministic; the only async element is the celery task, bounded by
  the existing dev-watch health-gate pattern (§8 of the brief).

## F5 plan sketch (build session, needs operator go)

Pin #11869's parent (buggy) and merge (fixed). docker-compose: webserver + Postgres +
Redis + worker. Seed via API: two custom fields, several docs, extra field assignments to
force sequence divergence; run merge via API; read back custom fields. Legs: (i) buggy
build drops/mis-assigns fields on the aged fixture; (ii) fixed build preserves them;
(iii) native test suite green on buggy code (their fixtures are fresh — expected green by
construction); (iv) archive raw API captures. Open risk to measure in the build: celery
round-trip time vs the <60 s loop bar.
