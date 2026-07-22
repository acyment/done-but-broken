#!/usr/bin/env bash
# Per-task DB reset (files persist across tasks, DB resets — prereg v2 §7.5):
# drop immich and recreate from the baseline template. Kills connections
# first; the server reconnects on demand, but the clean sequence is
# stop-server -> reset-db -> start-server.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

docker exec "$DB_CONTAINER" psql -U immich -d postgres -v ON_ERROR_STOP=1 \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='immich' AND pid<>pg_backend_pid();" \
  -c "DROP DATABASE IF EXISTS immich;" \
  -c "CREATE DATABASE immich TEMPLATE $BASELINE_DB;"
echo "immich DB reset from '$BASELINE_DB'"
