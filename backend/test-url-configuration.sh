#!/bin/bash

# Script de test pour vérifier la configuration des URLs d'accès
echo "=== Test de configuration des URLs d'accès ==="
echo

# Test 1: Aucune variable définie (défaut)
echo "Test 1: Aucune variable d'environnement définie"
unset APP_BASE_URL
unset FRONTEND_URL
unset APP_DOMAIN
unset QUARKUS_PROFILE
echo "Résultat attendu: http://localhost (production par défaut)"
echo "Variables: APP_BASE_URL=$APP_BASE_URL, FRONTEND_URL=$FRONTEND_URL, APP_DOMAIN=$APP_DOMAIN"
echo

# Test 2: Mode développement
echo "Test 2: Mode développement (QUARKUS_PROFILE=dev)"
export QUARKUS_PROFILE=dev
echo "Résultat attendu: http://localhost:4200"
echo "Variables: QUARKUS_PROFILE=$QUARKUS_PROFILE"
echo

# Test 3: APP_BASE_URL défini
echo "Test 3: APP_BASE_URL défini"
export APP_BASE_URL="https://ddsshare.example.com"
echo "Résultat attendu: https://ddsshare.example.com"
echo "Variables: APP_BASE_URL=$APP_BASE_URL"
echo

# Test 4: FRONTEND_URL défini (priorité inférieure à APP_BASE_URL)
echo "Test 4: FRONTEND_URL défini (avec APP_BASE_URL)"
export FRONTEND_URL="http://localhost:4200"
echo "Résultat attendu: https://ddsshare.example.com (APP_BASE_URL a la priorité)"
echo "Variables: APP_BASE_URL=$APP_BASE_URL, FRONTEND_URL=$FRONTEND_URL"
echo

# Test 5: APP_DOMAIN défini (priorité inférieure)
echo "Test 5: APP_DOMAIN défini (avec APP_BASE_URL et FRONTEND_URL)"
export APP_DOMAIN="localhost"
echo "Résultat attendu: https://ddsshare.example.com (APP_BASE_URL a la priorité)"
echo "Variables: APP_BASE_URL=$APP_BASE_URL, FRONTEND_URL=$FRONTEND_URL, APP_DOMAIN=$APP_DOMAIN"
echo

# Test 6: Seulement FRONTEND_URL défini
echo "Test 6: Seulement FRONTEND_URL défini"
unset APP_BASE_URL
unset APP_DOMAIN
echo "Résultat attendu: http://localhost:4200"
echo "Variables: FRONTEND_URL=$FRONTEND_URL"
echo

# Test 7: Seulement APP_DOMAIN défini (localhost)
echo "Test 7: Seulement APP_DOMAIN défini (localhost)"
unset FRONTEND_URL
export APP_DOMAIN="localhost"
echo "Résultat attendu: http://localhost"
echo "Variables: APP_DOMAIN=$APP_DOMAIN"
echo

# Test 8: Seulement APP_DOMAIN défini (domaine externe)
echo "Test 8: Seulement APP_DOMAIN défini (domaine externe)"
export APP_DOMAIN="ddsshare.example.com"
echo "Résultat attendu: https://ddsshare.example.com"
echo "Variables: APP_DOMAIN=$APP_DOMAIN"
echo

echo "=== Instructions pour tester avec l'application ==="
echo
echo "1. Démarrez le backend avec une variable d'environnement:"
echo "   export APP_BASE_URL=https://ddsshare.example.com"
echo "   cd backend && ./mvnw quarkus:dev"
echo
echo "2. Générez un lien d'accès depuis l'interface"
echo
echo "3. Vérifiez que l'URL générée utilise le bon domaine"
echo
echo "=== Variables d'environnement recommandées ==="
echo
echo "# Développement local"
echo "export APP_DOMAIN=localhost"
echo
echo "# Production avec domaine personnalisé"
echo "export APP_BASE_URL=https://ddsshare.monentreprise.com"
echo
echo "# Production avec sous-domaine"
echo "export APP_DOMAIN=ddsshare.monentreprise.com" 