#!/bin/bash

# ===========================================
# Script de Monitoring de Sécurité NovaPartage
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
LOG_FILE="$PROJECT_DIR/logs/security-monitor.log"
ALERT_EMAIL="admin@novapartage.com"
MONITORING_INTERVAL=${1:-60}

# Fonctions utilitaires
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "$(date): [INFO] $1" >> "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    echo "$(date): [SUCCESS] $1" >> "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    echo "$(date): [WARNING] $1" >> "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    echo "$(date): [ERROR] $1" >> "$LOG_FILE"
}

# Fonction pour créer le répertoire de logs
setup_logging() {
    mkdir -p "$(dirname "$LOG_FILE")"
    touch "$LOG_FILE"
}

# Fonction pour vérifier la santé des services
check_services_health() {
    log_info "Vérification de la santé des services..."
    
    local services_down=0
    
    # Vérifier le service d'authentification
    if ! curl -s -f "$AUTH_SERVICE_URL/health" > /dev/null; then
        log_error "Service d'authentification inaccessible"
        services_down=$((services_down + 1))
    fi
    
    # Vérifier Redis
    if ! docker exec novapartage-redis redis-cli ping > /dev/null 2>&1; then
        log_error "Redis inaccessible"
        services_down=$((services_down + 1))
    fi
    
    # Vérifier PostgreSQL
    if ! docker exec novapartage-db pg_isready -U novapartage > /dev/null 2>&1; then
        log_error "PostgreSQL inaccessible"
        services_down=$((services_down + 1))
    fi
    
    # Vérifier MongoDB
    if ! docker exec novapartage-mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
        log_error "MongoDB inaccessible"
        services_down=$((services_down + 1))
    fi
    
    if [ $services_down -eq 0 ]; then
        log_success "Tous les services sont opérationnels"
    else
        log_error "$services_down service(s) inaccessible(s)"
        send_alert "Services Down" "$services_down service(s) sont inaccessibles"
    fi
}

# Fonction pour surveiller les tentatives de connexion
monitor_auth_attempts() {
    log_info "Surveillance des tentatives d'authentification..."
    
    # Analyser les logs du service d'authentification
    local auth_logs=$(docker logs novapartage-auth 2>&1 | tail -100)
    
    # Compter les tentatives échouées
    local failed_attempts=$(echo "$auth_logs" | grep -c "Authentication failed" || echo "0")
    local rate_limited=$(echo "$auth_logs" | grep -c "rate limit" || echo "0")
    local csrf_errors=$(echo "$auth_logs" | grep -c "CSRF" || echo "0")
    
    # Vérifier les seuils d'alerte
    if [ $failed_attempts -gt 10 ]; then
        log_warning "Tentatives d'authentification échouées élevées: $failed_attempts"
        send_alert "High Failed Auth Attempts" "Tentatives d'authentification échouées élevées: $failed_attempts"
    fi
    
    if [ $rate_limited -gt 5 ]; then
        log_warning "Rate limiting activé: $rate_limited fois"
        send_alert "Rate Limiting Active" "Rate limiting activé: $rate_limited fois"
    fi
    
    if [ $csrf_errors -gt 3 ]; then
        log_warning "Erreurs CSRF détectées: $csrf_errors"
        send_alert "CSRF Errors" "Erreurs CSRF détectées: $csrf_errors"
    fi
    
    log_info "Tentatives échouées: $failed_attempts, Rate limited: $rate_limited, CSRF errors: $csrf_errors"
}

# Fonction pour surveiller les performances
monitor_performance() {
    log_info "Surveillance des performances..."
    
    # Vérifier l'utilisation de la mémoire
    local memory_usage=$(docker stats --no-stream --format "table {{.MemUsage}}" novapartage-auth | tail -1 | cut -d'/' -f1 | tr -d ' ')
    local memory_limit=$(docker stats --no-stream --format "table {{.MemUsage}}" novapartage-auth | tail -1 | cut -d'/' -f2 | tr -d ' ')
    
    # Vérifier l'utilisation du CPU
    local cpu_usage=$(docker stats --no-stream --format "table {{.CPUPerc}}" novapartage-auth | tail -1 | tr -d '%')
    
    # Vérifier l'espace disque
    local disk_usage=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
    
    # Vérifier les seuils
    if [ $cpu_usage -gt 80 ]; then
        log_warning "Utilisation CPU élevée: ${cpu_usage}%"
        send_alert "High CPU Usage" "Utilisation CPU élevée: ${cpu_usage}%"
    fi
    
    if [ $disk_usage -gt 85 ]; then
        log_warning "Espace disque faible: ${disk_usage}%"
        send_alert "Low Disk Space" "Espace disque faible: ${disk_usage}%"
    fi
    
    log_info "CPU: ${cpu_usage}%, Mémoire: $memory_usage, Disque: ${disk_usage}%"
}

