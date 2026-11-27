#!/bin/sh
if ! command -v tofu >/dev/null 2>&1; then
  echo "OpenTofu is required but 'tofu' was not found on PATH. Install it with: brew install opentofu" >&2
  exit 1
fi
