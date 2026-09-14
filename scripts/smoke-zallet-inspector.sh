#!/usr/bin/env bash
set -euo pipefail

image="${1:-veyrin-zallet-inspector:smoke}"
container="veyrin-zallet-smoke-${RANDOM}"
port="${VEYRIN_SMOKE_PORT:-51004}"
rpc_user="smoke_reviewer"
rpc_password="$(openssl rand -hex 32)"
work_dir="$(mktemp -d)"

cleanup() {
  docker rm --force "$container" >/dev/null 2>&1 || true
  rm -rf "$work_dir"
}
trap cleanup EXIT

docker run --detach --name "$container" \
  --cpus="${VEYRIN_SMOKE_CPUS:-0.1}" \
  --memory=512m \
  --env PORT=10000 \
  --env ZALLET_RPC_USER="$rpc_user" \
  --env ZALLET_RPC_PASSWORD="$rpc_password" \
  --publish "127.0.0.1:${port}:10000" \
  "$image" >/dev/null

for attempt in $(seq 1 300); do
  status="$(curl --silent --output "$work_dir/health.json" --write-out '%{http_code}' \
    "http://127.0.0.1:${port}/healthz" || true)"
  if [ "$status" = "200" ]; then
    break
  fi
  if ! docker inspect --format '{{.State.Running}}' "$container" | grep -q true; then
    docker logs "$container"
    echo "Inspector stopped before becoming ready" >&2
    exit 1
  fi
  if [ "$attempt" -eq 300 ]; then
    docker logs "$container"
    echo "Inspector readiness timed out" >&2
    exit 1
  fi
  sleep 1
done

grep -q '"status":"ready"' "$work_dir/health.json"

public_pczt="UENaVAEAAAAFis6ctQK0oduWDAEAyI0GhQEAAAEAxJUV9imWJJIzMwGTs9VTxEOo1FgzYwGSJJYp9hWVxAAB/////w8AAACgjQYZdqkUAQAAAAAAAAAAAAAAAAAAAAAAAACIrAAAAQEDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWsgICACIWBgIAIgICAgAgAAAAAAAAAAaCNBhl2qRQBAAAAAAAAAAAAAAAAAAAAAAAAAIisAAABI3QxSHh0Z1hZVFBXMko4QmU5MUhYUzc3TUZneDU3cWtIcnZLAAAAAPvC9DAMAfC3gg0A4zR8jaTuYUZ0N2y8RTWdqlT5tUk+AAADAAGuKTXx39iiSu18cN9946Zo63pJsTGYgN3iu9kDGuXYLwAA"
curl --fail --silent --show-error \
  --user "$rpc_user:$rpc_password" \
  --header 'Content-Type: application/json' \
  --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"pczt_inspect\",\"params\":[\"$public_pczt\"]}" \
  "http://127.0.0.1:${port}/" > "$work_dir/inspection.json"

grep -q '"result"' "$work_dir/inspection.json"
grep -q 't1HxtgXYTPW2J8Be91HXS77MFgx57qkHrvK' "$work_dir/inspection.json"

unauthorized_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --header 'Content-Type: application/json' \
  --data '{}' \
  "http://127.0.0.1:${port}/")"
test "$unauthorized_status" = "401"

echo "Inspector smoke proof passed: ready, decoded public PCZT, recipient verified, unauthorized request rejected."
