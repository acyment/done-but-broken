#!/usr/bin/env bash
# Run the hidden grader against the CURRENT server code (prereg v2 §5):
#   phase A: restart server under Asia/Tokyo (+09:00, ahead of UTC, different
#            offset than the pilot's Sydney +11:00), grader must be green
#   phase B: restart server under UTC (counter-check), grader must be green
# Verdict GREEN iff both phases pass. Leaves the server running under the
# pilot clock again when done. Exit 0 = GREEN, 1 = RED, 2 = env failure.
#
# Same absolute instant in every phase (2026-01-15T01:00:00Z); only the zone
# varies — the zone is the manipulated variable, the instant never moves.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

phase() {
  local tz="$1" instant="$2" label="$3"
  "$STACK_DIR/start-server.sh" --tz "$tz" --instant "$instant" >/dev/null
  if ! "$STACK_DIR/wait-current.sh" "${WAIT_TIMEOUT:-180}" >/dev/null; then
    echo "grade: phase $label ENV-FAIL (server not current/healthy)"; return 2
  fi
  IMMICH_BASE_URL="$BASE_URL" IMMICH_API_KEY="$(cat "$SECRETS_DIR/api_key")" \
    run_tool node "$STACK_DIR/grader/grader.mjs"
}

rc_a=0; rc_b=0
phase "Asia/Tokyo" "2026-01-15T10:00:00+09:00" "A(+09:00)" || rc_a=$?
if [[ $rc_a -ne 2 ]]; then
  phase "UTC" "2026-01-15T01:00:00Z" "B(UTC counter-check)" || rc_b=$?
fi

# restore the pilot clock
"$STACK_DIR/start-server.sh" >/dev/null
"$STACK_DIR/wait-current.sh" "${WAIT_TIMEOUT:-180}" >/dev/null || true

if [[ $rc_a -eq 2 || $rc_b -eq 2 ]]; then echo "grade: VERDICT ENV-FAIL"; exit 2; fi
if [[ $rc_a -eq 0 && $rc_b -eq 0 ]]; then echo "grade: VERDICT GREEN (A pass, B pass)"; exit 0; fi
echo "grade: VERDICT RED (A rc=$rc_a, B rc=$rc_b)"; exit 1
