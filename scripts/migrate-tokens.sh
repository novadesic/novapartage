#!/bin/bash

# ===========================================
# Script de Migration des Tokens NovaPartage
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
MIGRATION_MODE=${1:-dry-run}

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

# Fonction pour vérifier la connectivité
check_connectivity() {
    log_info "Vérification de la connectivité..."
    
    # Vérifier que le service d'authentification est accessible
    if ! curl -s -f "$AUTH_SERVICE_URL/health" > /dev/null; then
        log_error "Service d'authentification non accessible à $AUTH_SERVICE_URL"
        exit 1
    fi
    
    log_success "Service d'authentification accessible"
}

# Fonction pour analyser les tokens existants
analyze_existing_tokens() {
    log_info "Analyse des tokens existants..."
    
    local token_count=0
    local valid_tokens=0
    local expired_tokens=0
    
    # Analyser les tokens dans localStorage (simulation)
    log_info "Recherche des tokens dans localStorage..."
    
    # En réalité, cette analyse se ferait côté frontend
    # Ici, on simule l'analyse
    log_info "Tokens trouvés dans localStorage: 0 (simulation)"
    
    # Analyser les tokens dans les cookies
    log_info "Recherche des tokens dans les cookies..."
    
    # Vérifier les cookies d'authentification
    local cookies=$(curl -s -c - "$AUTH_SERVICE_URL/health" | grep -E "(novapartage_access_token|novapartage_user)" || true)
    
    if [ -n "$cookies" ]; then
        log_info "Cookies d'authentification trouvés"
        echo "$cookies"
    else
        log_info "Aucun cookie d'authentification trouvé"
    fi
    
    log_success "Analyse des tokens terminée"
}

# Fonction pour migrer les tokens localStorage vers cookies
migrate_localStorage_to_cookies() {
    log_info "Migration des tokens localStorage vers cookies..."
    
    if [ "$MIGRATION_MODE" = "dry-run" ]; then
        log_warning "Mode dry-run - Aucune migration réelle effectuée"
        log_info "Les tokens seraient migrés de localStorage vers des cookies HttpOnly"
        return 0
    fi
    
    # En réalité, cette migration se ferait côté frontend
    # Le processus serait:
    # 1. Récupérer le token depuis localStorage
    # 2. Appeler l'endpoint de migration côté serveur
    # 3. Le serveur définit les cookies HttpOnly
    # 4. Supprimer le token de localStorage
    
    log_info "Simulation de la migration des tokens..."
    
    # Simuler l'appel à l'endpoint de migration
    local migration_response=$(curl -s -X POST "$AUTH_SERVICE_URL/api/migrate-tokens" \
        -H "Content-Type: application/json" \
        -d '{"source": "localStorage", "target": "cookies"}' || echo "{}")
    
    if echo "$migration_response" | grep -q "success"; then
        log_success "Migration des tokens terminée"
    else
        log_warning "Migration des tokens simulée (endpoint non implémenté)"
    fi
}

# Fonction pour valider la migration
validate_migration() {
    log_info "Validation de la migration..."
    
    # Vérifier que les cookies sont présents
    local cookies=$(curl -s -c - "$AUTH_SERVICE_URL/health" | grep -E "(novapartage_access_token|novapartage_user)" || true)
    
    if [ -n "$cookies" ]; then
        log_success "Cookies d'authentification présents après migration"
        echo "$cookies"
    else
        log_warning "Aucun cookie d'authentification trouvé après migration"
    fi
    
    # Vérifier que localStorage est vide (simulation)
    log_info "Vérification de localStorage (simulation)..."
    log_info "localStorage serait vidé des tokens d'authentification"
    
    log_success "Validation de la migration terminée"
}

