#!/bin/bash

# Script pour vérifier la correspondance entre les variables du docker-compose.yml
# et celles gérées par notre système

echo "Vérification de la correspondance des variables d'environnement..."
echo ""

# Variables définies dans le docker-compose.yml (service frontend)
DOCKER_COMPOSE_VARS=(
    "KEYCLOAK_URL"
    "KEYCLOAK_REALM" 
    "KEYCLOAK_CLIENT_ID"
    "BACKEND_URL"
    "BACKEND_API_PATH"
    "APP_NAME"
    "APP_VERSION"
    "PRODUCTION"
)

# Variables gérées par le script replace-env.sh
SCRIPT_VARS=(
    "KEYCLOAK_URL"
    "KEYCLOAK_REALM"
    "KEYCLOAK_CLIENT_ID"
    "BACKEND_URL"
    "BACKEND_API_PATH"
    "APP_NAME"
    "APP_VERSION"
    "PRODUCTION"
)

# Variables utilisées dans l'application Angular
APP_VARS=(
    "KEYCLOAK_URL"
    "KEYCLOAK_REALM"
    "KEYCLOAK_CLIENT_ID"
    "BACKEND_URL"
    "BACKEND_API_PATH"
    "APP_NAME"
    "APP_VERSION"
    "PRODUCTION"
)

echo "=== Variables dans docker-compose.yml ==="
for var in "${DOCKER_COMPOSE_VARS[@]}"; do
    echo "✅ $var"
done

echo ""
echo "=== Variables gérées par replace-env.sh ==="
for var in "${SCRIPT_VARS[@]}"; do
    echo "✅ $var"
done

echo ""
echo "=== Variables utilisées dans l'application ==="
for var in "${APP_VARS[@]}"; do
    echo "✅ $var"
done

echo ""
echo "=== Vérification de correspondance ==="

# Vérifier que toutes les variables du docker-compose sont gérées par le script
missing_in_script=()
for var in "${DOCKER_COMPOSE_VARS[@]}"; do
    found=false
    for script_var in "${SCRIPT_VARS[@]}"; do
        if [ "$var" = "$script_var" ]; then
            found=true
            break
        fi
    done
    if [ "$found" = false ]; then
        missing_in_script+=("$var")
    fi
done

if [ ${#missing_in_script[@]} -eq 0 ]; then
    echo "✅ Toutes les variables du docker-compose.yml sont gérées par le script"
else
    echo "❌ Variables manquantes dans le script:"
    for var in "${missing_in_script[@]}"; do
        echo "   - $var"
    done
fi

# Vérifier que toutes les variables utilisées dans l'app sont gérées
missing_in_app=()
for var in "${SCRIPT_VARS[@]}"; do
    found=false
    for app_var in "${APP_VARS[@]}"; do
        if [ "$var" = "$app_var" ]; then
            found=true
            break
        fi
    done
    if [ "$found" = false ]; then
        missing_in_app+=("$var")
    fi
done

if [ ${#missing_in_app[@]} -eq 0 ]; then
    echo "✅ Toutes les variables du script sont utilisées dans l'application"
else
    echo "⚠️  Variables du script non utilisées dans l'application:"
    for var in "${missing_in_app[@]}"; do
        echo "   - $var"
    done
fi

echo ""
echo "=== Variables spéciales ==="
echo "ℹ️  DDSSHARE_DOMAIN et DDSSHARE_PROTOCOL: Utilisées pour construire les URLs"
echo "ℹ️  FRONTEND_URL: Définie dans docker-compose mais non utilisée dans l'app (optionnel)"

echo ""
echo "Vérification terminée!" 