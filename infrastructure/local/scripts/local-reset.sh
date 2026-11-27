#!/usr/bin/env bash
# Deletes all local data: the Postgres volume and everything emulated in floci.
set -euo pipefail
cd "$(dirname "$0")/.."

docker compose down -v
rm -rf .floci .env.aws
echo 'Local data wiped. Run `npm run dev` to start fresh.'