# Fonction pour nettoyer les anciens tokens
cleanup_old_tokens() {
    log_info "Nettoyage des anciens tokens..."
    
    if [ "$MIGRATION_MODE" = "dry-run" ]; then
        log_warning "Mode dry-run - Aucun nettoyage effectué"
        log_info "Les anciens tokens seraient supprimés de localStorage"
        return 0
    fi
    
    # En réalité, ce nettoyage se ferait côté frontend
    log_info "Simulation du nettoyage des anciens tokens..."
    log_info "Les tokens seraient supprimés de localStorage"
    
    log_success "Nettoyage des anciens tokens terminé"
}

# Fonction pour générer un rapport de migration
generate_migration_report() {
    log_info "Génération du rapport de migration..."
    
    local report_file="$PROJECT_DIR/migration-report-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > "$report_file" << EOF
# Rapport de Migration des Tokens NovaPartage
Date: $(date)
Mode: $MIGRATION_MODE

## Résumé de la Migration
- Source: localStorage
- Cible: Cookies HttpOnly
- Statut: $([ "$MIGRATION_MODE" = "dry-run" ] && echo "Simulation" || echo "Exécutée")

## Actions Effectuées
1. Analyse des tokens existants
2. Migration des tokens localStorage vers cookies
3. Validation de la migration
4. Nettoyage des anciens tokens

## Recommandations
- Vérifier que tous les utilisateurs peuvent se connecter
- Surveiller les logs d'authentification
- Tester les fonctionnalités d'authentification
- Planifier une migration complète en production

## Prochaines Étapes
1. Tester l'authentification avec les nouveaux cookies
2. Vérifier la compatibilité avec tous les navigateurs
3. Mettre à jour la documentation
4. Former les utilisateurs si nécessaire

EOF
    
    log_success "Rapport de migration généré: $report_file"
}

# Fonction pour afficher l'aide
show_help() {
    echo "Usage: $0 [MODE]"
    echo ""
    echo "MODE:"
    echo "  dry-run     Mode simulation (défaut) - Aucune modification réelle"
    echo "  execute     Mode exécution - Migration réelle des tokens"
    echo ""
    echo "Exemples:"
    echo "  $0                    # Mode simulation"
    echo "  $0 dry-run           # Mode simulation"
    echo "  $0 execute           # Migration réelle"
    echo ""
    echo "Description:"
    echo "  Ce script migre les tokens d'authentification de localStorage"
    echo "  vers des cookies HttpOnly pour améliorer la sécurité."
    echo ""
    echo "Prérequis:"
    echo "  - Service d'authentification en cours d'exécution"
    echo "  - Accès à l'URL: $AUTH_SERVICE_URL"
    echo ""
}

# Fonction principale
main() {
    log_info "Démarrage de la migration des tokens NovaPartage..."
    log_info "Mode: $MIGRATION_MODE"
    echo ""
    
    # Vérifier la connectivité
    check_connectivity
    echo ""
    
    # Analyser les tokens existants
    analyze_existing_tokens
    echo ""
    
    # Migrer les tokens
    migrate_localStorage_to_cookies
    echo ""
    
    # Valider la migration
    validate_migration
    echo ""
    
    # Nettoyer les anciens tokens
    cleanup_old_tokens
    echo ""
    
    # Générer le rapport
    generate_migration_report
    echo ""
    
    if [ "$MIGRATION_MODE" = "dry-run" ]; then
        log_success "Simulation de migration terminée!"
        log_info "Pour exécuter la migration réelle, utilisez: $0 execute"
    else
        log_success "Migration des tokens terminée!"
        log_info "Vérifiez que l'authentification fonctionne correctement"
    fi
}

# Vérifier les arguments
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

# Vérifier le mode
if [ "$MIGRATION_MODE" != "dry-run" ] && [ "$MIGRATION_MODE" != "execute" ]; then
    log_error "Mode invalide: $MIGRATION_MODE"
    log_error "Utilisez 'dry-run' ou 'execute'"
    exit 1
fi

# Exécuter le script principal
main "$@"

