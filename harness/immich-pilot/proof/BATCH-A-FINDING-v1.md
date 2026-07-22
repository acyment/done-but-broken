# Batch A exit memo — mechanism verification: **KILL for option 1 (timestamp re-anchor)**

Date: 2026-07-22. Zero external spend (git + node + docker + curl + GitHub API reads only; no
model calls). Governing plan: `docs/e5/E5-IMMICH-REANCHOR-BACKLOG-v1.md` Batch A. Raw evidence:
`raw-20260722-batch-a/`. This memo is the batch's exit gate; per the backlog's kill conditions,
control returns to the operator. Batches B–D as written are moot.

## Verdict

**No timestamp surface at pinned commit `4a8c3b6` passes the A3 admission test, and none can.**
Two independent kills, either sufficient:

1. **The fossil does not certify this surface.** The fix's (`e94e22f`, PR #28810) only
   behavioral change is the *date-only* encoder (`isoDateToDate.encode`: UTC slice → local
   calendar fields). On every datetime path the fix is a **rename** (`asDateString` →
   `asDateTimeString`); pre-fix `x.toISOString()` becomes `isoDatetimeToDate.encode(x)`,
   whose body at the pinned commit is `(date) => date.toISOString()` — byte-equivalent
   behavior (`raw-20260722/fix-e94e22f.diff` lines for `date.ts`/`validation.ts`). The
   date-only encoder's sole API surface is `person.birthDate` — already proven zero-exposure
   (`GATE-7-2-FINDING-v1.md`). So on the timestamp surface, "buggy" and "fixed" are
   observationally the same program: A3's requirement that correct code be observably right
   while the shipped code is observably wrong is **unsatisfiable by construction**.
2. **The surface has zero server-TZ sensitivity anyway.** Every timestamp column in the
   schema is `timestamp with time zone` (schema tables + `InitialMigration`; **no API-visible
   zone-less timestamp column exists**). The driver (postgres.js via `@immich/sql-tools`,
   session `TimeZone: 'UTC'`) hands the helper correct-instant Dates whose `toISOString()` is
   TZ-independent. Confirmed end-to-end through the real HTTP surface on the shipped code:
   byte-identical responses under `TZ=Australia/Sydney` (pilot pin) vs `TZ=UTC` (same absolute
   instant) for asset detail ×2, album `startDate`/`endDate`, timeline buckets list, both
   bucket payloads, and DB-stored text; write path likewise (upload under Sydney vs UTC stores
   identical rows; cross-TZ re-read correct). Nothing to trap — not even a representational
   difference.

## The candidate surfaces, settled (A1)

| Surface | Storage / path | Serialization | Server-TZ sensitive? |
|---|---|---|---|
| `GET /assets/:id` `localDateTime`, `fileCreatedAt`, `fileModifiedAt`, `createdAt`, `updatedAt` | `timestamptz` columns | pre-fix `asDateString` = `toISOString()` | **No** (proven E2E) |
| `exifInfo.dateTimeOriginal` / `modifyDate` | `timestamptz` columns | same helper, same class | **No** (same driver+helper class as above; worker not run — see A2) |
| Album `startDate`/`endDate` | SQL `MIN/MAX(("localDateTime" AT TIME ZONE 'UTC')::date)` → `date` value | same helper; driver parses `date` as **UTC midnight** | **No** (proven E2E) |
| Timeline buckets + bucket payload | fully SQL-serialized (`to_json(agg)::text`, bucket ids `::date::text`) | **no JS Date ever exists** | **No** (proven E2E) |
| `person.birthDate` | `date` column | the fix's only behavioral surface | Dead — §7.2 finding |

Upload path: `localDateTime` is set verbatim from the client's `fileCreatedAt` (zod
`z.iso.datetime()` accepts only zone-pinned strings → unambiguous instant). Metadata-worker
write path (not exercised): luxon-based with explicit `setZone('UTC', { keepLocalTime: true })`
— statically deterministic, and in any case uncertified by this fossil.

## Correction to the §7.2 finding's option-1 note (mechanism vs surface)

The §7.2 finding's subsidiary note claimed `asset.localDateTime` is `timestamp without time
zone`, parsed as local time. **The mechanism is real physics, but the type attribution was
wrong.** Driver probe v2 (`raw-20260722-batch-a/driver-probe-v2-output.txt`), run through the
server's own driver stack under both TZs:

- `timestamptz` → identical `toISOString()` under UTC and Sydney (TZ-independent);
- `date` cast → UTC midnight under both (TZ-independent);
- a **synthetic** zone-less timestamp (`AT TIME ZONE 'UTC'` projection) → `…T18:45Z` under UTC
  vs `…T08:45Z` under Sydney — the local-parse mechanism the note described, confirmed.

No API-visible column has the sensitive type. The note projected the §7.2 verdict correctly
(FAIL — unchanged, reinforced) but its option-1 escape hatch was an unverified inference; the
Batch A admission rule existed to catch exactly this, and did — pre-spend, pre-build.

## Fossil search (A1, bounded)

#28810 does not certify any timestamp surface (kill 1 above). A bounded GitHub search for a
*different* server-side fossil in the right symptom class found the nearest candidates —
#28705 "Search by date returns incorrect results" (v2.7.5, closed 2026-06-16, post-pin) and
#27487 (same day-earlier symptom) — both resolved by **web-client** fixes (PRs #29019,
#29128, `fix(web)`), i.e. the wrong layer for a server-API episode (the gunicorn failure
mode). No server-side timestamp fossil at or after the pin was found within the bounded
search; an exhaustive search is option-2 work.

## Batch tasks not run, and why

- **A2 (ingestion spike)**: NOT RUN — moot once A1/A3 killed the premise; the worker cannot
  create serialization-TZ sensitivity that the read path lacks. Its risk list (core-plugin
  wasm + geodata graceful-absence, worker latency vs the <60 s loop) remains **open** for any
  future use of this substrate.
- **A4 (episode sketch)**: NOT PRODUCED — kill conditions direct STOP, not redesign-in-place.

## Evidence inventory (`raw-20260722-batch-a/`)

`mk-fixtures.py`, `capture-reads.sh`, fixture JPEGs; `sydney-shipped-*` vs `utc-shipped-*`
capture pairs (asset-a, asset-b, album, buckets, bucket-2024-05-01, bucket-2024-11-01,
db-stored — all byte-identical); `upload-under-both-tz-db.txt` (write-path rows);
`sydney-read-of-utc-upload-asset-c.json` (cross-TZ read); `driver-probe-v2.mjs` +
`driver-probe-v2-output.txt`. Stack state: baseline DB template was rebuilt this session
(fresh Postgres volume); server and deps stopped after the run.

## Handoff to the operator (per backlog: present option 2)

Option 1 is dead: at this pinned commit the fossil's only observable surface has no exposure
(§7.2) and the timestamp surfaces have no fossil and no sensitivity (this memo). What
survives unchanged for a future episode: the full dev-watch stack, pinned toolchain, clock
pin, health gate, DB template reset, grader harness pattern, and the <60 s loop result.
Option 2 (substrate/fossil search with the end-to-end-repro admission rule baked in) is the
open path; this memo adds two admission-rule corollaries learned here: **(i)** verify the fix
commit's behavioral delta reaches the candidate surface (rename ≠ fix), and **(ii)** verify
the column/wire type actually produces the sensitive value — mechanism physics alone does not
establish a surface.
