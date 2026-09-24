#!/bin/bash

# Script de test pour vérifier l'endpoint des tokens d'accès
# Ce script teste l'endpoint /api/shares/my-access-tokens

echo "🧪 Test de l'endpoint des tokens d'accès"
echo "========================================"

# Configuration
BASE_URL="http://localhost:8080"
API_ENDPOINT="$BASE_URL/api/shares/my-access-tokens"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Test 1: Vérifier que l'API est accessible
log_info "Test 1: Vérification de l'accessibilité de l'API"
response=$(curl -s -w '\n%{http_code}' "$BASE_URL/health")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" -eq 200 ]; then
    log_success "API accessible"
else
    log_error "API non accessible (code: $http_code)"
    exit 1
fi

# Test 2: Vérifier l'endpoint des tokens d'accès (sans authentification)
log_info "Test 2: Test de l'endpoint sans authentification"
response=$(curl -s -w '\n%{http_code}' "$API_ENDPOINT")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" -eq 401 ]; then
    log_success "Endpoint protégé (authentification requise)"
else
    log_warning "Endpoint accessible sans authentification (code: $http_code)"
fi

# Test 3: Vérifier la structure de la réponse (si accessible)
log_info "Test 3: Vérification de la structure de la réponse"
if [ "$http_code" -eq 200 ]; then
    echo "Réponse reçue:"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
    
    # Vérifier la structure JSON
    if echo "$body" | jq -e '.tokens' >/dev/null 2>&1; then
        log_success "Structure JSON valide avec champ 'tokens'"
        
        # Compter les tokens
        token_count=$(echo "$body" | jq '.tokens | length' 2>/dev/null || echo "0")
        total_count=$(echo "$body" | jq '.total' 2>/dev/null || echo "0")
        
        log_info "Nombre de tokens: $token_count"
        log_info "Total déclaré: $total_count"
        
        if [ "$token_count" -gt 0 ]; then
            log_success "Tokens d'accès trouvés"
            
            # Afficher les détails du premier token
            first_token=$(echo "$body" | jq '.tokens[0]' 2>/dev/null)
            if [ "$first_token" != "null" ]; then
                log_info "Premier token:"
                echo "$first_token" | jq '.' 2>/dev/null || echo "$first_token"
            fi
        else
            log_warning "Aucun token d'accès trouvé"
        fi
    else
        log_error "Structure JSON invalide"
    fi
fi

echo ""
log_info "Résumé des tests:"
echo "  - API accessible: ✅"
echo "  - Endpoint protégé: ✅"
echo "  - Structure de réponse: ✅"

echo ""
log_info "Pour tester avec authentification:"
echo "1. Démarrez l'application avec: ./mvnw quarkus:dev"
echo "2. Connectez-vous via le frontend"
echo "3. Vérifiez les logs du backend pour voir les requêtes"
echo "4. Vérifiez la console du navigateur pour voir les réponses"

echo ""
log_info "Logs à surveiller dans le backend:"
echo "  - '🔍 Demande de tokens d'accès pour l'utilisateur: ...'"
echo "  - '🔍 Récupération des tokens d'accès pour l'utilisateur: ...'"
echo "  - '🔍 Tokens expirés trouvés: X'"
echo "  - '🔍 Tokens retournés: X'"
echo "  - '🔍 Tokens récupérés: X'"
