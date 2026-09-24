#!/bin/bash

# ===========================================
# Script de Test de Compatibilité NovaPartage
# ===========================================

set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/home/msoriano/DDS/git/datadesic/ddsshare"
AUTH_SERVICE_URL="http://localhost:3001"
FRONTEND_URL="http://localhost:3000"
TEST_MODE=${1:-all}

# Compteurs de tests
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

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

# Fonction pour exécuter un test
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    log_info "Test: $test_name"
    
    if eval "$test_command"; then
        log_success "✓ $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        log_error "✗ $test_name"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Fonction pour tester la connectivité des services
test_connectivity() {
    log_info "=== Tests de Connectivité ==="
    
    # Test du service d'authentification
    run_test "Service d'authentification accessible" \
        "curl -s -f '$AUTH_SERVICE_URL/health' > /dev/null"
    
    # Test du frontend
    run_test "Frontend accessible" \
        "curl -s -f '$FRONTEND_URL' > /dev/null"
    
    # Test de Redis
    run_test "Redis accessible" \
        "docker exec novapartage-redis redis-cli ping > /dev/null 2>&1"
    
    # Test de PostgreSQL
    run_test "PostgreSQL accessible" \
        "docker exec novapartage-db pg_isready -U novapartage > /dev/null 2>&1"
    
    # Test de MongoDB
    run_test "MongoDB accessible" \
        "docker exec novapartage-mongodb mongosh --eval 'db.adminCommand(\"ping\")' > /dev/null 2>&1"
}

# Fonction pour tester les endpoints d'authentification
test_auth_endpoints() {
    log_info "=== Tests des Endpoints d'Authentification ==="
    
    # Test de l'endpoint de santé
    run_test "Endpoint /health" \
        "curl -s -f '$AUTH_SERVICE_URL/health' | grep -q 'status.*ok'"
    
    # Test de l'endpoint de connexion sans email
    run_test "Endpoint /api/sign-in/email/passwordless (sans email)" \
        "curl -s -X POST '$AUTH_SERVICE_URL/api/sign-in/email/passwordless' -H 'Content-Type: application/json' -d '{}' | grep -q 'error'"
    
    # Test de l'endpoint de vérification sans code
    run_test "Endpoint /api/email/verify-code (sans code)" \
        "curl -s -X POST '$AUTH_SERVICE_URL/api/email/verify-code' -H 'Content-Type: application/json' -d '{}' | grep -q 'error'"
    
    # Test de l'endpoint de déconnexion
    run_test "Endpoint /api/logout" \
        "curl -s -X POST '$AUTH_SERVICE_URL/api/logout' | grep -q 'success'"
    
    # Test de l'endpoint OIDC /me sans token
    run_test "Endpoint /oidc/me (sans token)" \
        "curl -s -f '$AUTH_SERVICE_URL/oidc/me' | grep -q 'error'"
}

# Fonction pour tester la sécurité
test_security() {
    log_info "=== Tests de Sécurité ==="
    
    # Test des headers de sécurité
    run_test "Headers de sécurité présents" \
        "curl -s -I '$AUTH_SERVICE_URL/health' | grep -q 'X-Content-Type-Options'"
    
    # Test de la protection CSRF
    run_test "Protection CSRF active" \
        "curl -s -X POST '$AUTH_SERVICE_URL/api/sign-in/email/passwordless' -H 'Content-Type: application/json' -d '{\"email\":\"test@example.com\"}' | grep -q 'CSRF'"
    
    # Test du rate limiting
    run_test "Rate limiting actif" \
        "for i in {1..10}; do curl -s -X POST '$AUTH_SERVICE_URL/api/sign-in/email/passwordless' -H 'Content-Type: application/json' -d '{\"email\":\"test@example.com\"}' > /dev/null; done; curl -s -X POST '$AUTH_SERVICE_URL/api/sign-in/email/passwordless' -H 'Content-Type: application/json' -d '{\"email\":\"test@example.com\"}' | grep -q 'rate limit'"
    
    # Test de la validation des entrées
    run_test "Validation des entrées" \
        "curl -s -X POST '$AUTH_SERVICE_URL/api/sign-in/email/passwordless' -H 'Content-Type: application/json' -d '{\"email\":\"invalid-email\"}' | grep -q 'error'"
}

