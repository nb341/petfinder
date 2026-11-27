#!/usr/bin/env bash
# Checks the scenarios in features/local-emulator.feature against a local floci.
set -euo pipefail

cd "$(dirname "$0")/.."

FLOCI_URL=http://localhost:4566
HEALTH_URL="$FLOCI_URL/_localstack/health"
BUCKET=petfinder-smoke
failures=0

pass() { printf '  \033[32m✔\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✘\033[0m %s\n' "$1"; failures=$((failures + 1)); }

wait_for_floci() {
  for _ in $(seq 1 60); do
    curl -sf -o /dev/null "$HEALTH_URL" && return 0
    sleep 1
  done
  return 1
}

# floci doesn't verify SigV4, so unsigned path-style requests are enough here.
bucket_exists() { [ "$(curl -s -o /dev/null -w '%{http_code}' -I "$FLOCI_URL/$1")" = 200 ]; }

echo 'Scenario: floci starts and is reachable'
docker compose up -d floci >/dev/null 2>&1
wait_for_floci || true
status=$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL")
[ "$status" = 200 ] && pass "$HEALTH_URL responds with 200" || fail "$HEALTH_URL responded with $status"

echo 'Scenario: floci is not exposed beyond this machine'
bindings=$(docker inspect --format '{{range $p, $b := .HostConfig.PortBindings}}{{range $b}}{{$p}} {{.HostIp}}{{"\n"}}{{end}}{{end}}' "$(docker compose ps -q floci)")
exposed=$(awk 'NF && $2 != "127.0.0.1"' <<<"$bindings")
missing=$(for port in 4566 $(seq 7001 7099); do grep -q "^$port/tcp 127.0.0.1$" <<<"$bindings" || echo "$port"; done)
if [ -z "$exposed" ] && [ -z "$missing" ]; then
  pass 'ports 4566 and 7001-7099 are bound to 127.0.0.1 only'
else
  [ -n "$exposed" ] && fail "bound beyond loopback: $(cut -d" " -f1 <<<"$exposed" | paste -sd, -)"
  [ -n "$missing" ] && fail "not bound to 127.0.0.1: $(paste -sd, - <<<"$missing")"
fi

echo 'Scenario: Emulated resources survive a restart'
bucket_exists "$BUCKET" || curl -s -o /dev/null -X PUT "$FLOCI_URL/$BUCKET"
if bucket_exists "$BUCKET"; then
  docker compose restart floci >/dev/null 2>&1
  wait_for_floci || true
  bucket_exists "$BUCKET" && pass "bucket $BUCKET still exists after restart" || fail "bucket $BUCKET is gone after restart"
else
  fail "could not create bucket $BUCKET"
fi

[ "$failures" -eq 0 ] && echo 'All scenarios passed.' || { echo "$failures check(s) failed."; exit 1; }
