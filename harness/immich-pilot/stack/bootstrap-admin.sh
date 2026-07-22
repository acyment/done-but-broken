#!/usr/bin/env bash
# One-time bootstrap against a fresh DB: admin signup -> login -> API key.
# Writes the key to .secrets/api_key (0600). Idempotent-ish: if signup says
# the admin already exists, it logs in with the fixed credentials instead.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

EMAIL="pilot-admin@example.com"
PASSWORD="pilot-admin-password"
NAME="Pilot Admin"

signup_body="$(curl -fsS -X POST "$BASE_URL/auth/admin-sign-up" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"$NAME\"}" 2>&1)" \
  || echo "signup: admin may already exist (continuing to login)"

token="$(curl -fsS -X POST "$BASE_URL/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | \
  python3 -c 'import json,sys; print(json.load(sys.stdin)["accessToken"])')"

secret="$(curl -fsS -X POST "$BASE_URL/api-keys" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $token" \
  -d '{"name":"pilot-harness","permissions":["all"]}' | \
  python3 -c 'import json,sys; print(json.load(sys.stdin)["secret"])')"

umask 077
printf '%s' "$secret" > "$SECRETS_DIR/api_key"
echo "api key written to $SECRETS_DIR/api_key"
