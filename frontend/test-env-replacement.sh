#!/bin/bash

# Script de test pour vérifier le remplacement des variables d'environnement
echo "Test du remplacement des variables d'environnement..."

# Définir des variables d'environnement de test
export KEYCLOAK_URL="https://test-keycloak.datadesic.com/auth"
export KEYCLOAK_REALM="test-realm"
export KEYCLOAK_CLIENT_ID="test-client"
export BACKEND_URL="https://test-api.datadesic.com"
export BACKEND_API_PATH="/api/v1"
export APP_NAME="Test DDS Share"
export APP_VERSION="2.0.0"
export PRODUCTION="false"

# Créer une copie de test du fichier env.js
cp src/assets/env.js src/assets/env.js.test

# Exécuter le script de remplacement
echo "Exécution du script replace-env.sh..."
./scripts/replace-env.sh

# Vérifier le résultat
echo ""
echo "Vérification du résultat:"
if grep -q "test-keycloak.datadesic.com" src/assets/env.js; then
    echo "✅ KEYCLOAK_URL remplacé correctement"
else
    echo "❌ KEYCLOAK_URL non remplacé"
fi

if grep -q "test-realm" src/assets/env.js; then
    echo "✅ KEYCLOAK_REALM remplacé correctement"
else
    echo "❌ KEYCLOAK_REALM non remplacé"
fi

if grep -q "test-client" src/assets/env.js; then
    echo "✅ KEYCLOAK_CLIENT_ID remplacé correctement"
else
    echo "❌ KEYCLOAK_CLIENT_ID non remplacé"
fi

if grep -q "test-api.datadesic.com" src/assets/env.js; then
    echo "✅ BACKEND_URL remplacé correctement"
else
    echo "❌ BACKEND_URL non remplacé"
fi

if grep -q "/api/v1" src/assets/env.js; then
    echo "✅ BACKEND_API_PATH remplacé correctement"
else
    echo "❌ BACKEND_API_PATH non remplacé"
fi

if grep -q "Test DDS Share" src/assets/env.js; then
    echo "✅ APP_NAME remplacé correctement"
else
    echo "❌ APP_NAME non remplacé"
fi

if grep -q "2.0.0" src/assets/env.js; then
    echo "✅ APP_VERSION remplacé correctement"
else
    echo "❌ APP_VERSION non remplacé"
fi

if grep -q "false" src/assets/env.js; then
    echo "✅ PRODUCTION remplacé correctement"
else
    echo "❌ PRODUCTION non remplacé"
fi

# Restaurer le fichier original
mv src/assets/env.js.test src/assets/env.js

echo ""
echo "Test terminé!" 