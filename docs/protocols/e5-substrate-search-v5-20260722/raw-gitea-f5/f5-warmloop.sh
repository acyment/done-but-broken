#!/usr/bin/env bash
# f5-warmloop.sh — warm-loop latency: on an already-running instance,
# delete fixture repo -> reseed -> assert, all via the HTTP API.
# Usage: f5-warmloop.sh <port> <archive-dir> <label>
set -euo pipefail
PORT=$1; ARCH=$2; LABEL=$3
BASE="http://127.0.0.1:${PORT}"
U=f5admin; PASS='F5pass!12345'

TOKEN=$(curl -sS -u "${U}:${PASS}" -H 'Content-Type: application/json' \
  -d "{\"name\":\"warm-$RANDOM\",\"scopes\":[\"all\"]}" \
  "${BASE}/api/v1/users/${U}/tokens" | python3 -c 'import sys,json;print(json.load(sys.stdin)["sha1"])')
AUTH="Authorization: token ${TOKEN}"

T0=$(python3 -c 'import time;print(time.monotonic())')
curl -sS -X DELETE -H "$AUTH" "${BASE}/api/v1/repos/${U}/fixture" -o /dev/null
curl -sS -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"fixture","auto_init":true,"default_branch":"main","private":false}' \
  "${BASE}/api/v1/user/repos" -o /dev/null
curl -sS -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"new_branch_name":"feature","old_ref_name":"main"}' \
  "${BASE}/api/v1/repos/${U}/fixture/branches" -o /dev/null
B=$(curl -sS -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"content":"QiBmZWF0dXJlIHdvcmsK","branch":"feature","message":"B: feature work"}' \
  "${BASE}/api/v1/repos/${U}/fixture/contents/feature.txt" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["commit"]["sha"])')
N=$(curl -sS -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"head":"feature","base":"main","title":"warm loop PR"}' \
  "${BASE}/api/v1/repos/${U}/fixture/pulls" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["number"])')
C=$(curl -sS -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"content":"QzogYmFzZSBhZHZhbmNlcwo=","branch":"main","message":"C: base advances"}' \
  "${BASE}/api/v1/repos/${U}/fixture/contents/mainline.txt" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["commit"]["sha"])')
curl -sS -H "$AUTH" \
  "${BASE}/api/v1/repos/${U}/fixture/pulls/${N}/commits?verification=false&files=false" \
  -o "${ARCH}/${LABEL}-warm-loop-pr-commits-api.json"
T1=$(python3 -c 'import time;print(time.monotonic())')

python3 - "${ARCH}/${LABEL}-warm-loop-pr-commits-api.json" "$B" "$C" "$T0" "$T1" <<'EOF'
import json, sys
path, b, c, t0, t1 = sys.argv[1:6]
shas = [x["sha"] for x in json.load(open(path))]
print(f"warm PR#{'?'} commits = {shas}")
print(f"contains_B={b in shas} contains_C={c in shas} count={len(shas)}")
print(f"warm reset+seed+assert wall-clock: {float(t1)-float(t0):.2f}s")
EOF