# Fonction pour surveiller la sécurité
monitor_security() {
    log_info "Surveillance de la sécurité..."
    
    # Vérifier les headers de sécurité
    local security_headers=$(curl -s -I "$AUTH_SERVICE_URL/health" | grep -E "(X-Content-Type-Options|X-Frame-Options|X-XSS-Protection)" | wc -l)
    
    if [ $security_headers -lt 3 ]; then
        log_warning "Headers de sécurité manquants: $security_headers/3"
        send_alert "Missing Security Headers" "Headers de sécurité manquants: $security_headers/3"
    fi
    
    # Vérifier la configuration SSL (si applicable)
    if [ "$NODE_ENV" = "production" ]; then
        local ssl_check=$(curl -s -I "https://$AUTH_SERVICE_URL/health" 2>&1 | grep -c "HTTP/2 200" || echo "0")
        if [ $ssl_check -eq 0 ]; then
            log_warning "SSL non configuré ou invalide"
            send_alert "SSL Configuration" "SSL non configuré ou invalide"
        fi
    fi
    
    # Vérifier les cookies sécurisés
    local secure_cookies=$(curl -s -c - "$AUTH_SERVICE_URL/health" | grep -c "HttpOnly" || echo "0")
    if [ $secure_cookies -eq 0 ]; then
        log_warning "Cookies sécurisés non configurés"
        send_alert "Secure Cookies" "Cookies sécurisés non configurés"
    fi
    
    log_info "Headers de sécurité: $security_headers/3, Cookies sécurisés: $secure_cookies"
}

# Fonction pour surveiller les logs d'erreur
monitor_error_logs() {
    log_info "Surveillance des logs d'erreur..."
    
    # Analyser les logs d'erreur
    local error_logs=$(docker logs novapartage-auth 2>&1 | tail -100 | grep -i "error\|exception\|fatal" | wc -l)
    local warning_logs=$(docker logs novapartage-auth 2>&1 | tail -100 | grep -i "warning" | wc -l)
    
    if [ $error_logs -gt 5 ]; then
        log_warning "Logs d'erreur élevés: $error_logs"
        send_alert "High Error Logs" "Logs d'erreur élevés: $error_logs"
    fi
    
    if [ $warning_logs -gt 10 ]; then
        log_warning "Logs d'avertissement élevés: $warning_logs"
        send_alert "High Warning Logs" "Logs d'avertissement élevés: $warning_logs"
    fi
    
    log_info "Erreurs: $error_logs, Avertissements: $warning_logs"
}

# Fonction pour surveiller les connexions réseau
monitor_network() {
    log_info "Surveillance des connexions réseau..."
    
    # Vérifier les connexions actives
    local active_connections=$(netstat -an | grep ":3001" | grep "ESTABLISHED" | wc -l)
    local listening_ports=$(netstat -an | grep ":3001" | grep "LISTEN" | wc -l)
    
    if [ $listening_ports -eq 0 ]; then
        log_error "Port 3001 non en écoute"
        send_alert "Port Not Listening" "Port 3001 non en écoute"
    fi
    
    if [ $active_connections -gt 100 ]; then
        log_warning "Connexions actives élevées: $active_connections"
        send_alert "High Active Connections" "Connexions actives élevées: $active_connections"
    fi
    
    log_info "Connexions actives: $active_connections, Ports en écoute: $listening_ports"
}

# Fonction pour envoyer une alerte
send_alert() {
    local subject="$1"
    local message="$2"
    
    log_warning "ALERTE: $subject - $message"
    
    # Envoyer un email (si configuré)
    if command -v mail &> /dev/null && [ -n "$ALERT_EMAIL" ]; then
        echo "$message" | mail -s "NovaPartage Security Alert: $subject" "$ALERT_EMAIL"
    fi
    
    # Log de l'alerte
    echo "$(date): [ALERT] $subject - $message" >> "$LOG_FILE"
}

