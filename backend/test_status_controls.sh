#!/bin/bash

# Script de test pour vérifier les contrôles de statut des accès et shares
# Ce script teste les fonctionnalités ajoutées au backend ddsshare

echo "🧪 Test des contrôles de statut des accès et shares"
echo "=================================================="

# Configuration
BASE_URL="http://localhost:8080"
API_BASE="$BASE_URL/api/shares"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les logs
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Fonction pour faire une requête HTTP
make_request() {
    local method=$1
    local url=$2
    local data=$3
    local token=$4
    
    local curl_cmd="curl -s -w '\n%{http_code}' -X $method '$url'"
    
    if [ ! -z "$data" ]; then
        curl_cmd="$curl_cmd -H 'Content-Type: application/json' -d '$data'"
    fi
    
    if [ ! -z "$token" ]; then
        curl_cmd="$curl_cmd -H 'Authorization: Bearer $token'"
    fi
    
    local response=$(eval $curl_cmd)
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | head -n -1)
    
    echo "$body"
    return $http_code
}

# Test 1: Vérifier que l'API est accessible
log_info "Test 1: Vérification de l'accessibilité de l'API"
response=$(make_request "GET" "$BASE_URL/health")
if [ $? -eq 200 ]; then
    log_success "API accessible"
else
    log_error "API non accessible"
    exit 1
fi

# Test 2: Vérifier les endpoints de contrôle de statut
log_info "Test 2: Vérification des endpoints de contrôle de statut"

# Note: Ces tests nécessitent une authentification et des données de test
# Dans un environnement réel, il faudrait:
# 1. Créer un utilisateur de test
# 2. Créer un share de test
# 3. Créer des tokens d'accès de test
# 4. Tester les contrôles de statut

log_warning "Tests de contrôle de statut nécessitent une configuration complète"
log_info "Les contrôles de statut sont maintenant intégrés dans:"
echo "  - GET /api/shares (récupération des shares de l'utilisateur)"
echo "  - GET /api/shares/{id} (récupération d'un share spécifique)"
echo "  - GET /api/shares/shared-with-me (shares partagés avec l'utilisateur)"
echo "  - GET /api/shares/{id}/access-tokens (tokens d'accès d'un share)"
echo "  - GET /api/shares/my-access-tokens (tokens d'accès de l'utilisateur)"
echo "  - GET /api/shares/access/{token} (accès via token)"
echo "  - GET /api/shares/form/{token} (formulaire via token)"
echo "  - POST /api/shares/form/{token}/save (sauvegarde via token)"

log_info "Fonctionnalités ajoutées:"
echo "  ✅ Contrôle automatique du statut des tokens expirés"
echo "  ✅ Mise à jour automatique du statut des shares basé sur les tokens actifs"
echo "  ✅ Statut INACTIVE si aucun token actif"
echo "  ✅ Statut ACTIVE si au moins un token actif"
echo "  ✅ Préservation des statuts NEW et DELETED"

log_success "Tests de base terminés"
echo ""
echo "📋 Pour tester complètement les contrôles de statut:"
echo "1. Démarrez l'application avec: ./mvnw quarkus:dev"
echo "2. Créez un share avec des tokens d'accès"
echo "3. Attendez l'expiration d'un token ou révoquez-le"
echo "4. Vérifiez que le statut du share passe en INACTIVE"
echo "5. Créez un nouveau token et vérifiez que le statut repasse en ACTIVE" 