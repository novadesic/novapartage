#!/bin/bash

echo "🔍 TEST API - Vérification des tokens validés"
echo "============================================="
echo ""

# Configuration
API_BASE="http://localhost:8080"
ENDPOINT="/api/shares/my-access-tokens"

echo "1. 🚀 Test de l'endpoint $ENDPOINT"
echo "   URL complète: $API_BASE$ENDPOINT"
echo ""

echo "2. 📋 Commande curl à exécuter:"
echo "   curl -X GET '$API_BASE$ENDPOINT' \\"
echo "     -H 'Accept: application/json' \\"
echo "     -H 'Authorization: Bearer YOUR_TOKEN'"
echo ""

echo "3. 🔍 Points à vérifier dans la réponse:"
echo "   - Présence de tokens avec status: 'VALIDATED'"
echo "   - Nombre total de tokens"
echo "   - Structure de la réponse"
echo ""

echo "4. 📊 Analyse attendue:"
echo "   - Tokens ACTIVE: X"
echo "   - Tokens VALIDATED: X"
echo "   - Tokens EXPIRED: X"
echo "   - Tokens REVOKED: X"
echo ""

echo "5. 🎯 Si aucun token VALIDATED:"
echo "   - Vérifiez les logs du backend"
echo "   - Vérifiez la base de données"
echo "   - Vérifiez que des tokens ont été validés"
echo ""

echo "6. 🔧 Test rapide avec jq (si installé):"
echo "   curl -s '$API_BASE$ENDPOINT' | jq '.tokens[] | select(.status == \"VALIDATED\")'"
echo ""

echo "7. 📝 Logs backend à surveiller:"
echo "   - '🔍 Tokens d\'accès récupérés:'"
echo "   - '🔍 Tokens retournés:'"
echo "   - Erreurs éventuelles"
echo ""


