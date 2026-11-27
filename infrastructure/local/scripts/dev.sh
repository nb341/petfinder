#!/usr/bin/env bash
# One command for local development: services up, AWS resources created, migrations run, apps served.
set -euo pipefail
cd "$(dirname "$0")/../../.."

infrastructure/local/scripts/local-up.sh
npx nx run api:migration-run --output-style=stream

# Export the floci resource ids so the apps' config (process.env) can read them.
set -a
. infrastructure/local/.env.aws
set +a
exec npx nx run-many -t serve --parallel=5
