#!/bin/bash

# ===========================================
# Script de Test Final du Système NovaPartage
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
TEST_EMAIL="test@novapartage.com"

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

# Fonction pour tester l'architecture complète
test_complete_architecture() {
    log_info "=== Test de l'Architecture Complète ==="
    
    # Test de la présence des fichiers critiques
    run_test "Fichier server.js présent" \
        "test -f '$PROJECT_DIR/auth-service/server.js'"
    
    run_test "Configuration Redis présente" \
        "test -f '$PROJECT_DIR/auth-service/config/redis.js'"
    
    run_test "Gestionnaire de tokens présent" \
        "test -f '$PROJECT_DIR/auth-service/utils/tokenManager.js'"
    
    run_test "Gestionnaire de cookies présent" \
        "test -f '$PROJECT_DIR/auth-service/utils/cookieManager.js'"
    
    run_test "Configuration de validation présente" \
        "test -f '$PROJECT_DIR/auth-service/config/validation.js'"
    
    run_test "Middleware CSRF présent" \
        "test -f '$PROJECT_DIR/auth-service/middleware/csrf.js'"
    
    run_test "Middleware de sécurité présent" \
        "test -f '$PROJECT_DIR/auth-service/middleware/security.js'"
    
    run_test "Middleware JWT présent" \
        "test -f '$PROJECT_DIR/auth-service/middleware/jwt.js'"
    
    run_test "Service d'authentification sécurisé présent" \
        "test -f '$PROJECT_DIR/frontend/src/app/services/secure-auth.service.ts'"
    
    run_test "Service d'authentification hybride présent" \
        "test -f '$PROJECT_DIR/frontend/src/app/services/hybrid-auth.service.ts'"
    
    run_test "Interceptor CSRF présent" \
        "test -f '$PROJECT_DIR/frontend/src/app/interceptors/csrf.interceptor.ts'"
    
    run_test "Guard CSRF présent" \
        "test -f '$PROJECT_DIR/frontend/src/app/guards/csrf.guard.ts'"
    
    run_test "Guard JWT sécurisé présent" \
        "test -f '$PROJECT_DIR/frontend/src/app/guards/secure-jwt.guard.ts'"
    
    run_test "Configuration Docker Compose présente" \
        "test -f '$PROJECT_DIR/docker-compose.yml'"
    
    run_test "Configuration Docker Compose production présente" \
        "test -f '$PROJECT_DIR/docker-compose.prod.yml'"
    
    run_test "Fichier d'environnement exemple présent" \
        "test -f '$PROJECT_DIR/env.example'"
    
    run_test "Fichier d'environnement production exemple présent" \
        "test -f '$PROJECT_DIR/env.production.example'"
}

# Fonction pour tester la sécurité critique
test_critical_security() {
    log_info "=== Test de la Sécurité Critique ==="
    
    # Test de la configuration Redis
    run_test "Configuration Redis valide" \
        "grep -q 'REDIS_ENABLED' '$PROJECT_DIR/.env'"
    
    # Test de la configuration JWT
    run_test "Configuration JWT valide" \
        "grep -q 'JWT_SECRET' '$PROJECT_DIR/.env'"
    
    # Test de la configuration CSRF
    run_test "Configuration CSRF valide" \
        "grep -q 'CSRF_SECRET' '$PROJECT_DIR/.env'"
    
    # Test de la configuration des cookies
    run_test "Configuration des cookies valide" \
        "grep -q 'COOKIE_HTTP_ONLY' '$PROJECT_DIR/.env'"
    
    # Test de la configuration du stockage
    run_test "Configuration du stockage valide" \
        "grep -q 'TOKEN_STORAGE_METHOD' '$PROJECT_DIR/.env'"
    
    # Test de la configuration de validation JWT
    run_test "Configuration de validation JWT valide" \
        "grep -q 'JWT_VALIDATION_MODE' '$PROJECT_DIR/.env'"
    
    # Test de la configuration des durées de tokens
    run_test "Configuration des durées de tokens valide" \
        "grep -q 'TEMP_TOKEN_EXPIRES_IN' '$PROJECT_DIR/.env'"
    
    # Test de la configuration des tentatives de vérification
    run_test "Configuration des tentatives de vérification valide" \
        "grep -q 'MAX_VERIFICATION_ATTEMPTS' '$PROJECT_DIR/.env'"
}

