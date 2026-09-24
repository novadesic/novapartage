#!/bin/bash

# Script de test pour vérifier que les variables du docker-compose.yml sont correctement gérées

echo "Test des variables d'environnement du docker-compose.yml..."
echo ""

# Simuler les variables d'environnement du docker-compose.yml
export DDSSHARE_DOMAIN="test.datadesic.com"
export DDSSHARE_PROTOCOL="https"
export KEYCLOAK_URL="https://test.datadesic.com/auth"
export KEYCLOAK_REALM="ddsshare"
export KEYCLOAK_CLIENT_ID="ddsshare-frontend"
export BACKEND_URL="https://test.datadesic.com/backend"
export BACKEND_API_PATH="/api"
export APP_NAME="DDS Share"
export APP_VERSION="1.0.0"
export PRODUCTION="true"
export FRONTEND_URL="https://test.datadesic.com"

echo "Variables d'environnement simulées:"
echo "  DDSSHARE_DOMAIN=$DDSSHARE_DOMAIN"
echo "  DDSSHARE_PROTOCOL=$DDSSHARE_PROTOCOL"
echo "  KEYCLOAK_URL=$KEYCLOAK_URL"
echo "  KEYCLOAK_REALM=$KEYCLOAK_REALM"
echo "  KEYCLOAK_CLIENT_ID=$KEYCLOAK_CLIENT_ID"
echo "  BACKEND_URL=$BACKEND_URL"
echo "  BACKEND_API_PATH=$BACKEND_API_PATH"
echo "  APP_NAME=$APP_NAME"
echo "  APP_VERSION=$APP_VERSION"
echo "  PRODUCTION=$PRODUCTION"
echo "  FRONTEND_URL=$FRONTEND_URL"

echo ""
echo "Exécution du script replace-env.sh..."

# Créer une copie de test
cp src/assets/env.js src/assets/env.js.test

# Exécuter le script
./scripts/replace-env.sh

echo ""
echo "Vérification des résultats:"

# Vérifier chaque variable
declare -A expected_values=(
    ["KEYCLOAK_URL"]="https://test.datadesic.com/auth"
    ["KEYCLOAK_REALM"]="ddsshare"
    ["KEYCLOAK_CLIENT_ID"]="ddsshare-frontend"
    ["BACKEND_URL"]="https://test.datadesic.com/backend"
    ["BACKEND_API_PATH"]="/api"
    ["APP_NAME"]="DDS Share"
    ["APP_VERSION"]="1.0.0"
    ["PRODUCTION"]="true"
)

all_passed=true

for var in "${!expected_values[@]}"; do
    expected="${expected_values[$var]}"
    actual=$(grep "window.__env.$var" src/assets/env.js | sed "s/.*= '\([^']*\)'.*/\1/")
    
    if [ "$actual" = "$expected" ]; then
        echo "✅ $var = $actual"
    else
        echo "❌ $var = $actual (attendu: $expected)"
        all_passed=false
    fi
done

# Restaurer le fichier original
mv src/assets/env.js.test src/assets/env.js

echo ""
if [ "$all_passed" = true ]; then
    echo "🎉 Tous les tests sont passés! Le système gère correctement toutes les variables du docker-compose.yml."
else
    echo "❌ Certains tests ont échoué. Vérifiez la configuration."
fi 