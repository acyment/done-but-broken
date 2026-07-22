#!/usr/bin/env bash
# Shared paths + env for the Immich pilot stack scripts. Source, don't run.
set -euo pipefail

STACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PILOT_DIR="$(dirname "$STACK_DIR")"
IMMICH_DIR="$PILOT_DIR/substrate/immich"
SERVER_DIR="$IMMICH_DIR/server"
DATA_DIR="$STACK_DIR/.data"
SECRETS_DIR="$STACK_DIR/.secrets"
LOG_DIR="$STACK_DIR/.logs"
mkdir -p "$DATA_DIR/media" "$DATA_DIR/build/geodata" "$DATA_DIR/build/www" \
  "$DATA_DIR/build/plugins" "$SECRETS_DIR" "$LOG_DIR"

# ---- pinned toolchain (the substrate's own mise pins: node 24.15.0, pnpm
# 10.33.4), vendored locally in .toolchain/ because the sandbox blocked mise's
# downloader. run_tool prefixes PATH so child processes (nest, pnpm scripts)
# resolve the same pinned node.
TOOLCHAIN="$STACK_DIR/.toolchain"
NODE_BIN="$TOOLCHAIN/node-v24.15.0-darwin-arm64/bin"
run_tool() { PATH="$TOOLCHAIN:$NODE_BIN:$PATH" "$@"; }

# ---- server endpoint ----
IMMICH_PORT=2283
BASE_URL="http://127.0.0.1:${IMMICH_PORT}/api"

# ---- frozen instant (prereg v2 §3): non-UTC, AHEAD of UTC, DST-resolved ----
# 2026-01-15 12:00 in Australia/Sydney = AEDT = UTC+11 (DST active mid-January;
# the explicit +11:00 offset makes the resolution unambiguous by construction).
PIN_TZ="Australia/Sydney"
PIN_INSTANT="2026-01-15T12:00:00+11:00"

# ---- database ----
DB_CONTAINER=immich_pilot_postgres
DB_URL="postgres://immich:immich@127.0.0.1:15433/immich"
BASELINE_DB="immich_baseline"

server_env() {
  # Env for the Immich server process. Everything the server needs, nothing
  # about the harness. TZ + pin-clock ride on every invocation identically.
  env_vars=(
    "IMMICH_ENV=development"
    "IMMICH_WORKERS_INCLUDE=api"
    "IMMICH_PORT=${IMMICH_PORT}"
    "IMMICH_HOST=127.0.0.1"
    "DB_URL=${DB_URL}"
    "REDIS_HOSTNAME=127.0.0.1"
    "REDIS_PORT=16380"
    "IMMICH_MEDIA_LOCATION=${DATA_DIR}/media"
    "IMMICH_IGNORE_MOUNT_CHECK_ERRORS=true"
    "IMMICH_BUILD_DATA=${DATA_DIR}/build"
    "IMMICH_CONFIG_FILE=${STACK_DIR}/immich-config.json"
    "IMMICH_LOG_LEVEL=log"
    "TZ=${PIN_TZ}"
    "PIN_CLOCK_INSTANT=${PIN_INSTANT}"
    "NODE_OPTIONS=--require ${STACK_DIR}/pin-clock.cjs"
  )
  printf '%s\n' "${env_vars[@]}"
}

server_pid_on_port() {
  lsof -nP -iTCP:"${IMMICH_PORT}" -sTCP:LISTEN -t 2>/dev/null | head -1 || true
}

ping_ok() {
  curl -fsS --max-time 2 "${BASE_URL}/server/ping" >/dev/null 2>&1 ||
    curl -fsS --max-time 2 "${BASE_URL}/server-info/ping" >/dev/null 2>&1
}
