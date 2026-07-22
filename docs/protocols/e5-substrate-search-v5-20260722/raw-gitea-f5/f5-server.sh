#!/usr/bin/env bash
# f5-server.sh — start a fresh Gitea instance for the F5 repro (SQLite, no mailer).
# Usage: f5-server.sh <worktree-dir> <workdir> <port>
# Wipes <workdir>, writes a minimal app.ini, starts `gitea web` in the background
# (nohup, logs to <workdir>/server.log), waits for /api/healthz, prints PID.
set -euo pipefail

TREE=$1
WORK=$2
PORT=$3

rm -rf "$WORK"
mkdir -p "$WORK/data" "$WORK/log" "$WORK/home"

cat > "$WORK/app.ini" <<EOF
APP_NAME = F5
RUN_MODE = prod
WORK_PATH = $WORK

[server]
PROTOCOL = http
HTTP_ADDR = 127.0.0.1
HTTP_PORT = $PORT
ROOT_URL = http://127.0.0.1:$PORT/
DISABLE_SSH = true
OFFLINE_MODE = true
STATIC_ROOT_PATH = $TREE

[database]
DB_TYPE = sqlite3
PATH = $WORK/data/gitea.db

[repository]
ROOT = $WORK/data/gitea-repositories

[security]
INSTALL_LOCK = true

[service]
DISABLE_REGISTRATION = false
REQUIRE_SIGNIN_VIEW = false

[mailer]
ENABLED = false

[log]
MODE = console
LEVEL = Warn

[actions]
ENABLED = false

[cron]
ENABLED = false
EOF

cd "$TREE"
HOME="$WORK/home" GITEA_WORK_DIR="$WORK" nohup ./gitea web -c "$WORK/app.ini" \
  > "$WORK/server.log" 2>&1 &
PID=$!
echo "$PID" > "$WORK/server.pid"

for i in $(seq 1 120); do
  if curl -fsS "http://127.0.0.1:$PORT/api/healthz" > /dev/null 2>&1; then
    echo "READY pid=$PID port=$PORT after ~$((i))*0.5s"
    exit 0
  fi
  sleep 0.5
done
echo "FATAL: server did not become healthy; tail of log:" >&2
tail -20 "$WORK/server.log" >&2
exit 1
