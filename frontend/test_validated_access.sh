#!/bin/bash

echo "🔍 DIAGNOSTIC - Accès validés qui n'apparaissent plus"
echo "=================================================="
echo ""

echo "1. 🚀 Démarrage de l'application"
echo "   - Backend: cd ../backend && ./mvnw quarkus:dev"
echo "   - Frontend: npm start"
echo ""

echo "2. 🔍 Vérification des logs de débogage"
echo "   - Ouvrez la console du navigateur (F12)"
echo "   - Allez dans l'onglet 'Console'"
echo "   - Rechargez la page des partages"
echo "   - Cherchez les logs commençant par '🔍 applyAccessSort'"
echo ""

echo "3. 📊 Analyse des données"
echo "   - Vérifiez le nombre de tokens avant filtrage"
echo "   - Vérifiez les statuts des tokens"
echo "   - Vérifiez l'état des filtres"
echo ""

echo "4. 🎯 Test des filtres"
echo "   - Vérifiez que 'Accès validés' est coché par défaut"
echo "   - Décochez puis recochez le filtre 'Accès validés'"
echo "   - Vérifiez que les tokens VALIDATED apparaissent"
echo ""

echo "5. 🔧 Vérifications possibles"
echo "   - Les tokens ont-ils bien le statut 'VALIDATED' ?"
echo "   - Le filtre showValidatedAccess est-il bien à true ?"
echo "   - Y a-t-il des erreurs dans la console ?"
echo ""

echo "6. 📝 Logs à surveiller"
echo "   - '🔍 applyAccessSort - Filtres actuels:'"
echo "   - '🔍 applyAccessSort - Tokens avant filtrage:'"
echo "   - '🔍 Filtrage du token X (VALIDATED):'"
echo "   - '✅ Token X conservé: VALIDATED' ou '❌ Token X filtré'"
echo ""

echo "7. 🚨 Si le problème persiste"
echo "   - Vérifiez la réponse de l'API /api/shares/my-access-tokens"
echo "   - Vérifiez que les tokens VALIDATED sont bien retournés"
echo "   - Vérifiez que le statut est exactement 'VALIDATED' (majuscules)"
echo ""


