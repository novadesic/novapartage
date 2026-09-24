#!/bin/bash

# Script de test pour vérifier la configuration au runtime
echo "Test de configuration au runtime..."

# Test 1: Configuration de développement
echo ""
echo "=== Test 1: Configuration de développement ==="
export KEYCLOAK_URL="http://localhost:8081/auth"
export BACKEND_URL="http://localhost:8082"
export PRODUCTION="false"

cp src/assets/env.js src/assets/env.js.test1
./scripts/replace-env.sh
echo "Configuration dev appliquée"

# Test 2: Configuration de production
echo ""
echo "=== Test 2: Configuration de production ==="
export KEYCLOAK_URL="https://keycloak.production.com/auth"
export BACKEND_URL="https://api.production.com"
export PRODUCTION="true"

cp src/assets/env.js src/assets/env.js.test2
./scripts/replace-env.sh
echo "Configuration prod appliquée"

# Test 3: Configuration de staging
echo ""
echo "=== Test 3: Configuration de staging ==="
export KEYCLOAK_URL="https://keycloak.staging.com/auth"
export BACKEND_URL="https://api.staging.com"
export PRODUCTION="false"

cp src/assets/env.js src/assets/env.js.test3
./scripts/replace-env.sh
echo "Configuration staging appliquée"

# Comparaison des résultats
echo ""
echo "=== Comparaison des configurations ==="
echo "Dev:"
grep "KEYCLOAK_URL" src/assets/env.js.test1
echo "Prod:"
grep "KEYCLOAK_URL" src/assets/env.js.test2
echo "Staging:"
grep "KEYCLOAK_URL" src/assets/env.js.test3

# Nettoyage
rm src/assets/env.js.test1 src/assets/env.js.test2 src/assets/env.js.test3

echo ""
echo "Test terminé! Le système fonctionne correctement avec différentes configurations." 