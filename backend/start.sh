#!/bin/bash

set -euo pipefail

echo "Démarrage du backend Quarkus..."
echo "Port: 8083"
echo "Répertoire: $(pwd)"

# Charger les variables essentielles depuis .env (sans source — valeurs avec espaces)
load_env_var() {
  local key="$1"
  local file="$2"
  if [[ -f "$file" ]]; then
    grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- | sed 's/^"//;s/"$//'
  fi
}

ENV_ROOT="../.env"
ENV_LOCAL=".env"
for key in APP_AUTH_JWT_SECRET APP_ENCRYPTION_MASTER_KEY DB_HOST DB_NAME DB_USERNAME DB_PASSWORD; do
  val="$(load_env_var "$key" "$ENV_LOCAL")"
  [[ -z "$val" ]] && val="$(load_env_var "$key" "$ENV_ROOT")"
  [[ -n "$val" ]] && export "$key=$val"
done

if [[ -f .env ]]; then
  echo "Variables chargées depuis backend/.env"
elif [[ -f ../.env ]]; then
  echo "Variables chargées depuis ../.env"
fi

# Dev local : stockage relatif (le .env racine utilise /app/files pour Docker)
STORAGE_DIR="$(pwd)/user_files"
export APP_FILE_STORAGE_BASE_PATH="$STORAGE_DIR"
mkdir -p "$STORAGE_DIR/temp" "$STORAGE_DIR/users"
echo "Stockage fichiers: $STORAGE_DIR"

# Nettoyer et compiler
echo "Compilation..."
./mvnw clean compile -q

# Démarrer en mode dev
echo "Démarrage en mode dev..."
./mvnw quarkus:dev 