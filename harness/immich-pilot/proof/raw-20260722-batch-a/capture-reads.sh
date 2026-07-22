#!/usr/bin/env bash
# Capture the timestamp-surface API reads for the Batch A admission test.
# Usage: capture-reads.sh <label> <asset_id_a> <asset_id_b> <album_id>
# Writes <label>-{asset-a,asset-b,album,buckets,bucket-<date>,db-stored}.json/txt
# into this directory. Read-only against the running server + DB.
set -euo pipefail
cd "$(dirname "$0")"
LABEL="$1"; ASSET_A="$2"; ASSET_B="$3"; ALBUM="$4"
BASE_URL="http://127.0.0.1:2283/api"
KEY="$(cat ../../stack/.secrets/api_key)"

get() { curl -fsS -H "x-api-key: $KEY" "$BASE_URL$1"; }

get "/assets/$ASSET_A" | python3 -m json.tool > "$LABEL-asset-a.json"
get "/assets/$ASSET_B" | python3 -m json.tool > "$LABEL-asset-b.json"
get "/albums/$ALBUM"   | python3 -m json.tool > "$LABEL-album.json"
get "/timeline/buckets" | python3 -m json.tool > "$LABEL-buckets.json"
# fetch each bucket listed
for b in $(python3 -c "import json;print(' '.join(x['timeBucket'] for x in json.load(open('$LABEL-buckets.json'))))"); do
  get "/timeline/bucket?timeBucket=$b" | python3 -m json.tool > "$LABEL-bucket-$b.json"
done
# stored values, straight from Postgres in text form (server-independent ground truth)
docker exec immich_pilot_postgres psql -U immich -d immich -At -c \
  "SELECT id, \"localDateTime\", \"fileCreatedAt\", \"fileModifiedAt\" FROM asset ORDER BY \"originalFileName\";" \
  > "$LABEL-db-stored.txt"
echo "captured: $LABEL"
