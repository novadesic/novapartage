#!/bin/bash

# ===========================================
# Script de Test de Sécurité NovaPartage
# ===========================================

set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AUTH_SERVICE_URL="http://localhost:3001"
FRONTEND_URL="http://localhost:3000"
TEST_EMAIL="test@novapartage.com"
TEST_CODE="123456"

# Fonctions utilitaires
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Fonction pour tester la connectivité
test_connectivity() {
    log_info "Test de connectivité des services..."
    
    # Test du service d'authentification
    if curl -s -f "$AUTH_SERVICE_URL/health" > /dev/null; then
        log_success "Service d'authentification accessible"
    else
        log_error "Service d'authentification inaccessible"
        return 1
    fi
    
    # Test du frontend
    if curl -s -f "$FRONTEND_URL" > /dev/null; then
        log_success "Frontend accessible"
    else
        log_warning "Frontend inaccessible (normal si pas démarré)"
    fi
}

# Fonction pour tester les headers de sécurité
test_security_headers() {
    log_info "Test des headers de sécurité..."
    
    local response=$(curl -s -I "$AUTH_SERVICE_URL/health")
    
    # Vérifier les headers de sécurité
    if echo "$response" | grep -q "X-Frame-Options"; then
        log_success "Header X-Frame-Options présent"
    else
        log_warning "Header X-Frame-Options manquant"
    fi
    
    if echo "$response" | grep -q "X-Content-Type-Options"; then
        log_success "Header X-Content-Type-Options présent"
    else
        log_warning "Header X-Content-Type-Options manquant"
    fi
    
    if echo "$response" | grep -q "X-XSS-Protection"; then
        log_success "Header X-XSS-Protection présent"
    else
        log_warning "Header X-XSS-Protection manquant"
    fi
    
    if echo "$response" | grep -q "Strict-Transport-Security"; then
        log_success "Header HSTS présent"
    else
        log_warning "Header HSTS manquant (normal en développement)"
    fi
}

# Fonction pour tester le rate limiting
test_rate_limiting() {
    log_info "Test du rate limiting..."
    
    local success_count=0
    local total_requests=10
    
    for i in $(seq 1 $total_requests); do
        local response=$(curl -s -w "%{http_code}" -o /dev/null "$AUTH_SERVICE_URL/api/sign-in/email/passwordless" \
            -H "Content-Type: application/json" \
            -d "{\"email\":\"$TEST_EMAIL\"}")
        
        if [ "$response" = "200" ] || [ "$response" = "400" ]; then
            success_count=$((success_count + 1))
        fi
    done
    
    if [ $success_count -lt $total_requests ]; then
        log_success "Rate limiting fonctionne (requêtes limitées)"
    else
        log_warning "Rate limiting peut ne pas fonctionner correctement"
    fi
}

# Fonction pour tester la protection CSRF
test_csrf_protection() {
    log_info "Test de la protection CSRF..."
    
    # Test sans token CSRF
    local response=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$AUTH_SERVICE_URL/api/sign-in/email/passwordless" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$TEST_EMAIL\"}")
    
    if [ "$response" = "403" ]; then
        log_success "Protection CSRF active (requête bloquée sans token)"
    else
        log_warning "Protection CSRF peut ne pas fonctionner correctement"
    fi
}

# Fonction pour tester la validation JWT
test_jwt_validation() {
    log_info "Test de la validation JWT..."
    
    # Test avec un token JWT invalide
    local response=$(curl -s -w "%{http_code}" -o /dev/null "$AUTH_SERVICE_URL/oidc/me" \
        -H "Authorization: Bearer invalid-token")
    
    if [ "$response" = "401" ]; then
        log_success "Validation JWT fonctionne (token invalide rejeté)"
    else
        log_warning "Validation JWT peut ne pas fonctionner correctement"
    fi
}

# Fonction pour tester la configuration Redis
test_redis_config() {
    log_info "Test de la configuration Redis..."
    
    local response=$(curl -s "$AUTH_SERVICE_URL/health" | jq -r '.services.redis.isConnected // false')
    
    if [ "$response" = "true" ]; then
        log_success "Redis connecté et fonctionnel"
    else
        log_warning "Redis non connecté (utilise le fallback en mémoire)"
    fi
}

