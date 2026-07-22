#!/usr/bin/env bash
# Health gate: succeed only when the process serving the API (a) answers ping
# AND (b) started AFTER the newest source edit under server/src — i.e. "the
# code currently serving is the edited code". This is the amigo-flagged
# stale-code guard: after an edit, the old process keeps serving until the
# watcher recompiles and restarts; this gate refuses to green until the
# restart happened. A compile error means no restart ever, so the gate times
# out loudly instead of letting a stale server answer.
#
#   wait-current.sh [timeout_seconds]   (default 180)
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

timeout="${1:-180}"
newest_mtime="$(find "$SERVER_DIR/src" -name '*.ts' -exec stat -f %m {} + | sort -n | tail -1)"

deadline=$(( $(date +%s) + timeout ))
while (( $(date +%s) < deadline )); do
  pid="$(server_pid_on_port)"
  if [[ -n "$pid" ]]; then
    lstart="$(ps -p "$pid" -o lstart= 2>/dev/null | sed 's/^ *//')"
    if [[ -n "$lstart" ]]; then
      pstart="$(date -j -f '%a %b %d %T %Y' "$lstart" +%s 2>/dev/null || echo 0)"
      if (( pstart >= newest_mtime )) && ping_ok; then
        echo "serving pid $pid (started $(date -r "$pstart" '+%T')) >= newest src edit ($(date -r "$newest_mtime" '+%T')); ping OK"
        exit 0
      fi
    fi
  fi
  sleep 1
done
echo "GATE FAILED: no healthy server serving code newer than the last src edit within ${timeout}s" >&2
echo "  (compile error in watch mode? check $LOG_DIR/server.log)" >&2
exit 2
