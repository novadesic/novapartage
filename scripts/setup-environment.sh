#!/bin/bash

# ===========================================
# Script de Configuration d'Environnement NovaPartage
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
ENVIRONMENT=${1:-development}

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

# Fonction pour générer une clé sécurisée
generate_secure_key() {
    local length=${1:-64}
    openssl rand -hex $length
}

# Fonction pour configurer l'environnement de développement
setup_development() {
    log_info "Configuration de l'environnement de développement..."
    
    local env_file="$PROJECT_DIR/.env"
    
    # Créer le fichier .env s'il n'existe pas
    if [ ! -f "$env_file" ]; then
        log_info "Création du fichier .env pour le développement..."
        
        cat > "$env_file" << EOF
# ===========================================
# Configuration NovaPartage - Développement
# ===========================================

# Configuration de base
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug

# Configuration JWT
JWT_SECRET=$(generate_secure_key 32)
JWT_EXPIRES_IN=1h
JWT_ALGORITHM=HS256
JWT_ISSUER=novapartage-auth
JWT_AUDIENCE=novapartage-frontend

# Configuration Redis (désactivé en développement)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_ENABLED=false

# Configuration CSRF
CSRF_SECRET=$(generate_secure_key 32)

# Configuration Sécurité (relaxée pour le développement)
SECURITY_HEADERS_ENABLED=true
RATE_LIMIT_ENABLED=true
CSP_ENABLED=false
HSTS_ENABLED=false

# Configuration CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4200

# Configuration URLs
FRONTEND_URL=http://localhost:3000
AUTH_CALLBACK_URL=http://localhost:3001/callback

# Configuration SMTP (développement - utilise un service de test)
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=ethereal.user@ethereal.email
SMTP_PASS=ethereal.pass
SMTP_FROM=noreply@novapartage.dev

# Configuration Email
EMAIL_SUBJECT=Lien de connexion NovaPartage (Développement)

# Configuration Rate Limiting (relaxée pour le développement)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX_REQUESTS=50
EMAIL_RATE_LIMIT_WINDOW_MS=3600000
EMAIL_RATE_LIMIT_MAX_REQUESTS=100

# Configuration Cookies (relaxée pour le développement)
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
COOKIE_DOMAIN=localhost
COOKIE_HTTP_ONLY=true
COOKIE_MAX_AGE=3600000

# Configuration Stockage (localStorage pour le développement)
TOKEN_STORAGE_METHOD=localStorage
JWT_VALIDATION_MODE=client

# Configuration Tokens
TEMP_TOKEN_EXPIRES_IN=1h
VERIFICATION_CODE_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
MAX_VERIFICATION_ATTEMPTS=5

EOF
        
        log_success "Fichier .env créé pour le développement"
    else
        log_warning "Fichier .env existe déjà"
    fi
    
    # Vérifier que les dépendances sont installées
    if [ -f "$PROJECT_DIR/auth-service/package.json" ]; then
        log_info "Installation des dépendances du service d'authentification..."
        cd "$PROJECT_DIR/auth-service"
        npm install
        log_success "Dépendances installées"
    fi
    
    log_success "Environnement de développement configuré"
}

