#!/bin/bash

# Script pour tester la configuration du frontend
echo "=== Test de configuration du frontend NovaPartage ==="
echo

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
    echo "❌ Erreur: Ce script doit être exécuté depuis le répertoire frontend/"
    exit 1
fi

# Configuration des variables d'environnement pour le test
export KEYCLOAK_URL="http://localhost/auth"
export KEYCLOAK_REALM="ddsshare"
export KEYCLOAK_CLIENT_ID="ddsshare-frontend"
export BACKEND_URL="http://localhost/backend"
export BACKEND_API_PATH="/api"
export APP_NAME="DDS Share (Test)"
export APP_VERSION="1.0.0"
export PRODUCTION="false"

echo "🔧 Configuration de test :"
echo "   KEYCLOAK_URL: $KEYCLOAK_URL"
echo "   BACKEND_URL: $BACKEND_URL"
echo "   PRODUCTION: $PRODUCTION"
echo

# Tester le script de remplacement
echo "🧪 Test du script de remplacement des placeholders..."
if [ -f "scripts/replace-env.sh" ]; then
    ./scripts/replace-env.sh
    echo "✅ Script de remplacement fonctionne"
else
    echo "❌ Script replace-env.sh non trouvé"
    exit 1
fi

echo
echo "📄 Contenu final du fichier env.js :"
cat src/assets/env.js

echo
echo "✅ Test de configuration terminé"
echo "   Pour démarrer le serveur, utilisez: ./start.sh" 