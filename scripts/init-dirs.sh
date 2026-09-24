#!/usr/bin/env bash
#
# Crée les répertoires de stockage fichiers requis avant docker compose.
# À lancer une fois après le clone (idempotent).
#
# Usage :
#   ./scripts/init-dirs.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STORAGE_DIR="${ROOT_DIR}/user_files"

mkdir -p "${STORAGE_DIR}/temp" "${STORAGE_DIR}/users"
echo "Répertoires prêts: ${STORAGE_DIR}/temp , ${STORAGE_DIR}/users"
