#!/usr/bin/env bash
#
# Scan the repository for secrets with gitleaks.
#
# Usage:
#   ./scripts/run-gitleaks.sh
#
# Requires gitleaks CLI (https://github.com/gitleaks/gitleaks/releases)
# or Docker (fallback).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="${ROOT_DIR}/.gitleaks.toml"

run_gitleaks() {
  gitleaks detect \
    --source "$ROOT_DIR" \
    --config "$CONFIG" \
    --verbose \
    --no-banner \
    "$@"
}

if command -v gitleaks >/dev/null 2>&1; then
  echo "Using gitleaks: $(gitleaks version 2>/dev/null || gitleaks --version 2>/dev/null || echo local)"
  run_gitleaks
  echo "OK: gitleaks scan passed (0 leaks)."
  exit 0
fi

if command -v docker >/dev/null 2>&1; then
  echo "gitleaks CLI not found — using Docker image ghcr.io/gitleaks/gitleaks:latest"
  docker run --rm \
    -v "${ROOT_DIR}:/repo:ro" \
    -w /repo \
    ghcr.io/gitleaks/gitleaks:latest \
    detect \
    --source /repo \
    --config /repo/.gitleaks.toml \
    --verbose \
    --no-banner
  echo "OK: gitleaks scan passed (0 leaks)."
  exit 0
fi

echo "ERROR: install gitleaks or Docker to run secret scanning." >&2
echo "  https://github.com/gitleaks/gitleaks#installing" >&2
exit 1
