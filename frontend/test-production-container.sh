#!/bin/bash

# Script pour tester le conteneur de production localement
echo "=== Test du conteneur de production DDSShare ==="

# Configuration des variables d'environnement de production
export KEYCLOAK_URL="https://share.datadesic.com/auth"
export KEYCLOAK_REALM="ddsshare"
export KEYCLOAK_CLIENT_ID="ddsshare-frontend"
export BACKEND_URL="https://share.datadesic.com/backend"
export BACKEND_API_PATH="/api"
export APP_NAME="DDS Share"
export APP_VERSION="1.0.0"
export PRODUCTION="true"

echo "🔧 Configuration de production :"
echo "   KEYCLOAK_URL: $KEYCLOAK_URL"
echo "   BACKEND_URL: $BACKEND_URL"
echo "   PRODUCTION: $PRODUCTION"

echo ""
echo "🐳 Test du conteneur Docker..."

# Arrêter le conteneur s'il existe déjà
docker stop ddsshare-frontend-test 2>/dev/null || true
docker rm ddsshare-frontend-test 2>/dev/null || true

# Démarrer le conteneur avec les variables d'environnement
docker run -d \
  --name ddsshare-frontend-test \
  -p 8082:80 \
  -e KEYCLOAK_URL="$KEYCLOAK_URL" \
  -e KEYCLOAK_REALM="$KEYCLOAK_REALM" \
  -e KEYCLOAK_CLIENT_ID="$KEYCLOAK_CLIENT_ID" \
  -e BACKEND_URL="$BACKEND_URL" \
  -e BACKEND_API_PATH="$BACKEND_API_PATH" \
  -e APP_NAME="$APP_NAME" \
  -e APP_VERSION="$APP_VERSION" \
  -e PRODUCTION="$PRODUCTION" \
  ghcr.io/novadesic/novapartage-frontend:latest

echo "⏳ Attente du démarrage du conteneur..."
sleep 5

# Vérifier les logs du conteneur
echo ""
echo "📋 Logs du conteneur :"
docker logs ddsshare-frontend-test

# Vérifier que le conteneur fonctionne
echo ""
echo "🔍 Vérification du conteneur :"
if docker ps | grep -q ddsshare-frontend-test; then
    echo "✅ Conteneur en cours d'exécution"
    
    # Tester l'accès HTTP
    echo "🌐 Test d'accès HTTP..."
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8082 | grep -q "200"; then
        echo "✅ Serveur HTTP accessible"
        
        # Vérifier le contenu du fichier env.js
        echo "📄 Contenu du fichier env.js dans le conteneur :"
        docker exec ddsshare-frontend-test cat /usr/share/nginx/html/assets/env.js
    else
        echo "❌ Serveur HTTP non accessible"
    fi
else
    echo "❌ Conteneur non démarré"
fi

echo ""
echo "🧹 Nettoyage..."
docker stop ddsshare-frontend-test
docker rm ddsshare-frontend-test

echo "✅ Test terminé" 