# Fonction pour tester les cookies sécurisés
test_secure_cookies() {
    log_info "Test des cookies sécurisés..."
    
    # Test de l'endpoint de déconnexion
    local response=$(curl -s -I -X POST "$AUTH_SERVICE_URL/api/logout")
    
    if echo "$response" | grep -q "Set-Cookie.*HttpOnly"; then
        log_success "Cookies HttpOnly configurés"
    else
        log_warning "Cookies HttpOnly peuvent ne pas être configurés"
    fi
    
    if echo "$response" | grep -q "Set-Cookie.*Secure"; then
        log_success "Cookies Secure configurés"
    else
        log_warning "Cookies Secure non configurés (normal en développement)"
    fi
}

# Fonction pour tester la validation des entrées
test_input_validation() {
    log_info "Test de la validation des entrées..."
    
    # Test avec un email invalide
    local response=$(curl -s -w "%{http_code}" -o /dev/null "$AUTH_SERVICE_URL/api/sign-in/email/passwordless" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"invalid-email\"}")
    
    if [ "$response" = "400" ]; then
        log_success "Validation des entrées fonctionne (email invalide rejeté)"
    else
        log_warning "Validation des entrées peut ne pas fonctionner correctement"
    fi
}

# Fonction pour tester la compatibilité avec l'ancien système
test_backward_compatibility() {
    log_info "Test de la compatibilité avec l'ancien système..."
    
    # Test des endpoints existants
    local endpoints=(
        "/api/sign-in/email/passwordless"
        "/api/sign-in/email/verify"
        "/api/email/verify"
        "/api/email/verify-code"
        "/api/email/verify-link"
        "/oidc/me"
        "/health"
    )
    
    local success_count=0
    local total_endpoints=${#endpoints[@]}
    
    for endpoint in "${endpoints[@]}"; do
        local response=$(curl -s -w "%{http_code}" -o /dev/null "$AUTH_SERVICE_URL$endpoint")
        
        if [ "$response" = "200" ] || [ "$response" = "400" ] || [ "$response" = "401" ] || [ "$response" = "403" ]; then
            success_count=$((success_count + 1))
            log_success "Endpoint $endpoint accessible"
        else
            log_warning "Endpoint $endpoint peut avoir des problèmes"
        fi
    done
    
    if [ $success_count -eq $total_endpoints ]; then
        log_success "Tous les endpoints sont compatibles"
    else
        log_warning "Certains endpoints peuvent avoir des problèmes de compatibilité"
    fi
}

# Fonction pour générer un rapport de test
generate_report() {
    log_info "Génération du rapport de test..."
    
    local report_file="security-test-report-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "==========================================="
        echo "Rapport de Test de Sécurité NovaPartage"
        echo "Date: $(date)"
        echo "==========================================="
        echo ""
        echo "Configuration:"
        echo "- Service d'authentification: $AUTH_SERVICE_URL"
        echo "- Frontend: $FRONTEND_URL"
        echo "- Email de test: $TEST_EMAIL"
        echo ""
        echo "Tests effectués:"
        echo "- Connectivité des services"
        echo "- Headers de sécurité"
        echo "- Rate limiting"
        echo "- Protection CSRF"
        echo "- Validation JWT"
        echo "- Configuration Redis"
        echo "- Cookies sécurisés"
        echo "- Validation des entrées"
        echo "- Compatibilité avec l'ancien système"
        echo ""
        echo "Pour plus de détails, consultez les logs ci-dessus."
    } > "$report_file"
    
    log_success "Rapport généré: $report_file"
}

# Fonction principale
main() {
    log_info "Démarrage des tests de sécurité NovaPartage..."
    echo ""
    
    # Vérifier que jq est installé
    if ! command -v jq &> /dev/null; then
        log_error "jq n'est pas installé. Veuillez l'installer pour continuer."
        exit 1
    fi
    
    # Vérifier que curl est installé
    if ! command -v curl &> /dev/null; then
        log_error "curl n'est pas installé. Veuillez l'installer pour continuer."
        exit 1
    fi
    
    # Exécuter les tests
    test_connectivity
    echo ""
    
    test_security_headers
    echo ""
    
    test_rate_limiting
    echo ""
    
    test_csrf_protection
    echo ""
    
    test_jwt_validation
    echo ""
    
    test_redis_config
    echo ""
    
    test_secure_cookies
    echo ""
    
    test_input_validation
    echo ""
    
    test_backward_compatibility
    echo ""
    
    generate_report
    
    log_success "Tests de sécurité terminés!"
    log_info "Consultez le rapport généré pour plus de détails."
}

# Exécuter le script principal
main "$@"

