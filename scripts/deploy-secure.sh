#!/bin/bash

# ===========================================
# Script de Déploiement Sécurisé NovaPartage
# ===========================================

set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-development}
PROJECT_DIR="/home/msoriano/DDS/git/datadesic/ddsshare"
BACKUP_DIR="$PROJECT_DIR/backups/$(date +%Y%m%d-%H%M%S)"

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

# Fonction pour vérifier les prérequis
check_prerequisites() {
    log_info "Vérification des prérequis..."
    
    # Vérifier Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker n'est pas installé"
        exit 1
    fi
    
    # Vérifier Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose n'est pas installé"
        exit 1
    fi
    
    # Vérifier que nous sommes dans le bon répertoire
    if [ ! -f "$PROJECT_DIR/docker-compose.yml" ]; then
        log_error "Fichier docker-compose.yml non trouvé dans $PROJECT_DIR"
        exit 1
    fi
    
    log_success "Prérequis vérifiés"
}

# Fonction pour créer une sauvegarde
create_backup() {
    log_info "Création d'une sauvegarde..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Sauvegarder les volumes Docker
    if [ "$ENVIRONMENT" = "production" ]; then
        log_info "Sauvegarde des volumes de production..."
        
        # Sauvegarder Redis
        if docker volume ls | grep -q "novapartage_redis_data"; then
            docker run --rm -v novapartage_redis_data:/data -v "$BACKUP_DIR":/backup alpine tar czf /backup/redis_data.tar.gz -C /data .
            log_success "Sauvegarde Redis créée"
        fi
        
        # Sauvegarder PostgreSQL
        if docker volume ls | grep -q "novapartage_postgres_data"; then
            docker run --rm -v novapartage_postgres_data:/data -v "$BACKUP_DIR":/backup alpine tar czf /backup/postgres_data.tar.gz -C /data .
            log_success "Sauvegarde PostgreSQL créée"
        fi
        
        # Sauvegarder MongoDB
        if docker volume ls | grep -q "novapartage_mongodb_data"; then
            docker run --rm -v novapartage_mongodb_data:/data -v "$BACKUP_DIR":/backup alpine tar czf /backup/mongodb_data.tar.gz -C /data .
            log_success "Sauvegarde MongoDB créée"
        fi
    fi
    
    log_success "Sauvegarde créée dans $BACKUP_DIR"
}

# Fonction pour valider la configuration
validate_config() {
    log_info "Validation de la configuration..."
    
    # Vérifier les fichiers d'environnement
    if [ "$ENVIRONMENT" = "production" ]; then
        if [ ! -f "$PROJECT_DIR/.env" ]; then
            log_error "Fichier .env manquant pour la production"
            exit 1
        fi
        
        # Vérifier les variables critiques
        source "$PROJECT_DIR/.env"
        
        if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "your-super-secret-jwt-key-change-in-production" ]; then
            log_error "JWT_SECRET doit être configuré pour la production"
            exit 1
        fi
        
        if [ -z "$REDIS_PASSWORD" ]; then
            log_error "REDIS_PASSWORD doit être configuré pour la production"
            exit 1
        fi
        
        if [ -z "$CSRF_SECRET" ] || [ "$CSRF_SECRET" = "your-csrf-secret-key" ]; then
            log_error "CSRF_SECRET doit être configuré pour la production"
            exit 1
        fi
        
        log_success "Configuration de production validée"
    else
        log_info "Mode développement - validation basique"
    fi
}

# Fonction pour arrêter les services existants
stop_services() {
    log_info "Arrêt des services existants..."
    
    cd "$PROJECT_DIR"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        docker-compose -f docker-compose.prod.yml down
    else
        docker-compose down
    fi
    
    log_success "Services arrêtés"
}

# Fonction pour construire et démarrer les services
start_services() {
    log_info "Construction et démarrage des services..."
    
    cd "$PROJECT_DIR"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        # Mode production
        log_info "Déploiement en mode production..."
        
        # Construire les images
        docker-compose -f docker-compose.prod.yml build --no-cache
        
        # Démarrer les services
        docker-compose -f docker-compose.prod.yml up -d
        
        # Attendre que les services soient prêts
        log_info "Attente du démarrage des services..."
        sleep 30
        
        # Vérifier la santé des services
        check_services_health
        
    else
        # Mode développement
        log_info "Déploiement en mode développement..."
        
        # Démarrer les services
        docker-compose up -d
        
        # Attendre que les services soient prêts
        log_info "Attente du démarrage des services..."
        sleep 15
        
        # Vérifier la santé des services
        check_services_health
    fi
    
    log_success "Services démarrés"
}

