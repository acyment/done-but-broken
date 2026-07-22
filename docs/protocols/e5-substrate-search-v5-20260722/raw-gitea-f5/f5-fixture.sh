#!/usr/bin/env bash
# f5-fixture.sh — Gitea #36483 F5 live repro: fixture + assertion, HTTP surface only.
#
# Usage: f5-fixture.sh <label> <port> <archive-dir>
#   <label>       buggy | fixed  (names the archived outputs)
#   <port>        port the target gitea instance listens on
#   <archive-dir> directory for raw HTTP captures
#
# Precondition: a freshly-initialized gitea instance (empty DB, INSTALL_LOCK=true,
# registration open) is listening on 127.0.0.1:<port>.
#
# Everything below goes through the public HTTP surface:
#   - first user via the web sign-up form (first registrant becomes admin)
#   - API token via POST /api/v1/users/{u}/tokens (basic auth)
#   - repo / branch / commits / PR via the v1 API
# No gitea CLI admin commands, no DB access.
#
# Fixture shape (the precondition the trap needs):
#   commit A on main (auto_init) -> branch feature@A -> commit B on feature
#   -> PR #1 feature->main -> commit C directly on main (base advances after branch)
# Assertion surface: GET /api/v1/repos/{o}/{r}/pulls/1/commits
#   BUGGY expectation: list contains C (base-branch commit) — the wrong value
#   FIXED expectation: list is exactly [B]
set -euo pipefail

LABEL=$1
PORT=$2
ARCH=$3
BASE="http://127.0.0.1:${PORT}"
USER_NAME=f5admin
PASS='F5pass!12345'
JAR=$(mktemp)
mkdir -p "$ARCH"

say() { printf '%s\n' "$*" >&2; }

# --- 1. first user via web sign-up form ----------------------------------------
# (this tree serves the sign-up form without a CSRF hidden input and accepts the
# POST without one; keep extraction tolerant so the script replays on trees that
# do embed it)
csrf=$(curl -sS -c "$JAR" "${BASE}/user/sign_up" | sed -n 's/.*name="_csrf" value="\([^"]*\)".*/\1/p' | head -1)
curl -sS -b "$JAR" -c "$JAR" -o "$ARCH/${LABEL}-signup.html" -w '%{http_code}' \
  -d "${csrf:+_csrf=${csrf}&}user_name=${USER_NAME}&email=f5%40example.com&password=${PASS}&retype=${PASS}" \
  "${BASE}/user/sign_up" > "$ARCH/${LABEL}-signup.code"
code=$(cat "$ARCH/${LABEL}-signup.code")
say "sign-up HTTP ${code}"
case "$code" in 3*) ;; *) say "FATAL: sign-up did not redirect (expected 303)"; exit 1;; esac

# --- 2. API token via basic auth ----------------------------------------------
TOKEN=$(curl -sS -u "${USER_NAME}:${PASS}" -H 'Content-Type: application/json' \
  -d '{"name":"f5","scopes":["all"]}' \
  "${BASE}/api/v1/users/${USER_NAME}/tokens" | python3 -c 'import sys,json;print(json.load(sys.stdin)["sha1"])')
AUTH="Authorization: token ${TOKEN}"

api() { # method path json-body outfile
  curl -sS -X "$1" -H "$AUTH" -H 'Content-Type: application/json' \
    ${3:+-d "$3"} "${BASE}/api/v1$2" | tee "$ARCH/$4" ; }

# --- 3. fixture ----------------------------------------------------------------
SEED_T0=$(python3 -c 'import time;print(time.monotonic())')

api POST /user/repos '{"name":"fixture","auto_init":true,"default_branch":"main","private":false}' \
  "${LABEL}-create-repo.json" > /dev/null
A_SHA=$(api GET "/repos/${USER_NAME}/fixture/branches/main" '' "${LABEL}-branch-main-A.json" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["commit"]["id"])')

api POST "/repos/${USER_NAME}/fixture/branches" '{"new_branch_name":"feature","old_ref_name":"main"}' \
  "${LABEL}-create-branch.json" > /dev/null

B_SHA=$(api POST "/repos/${USER_NAME}/fixture/contents/feature.txt" \
  '{"content":"QiBmZWF0dXJlIHdvcmsK","branch":"feature","message":"B: feature work"}' \
  "${LABEL}-commit-B.json" | python3 -c 'import sys,json;print(json.load(sys.stdin)["commit"]["sha"])')

PR_INDEX=$(api POST "/repos/${USER_NAME}/fixture/pulls" \
  '{"head":"feature","base":"main","title":"F5 PR: feature work"}' \
  "${LABEL}-create-pr.json" | python3 -c 'import sys,json;print(json.load(sys.stdin)["number"])')

C_SHA=$(api POST "/repos/${USER_NAME}/fixture/contents/mainline.txt" \
  '{"content":"QzogYmFzZSBhZHZhbmNlcwo=","branch":"main","message":"C: base advances after branch"}' \
  "${LABEL}-commit-C.json" | python3 -c 'import sys,json;print(json.load(sys.stdin)["commit"]["sha"])')

# --- 4. assertion surface ------------------------------------------------------
curl -sS -H "$AUTH" \
  "${BASE}/api/v1/repos/${USER_NAME}/fixture/pulls/${PR_INDEX}/commits?verification=false&files=false" \
  > "$ARCH/${LABEL}-pr-commits-api.json"

SEED_T1=$(python3 -c 'import time;print(time.monotonic())')

# web Commits tab, anonymous (repo is public)
curl -sS "${BASE}/${USER_NAME}/fixture/pulls/${PR_INDEX}/commits" \
  > "$ARCH/${LABEL}-pr-commits-web.html"

# --- 5. verdict ----------------------------------------------------------------
python3 - "$ARCH/${LABEL}-pr-commits-api.json" "$A_SHA" "$B_SHA" "$C_SHA" "$SEED_T0" "$SEED_T1" <<'EOF'
import json, sys
path, a, b, c, t0, t1 = sys.argv[1:7]
shas = [x["sha"] for x in json.load(open(path))]
print(f"A(main initial) = {a}")
print(f"B(feature)      = {b}")
print(f"C(base advance) = {c}")
print(f"PR commits list = {shas}")
print(f"contains_B={b in shas} contains_C={c in shas} contains_A={a in shas} count={len(shas)}")
print(f"seed+assert wall-clock: {float(t1)-float(t0):.2f}s")
EOF

grep -o "${B_SHA}\|${C_SHA}" "$ARCH/${LABEL}-pr-commits-web.html" | sort | uniq -c \
  | sed 's/^/web-html sha occurrences: /' || true
rm -f "$JAR"