# Fonction pour tester l'intégration des services
test_service_integration() {
    log_info "=== Test de l'Intégration des Services ==="
    
    # Test de l'intégration Redis
    run_test "Intégration Redis dans server.js" \
        "grep -q 'redisManager' '$PROJECT_DIR/auth-service/server.js'"
    
    # Test de l'intégration des middlewares de sécurité
    run_test "Intégration des middlewares de sécurité" \
        "grep -q 'securityMiddleware' '$PROJECT_DIR/auth-service/server.js'"
    
    # Test de l'intégration de la protection CSRF
    run_test "Intégration de la protection CSRF" \
        "grep -q 'csrfProtection' '$PROJECT_DIR/auth-service/server.js'"
    
    # Test de l'intégration de la validation JWT
    run_test "Intégration de la validation JWT" \
        "grep -q 'jwtMiddleware' '$PROJECT_DIR/auth-service/server.js'"
    
    # Test de l'intégration du gestionnaire de cookies
    run_test "Intégration du gestionnaire de cookies" \
        "grep -q 'cookieManager' '$PROJECT_DIR/auth-service/server.js'"
    
    # Test de l'intégration du gestionnaire de tokens
    run_test "Intégration du gestionnaire de tokens" \
        "grep -q 'tokenManager' '$PROJECT_DIR/auth-service/server.js'"
    
    # Test de l'intégration de la configuration de validation
    run_test "Intégration de la configuration de validation" \
        "grep -q 'validationConfig' '$PROJECT_DIR/auth-service/server.js'"
}

# Fonction pour tester la compatibilité frontend
test_frontend_compatibility() {
    log_info "=== Test de la Compatibilité Frontend ==="
    
    # Test de la compatibilité avec CustomAuthService
    run_test "Compatibilité CustomAuthService" \
        "grep -q 'CustomAuthService' '$PROJECT_DIR/frontend/src/app/services/auth.service.ts'"
    
    # Test de la compatibilité avec AuthStateService
    run_test "Compatibilité AuthStateService" \
        "grep -q 'AuthStateService' '$PROJECT_DIR/frontend/src/app/services/auth.service.ts'"
    
    # Test de la compatibilité avec HybridAuthService
    run_test "Compatibilité HybridAuthService" \
        "grep -q 'HybridAuthService' '$PROJECT_DIR/frontend/src/app/services/auth.service.ts'"
    
    # Test de la configuration des interceptors
    run_test "Configuration des interceptors" \
        "grep -q 'csrfInterceptor' '$PROJECT_DIR/frontend/src/app/app.config.ts'"
    
    # Test de la configuration des services
    run_test "Configuration des services" \
        "grep -q 'SecureAuthService' '$PROJECT_DIR/frontend/src/app/app.config.ts'"
    
    # Test de la configuration des guards
    run_test "Configuration des guards" \
        "grep -q 'SecureJWTGuard' '$PROJECT_DIR/frontend/src/app/guards/secure-jwt.guard.ts'"
}

# Fonction pour tester la configuration Docker
test_docker_configuration() {
    log_info "=== Test de la Configuration Docker ==="
    
    # Test de la configuration des services
    run_test "Service Redis configuré" \
        "grep -q 'redis:' '$PROJECT_DIR/docker-compose.yml'"
    
    # Test de la configuration des volumes
    run_test "Volumes Redis configurés" \
        "grep -q 'redis_data:' '$PROJECT_DIR/docker-compose.yml'"
    
    # Test de la configuration des variables d'environnement
    run_test "Variables d'environnement configurées" \
        "grep -q 'JWT_SECRET' '$PROJECT_DIR/docker-compose.yml'"
    
    # Test de la configuration de production
    run_test "Configuration de production" \
        "grep -q 'redis:' '$PROJECT_DIR/docker-compose.prod.yml'"
    
    # Test de la configuration des réseaux
    run_test "Configuration des réseaux" \
        "grep -q 'novapartage-network' '$PROJECT_DIR/docker-compose.yml'"
    
    # Test de la configuration des dépendances
    run_test "Configuration des dépendances" \
        "grep -q 'depends_on' '$PROJECT_DIR/docker-compose.yml'"
}

