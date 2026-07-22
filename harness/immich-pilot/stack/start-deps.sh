#!/usr/bin/env bash
# Bring up Postgres + Redis (pinned digests) and wait until healthy.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

docker compose -f "$STACK_DIR/docker-compose.yml" up -d --wait
echo "deps up: postgres 127.0.0.1:15433, redis 127.0.0.1:16380"