# Fonction pour tester la compatibilité des services
test_service_compatibility() {
    log_info "=== Tests de Compatibilité des Services ==="
    
    # Test de la compatibilité avec CustomAuthService
    run_test "CustomAuthService compatible" \
        "grep -q 'CustomAuthService' '$PROJECT_DIR/frontend/src/app/services/auth.service.ts'"
    
    # Test de la compatibilité avec AuthStateService
    run_test "AuthStateService compatible" \
        "grep -q 'AuthStateService' '$PROJECT_DIR/frontend/src/app/services/auth.service.ts'"
    
    # Test de la compatibilité avec HybridAuthService
    run_test "HybridAuthService compatible" \
        "grep -q 'HybridAuthService' '$PROJECT_DIR/frontend/src/app/services/auth.service.ts'"
    
    # Test de la compatibilité avec SecureAuthService
    run_test "SecureAuthService compatible" \
        "grep -q 'SecureAuthService' '$PROJECT_DIR/frontend/src/app/services/auth.service.ts'"
    
    # Test de la configuration d'environnement
    run_test "Configuration d'environnement valide" \
        "grep -q 'TOKEN_STORAGE_METHOD' '$PROJECT_DIR/.env'"
}

# Fonction pour tester la migration des tokens
test_token_migration() {
    log_info "=== Tests de Migration des Tokens ==="
    
    # Test de la présence des cookies HttpOnly
    run_test "Cookies HttpOnly configurés" \
        "grep -q 'COOKIE_HTTP_ONLY' '$PROJECT_DIR/.env'"
    
    # Test de la configuration Redis
    run_test "Configuration Redis présente" \
        "grep -q 'REDIS_ENABLED' '$PROJECT_DIR/.env'"
    
    # Test de la configuration CSRF
    run_test "Configuration CSRF présente" \
        "grep -q 'CSRF_SECRET' '$PROJECT_DIR/.env'"
    
    # Test de la validation JWT côté serveur
    run_test "Validation JWT côté serveur configurée" \
        "grep -q 'JWT_VALIDATION_MODE' '$PROJECT_DIR/.env'"
}

# Fonction pour tester les middlewares de sécurité
test_security_middlewares() {
    log_info "=== Tests des Middlewares de Sécurité ==="
    
    # Test de la présence des middlewares
    run_test "Middleware CSRF présent" \
        "grep -q 'csrfProtection' '$PROJECT_DIR/auth-service/server.js'"
    
    # Test de la présence des middlewares de sécurité
    run_test "Middleware de sécurité présent" \
        "grep -q 'securityMiddleware' '$PROJECT_DIR/auth-service/server.js'"
    
    # Test de la présence des middlewares JWT
    run_test "Middleware JWT présent" \
        "grep -q 'jwtMiddleware' '$PROJECT_DIR/auth-service/server.js'"
    
    # Test de la présence des middlewares de rate limiting
    run_test "Middleware de rate limiting présent" \
        "grep -q 'authRateLimit' '$PROJECT_DIR/auth-service/server.js'"
}

# Fonction pour tester la configuration Docker
test_docker_config() {
    log_info "=== Tests de Configuration Docker ==="
    
    # Test de la présence des services Redis
    run_test "Service Redis configuré" \
        "grep -q 'redis:' '$PROJECT_DIR/docker-compose.yml'"
    
    # Test de la présence des variables d'environnement
    run_test "Variables d'environnement configurées" \
        "grep -q 'JWT_SECRET' '$PROJECT_DIR/docker-compose.yml'"
    
    # Test de la configuration de production
    run_test "Configuration de production présente" \
        "grep -q 'redis:' '$PROJECT_DIR/docker-compose.prod.yml'"
    
    # Test de la configuration des volumes
    run_test "Volumes Redis configurés" \
        "grep -q 'redis_data:' '$PROJECT_DIR/docker-compose.yml'"
}

# Fonction pour tester les interceptors et guards
test_frontend_security() {
    log_info "=== Tests de Sécurité Frontend ==="
    
    # Test de la présence des interceptors CSRF
    run_test "Interceptor CSRF présent" \
        "grep -q 'CSRFInterceptor' '$PROJECT_DIR/frontend/src/app/app.config.ts'"
    
    # Test de la présence des guards CSRF
    run_test "Guard CSRF présent" \
        "grep -q 'CsrfGuard' '$PROJECT_DIR/frontend/src/app/guards/csrf.guard.ts'"
    
    # Test de la présence des guards JWT sécurisés
    run_test "Guard JWT sécurisé présent" \
        "grep -q 'SecureJwtGuard' '$PROJECT_DIR/frontend/src/app/guards/secure-jwt.guard.ts'"
    
    # Test de la configuration des interceptors
    run_test "Configuration des interceptors" \
        "grep -q 'withInterceptors' '$PROJECT_DIR/frontend/src/app/app.config.ts'"
}

