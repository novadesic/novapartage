#!/usr/bin/env bash
# Fail if ag-grid-enterprise appears in package manifests (forbidden license tier).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PATTERN='ag-grid-enterprise'

matches="$(grep -rE "$PATTERN" \
  --include='package.json' \
  --include='package-lock.json' \
  --include='pnpm-lock.yaml' \
  --include='yarn.lock' \
  frontend auth-service email-service monitoring-service 2>/dev/null || true)"

if [[ -n "$matches" ]]; then
  echo "ERROR: $PATTERN found — Enterprise edition is not allowed:" >&2
  echo "$matches" >&2
  exit 1
fi

echo "OK: no $PATTERN in Node package manifests."
