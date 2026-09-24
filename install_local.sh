#!/usr/bin/env bash
#
# Script d'installation locale — redirige vers la stack self-host.
# L'ancienne procédure Keycloak/MongoDB a été retirée.
#

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "=============================================="
echo " NovaPartage — installation locale"
echo "=============================================="
echo ""
echo "Ce script lance la stack self-host Docker."
echo "Documentation complète : docs/INSTALL.md"
echo ""

if [[ ! -f .env ]]; then
  echo "Création de .env depuis env.example..."
  cp env.example .env
  ./scripts/generate-secrets.sh --write
else
  echo "Fichier .env existant — conservé."
  echo "Pour regénérer les secrets : ./scripts/generate-secrets.sh --force"
fi

echo ""
echo "Démarrage : docker compose -f docker-compose.selfhost.yml up --build -d"
docker compose -f docker-compose.selfhost.yml up --build -d

echo ""
echo "Ensuite :"
echo "  ./scripts/init-superadmin.sh admin@example.com"
echo "  Ouvrir http://localhost et http://localhost:8025 (Mailpit)"
echo ""
echo "Voir docs/INSTALL.md pour le développement hot-reload."