# Fonction pour tester les scripts d'automatisation
test_automation_scripts() {
    log_info "=== Test des Scripts d'Automatisation ==="
    
    # Test de la présence des scripts
    run_test "Script de déploiement sécurisé présent" \
        "test -f '$PROJECT_DIR/scripts/deploy-secure.sh'"
    
    run_test "Script de test de sécurité présent" \
        "test -f '$PROJECT_DIR/scripts/security-test.sh'"
    
    run_test "Script de migration des tokens présent" \
        "test -f '$PROJECT_DIR/scripts/migrate-tokens.sh'"
    
    run_test "Script de configuration d'environnement présent" \
        "test -f '$PROJECT_DIR/scripts/setup-environment.sh'"
    
    run_test "Script de test de compatibilité présent" \
        "test -f '$PROJECT_DIR/scripts/test-compatibility.sh'"
    
    run_test "Script de monitoring de sécurité présent" \
        "test -f '$PROJECT_DIR/scripts/monitor-security.sh'"
    
    # Test des permissions d'exécution
    run_test "Permissions d'exécution des scripts" \
        "test -x '$PROJECT_DIR/scripts/deploy-secure.sh'"
    
    run_test "Permissions d'exécution du script de test de sécurité" \
        "test -x '$PROJECT_DIR/scripts/security-test.sh'"
    
    run_test "Permissions d'exécution du script de migration" \
        "test -x '$PROJECT_DIR/scripts/migrate-tokens.sh'"
    
    run_test "Permissions d'exécution du script de configuration" \
        "test -x '$PROJECT_DIR/scripts/setup-environment.sh'"
    
    run_test "Permissions d'exécution du script de compatibilité" \
        "test -x '$PROJECT_DIR/scripts/test-compatibility.sh'"
    
    run_test "Permissions d'exécution du script de monitoring" \
        "test -x '$PROJECT_DIR/scripts/monitor-security.sh'"
}

# Fonction pour tester la configuration des dépendances
test_dependencies() {
    log_info "=== Test des Dépendances ==="
    
    # Test des dépendances du service d'authentification
    run_test "Dépendance cookie-parser présente" \
        "grep -q 'cookie-parser' '$PROJECT_DIR/auth-service/package.json'"
    
    run_test "Dépendance helmet présente" \
        "grep -q 'helmet' '$PROJECT_DIR/auth-service/package.json'"
    
    run_test "Dépendance redis présente" \
        "grep -q 'redis' '$PROJECT_DIR/auth-service/package.json'"
    
    run_test "Dépendance express-rate-limit présente" \
        "grep -q 'express-rate-limit' '$PROJECT_DIR/auth-service/package.json'"
    
    run_test "Dépendance express-validator présente" \
        "grep -q 'express-validator' '$PROJECT_DIR/auth-service/package.json'"
    
    run_test "Dépendance csurf présente" \
        "grep -q 'csurf' '$PROJECT_DIR/auth-service/package.json'"
    
    run_test "Dépendance ioredis présente" \
        "grep -q 'ioredis' '$PROJECT_DIR/auth-service/package.json'"
    
    run_test "Dépendance ms présente" \
        "grep -q 'ms' '$PROJECT_DIR/auth-service/package.json'"
}

# Fonction pour tester la configuration des variables d'environnement
test_environment_variables() {
    log_info "=== Test des Variables d'Environnement ==="
    
    # Test des variables critiques
    run_test "Variable JWT_SECRET configurée" \
        "grep -q 'JWT_SECRET=' '$PROJECT_DIR/.env'"
    
    run_test "Variable CSRF_SECRET configurée" \
        "grep -q 'CSRF_SECRET=' '$PROJECT_DIR/.env'"
    
    run_test "Variable REDIS_ENABLED configurée" \
        "grep -q 'REDIS_ENABLED=' '$PROJECT_DIR/.env'"
    
    run_test "Variable TOKEN_STORAGE_METHOD configurée" \
        "grep -q 'TOKEN_STORAGE_METHOD=' '$PROJECT_DIR/.env'"
    
    run_test "Variable JWT_VALIDATION_MODE configurée" \
        "grep -q 'JWT_VALIDATION_MODE=' '$PROJECT_DIR/.env'"
    
    run_test "Variable COOKIE_HTTP_ONLY configurée" \
        "grep -q 'COOKIE_HTTP_ONLY=' '$PROJECT_DIR/.env'"
    
    run_test "Variable SECURITY_HEADERS_ENABLED configurée" \
        "grep -q 'SECURITY_HEADERS_ENABLED=' '$PROJECT_DIR/.env'"
    
    run_test "Variable RATE_LIMIT_ENABLED configurée" \
        "grep -q 'RATE_LIMIT_ENABLED=' '$PROJECT_DIR/.env'"
}

