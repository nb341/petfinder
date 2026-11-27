#!/usr/bin/env bash
# Starts Postgres and floci, waits until they're healthy, and creates the local AWS resources.
set -euo pipefail
cd "$(dirname "$0")/../../.."

[ -f .env ] || { cp .env.example .env; echo 'Created .env from .env.example'; }

docker compose -f infrastructure/local/docker-compose.yml up -d --build --wait postgres floci
infrastructure/local/scripts/setup-aws.sh