# Fonction pour générer un rapport de surveillance
generate_monitoring_report() {
    log_info "Génération du rapport de surveillance..."
    
    local report_file="$PROJECT_DIR/logs/monitoring-report-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > "$report_file" << EOF
# Rapport de Surveillance de Sécurité NovaPartage
Date: $(date)
Intervalle: ${MONITORING_INTERVAL}s

## État des Services
EOF
    
    # État des services
    if curl -s -f "$AUTH_SERVICE_URL/health" > /dev/null; then
        echo "✅ Service d'authentification: Opérationnel" >> "$report_file"
    else
        echo "❌ Service d'authentification: Inaccessible" >> "$report_file"
    fi
    
    if docker exec novapartage-redis redis-cli ping > /dev/null 2>&1; then
        echo "✅ Redis: Opérationnel" >> "$report_file"
    else
        echo "❌ Redis: Inaccessible" >> "$report_file"
    fi
    
    if docker exec novapartage-db pg_isready -U novapartage > /dev/null 2>&1; then
        echo "✅ PostgreSQL: Opérationnel" >> "$report_file"
    else
        echo "❌ PostgreSQL: Inaccessible" >> "$report_file"
    fi
    
    if docker exec novapartage-mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
        echo "✅ MongoDB: Opérationnel" >> "$report_file"
    else
        echo "❌ MongoDB: Inaccessible" >> "$report_file"
    fi
    
    echo "" >> "$report_file"
    echo "## Métriques de Performance" >> "$report_file"
    
    # Métriques de performance
    local cpu_usage=$(docker stats --no-stream --format "table {{.CPUPerc}}" novapartage-auth | tail -1 | tr -d '%')
    local memory_usage=$(docker stats --no-stream --format "table {{.MemUsage}}" novapartage-auth | tail -1 | cut -d'/' -f1 | tr -d ' ')
    local disk_usage=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
    
    echo "CPU: ${cpu_usage}%" >> "$report_file"
    echo "Mémoire: $memory_usage" >> "$report_file"
    echo "Disque: ${disk_usage}%" >> "$report_file"
    
    echo "" >> "$report_file"
    echo "## Métriques de Sécurité" >> "$report_file"
    
    # Métriques de sécurité
    local security_headers=$(curl -s -I "$AUTH_SERVICE_URL/health" | grep -E "(X-Content-Type-Options|X-Frame-Options|X-XSS-Protection)" | wc -l)
    local secure_cookies=$(curl -s -c - "$AUTH_SERVICE_URL/health" | grep -c "HttpOnly" || echo "0")
    
    echo "Headers de sécurité: $security_headers/3" >> "$report_file"
    echo "Cookies sécurisés: $secure_cookies" >> "$report_file"
    
    echo "" >> "$report_file"
    echo "## Recommandations" >> "$report_file"
    
    if [ $cpu_usage -gt 80 ]; then
        echo "- Surveiller l'utilisation CPU" >> "$report_file"
    fi
    
    if [ $disk_usage -gt 85 ]; then
        echo "- Nettoyer l'espace disque" >> "$report_file"
    fi
    
    if [ $security_headers -lt 3 ]; then
        echo "- Vérifier la configuration des headers de sécurité" >> "$report_file"
    fi
    
    log_success "Rapport de surveillance généré: $report_file"
}

# Fonction pour afficher l'aide
show_help() {
    echo "Usage: $0 [INTERVAL]"
    echo ""
    echo "INTERVAL:"
    echo "  Intervalle de surveillance en secondes (défaut: 60)"
    echo ""
    echo "Exemples:"
    echo "  $0                    # Surveillance toutes les 60 secondes"
    echo "  $0 30                 # Surveillance toutes les 30 secondes"
    echo "  $0 300                # Surveillance toutes les 5 minutes"
    echo ""
    echo "Description:"
    echo "  Ce script surveille la sécurité et les performances"
    echo "  du système NovaPartage en continu."
    echo ""
    echo "Fonctionnalités:"
    echo "  - Surveillance de la santé des services"
    echo "  - Surveillance des tentatives d'authentification"
    echo "  - Surveillance des performances"
    echo "  - Surveillance de la sécurité"
    echo "  - Surveillance des logs d'erreur"
    echo "  - Surveillance des connexions réseau"
    echo "  - Génération de rapports"
    echo "  - Envoi d'alertes"
    echo ""
}

# Fonction principale
main() {
    log_info "Démarrage du monitoring de sécurité NovaPartage..."
    log_info "Intervalle: ${MONITORING_INTERVAL}s"
    echo ""
    
    # Configuration du logging
    setup_logging
    
    # Boucle de surveillance
    while true; do
        log_info "=== Cycle de surveillance ==="
        
        # Vérifier la santé des services
        check_services_health
        echo ""
        
        # Surveiller les tentatives d'authentification
        monitor_auth_attempts
        echo ""
        
        # Surveiller les performances
        monitor_performance
        echo ""
        
        # Surveiller la sécurité
        monitor_security
        echo ""
        
        # Surveiller les logs d'erreur
        monitor_error_logs
        echo ""
        
        # Surveiller les connexions réseau
        monitor_network
        echo ""
        
        # Générer un rapport toutes les heures
        if [ $(( $(date +%M) % 60 )) -eq 0 ]; then
            generate_monitoring_report
        fi
        
        log_info "Attente de ${MONITORING_INTERVAL}s avant le prochain cycle..."
        sleep "$MONITORING_INTERVAL"
    done
}

# Vérifier les arguments
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

# Vérifier l'intervalle
if ! [[ "$MONITORING_INTERVAL" =~ ^[0-9]+$ ]] || [ "$MONITORING_INTERVAL" -lt 10 ]; then
    log_error "Intervalle invalide: $MONITORING_INTERVAL"
    log_error "L'intervalle doit être un nombre entier >= 10 secondes"
    exit 1
fi

# Exécuter le script principal
main "$@"

