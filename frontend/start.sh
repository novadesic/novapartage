#!/bin/bash

set -euo pipefail

echo "Démarrage du frontend Angular (dev)..."
echo "Port: 4200"
echo "Répertoire: $(pwd)"

if [[ ! -f package.json ]]; then
  echo "Erreur: exécuter ce script depuis le répertoire frontend/"
  exit 1
fi

# Charger les variables frontend depuis .env (sans source — valeurs avec espaces)
load_env_var() {
  local key="$1"
  local file="$2"
  if [[ -f "$file" ]]; then
    grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- | sed 's/^"//;s/"$//'
  fi
}

ENV_ROOT="../.env"
ENV_LOCAL=".env"
for key in CUSTOM_AUTH_ENDPOINT BACKEND_URL BACKEND_API_PATH APP_NAME APP_VERSION PRODUCTION MAX_RECIPIENTS_PER_SHARE MAX_FILE_SIZE MAX_SELECTED_COLUMNS; do
  val="$(load_env_var "$key" "$ENV_LOCAL")"
  [[ -z "$val" ]] && val="$(load_env_var "$key" "$ENV_ROOT")"
  [[ -n "$val" ]] && export "$key=$val"
done

# Valeurs par défaut : ng serve + proxy.conf.json (accès direct http://localhost:4200)
export CUSTOM_AUTH_ENDPOINT="${CUSTOM_AUTH_ENDPOINT:-http://localhost:4200/auth}"
export BACKEND_URL="${BACKEND_URL:-http://localhost:4200/backend}"
export BACKEND_API_PATH="${BACKEND_API_PATH:-/api}"
export APP_NAME="${APP_NAME:-NovaPartage}"
export APP_VERSION="${APP_VERSION:-1.0.0}"
export PRODUCTION="${PRODUCTION:-false}"
export MAX_RECIPIENTS_PER_SHARE="${MAX_RECIPIENTS_PER_SHARE:-50}"
export MAX_FILE_SIZE="${MAX_FILE_SIZE:-50MB}"
export MAX_SELECTED_COLUMNS="${MAX_SELECTED_COLUMNS:-20}"

echo "Configuration runtime (env.js) :"
echo "  CUSTOM_AUTH_ENDPOINT: $CUSTOM_AUTH_ENDPOINT"
echo "  BACKEND_URL: $BACKEND_URL"
echo "  PRODUCTION: $PRODUCTION"
echo ""
echo "Accès : http://localhost:4200 (proxy /backend → :8083, /auth → :3001)"
echo "Via nginx : http://localhost — définir CUSTOM_AUTH_ENDPOINT=http://localhost/auth dans .env"
echo ""

if [[ -f scripts/replace-env.sh ]]; then
  echo "Génération de src/assets/env.js..."
  ./scripts/replace-env.sh
else
  echo "Attention: scripts/replace-env.sh introuvable"
  exit 1
fi

echo ""
echo "Démarrage ng serve..."
exec npm start
