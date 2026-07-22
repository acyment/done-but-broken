#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
docker compose -f "$STACK_DIR/docker-compose.yml" down "$@"
