#!/bin/sh
set -eu

: "${ZALLET_RPC_USER:?ZALLET_RPC_USER is required}"
: "${ZALLET_RPC_PASSWORD:?ZALLET_RPC_PASSWORD is required}"

case "${PORT:-10000}" in
  *[!0-9]*|'') echo "PORT must be numeric" >&2; exit 1 ;;
esac

runtime_dir="/var/lib/veyrin/runtime"
zebra_dir="/var/lib/veyrin/zebra"
zallet_dir="/var/lib/veyrin/zallet"
mkdir -p "$runtime_dir" "$zebra_dir" "$zallet_dir"
mkdir -p /tmp/nginx/client /tmp/nginx/proxy /tmp/nginx/fastcgi /tmp/nginx/uwsgi /tmp/nginx/scgi
umask 077

salt="$(openssl rand -hex 16)"
password_hash="$(printf '%s' "$ZALLET_RPC_PASSWORD" | openssl dgst -sha256 -mac HMAC -macopt "key:$salt" | awk '{print $NF}')"

cat > "$runtime_dir/zebra.toml" <<'EOF'
[network]
network = "Regtest"

[network.testnet_parameters.activation_heights]
BeforeOverwinter = 1
Overwinter = 1
Sapling = 1
Blossom = 1
Heartwood = 1
Canopy = 1
NU5 = 2
NU6 = 2
"NU6.1" = 2
"NU6.2" = 2
"NU6.3" = 2

[state]
cache_dir = "/var/lib/veyrin/zebra"
ephemeral = true

[rpc]
listen_addr = "127.0.0.1:18232"
enable_cookie_auth = false
parallel_cpu_threads = 1

[mining]
miner_address = "tmSRd1r8gs77Ja67Fw1JcdoXytxsyrLTPJm"

[sync]
download_concurrency_limit = 1
checkpoint_verify_concurrency_limit = 1
full_verify_concurrency_limit = 1
parallel_cpu_threads = 1

[tracing]
force_use_color = false
filter = "warn"
EOF

cat > "$runtime_dir/zallet.toml" <<EOF
[builder.limits]
orchard_actions = 250

[consensus]
network = "regtest"
regtest_nuparams = [
  "5ba81b19:1",
  "76b809bb:1",
  "2bb40e60:1",
  "f5b9230b:1",
  "e9ff75a6:1",
  "c2d6d0b4:2",
  "c8e71055:2",
  "4dec4df0:2",
  "5437f330:2",
  "37a5165b:2",
]

[database]

[external]

[features]
as_of_version = "0.1.0-beta.1"

[features.deprecated]

[features.experimental]

[indexer]
validator_address = "127.0.0.1:18232"
validator_user = "zebra"
validator_password = "zebra"

[keystore]
encryption_identity = "/var/lib/veyrin/zallet/identity.txt"

[note_management]

[rpc]
bind = ["127.0.0.1:28232"]
timeout = 180

[[rpc.auth]]
user = "$ZALLET_RPC_USER"
pwhash = "$salt\$$password_hash"
EOF

export PORT="${PORT:-10000}"
envsubst '${PORT}' < /etc/veyrin/nginx.conf.template > "$runtime_dir/nginx.conf"
rm -f "$runtime_dir/ready.json" "$runtime_dir/ready.json.tmp"

zebra_pid=""
zallet_pid=""
nginx_pid=""

shutdown() {
  if [ -n "$nginx_pid" ]; then kill "$nginx_pid" 2>/dev/null || true; fi
  if [ -n "$zallet_pid" ]; then kill "$zallet_pid" 2>/dev/null || true; fi
  if [ -n "$zebra_pid" ]; then kill "$zebra_pid" 2>/dev/null || true; fi
}
trap shutdown INT TERM EXIT

nginx -e /dev/stderr -c "$runtime_dir/nginx.conf" -g 'daemon off;' &
nginx_pid=$!

zebrad --config "$runtime_dir/zebra.toml" start &
zebra_pid=$!

attempt=0
until curl --fail --silent --show-error \
  --header 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"getblockchaininfo","params":[]}' \
  http://127.0.0.1:18232/ >/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo "Zebra did not become ready" >&2
    exit 1
  fi
  kill -0 "$zebra_pid" 2>/dev/null || { echo "Zebra stopped during startup" >&2; exit 1; }
  sleep 1
