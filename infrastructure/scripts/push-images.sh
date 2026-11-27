#!/usr/bin/env bash
# Builds the api and ui images from the root Dockerfile and pushes them to the shared ECR registry.
# Usage: scripts/push-images.sh [tag]   (default tag: the current commit's short SHA)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Commit or stash your changes first: an image tag must match a commit." >&2
  exit 1
fi

TAG="${1:-$(git rev-parse --short=12 HEAD)}"
if [[ "$TAG" == "latest" ]]; then
  echo "Refusing tag \"latest\": tags are immutable, so use a commit SHA or version." >&2
  exit 1
fi

if ! command -v aws >/dev/null; then
  echo "The AWS CLI is required: brew install awscli" >&2
  exit 1
fi

ACCOUNT_ID="${INFRA_AWS_ACCOUNT_ID:-$(grep -E '^INFRA_AWS_ACCOUNT_ID=' .env 2>/dev/null | cut -d= -f2- || true)}"
if [[ ! "$ACCOUNT_ID" =~ ^[0-9]{12}$ ]]; then
  echo "Set INFRA_AWS_ACCOUNT_ID in the root .env." >&2
  exit 1
fi

REGION="${AWS_REGION:-us-east-1}"
PROFILE="${AWS_PROFILE:-petfinder-dev}"
# Fargate tasks run on ARM64 (Graviton): cheaper than x86, and native on Apple silicon.
PLATFORM="${IMAGE_PLATFORM:-linux/arm64}"
REGISTRY="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

aws ecr get-login-password --region "$REGION" --profile "$PROFILE" | docker login --username AWS --password-stdin "$REGISTRY"

for app in api ui; do
  image="$REGISTRY/petfinder/$app:$TAG"
  docker build --platform "$PLATFORM" --target "$app" -t "$image" .
  docker push "$image"
done

echo "Pushed petfinder/api:$TAG and petfinder/ui:$TAG to $REGISTRY"
