#!/usr/bin/env bash
# THE acceptance affordance: health-gate (current code serving), then run the
# committed cucumber glue in --strict mode. Pass/fail is THIS SCRIPT'S EXIT
# CODE, taken from cucumber's process exit code — never stdout scraping.
#   exit 0  = suite green
#   exit 1  = suite red (a scenario failed)
#   exit 2  = environment not ready (server not serving current code) — NOT a
#             scenario verdict; the distinction is load-bearing for the pilot.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

"$STACK_DIR/wait-current.sh" "${WAIT_TIMEOUT:-180}" || exit 2

[[ -f "$SECRETS_DIR/api_key" ]] || { echo "no api key; run bootstrap-admin.sh" >&2; exit 2; }

cd "$PILOT_DIR"
export IMMICH_BASE_URL="$BASE_URL"
export IMMICH_API_KEY="$(cat "$SECRETS_DIR/api_key")"
# exec: the runner's exit code IS this script's exit code, by construction.
exec env "PATH=$TOOLCHAIN:$NODE_BIN:$PATH" \
  "$NODE_BIN/node" ./node_modules/.bin/cucumber-js --config cucumber.mjs