done

attempt=0
while :; do
  generate_response="$(curl --fail --silent --show-error \
    --header 'Content-Type: application/json' \
    --data '{"jsonrpc":"2.0","id":2,"method":"generate","params":[2]}' \
    http://127.0.0.1:18232/)" || generate_response=""
  case "$generate_response" in
    *'"result"'*) break ;;
  esac
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo "Zebra could not generate the inspection chain" >&2
    exit 1
  fi
  kill -0 "$zebra_pid" 2>/dev/null || { echo "Zebra stopped during startup" >&2; exit 1; }
  sleep 1
done

attempt=0
until curl --fail --silent --show-error \
  --header 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":3,"method":"getblockchaininfo","params":[]}' \
  http://127.0.0.1:18232/ | grep -q '"blocks":2'; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "Zebra did not commit the inspection chain" >&2
    exit 1
  fi
  sleep 1
done

if [ ! -s "$zallet_dir/identity.txt" ]; then
  zallet-zaino --datadir "$zallet_dir" --config "$runtime_dir/zallet.toml" \
    generate-encryption-identity >/dev/null 2>&1
fi

if [ ! -s "$zallet_dir/wallet.db" ]; then
  zallet-zaino --datadir "$zallet_dir" --config "$runtime_dir/zallet.toml" \
    init-wallet-encryption >/dev/null 2>&1
fi

zallet-zaino --datadir "$zallet_dir" --config "$runtime_dir/zallet.toml" start &
zallet_pid=$!

attempt=0
until bash -c 'exec 3<>/dev/tcp/127.0.0.1/28232' 2>/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 120 ]; then
    echo "Zallet RPC did not begin accepting requests" >&2
    exit 1
  fi
  kill -0 "$zallet_pid" 2>/dev/null || { echo "Zallet stopped during startup" >&2; exit 1; }
  sleep 1
done

readiness_pczt="UENaVAEAAAAFis6ctQK0oduWDAEAyI0GhQEAAAEAxJUV9imWJJIzMwGTs9VTxEOo1FgzYwGSJJYp9hWVxAAB/////w8AAACgjQYZdqkUAQAAAAAAAAAAAAAAAAAAAAAAAACIrAAAAQEDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWsgICACIWBgIAIgICAgAgAAAAAAAAAAaCNBhl2qRQBAAAAAAAAAAAAAAAAAAAAAAAAAIisAAABI3QxSHh0Z1hZVFBXMko4QmU5MUhYUzc3TUZneDU3cWtIcnZLAAAAAPvC9DAMAfC3gg0A4zR8jaTuYUZ0N2y8RTWdqlT5tUk+AAADAAGuKTXx39iiSu18cN9946Zo63pJsTGYgN3iu9kDGuXYLwAA"
readiness_response="$(curl --fail --silent --show-error --connect-timeout 2 --max-time 185 \
  --user "$ZALLET_RPC_USER:$ZALLET_RPC_PASSWORD" \
  --header 'Content-Type: application/json' \
  --data "{\"jsonrpc\":\"2.0\",\"id\":4,\"method\":\"pczt_inspect\",\"params\":[\"$readiness_pczt\"]}" \
  http://127.0.0.1:28232/)" || readiness_response=""
case "$readiness_response" in
  *'"result"'*) ;;
  *) echo "Zallet could not inspect the readiness PCZT" >&2; exit 1 ;;
esac

printf '%s\n' '{"status":"ready","service":"keyless-pczt-inspector"}' > "$runtime_dir/ready.json.tmp"
mv "$runtime_dir/ready.json.tmp" "$runtime_dir/ready.json"
echo "Keyless PCZT inspector ready; no mnemonic, account, or address was generated."
supervisor_pid=$$
(
  while kill -0 "$zebra_pid" 2>/dev/null && \
    kill -0 "$zallet_pid" 2>/dev/null && \
    kill -0 "$nginx_pid" 2>/dev/null; do
    sleep 2
  done
  echo "An inspector dependency stopped; restarting the service." >&2
  kill -TERM "$supervisor_pid" 2>/dev/null || true
) &
wait "$nginx_pid"
