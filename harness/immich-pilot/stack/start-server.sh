#!/usr/bin/env bash
# Start the Immich server (API worker only) as a bare node process in
# dev-watch mode, under the pinned zone + frozen instant.
#
#   start-server.sh                 # pilot clock (Australia/Sydney, pinned instant)
#   start-server.sh --tz UTC --no-pin      # proof/grader runs under other clocks
#   start-server.sh --tz Asia/Tokyo --instant 2026-01-15T12:00:00+09:00
#
# The clock args exist for the §7.2 proof and the hidden grader ONLY; the
# pilot itself always runs the default pin, identically in both arms.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

TZ_ARG="$PIN_TZ"
INSTANT_ARG="$PIN_INSTANT"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tz) TZ_ARG="$2"; shift 2 ;;
    --instant) INSTANT_ARG="$2"; shift 2 ;;
    --no-pin) INSTANT_ARG=""; shift ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

"$STACK_DIR/stop-server.sh" >/dev/null 2>&1 || true

declare -a env_kv
while IFS= read -r line; do env_kv+=("$line"); done < <(server_env)
# apply clock overrides
for i in "${!env_kv[@]}"; do
  case "${env_kv[$i]}" in
    TZ=*) env_kv[$i]="TZ=${TZ_ARG}" ;;
    PIN_CLOCK_INSTANT=*) env_kv[$i]="PIN_CLOCK_INSTANT=${INSTANT_ARG}" ;;
  esac
done

cd "$SERVER_DIR"
: > "$LOG_DIR/server.log"
nohup env "PATH=$TOOLCHAIN:$NODE_BIN:$PATH" "${env_kv[@]}" \
  "$TOOLCHAIN/pnpm" exec nest start --watch \
  > "$LOG_DIR/server.log" 2>&1 &
echo $! > "$LOG_DIR/server.pid"
echo "server starting (watch mode), TZ=${TZ_ARG} instant=${INSTANT_ARG:-<none>}; log: $LOG_DIR/server.log"
