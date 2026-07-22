#!/usr/bin/env bash
# Snapshot the current immich DB (post-migration, post-bootstrap) as a
# template database. reset-db.sh restores from it in ~1s. Server must be
# stopped (template creation requires no active connections).
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

docker exec "$DB_CONTAINER" psql -U immich -d postgres -v ON_ERROR_STOP=1 \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='immich' AND pid<>pg_backend_pid();" \
  -c "DROP DATABASE IF EXISTS $BASELINE_DB;" \
  -c "CREATE DATABASE $BASELINE_DB TEMPLATE immich;"
echo "baseline snapshot '$BASELINE_DB' created"