# Fonction pour configurer l'environnement de production
setup_production() {
    log_info "Configuration de l'environnement de production..."
    
    local env_file="$PROJECT_DIR/.env"
    
    # Vérifier si le fichier .env existe
    if [ -f "$env_file" ]; then
        log_warning "Fichier .env existe déjà"
        read -p "Voulez-vous le remplacer? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Configuration de production annulée"
            return 0
        fi
    fi
    
    # Demander les informations de configuration
    log_info "Configuration des paramètres de production..."
    
    # Domaine de production
    read -p "Domaine de production (ex: novapartage.com): " PRODUCTION_DOMAIN
    if [ -z "$PRODUCTION_DOMAIN" ]; then
        log_error "Domaine de production requis"
        exit 1
    fi
    
    # Configuration SMTP
    read -p "Serveur SMTP: " SMTP_HOST
    read -p "Port SMTP: " SMTP_PORT
    read -p "Utilisateur SMTP: " SMTP_USER
    read -s -p "Mot de passe SMTP: " SMTP_PASS
    echo
    read -p "Email expéditeur: " SMTP_FROM
    
    # Configuration Redis
    read -s -p "Mot de passe Redis: " REDIS_PASSWORD
    echo
    
    # Créer le fichier .env pour la production
    log_info "Création du fichier .env pour la production..."
    
    cat > "$env_file" << EOF
# ===========================================
# Configuration NovaPartage - Production
# ===========================================

# Configuration de base
NODE_ENV=production
PORT=3001
LOG_LEVEL=info

# Configuration JWT
JWT_SECRET=$(generate_secure_key 64)
JWT_EXPIRES_IN=1h
JWT_ALGORITHM=HS256
JWT_ISSUER=novapartage-auth
JWT_AUDIENCE=novapartage-frontend

# Configuration Redis (activé en production)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=$REDIS_PASSWORD
REDIS_DB=0
REDIS_ENABLED=true

# Configuration CSRF
CSRF_SECRET=$(generate_secure_key 64)

# Configuration Sécurité (renforcée pour la production)
SECURITY_HEADERS_ENABLED=true
RATE_LIMIT_ENABLED=true
CSP_ENABLED=true
HSTS_ENABLED=true

# Configuration CORS
ALLOWED_ORIGINS=https://$PRODUCTION_DOMAIN

# Configuration URLs
FRONTEND_URL=https://$PRODUCTION_DOMAIN
AUTH_CALLBACK_URL=https://$PRODUCTION_DOMAIN/callback

# Configuration SMTP (production)
SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_SECURE=true
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
SMTP_FROM=$SMTP_FROM

# Configuration Email
EMAIL_SUBJECT=Lien de connexion NovaPartage

# Configuration Rate Limiting (renforcée pour la production)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX_REQUESTS=5
EMAIL_RATE_LIMIT_WINDOW_MS=3600000
EMAIL_RATE_LIMIT_MAX_REQUESTS=10

# Configuration Cookies (sécurisées pour la production)
COOKIE_SECURE=true
COOKIE_SAME_SITE=strict
COOKIE_DOMAIN=$PRODUCTION_DOMAIN
COOKIE_HTTP_ONLY=true
COOKIE_MAX_AGE=3600000

# Configuration Stockage (cookies pour la production)
TOKEN_STORAGE_METHOD=cookies
JWT_VALIDATION_MODE=server

# Configuration Tokens
TEMP_TOKEN_EXPIRES_IN=1h
VERIFICATION_CODE_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
MAX_VERIFICATION_ATTEMPTS=3

EOF
    
    log_success "Fichier .env créé pour la production"
    
    # Créer le fichier .env.production.example
    log_info "Création du fichier .env.production.example..."
    
    cat > "$PROJECT_DIR/.env.production.example" << EOF
# ===========================================
# Configuration NovaPartage - Production (Exemple)
# ===========================================

# Configuration de base
NODE_ENV=production
PORT=3001
LOG_LEVEL=info

# Configuration JWT
JWT_SECRET=your-very-secure-jwt-secret-key-64-characters-long
JWT_EXPIRES_IN=1h
JWT_ALGORITHM=HS256
JWT_ISSUER=novapartage-auth
JWT_AUDIENCE=novapartage-frontend

# Configuration Redis (production)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your-very-secure-redis-password
REDIS_DB=0
REDIS_ENABLED=true

# Configuration CSRF
CSRF_SECRET=your-very-secure-csrf-secret-key-64-characters-long

# Configuration Sécurité (production)
SECURITY_HEADERS_ENABLED=true
RATE_LIMIT_ENABLED=true
CSP_ENABLED=true
HSTS_ENABLED=true

# Configuration CORS
ALLOWED_ORIGINS=https://yourdomain.com

# Configuration URLs
FRONTEND_URL=https://yourdomain.com
AUTH_CALLBACK_URL=https://yourdomain.com/callback

# Configuration SMTP (production)
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=noreply@yourdomain.com

# Configuration Email
EMAIL_SUBJECT=Lien de connexion NovaPartage

# Configuration Rate Limiting (production)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX_REQUESTS=5
EMAIL_RATE_LIMIT_WINDOW_MS=3600000
EMAIL_RATE_LIMIT_MAX_REQUESTS=10

# Configuration Cookies (production)
COOKIE_SECURE=true
COOKIE_SAME_SITE=strict
COOKIE_DOMAIN=yourdomain.com
COOKIE_HTTP_ONLY=true
COOKIE_MAX_AGE=3600000

# Configuration Stockage (production)
TOKEN_STORAGE_METHOD=cookies
JWT_VALIDATION_MODE=server

# Configuration Tokens
TEMP_TOKEN_EXPIRES_IN=1h
VERIFICATION_CODE_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
MAX_VERIFICATION_ATTEMPTS=3

EOF
    
    log_success "Fichier .env.production.example créé"
    
    # Installer les dépendances
    if [ -f "$PROJECT_DIR/auth-service/package.json" ]; then
        log_info "Installation des dépendances du service d'authentification..."
        cd "$PROJECT_DIR/auth-service"
        npm install --production
        log_success "Dépendances installées"
    fi
    
    log_success "Environnement de production configuré"
}

