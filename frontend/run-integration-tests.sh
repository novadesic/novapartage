#!/bin/bash

# Script de lancement des tests d'intégration pour NovaPartage
# Utilise docker-compose.yml et Cypress (auth magic link — pas Keycloak)

set -e  # Arrêter le script en cas d'erreur

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCKER_COMPOSE_FILE="../docker-compose.yml"
CYPRESS_CONFIG="cypress.config.integration.ts"
TEST_RESULTS_DIR="cypress/results"
VIDEOS_DIR="cypress/videos"
SCREENSHOTS_DIR="cypress/screenshots"

# Fonction pour afficher les messages
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

# Fonction pour vérifier les prérequis
check_prerequisites() {
    log_info "Vérification des prérequis..."
    
    # Vérifier que Docker est installé
    if ! command -v docker &> /dev/null; then
        log_error "Docker n'est pas installé ou n'est pas dans le PATH"
        exit 1
    fi
    
    # Vérifier que Docker Compose est installé
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose n'est pas installé ou n'est pas dans le PATH"
        exit 1
    fi
    
    # Vérifier que Node.js est installé
    if ! command -v node &> /dev/null; then
        log_error "Node.js n'est pas installé ou n'est pas dans le PATH"
        exit 1
    fi
    
    # Vérifier que npm est installé
    if ! command -v npm &> /dev/null; then
        log_error "npm n'est pas installé ou n'est pas dans le PATH"
        exit 1
    fi
    
    # Vérifier que le fichier docker-compose.yml existe
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
        log_error "Le fichier docker-compose.yml n'existe pas: $DOCKER_COMPOSE_FILE"
        exit 1
    fi
    
    log_success "Tous les prérequis sont satisfaits"
}

# Fonction pour démarrer les services Docker
start_docker_services() {
    log_info "Démarrage des services Docker..."
    
    cd "$(dirname "$DOCKER_COMPOSE_FILE")"
    
    # Vérifier si les services sont déjà en cours d'exécution
    if docker-compose ps | grep -q "Up"; then
        log_info "Services déjà en cours d'exécution, utilisation de la configuration existante"
    else
        # Démarrer les services sans supprimer les volumes existants
        log_info "Démarrage des services..."
        docker-compose up -d
        
        # Attendre que les services soient prêts
        log_info "Attente que les services soient prêts..."
        sleep 30
    fi
    
    # Vérifier que les services sont en cours d'exécution
    if ! docker-compose ps | grep -q "Up"; then
        log_error "Les services Docker ne sont pas démarrés correctement"
        docker-compose logs
        exit 1
    fi
    
    log_success "Services Docker démarrés avec succès"
    cd - > /dev/null
}

# Fonction pour attendre que les services soient prêts
wait_for_services() {
    log_info "Attente que les services soient prêts..."
    
    # Auth-service (magic link) via nginx ou port direct
    log_info "Attente de l'auth-service..."
    timeout=120
    while [ $timeout -gt 0 ]; do
        if curl -s -o /dev/null -w "%{http_code}" http://localhost/auth/ 2>/dev/null | grep -qE '200|401|403|404'; then
            break
        fi
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/ 2>/dev/null | grep -qE '200|401|403|404'; then
            break
        fi
        sleep 5
        timeout=$((timeout - 5))
    done
    
    if [ $timeout -le 0 ]; then
        log_warning "Auth-service n'est pas encore prêt, mais on continue..."
    else
        log_success "Auth-service joignable"
    fi
    
    # Backend Quarkus
    log_info "Attente du backend..."
    timeout=90
    while [ $timeout -gt 0 ]; do
        if curl -s -o /dev/null -w "%{http_code}" http://localhost/backend/openapi 2>/dev/null | grep -qE '200'; then
            break
        fi
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:8083/openapi 2>/dev/null | grep -qE '200'; then
            break
        fi
        sleep 5
        timeout=$((timeout - 5))
    done
    
    if [ $timeout -le 0 ]; then
        log_warning "Backend n'est pas encore prêt, mais on continue..."
    else
        log_success "Backend joignable"
    fi
}

