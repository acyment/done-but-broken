#!/usr/bin/env bash
# Paperless-ngx F5 fixture: aged-workspace custom-field repro, REST API only.
# Usage: fixture.sh <port> <outdir>
# Creates 4 custom field defs; ingests 3 docs; ages the workspace (3 burned
# instance ids on the scratch doc); assigns field-A + field-B to the source doc
# (engineering both wrongness forms: source instance id 4 == def id of field-D
# -> collision; source instance id 5 matches no def -> divergence); merges
# source+other with metadata_document_id=source; reads back merged custom_fields.
# All timestamps to stdout; raw HTTP bodies to <outdir> via curl -o.
set -euo pipefail
PORT="$1"; OUT="$2"
BASE="http://localhost:$PORT"
SAMPLES="$(cd "$(dirname "$0")" && pwd)/samples"
mkdir -p "$OUT"

now_ms() { python3 -c 'import time; print(int(time.time()*1000))'; }
T_START=$(now_ms)

# --- 1. wait for API up (accept 200/302/401 as alive) ---
while :; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$BASE/api/" || true)
  [ "$code" = "200" ] || [ "$code" = "302" ] || [ "$code" = "401" ] && break
  sleep 0.5
done
T_UP=$(now_ms)
echo "TIMING api_up_ms=$((T_UP - T_START))"

# --- 2. token auth ---
for i in $(seq 1 60); do
  curl -s -X POST "$BASE/api/token/" -H 'Content-Type: application/json' \
    -d '{"username":"f5admin","password":"f5password"}' -o "$OUT/token.json" || true
  TOKEN=$(jq -r '.token // empty' "$OUT/token.json" 2>/dev/null || true)
  [ -n "$TOKEN" ] && break
  sleep 0.5
done
[ -n "$TOKEN" ] || { echo "FATAL: no token"; cat "$OUT/token.json"; exit 1; }
AUTH="Authorization: Token $TOKEN"

api() { # api <method> <path> <json-body-or-empty> <outfile>
  local m="$1" p="$2" body="$3" out="$4"
  if [ -n "$body" ]; then
    curl -sf -X "$m" "$BASE$p" -H "$AUTH" -H 'Content-Type: application/json' -d "$body" -o "$out"
  else
    curl -sf -X "$m" "$BASE$p" -H "$AUTH" -o "$out"
  fi
}

# --- 3. four string custom field definitions (ids read back, not assumed) ---
declare -A CF
for name in field-A field-B field-C field-D; do
  api POST /api/custom_fields/ "{\"name\":\"$name\",\"data_type\":\"string\"}" "$OUT/cf-$name.json"
  CF[$name]=$(jq -r .id "$OUT/cf-$name.json")
  echo "DEF $name id=${CF[$name]}"
done

# --- 4. ingest three documents (async; poll tasks API) ---
upload() { # upload <file> <title> -> task uuid on stdout
  curl -sf -H "$AUTH" -F "document=@$SAMPLES/$1" -F "title=$2" \
    "$BASE/api/documents/post_document/" | tr -d '"'
}
wait_task() { # wait_task <uuid> <label> -> related_document id on stdout
  local uuid="$1" label="$2" status="" i
  for i in $(seq 1 240); do
    curl -sf -H "$AUTH" "$BASE/api/tasks/?task_id=$uuid" -o "$OUT/task-$label.json"
    status=$(jq -r '.[0].status // empty' "$OUT/task-$label.json")
    if [ "$status" = "SUCCESS" ]; then jq -r '.[0].related_document' "$OUT/task-$label.json"; return 0; fi
    if [ "$status" = "FAILURE" ]; then echo "FATAL: task $label FAILURE" >&2; cat "$OUT/task-$label.json" >&2; return 1; fi
    sleep 0.5
  done
  echo "FATAL: task $label timeout (last status: $status)" >&2; return 1
}
TK1=$(upload simple.pdf scratch);            echo "task scratch  $TK1"
TK2=$(upload double-sided-even.pdf source);  echo "task source   $TK2"
TK3=$(upload double-sided-odd.pdf other);    echo "task other    $TK3"
DOC1=$(wait_task "$TK1" scratch); DOC2=$(wait_task "$TK2" source); DOC3=$(wait_task "$TK3" other)
echo "DOCS scratch=$DOC1 source=$DOC2 other=$DOC3"
T_DOCS=$(now_ms)
echo "TIMING ingest_done_ms=$((T_DOCS - T_UP))"

