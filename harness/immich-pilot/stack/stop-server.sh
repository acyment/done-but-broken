#!/usr/bin/env bash
# Stop the dev-watch server and every child (tsc watcher, api worker).
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

stopped=0
if [[ -f "$LOG_DIR/server.pid" ]]; then
  pid="$(cat "$LOG_DIR/server.pid")"
  if kill -0 "$pid" 2>/dev/null; then
    pgid="$(ps -o pgid= -p "$pid" | tr -d ' ')"
    if [[ -n "$pgid" ]]; then kill -TERM -- "-$pgid" 2>/dev/null || true; fi
    kill -TERM "$pid" 2>/dev/null || true
    stopped=1
  fi
  rm -f "$LOG_DIR/server.pid"
fi
# Fallback: anything still listening on the API port dies too.
for _ in 1 2 3 4 5 6 7 8 9 10; do
  lp="$(server_pid_on_port)"
  [[ -z "$lp" ]] && break
  kill -TERM "$lp" 2>/dev/null || kill -KILL "$lp" 2>/dev/null || true
  sleep 0.5
done
[[ "$stopped" == 1 ]] && echo "server stopped" || echo "server was not running"
exit 0