# Fonction pour vérifier et installer les dépendances si nécessaire
install_dependencies() {
    log_info "Vérification des dépendances..."
    
    # Si l'installation forcée est demandée
    if [ "$FORCE_INSTALL" = true ]; then
        log_info "Installation forcée des dépendances..."
        if [ ! -d "node_modules" ]; then
            npm install
        else
            npm ci
        fi
        log_success "Dépendances installées"
        return 0
    fi
    
    # Vérifier si node_modules existe et si Cypress est disponible
    if [ -d "node_modules" ] && [ -f "node_modules/.bin/cypress" ]; then
        log_success "Dépendances déjà installées et Cypress disponible"
        return 0
    fi
    
    # Vérifier si le frontend fonctionne déjà (via nginx reverse proxy)
    if curl -s http://localhost > /dev/null 2>&1; then
        log_success "Frontend déjà en cours d'exécution via nginx sur http://localhost"
        log_info "Utilisation des dépendances existantes"
        return 0
    fi
    
    # Vérifier aussi le port direct au cas où
    if curl -s http://localhost:4200 > /dev/null 2>&1; then
        log_success "Frontend déjà en cours d'exécution sur le port 4200"
        log_info "Utilisation des dépendances existantes"
        return 0
    fi
    
    # Seulement installer si vraiment nécessaire
    log_info "Installation des dépendances..."
    
    if [ ! -d "node_modules" ]; then
        npm install
    else
        npm ci
    fi
    
    log_success "Dépendances installées"
}

# Fonction pour lancer les tests
run_tests() {
    log_info "Lancement des tests d'intégration..."
    
    # Créer le répertoire des résultats s'il n'existe pas
    mkdir -p "$TEST_RESULTS_DIR"
    mkdir -p "$VIDEOS_DIR"
    mkdir -p "$SCREENSHOTS_DIR"
    
    # Lancer les tests avec la configuration d'intégration
    if npx cypress run --config-file "$CYPRESS_CONFIG" --record false; then
        log_success "Tests d'intégration terminés avec succès"
        return 0
    else
        log_error "Tests d'intégration échoués"
        return 1
    fi
}

# Fonction pour lancer Cypress en mode UI
run_tests_ui() {
    log_info "Lancement de Cypress en mode UI..."
    
    # Créer le répertoire des résultats s'il n'existe pas
    mkdir -p "$TEST_RESULTS_DIR"
    mkdir -p "$VIDEOS_DIR"
    mkdir -p "$SCREENSHOTS_DIR"
    
    # Choisir la configuration selon le mode
    local config_file="$CYPRESS_CONFIG"
    if [[ "$SLOW_MODE" == "true" ]]; then
        config_file="cypress.config.integration-ui.ts"
        log_info "Mode lent activé - utilisation de la configuration lente"
    fi
    
    log_info "Ouverture de l'interface Cypress..."
    log_info "Dans l'interface Cypress:"
    log_info "1. Sélectionnez 'E2E Testing'"
    log_info "2. Choisissez votre navigateur préféré"
    log_info "3. Cliquez sur 'Start E2E Testing'"
    log_info "4. Les tests d'intégration se trouvent dans: cypress/e2e/integration/"
    if [[ "$SLOW_MODE" == "true" ]]; then
        log_info "5. ⏱️ Mode lent activé - tests plus lents pour observation"
    fi
    log_info ""
    log_info "Appuyez sur Ctrl+C pour fermer Cypress"
    
    # Lancer Cypress en mode UI avec la configuration appropriée
    npx cypress open --config-file "$config_file"
}

# Fonction pour nettoyer
cleanup() {
    log_info "Nettoyage..."
    
    # Note: Cette fonction n'arrête PAS les services pour préserver les données
    # Les services continuent de fonctionner avec vos données existantes
    log_info "Les services Docker restent actifs pour préserver vos données"
    log_info "Pour arrêter manuellement: cd ../ && docker-compose down"
    
    log_success "Nettoyage terminé (services préservés)"
}