# --- 5. age the workspace: burn 3 instance ids on the scratch doc, then
#        delete those assignments (removal is a hard delete after the update;
#        the id sequence stays advanced) ---
A=${CF[field-A]}; B=${CF[field-B]}; C=${CF[field-C]}; D=${CF[field-D]}
api PATCH "/api/documents/$DOC1/" \
  "{\"custom_fields\":[{\"field\":$A,\"value\":\"burn-a\"},{\"field\":$B,\"value\":\"burn-b\"},{\"field\":$C,\"value\":\"burn-c\"}]}" \
  "$OUT/age-assign.json"
api PATCH "/api/documents/$DOC1/" '{"custom_fields":[]}' "$OUT/age-clear.json"

# --- 6. source doc gets field-A then field-B (instance ids 4 then 5 on a
#        fresh sequence; verified diagnostically outside this script) ---
api PATCH "/api/documents/$DOC2/" \
  "{\"custom_fields\":[{\"field\":$A,\"value\":\"alpha-val\"}]}" "$OUT/source-assign-a.json"
api PATCH "/api/documents/$DOC2/" \
  "{\"custom_fields\":[{\"field\":$A,\"value\":\"alpha-val\"},{\"field\":$B,\"value\":\"beta-val\"}]}" \
  "$OUT/source-assign-ab.json"
api GET "/api/documents/$DOC2/" "" "$OUT/source-doc.json"
echo "SOURCE custom_fields: $(jq -c .custom_fields "$OUT/source-doc.json")"
T_SEED=$(now_ms)
echo "TIMING seed_done_ms=$((T_SEED - T_UP))"

# --- 7. merge through the public bulk-edit API (the #10256/#11868 operation) ---
api POST /api/documents/bulk_edit/ \
  "{\"documents\":[$DOC2,$DOC3],\"method\":\"merge\",\"parameters\":{\"metadata_document_id\":$DOC2}}" \
  "$OUT/merge-response.json"
T_MERGE_HTTP=$(now_ms)
echo "MERGE response: $(cat "$OUT/merge-response.json")"
echo "TIMING merge_http_ms=$((T_MERGE_HTTP - T_SEED))"

# --- 8. wait for the merged document (async consume) ---
MERGED=""
for i in $(seq 1 240); do
  curl -sf -H "$AUTH" "$BASE/api/documents/?ordering=-id&page_size=5" -o "$OUT/doclist-latest.json"
  MERGED=$(jq -r '[.results[] | select(.title | test("merged"))][0].id // empty' "$OUT/doclist-latest.json")
  [ -n "$MERGED" ] && break
  sleep 0.5
done
[ -n "$MERGED" ] || { echo "FATAL: merged doc never appeared"; exit 1; }
T_MERGED=$(now_ms)
echo "MERGED doc id=$MERGED"
echo "TIMING merge_async_wait_ms=$((T_MERGED - T_MERGE_HTTP))"

# --- 9. read back the merged document's custom fields (the assertion surface) ---
api GET "/api/documents/$MERGED/" "" "$OUT/merged-doc.json"
echo "MERGED custom_fields: $(jq -c .custom_fields "$OUT/merged-doc.json")"
T_END=$(now_ms)
echo "TIMING total_ms=$((T_END - T_START))"
echo "DEFS A=$A B=$B C=$C D=$D"
echo "FIXTURE COMPLETE"
