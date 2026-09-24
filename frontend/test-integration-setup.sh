#!/bin/bash

# Script de test rapide pour vérifier la configuration des tests d'intégration

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

echo "=========================================="
echo "Test de Configuration - Tests d'Intégration"
echo "=========================================="

# Vérifier les fichiers de configuration
log_info "Vérification des fichiers de configuration..."

# Vérifier cypress.config.integration.ts
if [ -f "cypress.config.integration.ts" ]; then
    log_success "✓ cypress.config.integration.ts trouvé"
else
    log_error "✗ cypress.config.integration.ts manquant"
    exit 1
fi

# Vérifier les commandes d'intégration
if [ -f "cypress/support/integration-commands.ts" ]; then
    log_success "✓ integration-commands.ts trouvé"
else
    log_error "✗ integration-commands.ts manquant"
    exit 1
fi

# Vérifier les tests d'intégration
if [ -d "cypress/e2e/integration" ]; then
    log_success "✓ Répertoire integration trouvé"
    
    # Compter les fichiers de test
    test_count=$(find cypress/e2e/integration -name "*.cy.ts" | wc -l)
    log_info "Nombre de fichiers de test: $test_count"
    
    # Lister les fichiers de test
    for file in cypress/e2e/integration/*.cy.ts; do
        if [ -f "$file" ]; then
            log_success "✓ $(basename "$file")"
        fi
    done
else
    log_error "✗ Répertoire integration manquant"
    exit 1
fi

# Vérifier le script principal
if [ -f "run-integration-tests.sh" ]; then
    log_success "✓ run-integration-tests.sh trouvé"
    
    # Vérifier les permissions
    if [ -x "run-integration-tests.sh" ]; then
        log_success "✓ run-integration-tests.sh exécutable"
    else
        log_warning "! run-integration-tests.sh n'est pas exécutable"
        chmod +x run-integration-tests.sh
        log_success "✓ Permissions corrigées"
    fi
else
    log_error "✗ run-integration-tests.sh manquant"
    exit 1
fi

# Vérifier le package.json
if [ -f "package.json" ]; then
    log_success "✓ package.json trouvé"
    
    # Vérifier les scripts d'intégration
    if grep -q "test:integration" package.json; then
        log_success "✓ Scripts d'intégration présents dans package.json"
    else
        log_warning "! Scripts d'intégration manquants dans package.json"
    fi
else
    log_error "✗ package.json manquant"
    exit 1
fi

# Vérifier le docker-compose.yml
if [ -f "../docker-compose.yml" ]; then
    log_success "✓ docker-compose.yml trouvé"
else
    log_error "✗ docker-compose.yml manquant"
    exit 1
fi

# Vérifier les prérequis système
log_info "Vérification des prérequis système..."

# Docker
if command -v docker &> /dev/null; then
    docker_version=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
    log_success "✓ Docker installé (version $docker_version)"
else
    log_error "✗ Docker non installé"
fi

# Docker Compose
if command -v docker-compose &> /dev/null; then
    compose_version=$(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1)
    log_success "✓ Docker Compose installé (version $compose_version)"
else
    log_error "✗ Docker Compose non installé"
fi

# Node.js
if command -v node &> /dev/null; then
    node_version=$(node --version)
    log_success "✓ Node.js installé (version $node_version)"
else
    log_error "✗ Node.js non installé"
fi

# npm
if command -v npm &> /dev/null; then
    npm_version=$(npm --version)
    log_success "✓ npm installé (version $npm_version)"
else
    log_error "✗ npm non installé"
fi

# curl
if command -v curl &> /dev/null; then
    log_success "✓ curl installé"
else
    log_warning "! curl non installé (nécessaire pour les vérifications de santé)"
fi

# Vérifier les ports
log_info "Vérification de la disponibilité des ports..."

ports=(4200 8080 8081 27017)
for port in "${ports[@]}"; do
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        log_warning "! Port $port déjà utilisé"
    else
        log_success "✓ Port $port disponible"
    fi
done

# Vérifier les dépendances npm
log_info "Vérification des dépendances npm..."

if [ -d "node_modules" ]; then
    log_success "✓ node_modules présent"
    
    # Vérifier Cypress
    if [ -d "node_modules/cypress" ]; then
        cypress_version=$(npx cypress --version 2>/dev/null | head -n1 | cut -d' ' -f2 || echo "inconnue")
        log_success "✓ Cypress installé (version $cypress_version)"
    else
        log_warning "! Cypress non installé"
    fi
else
    log_warning "! node_modules manquant (exécutez 'npm install')"
fi

# Test de validation de la configuration Cypress
log_info "Validation de la configuration Cypress..."

if npx cypress verify --config-file cypress.config.integration.ts >/dev/null 2>&1; then
    log_success "✓ Configuration Cypress valide"
else
    log_warning "! Configuration Cypress invalide"
fi

echo ""
echo "=========================================="
echo "Résumé de la Configuration"
echo "=========================================="

# Compter les erreurs et avertissements
error_count=$(grep -c "✗" <<< "$(cat $0)")
warning_count=$(grep -c "!" <<< "$(cat $0)")

if [ $error_count -eq 0 ]; then
    log_success "Configuration complète et prête pour les tests d'intégration"
    echo ""
    echo "Pour lancer les tests :"
    echo "  npm run test:integration"
    echo "  ou"
    echo "  ./run-integration-tests.sh"
else
    log_error "Configuration incomplète ($error_count erreur(s), $warning_count avertissement(s))"
    echo ""
    echo "Veuillez corriger les erreurs avant de lancer les tests"
fi

echo ""
echo "Documentation : README_INTEGRATION_TESTS.md"











