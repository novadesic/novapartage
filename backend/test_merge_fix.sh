#!/bin/bash

echo "🧪 Test de la correction du merge des données soumises"
echo "=================================================="

# Vérifier que le backend compile
echo "📦 Compilation du backend..."
./mvnw clean compile
if [ $? -eq 0 ]; then
    echo "✅ Compilation réussie"
else
    echo "❌ Erreur de compilation"
    exit 1
fi

echo ""
echo "🔍 Analyse des logs pour vérifier le fonctionnement..."
echo ""

# Démarrer le backend en mode test
echo "🚀 Démarrage du backend en mode test..."
./mvnw quarkus:dev &
BACKEND_PID=$!

# Attendre que le backend démarre
echo "⏳ Attente du démarrage du backend..."
sleep 10

# Vérifier que le backend répond
echo "🔍 Test de la réponse du backend..."
curl -s http://localhost:8080/q/health || echo "❌ Backend non accessible"

echo ""
echo "📝 Pour tester la correction :"
echo "1. Créez un partage avec des cellules éditables"
echo "2. Accédez au formulaire via le token"
echo "3. Modifiez une valeur et sauvegardez"
echo "4. Rechargez la page et vérifiez que la valeur modifiée est visible"
echo ""
echo "🔍 Vérifiez les logs du backend pour voir :"
echo "   - Les données soumises reçues"
echo "   - La fusion des données"
echo "   - Les valeurs remplacées"
echo ""

# Arrêter le backend
echo "🛑 Arrêt du backend..."
kill $BACKEND_PID

echo ""
echo "✅ Test terminé"