# Fonction pour afficher l'aide
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Afficher cette aide"
    echo "  -s, --start-only    Démarrer seulement les services Docker"
    echo "  -t, --test-only     Lancer seulement les tests (services déjà démarrés)"
    echo "  -u, --ui            Lancer Cypress en mode UI (interface graphique)"
    echo "  --slow-ui           Lancer Cypress en mode UI avec exécution lente des tests"
    echo "  -c, --cleanup-only  Arrêter seulement les services Docker (PRÉSERVE les données)"
    echo "  -f, --force-stop    Arrêter les services ET supprimer les volumes (ATTENTION!)"
    echo "  -i, --force-install Forcer l'installation des dépendances"
    echo "  -v, --verbose       Mode verbeux"
    echo ""
    echo "Exemples:"
    echo "  $0                  # Lancer tous les tests d'intégration"
    echo "  $0 --start-only     # Démarrer seulement les services"
    echo "  $0 --test-only      # Lancer seulement les tests"
    echo "  $0 --ui             # Lancer Cypress en mode UI"
    echo "  $0 --slow-ui        # Lancer Cypress en mode UI avec tests lents"
    echo "  $0 --cleanup-only   # Arrêter les services (préserve les données)"
    echo "  $0 --force-stop     # Arrêter et supprimer tout (ATTENTION!)"
    echo "  $0 --force-install  # Forcer l'installation des dépendances"
    echo ""
    echo "Note: Par défaut, les données de la base sont préservées."
    echo "Note: Les dépendances ne sont installées que si nécessaire."
}

# Variables pour les options
START_ONLY=false
TEST_ONLY=false
TEST_UI=false
CLEANUP_ONLY=false
FORCE_STOP=false
FORCE_INSTALL=false
VERBOSE=false

# Parsing des arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -s|--start-only)
            START_ONLY=true
            shift
            ;;
        -t|--test-only)
            TEST_ONLY=true
            shift
            ;;
        -u|--ui)
            TEST_UI=true
            shift
            ;;
        --slow-ui)
            TEST_UI=true
            SLOW_MODE=true
            shift
            ;;
        -c|--cleanup-only)
            CLEANUP_ONLY=true
            shift
            ;;
        -f|--force-stop)
            FORCE_STOP=true
            shift
            ;;
        -i|--force-install)
            FORCE_INSTALL=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        *)
            log_error "Option inconnue: $1"
            show_help
            exit 1
            ;;
    esac
done

# Configuration du mode verbeux
if [ "$VERBOSE" = true ]; then
    set -x
fi

# Traitement principal
main() {
    log_info "Démarrage des tests d'intégration DDS Share"
    
    # Vérifier les prérequis
    check_prerequisites
    
    if [ "$CLEANUP_ONLY" = true ]; then
        cleanup
        exit 0
    fi
    
    if [ "$FORCE_STOP" = true ]; then
        log_warning "ATTENTION: Arrêt forcé avec suppression des volumes!"
        cd "$(dirname "$DOCKER_COMPOSE_FILE")"
        docker-compose down -v
        cd - > /dev/null
        log_success "Services arrêtés et volumes supprimés"
        exit 0
    fi
    
    if [ "$START_ONLY" = true ]; then
        start_docker_services
        wait_for_services
        log_success "Services démarrés. Vous pouvez maintenant lancer les tests avec --test-only"
        exit 0
    fi
    
    if [ "$TEST_ONLY" = true ]; then
        install_dependencies
        run_tests
        exit $?
    fi
    
    if [ "$TEST_UI" = true ]; then
        install_dependencies
        run_tests_ui
        exit $?
    fi
    
    # Mode complet
    start_docker_services
    wait_for_services
    install_dependencies
    run_tests
    test_result=$?
    # Note: Pas de cleanup automatique pour préserver les données
    log_info "Tests terminés. Les services Docker restent actifs avec vos données."
    log_info "Pour arrêter manuellement: cd ../ && docker-compose down"
    exit $test_result
}

# Gestion des signaux pour le nettoyage
trap cleanup EXIT
trap 'log_error "Interruption détectée"; cleanup; exit 1' INT TERM

# Lancer le script principal
main
