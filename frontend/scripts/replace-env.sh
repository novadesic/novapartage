#!/bin/bash

# Script pour remplacer les variables d'environnement dans env.js au runtime
echo "🚀 Démarrage du script de remplacement des variables d'environnement..."
echo "🔍 Contexte d'exécution :"
echo "   PWD: $(pwd)"
echo "   USER: $(whoami)"
echo "   ENV: $ENV"

# Déterminer le chemin du fichier selon le contexte (build ou conteneur)
if [ -f "src/assets/env.js" ]; then
    ENV_FILE="src/assets/env.js"
elif [ -f "/usr/share/nginx/html/assets/env.js" ]; then
    ENV_FILE="/usr/share/nginx/html/assets/env.js"
else
    echo "❌ Erreur: Fichier env.js non trouvé"
    echo "Recherche dans les dossiers suivants :"
    find /usr/share/nginx/html -name "env.js" 2>/dev/null || echo "Aucun fichier env.js trouvé"
    exit 1
fi

echo "📄 Fichier env.js trouvé : $ENV_FILE"

echo "📄 Contenu initial du fichier $ENV_FILE :"
cat "$ENV_FILE"

# Vérification que les variables d'environnement sont définies
if [ -z "$CUSTOM_AUTH_ENDPOINT" ]; then
    echo "❌ Erreur: CUSTOM_AUTH_ENDPOINT n'est pas défini"
    exit 1
fi

if [ -z "$BACKEND_URL" ]; then
    echo "❌ Erreur: BACKEND_URL n'est pas définie"
    exit 1
fi

# Valeurs par défaut uniquement pour les variables optionnelles
BACKEND_API_PATH=${BACKEND_API_PATH:-"/api"}
APP_NAME=${APP_NAME:-"DDS Share"}
APP_VERSION=${APP_VERSION:-"1.0.0"}
PRODUCTION=${PRODUCTION:-"true"}
MAX_RECIPIENTS_PER_SHARE=${MAX_RECIPIENTS_PER_SHARE:-"5"}
MAX_FILE_SIZE=${MAX_FILE_SIZE:-"50MB"}
MAX_SELECTED_COLUMNS=${MAX_SELECTED_COLUMNS:-"20"}

echo "📝 Variables d'environnement :"
echo "   CUSTOM_AUTH_ENDPOINT: $CUSTOM_AUTH_ENDPOINT"
echo "   BACKEND_URL: $BACKEND_URL"
echo "   BACKEND_API_PATH: $BACKEND_API_PATH"
echo "   APP_NAME: $APP_NAME"
echo "   APP_VERSION: $APP_VERSION"
echo "   PRODUCTION: $PRODUCTION"
echo "   MAX_RECIPIENTS_PER_SHARE: $MAX_RECIPIENTS_PER_SHARE"
echo "   MAX_FILE_SIZE: $MAX_FILE_SIZE"
echo "   MAX_SELECTED_COLUMNS: $MAX_SELECTED_COLUMNS"

echo ""
echo "🔧 Remplacement des placeholders..."

# Remplacer les placeholders dans le fichier env.js
sed -i "s|%%CUSTOM_AUTH_ENDPOINT%%|$CUSTOM_AUTH_ENDPOINT|g" "$ENV_FILE"
sed -i "s|%%BACKEND_URL%%|$BACKEND_URL|g" "$ENV_FILE"
sed -i "s|%%BACKEND_API_PATH%%|$BACKEND_API_PATH|g" "$ENV_FILE"
sed -i "s|%%APP_NAME%%|$APP_NAME|g" "$ENV_FILE"
sed -i "s|%%APP_VERSION%%|$APP_VERSION|g" "$ENV_FILE"
sed -i "s|%%PRODUCTION%%|$PRODUCTION|g" "$ENV_FILE"
sed -i "s|%%MAX_RECIPIENTS_PER_SHARE%%|$MAX_RECIPIENTS_PER_SHARE|g" "$ENV_FILE"
sed -i "s|%%MAX_FILE_SIZE%%|$MAX_FILE_SIZE|g" "$ENV_FILE"
sed -i "s|%%MAX_SELECTED_COLUMNS%%|$MAX_SELECTED_COLUMNS|g" "$ENV_FILE"

# Si aucun placeholder n'a été remplacé (fichier sans %%...%%), réécrire env.js avec les valeurs courantes
if ! grep -q '%%' "$ENV_FILE"; then
  echo "ℹ️  Aucun placeholder détecté, écriture d'un env.js calculé au runtime"
  cat > "$ENV_FILE" <<EOT
(function(window) {
  window.__env = window.__env || {};
  window.__env.CUSTOM_AUTH_ENDPOINT = '${CUSTOM_AUTH_ENDPOINT}';
  window.__env.BACKEND_URL = '${BACKEND_URL}';
  window.__env.BACKEND_API_PATH = '${BACKEND_API_PATH}';
  window.__env.APP_NAME = '${APP_NAME}';
  window.__env.APP_VERSION = '${APP_VERSION}';
  window.__env.PRODUCTION = ${PRODUCTION};
  window.__env.MAX_RECIPIENTS_PER_SHARE = ${MAX_RECIPIENTS_PER_SHARE};
  window.__env.MAX_FILE_SIZE = '${MAX_FILE_SIZE}';
  window.__env.MAX_SELECTED_COLUMNS = ${MAX_SELECTED_COLUMNS};
})(this);
EOT
fi

echo "✅ Remplacement terminé"
echo ""
echo "📄 Contenu final du fichier $ENV_FILE :"
cat "$ENV_FILE" 