# Fonction pour valider la configuration
validate_config() {
    log_info "Validation de la configuration..."
    
    local env_file="$PROJECT_DIR/.env"
    
    if [ ! -f "$env_file" ]; then
        log_error "Fichier .env non trouvé"
        exit 1
    fi
    
    # Charger les variables d'environnement
    source "$env_file"
    
    # Vérifier les variables critiques
    local errors=0
    
    if [ -z "$JWT_SECRET" ]; then
        log_error "JWT_SECRET non configuré"
        errors=$((errors + 1))
    fi
    
    if [ -z "$CSRF_SECRET" ]; then
        log_error "CSRF_SECRET non configuré"
        errors=$((errors + 1))
    fi
    
    if [ "$NODE_ENV" = "production" ]; then
        if [ -z "$REDIS_PASSWORD" ]; then
            log_error "REDIS_PASSWORD requis en production"
            errors=$((errors + 1))
        fi
        
        if [ "$COOKIE_SECURE" != "true" ]; then
            log_warning "COOKIE_SECURE devrait être 'true' en production"
        fi
        
        if [ "$TOKEN_STORAGE_METHOD" != "cookies" ]; then
            log_warning "TOKEN_STORAGE_METHOD devrait être 'cookies' en production"
        fi
    fi
    
    if [ $errors -eq 0 ]; then
        log_success "Configuration validée"
    else
        log_error "$errors erreur(s) de configuration trouvée(s)"
        exit 1
    fi
}

# Fonction pour afficher l'aide
show_help() {
    echo "Usage: $0 [ENVIRONMENT]"
    echo ""
    echo "ENVIRONMENT:"
    echo "  development  Configuration pour le développement (défaut)"
    echo "  production   Configuration pour la production"
    echo ""
    echo "Exemples:"
    echo "  $0                    # Configuration développement"
    echo "  $0 development        # Configuration développement"
    echo "  $0 production         # Configuration production"
    echo ""
    echo "Description:"
    echo "  Ce script configure l'environnement NovaPartage en créant"
    echo "  les fichiers de configuration nécessaires et en installant"
    echo "  les dépendances."
    echo ""
}

# Fonction principale
main() {
    log_info "Configuration de l'environnement NovaPartage..."
    log_info "Environnement: $ENVIRONMENT"
    echo ""
    
    # Vérifier que nous sommes dans le bon répertoire
    if [ ! -f "$PROJECT_DIR/docker-compose.yml" ]; then
        log_error "Fichier docker-compose.yml non trouvé dans $PROJECT_DIR"
        exit 1
    fi
    
    # Configurer l'environnement
    if [ "$ENVIRONMENT" = "production" ]; then
        setup_production
    else
        setup_development
    fi
    
    echo ""
    
    # Valider la configuration
    validate_config
    
    echo ""
    
    log_success "Configuration de l'environnement terminée!"
    log_info "Vous pouvez maintenant démarrer les services avec:"
    log_info "  ./scripts/deploy-secure.sh $ENVIRONMENT"
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