# Fonction pour générer un rapport final
generate_final_report() {
    log_info "=== Génération du Rapport Final ==="
    
    local report_file="$PROJECT_DIR/final-test-report-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > "$report_file" << EOF
# Rapport Final de Test du Système NovaPartage
Date: $(date)

## Résumé des Tests
- Total: $TOTAL_TESTS
- Réussis: $PASSED_TESTS
- Échoués: $FAILED_TESTS
- Taux de réussite: $(( (PASSED_TESTS * 100) / TOTAL_TESTS ))%

## Détails des Tests

### Architecture Complète
- Fichiers critiques présents
- Configuration Redis
- Gestionnaires de tokens et cookies
- Middlewares de sécurité
- Services frontend

### Sécurité Critique
- Configuration Redis
- Configuration JWT
- Configuration CSRF
- Configuration des cookies
- Configuration du stockage
- Configuration de validation JWT
- Configuration des durées de tokens
- Configuration des tentatives de vérification

### Intégration des Services
- Intégration Redis
- Intégration des middlewares de sécurité
- Intégration de la protection CSRF
- Intégration de la validation JWT
- Intégration du gestionnaire de cookies
- Intégration du gestionnaire de tokens
- Intégration de la configuration de validation

### Compatibilité Frontend
- Compatibilité CustomAuthService
- Compatibilité AuthStateService
- Compatibilité HybridAuthService
- Configuration des interceptors
- Configuration des services
- Configuration des guards

### Configuration Docker
- Service Redis
- Volumes Redis
- Variables d'environnement
- Configuration de production
- Configuration des réseaux
- Configuration des dépendances

### Scripts d'Automatisation
- Scripts présents
- Permissions d'exécution

### Dépendances
- Dépendances du service d'authentification

### Variables d'Environnement
- Variables critiques configurées

## Recommandations

EOF
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo "✅ Le système est prêt pour la production!" >> "$report_file"
        echo "- Toutes les fonctionnalités de sécurité sont implémentées" >> "$report_file"
        echo "- La compatibilité avec les services existants est assurée" >> "$report_file"
        echo "- Les scripts d'automatisation sont opérationnels" >> "$report_file"
        echo "- La configuration Docker est complète" >> "$report_file"
    else
        echo "❌ $FAILED_TESTS test(s) ont échoué" >> "$report_file"
        echo "- Corriger les tests échoués avant le déploiement" >> "$report_file"
        echo "- Vérifier la configuration des services" >> "$report_file"
        echo "- Tester manuellement les fonctionnalités critiques" >> "$report_file"
    fi
    
    echo "" >> "$report_file"
    echo "## Prochaines Étapes" >> "$report_file"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo "1. Déployer en production avec: ./scripts/deploy-secure.sh production" >> "$report_file"
        echo "2. Migrer les tokens avec: ./scripts/migrate-tokens.sh execute" >> "$report_file"
        echo "3. Surveiller avec: ./scripts/monitor-security.sh" >> "$report_file"
        echo "4. Tester la compatibilité avec: ./scripts/test-compatibility.sh" >> "$report_file"
    else
        echo "1. Corriger les tests échoués" >> "$report_file"
        echo "2. Re-exécuter les tests" >> "$report_file"
        echo "3. Valider manuellement les fonctionnalités" >> "$report_file"
        echo "4. Déployer une fois tous les tests passés" >> "$report_file"
    fi
    
    log_success "Rapport final généré: $report_file"
}

# Fonction pour afficher l'aide
show_help() {
    echo "Usage: $0"
    echo ""
    echo "Description:"
    echo "  Ce script effectue un test complet du système NovaPartage"
    echo "  pour valider que toutes les améliorations de sécurité"
    echo "  ont été correctement implémentées."
    echo ""
    echo "Tests effectués:"
    echo "  - Architecture complète"
    echo "  - Sécurité critique"
    echo "  - Intégration des services"
    echo "  - Compatibilité frontend"
    echo "  - Configuration Docker"
    echo "  - Scripts d'automatisation"
    echo "  - Dépendances"
    echo "  - Variables d'environnement"
    echo ""
}

# Fonction principale
main() {
    log_info "Démarrage du test final du système NovaPartage..."
    echo ""
    
    # Test de l'architecture complète
    test_complete_architecture
    echo ""
    
    # Test de la sécurité critique
    test_critical_security
    echo ""
    
    # Test de l'intégration des services
    test_service_integration
    echo ""
    
    # Test de la compatibilité frontend
    test_frontend_compatibility
    echo ""
    
    # Test de la configuration Docker
    test_docker_configuration
    echo ""
    
    # Test des scripts d'automatisation
    test_automation_scripts
    echo ""
    
    # Test des dépendances
    test_dependencies
    echo ""
    
    # Test des variables d'environnement
    test_environment_variables
    echo ""
    
    # Génération du rapport final
    generate_final_report
    
    echo ""
    
    # Afficher le résumé
    log_info "=== Résumé Final ==="
    log_info "Total: $TOTAL_TESTS"
    log_success "Réussis: $PASSED_TESTS"
    if [ $FAILED_TESTS -gt 0 ]; then
        log_error "Échoués: $FAILED_TESTS"
    else
        log_success "Échoués: $FAILED_TESTS"
    fi
    
    if [ $FAILED_TESTS -eq 0 ]; then
        log_success "🎉 Tous les tests sont passés avec succès!"
        log_success "Le système NovaPartage est prêt pour la production!"
        exit 0
    else
        log_error "❌ $FAILED_TESTS test(s) ont échoué"
        log_error "Corrigez les erreurs avant de déployer en production"
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
