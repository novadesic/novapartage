#!/usr/bin/env bash
#
# Ajoute un superadmin dans ddsshare_superadmins (connexion par magic link).
#
# Usage :
#   ./scripts/init-superadmin.sh admin@example.com
#   ./scripts/init-superadmin.sh --dry-run admin@example.com

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.selfhost.yml"
DRY_RUN=false
EMAIL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --compose-file)
      COMPOSE_FILE="$2"
      shift 2
      ;;
    --help|-h)
      sed -n '1,8p' "$0"
      exit 0
      ;;
    -*)
      echo "Option inconnue: $1" >&2
      exit 1
      ;;
    *)
      EMAIL="$1"
      shift
      ;;
  esac
done

if [[ -z "$EMAIL" ]]; then
  echo "Usage: $0 [--dry-run] [--compose-file PATH] email@example.com" >&2
  exit 1
fi

read_env() {
  if [[ -f "$ENV_FILE" ]]; then
    grep -E "^${1}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | sed 's/^"//;s/"$//' || true
  fi
}

POSTGRES_USER="$(read_env POSTGRES_USER)"
POSTGRES_DB="$(read_env POSTGRES_DB)"
POSTGRES_USER="${POSTGRES_USER:-novapartage}"
POSTGRES_DB="${POSTGRES_DB:-novapartage}"

NORMALIZED_EMAIL="$(echo "$EMAIL" | tr '[:upper:]' '[:lower:]' | xargs)"

if [[ ! "$NORMALIZED_EMAIL" =~ ^[^@]+@[^@]+\.[^@]+$ ]]; then
  echo "Erreur: email invalide: $EMAIL" >&2
  exit 1
fi

SQL="INSERT INTO ddsshare_superadmins (email) VALUES ('${NORMALIZED_EMAIL}') ON CONFLICT (email) DO NOTHING;"

echo "Superadmin: $NORMALIZED_EMAIL"
echo "Compose: $COMPOSE_FILE"
echo "SQL: $SQL"

if [[ "$DRY_RUN" == true ]]; then
  echo "(dry-run — aucune modification)"
  exit 0
fi

if ! docker compose -f "$COMPOSE_FILE" ps postgres 2>/dev/null | grep -qiE 'up|running'; then
  echo "Erreur: le conteneur postgres n'est pas démarré." >&2
  echo "Lancez: docker compose -f docker-compose.selfhost.yml up -d" >&2
  exit 1
fi

TABLE_EXISTS="$(docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
  "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ddsshare_superadmins');" \
  2>/dev/null || echo "f")"

if [[ "$TABLE_EXISTS" != "t" ]]; then
  echo "Erreur: table ddsshare_superadmins absente. Démarrez le backend pour exécuter Flyway." >&2
  echo "  docker compose -f docker-compose.selfhost.yml up -d backend" >&2
  exit 1
fi

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "$SQL"

echo "OK — connectez-vous via magic link (Mailpit: http://localhost:8025)"
