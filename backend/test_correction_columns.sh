#!/bin/bash

echo "🧪 Test de la Correction des Colonnes Côté Backend"
echo "=================================================="
echo ""

# Vérifier que le backend compile
echo "🔍 Vérification de la compilation..."
if ./mvnw compile > /dev/null 2>&1; then
    echo "✅ Backend compilé avec succès"
else
    echo "❌ Erreur de compilation du backend"
    echo "Exécutez './mvnw compile' pour voir les détails"
    exit 1
fi

echo ""
echo "🚀 Backend prêt pour les tests !"
echo ""
echo "📋 Instructions de test :"
echo "1. Démarrer le backend : ./mvnw quarkus:dev"
echo "2. Créer un nouveau partage en excluant la première colonne"
echo "3. Accéder au formulaire partagé via le lien généré"
echo "4. Vérifier que seulement les colonnes sélectionnées sont visibles"
echo ""
echo "🔍 Logs à surveiller dans le backend :"
echo "   - '🔍 Share-access: utilisation de convertToTableDataWithSelection avec X cellules sélectionnées'"
echo "   - '🔍 Mapping des colonnes filtrées: {column-1=0, column-2=1, column-3=2}'"
echo "   - '🔍 ColumnLabels filtrés selon le tableData: {column-1=Référence, column-2=Nom du produit, column-3=Tarif}'"
echo ""
echo "✅ Résultat attendu :"
echo "   - Colonne 'Catégorie' (première colonne) NON visible (aucune cellule sélectionnée)"
echo "   - Colonne 'Référence' (colonne B) visible avec TOUTES les lignes de données"
echo "   - Colonne 'Nom du produit' (colonne C) visible avec TOUTES les lignes de données"
echo "   - Colonne 'Tarif' (colonne D) visible avec TOUTES les lignes de données"
echo "   - TOUTES les lignes de données sont visibles (pas de filtrage par ligne)"
echo "   - Première ligne d'Excel (en-têtes) exclue des données"
echo "   - Cellules non sélectionnées affichent des chaînes vides"
echo "   - Seules les cellules sélectionnées affichent leurs valeurs réelles"
echo "   - Cellules éditables sont sur les bonnes colonnes (pas de décalage)"
echo ""
echo "🔧 Pour démarrer le backend :"
echo "   cd /home/msoriano/DDS/git/datadesic/ddsshare/backend"
echo "   ./mvnw quarkus:dev"
echo ""
echo "📝 Documentation complète : test_correction_columns_backend.md"
