#!/usr/bin/env bash
#
# Génère les secrets pour NovaPartage (self-host ou dev).
#
# IMPORTANT : JWT_SECRET et APP_AUTH_JWT_SECRET doivent être IDENTIQUES
# (auth-service émet les JWT, backend Quarkus les valide).
#
# Usage :
#   ./scripts/generate-secrets.sh           # affiche les lignes à copier
#   ./scripts/generate-secrets.sh --write   # crée/met à jour .env sans écraser les secrets existants
#   ./scripts/generate-secrets.sh --force   # régénère tous les secrets (écrase les valeurs existantes)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
ENV_EXAMPLE="${ROOT_DIR}/env.example"

WRITE=false
FORCE=false

for arg in "$@"; do
  case "$arg" in
    --write) WRITE=true ;;
    --force) FORCE=true; WRITE=true ;;
    -h|--help)
      sed -n '1,12p' "$0"
      exit 0
      ;;
    *)
      echo "Option inconnue: $arg (utilisez --write, --force ou --help)" >&2
      exit 1
      ;;
  esac
done

if ! command -v openssl >/dev/null 2>&1; then
  echo "Erreur: openssl est requis." >&2
  exit 1
fi

rand_b64() {
  openssl rand -base64 32
}

rand_hex() {
  openssl rand -hex 24
}

JWT_SECRET_VAL="$(rand_b64)"
APP_AUTH_JWT_SECRET_VAL="$JWT_SECRET_VAL"
APP_ENCRYPTION_MASTER_KEY_VAL="$(rand_b64)"
CSRF_SECRET_VAL="$(rand_b64)"
POSTGRES_PASSWORD_VAL="$(rand_hex)"

declare -A SECRETS=(
  [JWT_SECRET]="$JWT_SECRET_VAL"
  [APP_AUTH_JWT_SECRET]="$APP_AUTH_JWT_SECRET_VAL"
  [APP_ENCRYPTION_MASTER_KEY]="$APP_ENCRYPTION_MASTER_KEY_VAL"
  [CSRF_SECRET]="$CSRF_SECRET_VAL"
  [POSTGRES_PASSWORD]="$POSTGRES_PASSWORD_VAL"
  [DB_PASSWORD]="$POSTGRES_PASSWORD_VAL"
)

print_secrets() {
  echo "# Secrets générés — $(date -Iseconds)"
  echo "# JWT_SECRET et APP_AUTH_JWT_SECRET doivent rester identiques."
  echo "JWT_SECRET=${SECRETS[JWT_SECRET]}"
  echo "APP_AUTH_JWT_SECRET=${SECRETS[APP_AUTH_JWT_SECRET]}"
  echo "APP_ENCRYPTION_MASTER_KEY=${SECRETS[APP_ENCRYPTION_MASTER_KEY]}"
  echo "CSRF_SECRET=${SECRETS[CSRF_SECRET]}"
  echo "POSTGRES_PASSWORD=${SECRETS[POSTGRES_PASSWORD]}"
  echo "DB_PASSWORD=${SECRETS[DB_PASSWORD]}"
}

get_env_value() {
  local key="$1"
  local file="$2"
  if [[ -f "$file" ]]; then
    grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- || true
  fi
}

is_placeholder() {
  local val="$1"
  [[ -z "$val" ]] && return 0
  [[ "$val" == "change-me-generate-with-openssl-rand-base64-32" ]] && return 0
  [[ "$val" == "your-super-secret-jwt-key-change-in-production" ]] && return 0
  [[ "$val" == "your-csrf-secret-key" ]] && return 0
  [[ "$val" == "novapartage_password" ]] && return 0
  return 1
}

write_env() {
  if [[ ! -f "$ENV_EXAMPLE" ]]; then
    echo "Erreur: env.example introuvable dans $ROOT_DIR" >&2
    exit 1
  fi

  if [[ -f "$ENV_FILE" && "$FORCE" != true ]]; then
    # Conserver les secrets déjà définis (hors placeholders)
    for key in "${!SECRETS[@]}"; do
      existing="$(get_env_value "$key" "$ENV_FILE")"
      if ! is_placeholder "$existing"; then
        SECRETS[$key]="$existing"
      fi
    done
    # Garder JWT et APP_AUTH_JWT_SECRET alignés si l'un existe déjà
    jwt_existing="$(get_env_value JWT_SECRET "$ENV_FILE")"
    app_jwt_existing="$(get_env_value APP_AUTH_JWT_SECRET "$ENV_FILE")"
    if ! is_placeholder "$jwt_existing"; then
      SECRETS[JWT_SECRET]="$jwt_existing"
      SECRETS[APP_AUTH_JWT_SECRET]="$jwt_existing"
    elif ! is_placeholder "$app_jwt_existing"; then
      SECRETS[JWT_SECRET]="$app_jwt_existing"
      SECRETS[APP_AUTH_JWT_SECRET]="$app_jwt_existing"
    fi
    db_existing="$(get_env_value DB_PASSWORD "$ENV_FILE")"
    pg_existing="$(get_env_value POSTGRES_PASSWORD "$ENV_FILE")"
    if ! is_placeholder "$db_existing"; then
      SECRETS[DB_PASSWORD]="$db_existing"
      SECRETS[POSTGRES_PASSWORD]="$db_existing"
    elif ! is_placeholder "$pg_existing"; then
      SECRETS[DB_PASSWORD]="$pg_existing"
      SECRETS[POSTGRES_PASSWORD]="$pg_existing"
    else
      echo "Nouveau mot de passe PostgreSQL généré." >&2
      echo "Si Postgres tourne déjà avec l'ancien mot de passe, arrêtez les conteneurs et supprimez les volumes du projet avant de relancer :" >&2
      echo "  cd $ROOT_DIR && docker compose down -v" >&2
    fi
  elif [[ "$FORCE" == true ]]; then
    echo "Attention: régénération forcée de tous les secrets." >&2
    echo "Si Postgres tourne déjà, arrêtez les conteneurs et supprimez les volumes du projet avant de relancer :" >&2
    echo "  cd $ROOT_DIR && docker compose down -v" >&2
  fi

  if [[ ! -f "$ENV_FILE" ]]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    echo "Créé $ENV_FILE depuis env.example"
  fi

  for key in "${!SECRETS[@]}"; do
    val="${SECRETS[$key]}"
    if grep -qE "^${key}=" "$ENV_FILE"; then
      sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
    else
      echo "${key}=${val}" >> "$ENV_FILE"
    fi
  done

  echo "Secrets écrits dans $ENV_FILE"
}

if [[ "$WRITE" == true ]]; then
  write_env
else
  print_secrets
  echo ""
  echo "Pour écrire dans .env : ./scripts/generate-secrets.sh --write"
fi
