#!/bin/bash

echo "🔍 Diagnostic du problème d'authentification 403"
echo "=============================================="

# Vérifier que le backend compile
echo "📦 Compilation du backend..."
./mvnw clean compile
if [ $? -eq 0 ]; then
    echo "✅ Compilation réussie"
else
    echo "❌ Erreur de compilation"
    exit 1
fi

echo ""
echo "🔍 Analyse du problème..."
echo ""

# Vérifier la configuration OIDC
echo "📋 Configuration OIDC actuelle :"
echo "   - auth-server-url: http://localhost/auth/realms/ddsshare"
echo "   - client-id: ddshare-backend"
echo "   - force-redirect: false (dev)"
echo "   - user-info-required: false (dev)"
echo ""

# Vérifier les endpoints de sécurité
echo "🔐 Endpoints de sécurité à vérifier :"
echo "   1. /q/health - Santé de l'application"
echo "   2. /openapi - Documentation OpenAPI"
echo "   3. /api/shares/{id}/file-with-validated-data - Fichier avec données validées"
echo ""

# Démarrer le backend en mode test
echo "🚀 Démarrage du backend en mode test..."
./mvnw quarkus:dev &
BACKEND_PID=$!

# Attendre que le backend démarre
echo "⏳ Attente du démarrage du backend..."
sleep 15

# Test de santé
echo "🔍 Test de santé du backend..."
HEALTH_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:8083/q/health)
HTTP_CODE="${HEALTH_RESPONSE: -3}"
BODY="${HEALTH_RESPONSE%???}"

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Backend accessible (HTTP $HTTP_CODE)"
    echo "   Réponse: $BODY"
else
    echo "❌ Backend non accessible (HTTP $HTTP_CODE)"
    echo "   Réponse: $BODY"
fi

echo ""

# Test de l'endpoint OpenAPI
echo "🔍 Test de l'endpoint OpenAPI..."
OPENAPI_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:8083/openapi)
HTTP_CODE="${OPENAPI_RESPONSE: -3}"

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ OpenAPI accessible (HTTP $HTTP_CODE)"
else
    echo "❌ OpenAPI non accessible (HTTP $HTTP_CODE)"
fi

echo ""

# Test de l'endpoint de téléchargement (sans authentification)
echo "🔍 Test de l'endpoint de téléchargement (sans auth)..."
DOWNLOAD_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:8083/backend/api/shares/688ca82faba32d36852855da/file-with-validated-data)
HTTP_CODE="${DOWNLOAD_RESPONSE: -3}"

if [ "$HTTP_CODE" = "401" ]; then
    echo "✅ Endpoint protégé - authentification requise (HTTP $HTTP_CODE)"
elif [ "$HTTP_CODE" = "403" ]; then
    echo "❌ Endpoint accessible mais accès refusé (HTTP $HTTP_CODE)"
elif [ "$HTTP_CODE" = "200" ]; then
    echo "⚠️ Endpoint accessible sans authentification (HTTP $HTTP_CODE) - Problème de sécurité !"
else
    echo "❓ Réponse inattendue (HTTP $HTTP_CODE)"
fi

echo ""

echo "📝 Analyse du problème :"
echo "   L'erreur 403 indique que :"
echo "   1. L'utilisateur est authentifié (pas d'erreur 401)"
echo "   2. Mais l'accès est refusé pour des raisons de sécurité"
echo "   3. Possiblement :"
echo "      - L'utilisateur n'est pas le propriétaire du partage"
echo "      - Le partage n'est pas actif"
echo "      - Aucun token validé trouvé"
echo "      - Problème avec SecurityIdentity.getPrincipal().getName()"
echo ""

echo "🔧 Solutions possibles :"
echo "   1. Vérifier que l'utilisateur connecté est bien le propriétaire du partage"
echo "   2. Vérifier que le partage a le statut ACTIVE"
echo "   3. Vérifier qu'il existe des tokens d'accès validés"
echo "   4. Vérifier que SecurityIdentity.getPrincipal().getName() retourne le bon username"
echo "   5. Ajouter des logs de débogage dans le service"
echo ""

# Arrêter le backend
echo "🛑 Arrêt du backend..."
kill $BACKEND_PID

echo ""
echo "✅ Diagnostic terminé"