# Fonction pour vérifier la santé des services
check_services_health() {
    log_info "Vérification de la santé des services..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log_info "Tentative $attempt/$max_attempts..."
        
        # Vérifier le service d'authentification
        if curl -s -f "http://localhost:3001/health" > /dev/null; then
            log_success "Service d'authentification en ligne"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            log_error "Service d'authentification non accessible après $max_attempts tentatives"
            exit 1
        fi
        
        sleep 2
        attempt=$((attempt + 1))
    done
    
    # Vérifier Redis
    if docker exec novapartage-redis redis-cli ping > /dev/null 2>&1; then
        log_success "Redis en ligne"
    else
        log_warning "Redis non accessible"
    fi
    
    # Vérifier PostgreSQL
    if docker exec novapartage-db pg_isready -U novapartage > /dev/null 2>&1; then
        log_success "PostgreSQL en ligne"
    else
        log_warning "PostgreSQL non accessible"
    fi
    
    # Vérifier MongoDB
    if docker exec novapartage-mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
        log_success "MongoDB en ligne"
    else
        log_warning "MongoDB non accessible"
    fi
}

# Fonction pour exécuter les tests de sécurité
run_security_tests() {
    log_info "Exécution des tests de sécurité..."
    
    if [ -f "$PROJECT_DIR/scripts/security-test.sh" ]; then
        "$PROJECT_DIR/scripts/security-test.sh"
        log_success "Tests de sécurité terminés"
    else
        log_warning "Script de test de sécurité non trouvé"
    fi
}

# Fonction pour nettoyer les ressources
cleanup() {
    log_info "Nettoyage des ressources..."
    
    # Nettoyer les images Docker inutilisées
    docker image prune -f
    
    # Nettoyer les conteneurs arrêtés
    docker container prune -f
    
    # Nettoyer les volumes inutilisés (seulement en développement)
    if [ "$ENVIRONMENT" = "development" ]; then
        docker volume prune -f
    fi
    
    log_success "Nettoyage terminé"
}

# Fonction pour afficher les informations de déploiement
show_deployment_info() {
    log_info "Informations de déploiement:"
    echo ""
    echo "Environment: $ENVIRONMENT"
    echo "Project Directory: $PROJECT_DIR"
    echo "Backup Directory: $BACKUP_DIR"
    echo ""
    echo "Services déployés:"
    echo "- Service d'authentification: http://localhost:3001"
    echo "- Frontend: http://localhost:3000"
    echo "- Redis: localhost:6379"
    echo "- PostgreSQL: localhost:5432"
    echo "- MongoDB: localhost:27017"
    echo ""
    echo "Commandes utiles:"
    echo "- Voir les logs: docker-compose logs -f"
    echo "- Arrêter les services: docker-compose down"
    echo "- Redémarrer un service: docker-compose restart <service>"
    echo ""
    echo "Tests de sécurité:"
    echo "- Exécuter: $PROJECT_DIR/scripts/security-test.sh"
    echo ""
}

# Fonction pour gérer les erreurs
handle_error() {
    log_error "Erreur lors du déploiement"
    log_info "Tentative de restauration..."
    
    # Arrêter les services
    cd "$PROJECT_DIR"
    if [ "$ENVIRONMENT" = "production" ]; then
        docker-compose -f docker-compose.prod.yml down
    else
        docker-compose down
    fi
    
    log_error "Déploiement échoué. Consultez les logs pour plus de détails."
    exit 1
}

# Configuration du gestionnaire d'erreurs
trap handle_error ERR

# Fonction principale
main() {
    log_info "Démarrage du déploiement sécurisé NovaPartage..."
    log_info "Environnement: $ENVIRONMENT"
    echo ""
    
    # Vérifier les prérequis
    check_prerequisites
    echo ""
    
    # Créer une sauvegarde
    create_backup
    echo ""
    
    # Valider la configuration
    validate_config
    echo ""
    
    # Arrêter les services existants
    stop_services
    echo ""
    
    # Démarrer les services
    start_services
    echo ""
    
    # Exécuter les tests de sécurité
    run_security_tests
    echo ""
    
    # Nettoyer les ressources
    cleanup
    echo ""
    
    # Afficher les informations de déploiement
    show_deployment_info
    
    log_success "Déploiement sécurisé terminé avec succès!"
}

# Afficher l'aide
show_help() {
    echo "Usage: $0 [ENVIRONMENT]"
    echo ""
    echo "ENVIRONMENT:"
    echo "  development  Déploiement en mode développement (défaut)"
    echo "  production   Déploiement en mode production"
    echo ""
    echo "Exemples:"
    echo "  $0                    # Déploiement en développement"
    echo "  $0 development        # Déploiement en développement"
    echo "  $0 production         # Déploiement en production"
    echo ""
}

# Vérifier les arguments
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

# Vérifier l'environnement
if [ "$ENVIRONMENT" != "development" ] && [ "$ENVIRONMENT" != "production" ]; then
    log_error "Environnement invalide: $ENVIRONMENT"
    log_error "Utilisez 'development' ou 'production'"
    exit 1
fi

# Exécuter le script principal
main "$@"

