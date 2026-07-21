# FastAPI streaming chain — local verification results v1

Pass 3 verification of the search-v2 comparison's only admitted candidate (`COMPARISON-v1.md` §3
row 1). Zero model spend — git + pytest only. Executed 2026-07-21 by Claude Code with operator
authorization. Environment: shallow clone (`--shallow-since=2026-01-15`) of fastapi/fastapi;
Python 3.12.11; `uv sync --group tests`; Starlette resolves to **0.52.1** under the repo's own
lockfile (matters below). Raw evidence in `verification-raw/`
(`MINUS-15022-revert-conflict.diff`, `MINUS-15022-revert-status.txt`, `KNOCKOUT-v2-semantic.diff`).

Method note: this run extends the frozen subtract-one-change method with one additional probe
type — a **semantic knockout** (disable the claimed mechanism's behavior in place, 1-line change,
diff preserved) — used where mechanical subtraction is impossible because the dependent commit
edited the claimed machinery in place. Each probe is labeled below. The loudness column
implements the comparison's §5.1 procedure change.

## Chain commits (all confirmed present, span linear)

| PR | squash commit | date |
|---|---|---|
| #14987 Starlette 1.0.0+ | `c73bc94` | 2026-02-24 |
| #15022 JSON-Lines/binary streaming via `yield` | `749cefd` | 2026-02-27 |
| #15030 Server-Sent Events | `2238155` | 2026-03-01 |
| #15038 TaskGroup/exit-stack fix | `8a9258b` | 2026-03-01 |
| #15588 SSE field validation | `c7fb785` | 2026-05-23 |

`git rev-list --merges c73bc94..c7fb785` → **0**. Linearity holds for the whole span and every
segment (14 / 12 / 13 / 303 intervening commits, the last segment almost all docs/translations).
(An earlier `git log --merges | wc -l` read 1 — artifact of output filtering; `rev-list` is
authoritative and was re-checked.)

## Mechanism verification (the load-bearing inferred claim)

**CONFIRMED at call-site level.** At `2238155`, `fastapi/routing.py` builds
`stream_item_field` from `get_stream_item_type(return_annotation)` (routing.py:808, 874 — both
symbols introduced by #15022) and the SSE handler's serializer is literally commented
"Shared serializer for stream items (JSONL and SSE)" (routing.py:440): plain objects yielded by
an SSE generator are validated and serialized through `stream_item_field.validate/serialize_json`.
Scope caveat, confirmed in code: items that are `ServerSentEvent` instances **skip** that
machinery by design — the dependency binds for *typed* SSE routes (`-> AsyncIterable[Item]`),
not for `ServerSentEvent`-yielding routes.

One scout overclaim corrected: `Dependant.is_gen_callable`/`is_async_gen_callable` predate
#15022 (it never touched `dependencies/models.py`); #15022's contribution to the dependency
layer is `get_stream_item_type` (+31 lines in `dependencies/utils.py`).

## Per-edge results

| Edge | Probe | Verdict | Loudness |
|---|---|---|---|
| #14987→#15022 | constraint analysis (+ attempted revert) | **NOT DEPENDENT** | n/a |
| #15022→#15030 | revert (conflict) + full knockout + semantic knockout | **DEPENDENT** | **loud if wholly absent; SILENT under semantic degradation** |
| #15030→#15038 | diff inspection + suite run without the fix | **DEPENDENT (structural)** | construction-loud; fixed behavior **untested** |
| #15038→#15588 (consecutive) | clean revert of #15038 at #15588 + test runs | **NOT DEPENDENT** | n/a |
| #15030→#15588 (hub edge) | test-diff inspection | **DEPENDENT** | loud (module import) |

### #14987→#15022 — NOT DEPENDENT (scout's own prediction, confirmed stronger)

#14987 touches only `pyproject.toml`/`uv.lock`: it removes the `starlette<1.0.0` cap. #15022
then raises the floor to `>=0.46.0`. Under the repo's own lockfile the resolved Starlette is
**0.52.1**, which satisfies the constraint both with and without #14987 — the edge is not even
an install-time dependency in the locked environment. Drop it; the chain starts at #15022.

### #15022→#15030 — the measured edge; DEPENDENT with a real silent layer

- **Mechanical subtraction impossible — and that is evidence, not noise.** `git revert 749cefd`
  at `2238155` conflicts in exactly 3 hunks of `routing.py` + 1 of `openapi/utils.py`, every one
  inside the claimed machinery (the SSE commit edited #15022's `stream_item` extraction block in
  place; `_serialize_data` and the SSE branch live in one region; `is_sse_stream`/`is_json_stream`
  are defined together). Unlike the SWE-Milestone merge-boundary cascade (100+ files of
  infrastructure noise), this conflict is semantically located: a coherent "SSE without
  streaming" tree never existed. Conflict diff preserved verbatim.
- **Full-absence knockout (`get_stream_item_type` → `None`): LOUD.** Route registration itself
  raises `FastAPIError: Invalid args for response field!` at collection time — the app won't
  start. An agent that wholly failed change A produces loud breakage at change B in both arms →
  non-discriminating.
- **Semantic knockout (bypass `stream_item_field` validation/serialization, surface intact):
  SILENT — and B's own suite is blind to it.** With A's semantics gone:
  - change B's entire test set passes: **33/33** (`tests/test_sse.py` + tutorial SSE tests);
  - across all streaming tests, exactly **2 of 28** fail — #15022's own
    `test_stream_json_validation_error_{async,sync}` — and they fail as
    `Failed: DID NOT RAISE ResponseValidationError`: no traceback, no import error, the app
    streams invalid data happily. Textbook silent behavioral divergence, observable at the
    public HTTP surface (yield an invalid item → correct build errors, degraded build streams
    garbage), i.e. exactly the class an executable acceptance scenario can detect and a
    passing-suite signal cannot.

### #15030→#15038 — DEPENDENT scaffolding; the fixed behavior is untested

#15038 rewrites the SSE producer internals #15030 created (its diff context *is* #15030's code
— PEP 789 exit-stack lifecycle). It shipped **no tests**, and reverting it at `c7fb785` leaves
the full SSE suite green (**39/39**) — the bug it fixes (generator finalization / task-group
cancellation) is entirely uncovered. A second silent behavior, but in the hang/lifecycle class:
hard to assert in a scenario without disconnect simulation. Scaffolding, not a measured edge.