# Fonction pour générer un rapport de test
generate_test_report() {
    log_info "=== Rapport de Test ==="
    
    local report_file="$PROJECT_DIR/test-report-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > "$report_file" << EOF
# Rapport de Test de Compatibilité NovaPartage
Date: $(date)
Mode: $TEST_MODE

## Résumé des Tests
- Total: $TOTAL_TESTS
- Réussis: $PASSED_TESTS
- Échoués: $FAILED_TESTS
- Taux de réussite: $(( (PASSED_TESTS * 100) / TOTAL_TESTS ))%

## Détails des Tests
EOF
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo "✅ Tous les tests sont passés avec succès!" >> "$report_file"
    else
        echo "❌ $FAILED_TESTS test(s) ont échoué" >> "$report_file"
    fi
    
    echo "" >> "$report_file"
    echo "## Recommandations" >> "$report_file"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo "- Le système est prêt pour la production" >> "$report_file"
        echo "- Toutes les fonctionnalités de sécurité sont opérationnelles" >> "$report_file"
        echo "- La compatibilité avec les services existants est assurée" >> "$report_file"
    else
        echo "- Corriger les tests échoués avant le déploiement" >> "$report_file"
        echo "- Vérifier la configuration des services" >> "$report_file"
        echo "- Tester manuellement les fonctionnalités critiques" >> "$report_file"
    fi
    
    log_success "Rapport de test généré: $report_file"
}

# Fonction pour afficher l'aide
show_help() {
    echo "Usage: $0 [MODE]"
    echo ""
    echo "MODE:"
    echo "  all         Tous les tests (défaut)"
    echo "  connectivity Tests de connectivité uniquement"
    echo "  auth        Tests d'authentification uniquement"
    echo "  security    Tests de sécurité uniquement"
    echo "  compatibility Tests de compatibilité uniquement"
    echo "  migration   Tests de migration des tokens uniquement"
    echo "  middlewares Tests des middlewares uniquement"
    echo "  docker      Tests de configuration Docker uniquement"
    echo "  frontend    Tests de sécurité frontend uniquement"
    echo ""
    echo "Exemples:"
    echo "  $0                    # Tous les tests"
    echo "  $0 connectivity       # Tests de connectivité"
    echo "  $0 security           # Tests de sécurité"
    echo ""
}

# Fonction principale
main() {
    log_info "Démarrage des tests de compatibilité NovaPartage..."
    log_info "Mode: $TEST_MODE"
    echo ""
    
    # Vérifier que les services sont en cours d'exécution
    if ! docker ps | grep -q "novapartage"; then
        log_error "Les services NovaPartage ne sont pas en cours d'exécution"
        log_info "Démarrez les services avec: ./scripts/deploy-secure.sh"
        exit 1
    fi
    
    # Exécuter les tests selon le mode
    case "$TEST_MODE" in
        "connectivity")
            test_connectivity
            ;;
        "auth")
            test_auth_endpoints
            ;;
        "security")
            test_security
            ;;
        "compatibility")
            test_service_compatibility
            ;;
        "migration")
            test_token_migration
            ;;
        "middlewares")
            test_security_middlewares
            ;;
        "docker")
            test_docker_config
            ;;
        "frontend")
            test_frontend_security
            ;;
        "all")
            test_connectivity
            echo ""
            test_auth_endpoints
            echo ""
            test_security
            echo ""
            test_service_compatibility
            echo ""
            test_token_migration
            echo ""
            test_security_middlewares
            echo ""
            test_docker_config
            echo ""
            test_frontend_security
            ;;
        *)
            log_error "Mode de test invalide: $TEST_MODE"
            show_help
            exit 1
            ;;
    esac
    
    echo ""
    
    # Générer le rapport
    generate_test_report
    
    echo ""
    
    # Afficher le résumé
    log_info "=== Résumé des Tests ==="
    log_info "Total: $TOTAL_TESTS"
    log_success "Réussis: $PASSED_TESTS"
    if [ $FAILED_TESTS -gt 0 ]; then
        log_error "Échoués: $FAILED_TESTS"
    else
        log_success "Échoués: $FAILED_TESTS"
    fi
    
    if [ $FAILED_TESTS -eq 0 ]; then
        log_success "Tous les tests sont passés avec succès!"
        exit 0
    else
        log_error "$FAILED_TESTS test(s) ont échoué"
        exit 1
    fi
}

# Vérifier les arguments
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

# Exécuter le script principal
main "$@"

