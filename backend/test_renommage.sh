#!/bin/bash

echo "🔄 Test du Renommage editableCells → tableDataEditableCells"
echo "============================================================"
echo ""

# Vérifier que le backend compile
echo "🔍 Vérification de la compilation..."
if ./mvnw compile > /dev/null 2>&1; then
    echo "✅ Backend compilé avec succès"
else
    echo "❌ Erreur de compilation du backend"
    exit 1
fi

echo ""
echo "🔍 Vérification des changements effectués :"
echo ""

# Vérifier que le renommage a été fait dans ShareService
if grep -q "tableDataEditableCells" src/main/java/com/datadesic/ddsshare/backend/service/ShareService.java; then
    echo "✅ ShareService : tableDataEditableCells trouvé"
else
    echo "❌ ShareService : tableDataEditableCells manquant"
fi

# Vérifier que le renommage a été fait dans FormAccessData
if grep -q "tableDataEditableCells" src/main/java/com/datadesic/ddsshare/backend/model/dto/FormAccessData.java; then
    echo "✅ FormAccessData : tableDataEditableCells trouvé"
else
    echo "❌ FormAccessData : tableDataEditableCells manquant"
fi

# Vérifier que l'ancien nom n'existe plus dans FormAccessData
if grep -q "editableCells" src/main/java/com/datadesic/ddsshare/backend/model/dto/FormAccessData.java; then
    echo "❌ FormAccessData : editableCells encore présent"
else
    echo "✅ FormAccessData : editableCells supprimé"
fi

echo ""
echo "🎯 Résumé du Renommage :"
echo "   - editableCells → tableDataEditableCells dans FormAccessData"
echo "   - Variable locale renommée dans ShareService"
echo "   - Interface TypeScript mise à jour"
echo ""
echo "🚀 Prêt pour le test avec les logs de débogage !"
echo "   Démarrer le backend : ./mvnw quarkus:dev"
echo "   Créer un nouveau partage et tester l'accès"
echo ""
echo "📝 Documentation mise à jour : test_correction_columns_backend.md"