### #15038→#15588 — NOT DEPENDENT; the chain is a hub, not a line

`git revert 8a9258b` at `c7fb785` is clean; #15588's 6 new tests pass (6/6) and the full suite
stays green. #15588's real dependency is on #15030 (its tests are pure unit tests of
`ServerSentEvent`, which #15030 defines — loud import failure without it). **The nominated
5-node chain is really a hub around #15030** (#15022→#15030→{#15038, #15588}), with both ends
(#14987, and the #15038→#15588 link) co-location.

Worth keeping: #15588 exists because pre-#15588 FastAPI **silently emitted corrupt SSE frames**
when `event`/`id` contained newlines — a shipped, real-world instance of silent public-surface
corruption at exactly this boundary, later caught by a maintainer rather than a test. Natural
material for scenario themes and the held-out oracle.

## Verdict against the comparison's go/no-go

- **The candidate survives every check it could be put to locally**: chain real, history linear,
  mechanism confirmed in code, one genuinely silent discriminating behavior found on the
  measured edge, observable at the public HTTP surface, with a natural visible/held-out split
  (tutorial tests vs `test_sse.py` vs authored scenarios).
- **But the silent layer is thin, and the scout's own promotion bar is not met.** The scout's
  threshold for a full two-arm study was ≥3 silent discriminating edges in one workspace; this
  chain yields **one** scenario-detectable silent behavior (stream-item validation), plus one
  uncovered lifecycle behavior that is hard to scenario-ize. What the substrate supports is at
  most a **narrow pilot on the #15022→#15030 edge** for the scoped claim already worded in the
  comparison (§5.4).
- **The recurring pattern is now cross-substrate**: change B's own tests not exercising the
  dependency mechanism (here: SSE suite blind to the shared serializer's semantics; in
  SWE-Milestone: M04's only graded test unrelated to `force_writeable`) has appeared in both
  substrates examined this way. The blind spot lives in real test suites, not just curated
  benchmarks — program-level finding, feeds either route.
- **The pilot's central design question is now concrete**: the discriminating scenario is "yield
  an item that violates the declared type → the endpoint must error, not stream garbage." A
  blind authoring pass (manifest + issue text, never the patch) either produces that scenario or
  it doesn't — and that, per the admission gate's per-check discrimination rule, is measurable
  before any paid run.

Any paid run remains gated on fresh operator authorization, a written pre-registration, and the
Step 6 re-attack, per standing discipline.
