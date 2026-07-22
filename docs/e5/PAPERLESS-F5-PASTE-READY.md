# Paperless-ngx F5 build session — paste-ready prompt (v1)

Session mechanics (operator): fresh context, frontier tier, high effort. Zero external
spend. Expected length: one session (heavier stack than gitea: compose + async worker).

---

Run admission filter **F5 (live end-to-end repro)** for the paperless-ngx candidate of
substrate search v5. **Falsification framing: your job is to find the reason this candidate
is OUT.** A candidate that survives an honest kill attempt is admitted; a candidate nursed
through a sympathetic check is how this program has died twice before (Immich §7.2,
Batch A). Gitea already passed F5 (`GITEA-F5-RESULTS-v1.md`) — that outcome creates **no**
presumption here; a latent fossil on a heavier stack has more ways to be OUT.

## Read first (do not re-litigate F0–F4)

1. `docs/e5/E5-SUBSTRATE-SEARCH-V5-BRIEF-v1.md` — §3 (F5 definition), §8 (reusable stack
   properties, <60 s loop bar).
2. `docs/protocols/e5-substrate-search-v5-20260722/PAPERLESS-SCREEN-v1.md` — the
   candidate's F0–F4 record, fossil anchors, F5 plan sketch.
3. `docs/protocols/e5-substrate-search-v5-20260722/COMPARISON-v1.md` §6 — exit-gate rules.
4. `docs/protocols/e5-substrate-search-v5-20260722/GITEA-F5-RESULTS-v1.md` §5 — the
   suite-failure attribution procedure (controlled comparison on the fixed tree); reuse it.

F0–F4 verdicts stand; do not re-argue them. DO re-anchor the two pinned facts locally
before building: the #11869 diff must show the one-token fix `custom_field.id` →
`custom_field.field.id` inside `DocumentMetadataOverrides.from_document()`
(`src/documents/data_models.py`); and at the BUGGY checkout the consumer of that override
map must filter `CustomField.objects.filter(id__in=<keys>)` (or equivalent) so unknown
keys are **silently dropped** — read the actual consumer, don't assume it.

## Hard constraints

- **Zero external spend**: local compute, git, docker, GitHub reads only. No model
  experiments, no OpenRouter/provider calls, no runs.
- **Stop at first kill.** Kill ⇒ write the finding memo, stop; no redesign-in-place
  (Batch A precedent). Control returns to the operator either way.
- **No design-phase machinery** regardless of outcome: no memorization probe (mandatory
  later for this latent fossil — #10256 is in training data — but NOT part of F5), no
  blind-author probe, no Three Amigos, no prereg drafting. Exit memo → operator.

## Pinned states

Repo: `paperless-ngx/paperless-ngx`.

- **FIXED** = merge commit of PR #11869 (resolve via
  `gh pr view 11869 --repo paperless-ngx/paperless-ngx --json mergeCommit`; record it).
- **BUGGY** = first parent of the FIXED merge commit (verify the buggy keying line is
  present in `from_document()` at that checkout).
- No pre-culprit leg: the culprit is pre-window (2023–24); the fix's parent has been buggy
  for the fossil's whole life, which is the point of the latent shape.

## The fixture (the precondition, black-box)

Via the REST API only (no DB pokes, no Django shell): create ≥2 custom field definitions;
ingest several documents (async consume — wait via the tasks API); then **age the
workspace**: create and delete enough custom-field *assignments* that the instance-id
sequence advances past the field-definition-id sequence. Engineer both wrongness forms:

- **Divergence:** the source document's instance ids match no field-definition id →
  fields silently dropped on the produced document.
- **Collision (stronger, wrong-value):** a source instance id equals a *different* field's
  definition id → value lands on the wrong field. Archive which form(s) the fixture
  achieved; divergence alone is sufficient for leg (i), collision is worth one extra try.

Then run **merge** through the public API (the operation the users in #10256/#11868 ran),
wait for the async task, and read back the produced document's `custom_fields`.
Deterministic apart from task completion — poll, don't sleep blindly.

## Legs (all four required; archive raw outputs for each)

1. **(i) Wrong value live at the public surface, BUGGY build:** on the aged fixture,
   `GET /api/documents/{new_id}/` must show custom fields missing (or mis-assigned) on the
   merged document, with the merge reporting success and no error surfaced. **If the buggy
   build does NOT produce the wrong value through the real surface — e.g. the id spread
   cannot be produced via the API, or the consumer path differs from the screen's reading —
   that is the kill; write it up, stop.** (Batch-A corollaries: the fix's delta must reach
   this surface; the live path must actually produce the diverged ids.)
2. **(ii) Correct behavior, FIXED build:** same fixture recipe, same requests → all source
   custom fields present with correct values on the merged document. Diff the two
   `custom_fields` payloads; archive both.
3. **(iii) Decoy property — native suite green on BUGGY:** run the native test suite on
   the BUGGY checkout. Scope honestly: at minimum the test modules covering
   `data_models`/overrides, bulk edit (merge/split/edit_pdf/remove_password), and the
   consumer pipeline; record exactly what was run and why that scope is a fair reading.
   The screen predicts green **by construction** (fresh-DB fixtures make the ids
   coincide) — verify the prediction, and verify at least one native test actually
   exercises `from_document()` metadata copying (if none does, record that; it strengthens
   the decoy, it is not a kill). **Any native test that fails on BUGGY because of this bug
   ⇒ KILL.** For any failure: attribute via the gitea §5 procedure (quiet re-run, then the
   identical tests on the FIXED tree in the same environment) before calling it either way.
4. **(iv) Evidence archive:** raw HTTP captures, suite/build logs, fixture script →
   `docs/protocols/e5-substrate-search-v5-20260722/raw-paperless-f5/`, memo →
   `docs/protocols/e5-substrate-search-v5-20260722/PAPERLESS-F5-RESULTS-v1.md`.

Additionally **measure the loop**: wall-clock for reset→seed→assert on the buggy build
against the <60 s bar (§8) — the screen flags the celery round-trip as the open risk, so
report the async wait separately from the HTTP time. Over-bar is not an automatic kill;
it is a number the operator needs for the episode design.

## Build hints (hints, not prescriptions)

- Both builds are local docker images at pinned commits (compose: webserver + Postgres +
  Redis + worker); check the repo's Dockerfile/compose files for the January-2026 layout
  and Python version. If image builds are slow, build once per commit and reuse volumes
  for the warm-loop measurement — but the cold loop must include a real reset.
- Gotchas that recurred in the gitea F5 session: detach long builds; write HTTP responses
  with `curl -o` straight to files (zsh `echo` corrupts JSON `\n` escapes); the repo-root
  `.gitignore` has `*.log` — force-add archived logs; keep the machine quiet during suite
  runs (load flakes) and never attribute a suite failure without the fixed-tree controlled
  comparison; all fixture setup through the API so the repro replays from the archived
  script.

## Exit

- **PASS all legs** ⇒ paperless is the second F5-verified candidate (latent class); memo +
  standings line; stop. Operator decides design-phase start — for this candidate the
  memorization probe comes first, before any other machinery.
- **KILL** ⇒ memo with the exact leg and evidence, one-line entry for the comparison doc's
  kill table; stop. Gitea remains the sole F5-verified candidate; the CLI reserves
  (ripgrep first) are the next vein — operator decision.
