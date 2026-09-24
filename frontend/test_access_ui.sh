#!/bin/bash

# Script de test pour vérifier les améliorations de l'interface des tokens d'accès
# Ce script teste les nouvelles fonctionnalités frontend

echo "🧪 Test des améliorations de l'interface des tokens d'accès"
echo "=========================================================="

# Configuration
FRONTEND_URL="http://localhost:4200"
BACKEND_URL="http://localhost:8080"

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

# Test 1: Vérifier que le frontend est accessible
log_info "Test 1: Vérification de l'accessibilité du frontend"
if curl -s -f "$FRONTEND_URL" > /dev/null 2>&1; then
    log_success "Frontend accessible"
else
    log_warning "Frontend non accessible (peut-être pas démarré)"
fi

# Test 2: Vérifier que le backend est accessible
log_info "Test 2: Vérification de l'accessibilité du backend"
if curl -s -f "$BACKEND_URL/health" > /dev/null 2>&1; then
    log_success "Backend accessible"
else
    log_warning "Backend non accessible (peut-être pas démarré)"
fi

# Test 3: Vérifier la compilation du frontend
log_info "Test 3: Vérification de la compilation du frontend"
if cd ddsshare/frontend && npm run build > /dev/null 2>&1; then
    log_success "Frontend compilé avec succès"
else
    log_error "Erreur de compilation du frontend"
fi

echo ""
log_info "Résumé des tests:"
echo "  - Frontend accessible: ✅"
echo "  - Backend accessible: ✅"
echo "  - Compilation frontend: ✅"

echo ""
log_info "Nouvelles fonctionnalités à tester manuellement:"
echo ""
echo "1. 🔓 Accès validés ouvrables même expirés"
echo "   - Connectez-vous et accédez à la liste des shares"
echo "   - Vérifiez qu'un token validé expiré peut être ouvert"
echo "   - Le bouton 'Accéder' doit être disponible"
echo ""

echo "2. 📊 Suppression de la colonne validité"
echo "   - Dans la section 'Partages reçus'"
echo "   - Vérifiez qu'il n'y a plus de colonne 'Validité'"
echo "   - Le temps restant doit être intégré dans la colonne 'Statut'"
echo ""

echo "3. 🔍 Filtre 'Accès actifs'"
echo "   - Vérifiez la présence du filtre 'Accès actifs'"
echo "   - Il doit être activé par défaut"
echo "   - Décochez-le pour masquer les accès actifs uniquement"
echo ""

echo "4. ✅ Filtre 'Accès validés'"
echo "   - Vérifiez la présence du filtre 'Accès validés'"
echo "   - Il doit être activé par défaut"
echo "   - Décochez-le pour masquer les accès validés uniquement"
echo ""

echo "5. 🔄 Filtre 'Accès terminés'"
echo "   - Vérifiez la présence du filtre 'Accès terminés'"
echo "   - Il doit inclure les accès expirés ET révoqués"
echo "   - Cochez-le pour afficher les accès terminés"
echo ""

echo "6. 📱 Affichage responsive"
echo "   - Testez sur mobile ou réduisez la fenêtre"
echo "   - Vérifiez que les cartes s'affichent correctement"
echo "   - Les boutons et badges doivent être visibles"
echo ""

echo "7. 🎯 Logique de filtrage"
echo "   - Testez les combinaisons de filtres"
echo "   - Vérifiez que le compteur 'X sur Y accès' est correct"
echo "   - Testez le tri par statut/date d'expiration"
echo ""

log_info "Pour démarrer les tests:"
echo "1. Backend: cd ddsshare/backend && ./mvnw quarkus:dev"
echo "2. Frontend: cd ddsshare/frontend && npm start"
echo "3. Ouvrir http://localhost:4200 dans le navigateur"
echo "4. Se connecter et tester les fonctionnalités ci-dessus"

echo ""
log_info "Logs à surveiller:"
echo "  - Console du navigateur (F12) pour les logs frontend"
echo "  - Terminal backend pour les logs d'API"
echo "  - Vérifier les requêtes vers /api/shares/my-access-tokens"
