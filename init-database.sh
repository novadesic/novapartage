#!/bin/bash

# Script d'initialisation de la base de données pour le nouveau système de sécurité des partages
# Ce script supprime les collections existantes et initialise la base avec le nouveau système

echo "🔒 REFACTORING SÉCURITÉ DES PARTAGES - Initialisation de la base de données"
echo "=================================================================="

# Configuration MongoDB
MONGO_HOST=${MONGO_HOST:-localhost}
MONGO_PORT=${MONGO_PORT:-27017}
MONGO_DB=${MONGO_DB:-ddsshare}

echo "📊 Configuration MongoDB:"
echo "  - Host: $MONGO_HOST"
echo "  - Port: $MONGO_PORT"
echo "  - Database: $MONGO_DB"
echo ""

# Vérifier que MongoDB est accessible
echo "🔍 Vérification de la connexion MongoDB..."
if ! mongosh --host $MONGO_HOST --port $MONGO_PORT --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo "❌ Erreur: Impossible de se connecter à MongoDB sur $MONGO_HOST:$MONGO_PORT"
    echo "   Vérifiez que MongoDB est démarré et accessible"
    exit 1
fi
echo "✅ Connexion MongoDB OK"
echo ""

# Confirmation de l'utilisateur
echo "⚠️  ATTENTION: Ce script va supprimer toutes les données existantes dans la base '$MONGO_DB'"
echo "   - Collection 'shares' (partages existants)"
echo "   - Collection 'access_tokens' (tokens d'accès)"
echo "   - Collection 'share_access_tabdata' (nouvelles données pré-calculées)"
echo ""
# Auto-confirmation pour les tests
confirm="oui"
echo "✅ Auto-confirmation activée pour les tests"

echo ""
echo "🗑️  Suppression des collections existantes..."

# Supprimer les collections existantes
mongosh --host $MONGO_HOST --port $MONGO_PORT $MONGO_DB --eval "
    print('Suppression de la collection shares...');
    db.shares.drop();
    
    print('Suppression de la collection access_tokens...');
    db.access_tokens.drop();
    
    print('Suppression de la collection share_access_tabdata...');
    db.share_access_tabdata.drop();
    
    print('Collections supprimées avec succès');
"

if [ $? -eq 0 ]; then
    echo "✅ Collections supprimées avec succès"
else
    echo "❌ Erreur lors de la suppression des collections"
    exit 1
fi

echo ""
echo "🔧 Création des index pour le nouveau système..."

# Créer les index pour la nouvelle collection share_access_tabdata
mongosh --host $MONGO_HOST --port $MONGO_PORT $MONGO_DB --eval "
    print('Création des index pour share_access_tabdata...');
    
    // Index unique sur shareId + recipientEmail
    db.share_access_tabdata.createIndex(
        { 'shareId': 1, 'recipientEmail': 1 }, 
        { unique: true, name: 'idx_share_recipient_unique' }
    );
    
    // Index sur shareId pour les requêtes par partage
    db.share_access_tabdata.createIndex(
        { 'shareId': 1 }, 
        { name: 'idx_share_id' }
    );
    
    // Index sur fileFingerprint pour la vérification de cohérence
    db.share_access_tabdata.createIndex(
        { 'fileFingerprint': 1 }, 
        { name: 'idx_file_fingerprint' }
    );
    
    // Index sur computedAt pour le nettoyage des données obsolètes
    db.share_access_tabdata.createIndex(
        { 'computedAt': 1 }, 
        { name: 'idx_computed_at' }
    );
    
    print('Index créés avec succès');
"

if [ $? -eq 0 ]; then
    echo "✅ Index créés avec succès"
else
    echo "❌ Erreur lors de la création des index"
    exit 1
fi

echo ""
echo "📊 Vérification de la structure de la base..."

# Vérifier que les collections sont bien créées
mongosh --host $MONGO_HOST --port $MONGO_PORT $MONGO_DB --eval "
    print('Collections dans la base:');
    db.getCollectionNames().forEach(function(name) {
        print('  - ' + name);
    });
    
    print('');
    print('Index de la collection share_access_tabdata:');
    db.share_access_tabdata.getIndexes().forEach(function(index) {
        print('  - ' + index.name + ': ' + JSON.stringify(index.key));
    });
"

echo ""
echo "✅ Base de données initialisée avec succès !"
echo ""
echo "🚀 Le nouveau système de sécurité des partages est prêt :"
echo "   - Accès aux fichiers limité aux cas d'édition/téléchargement"
echo "   - Données tabdata pré-calculées et stockées en base"
echo "   - Vérification de cohérence avec empreinte SHA-256"
echo "   - Compression des données pour optimiser l'espace"
echo ""
echo "📝 Prochaines étapes :"
echo "   1. Démarrer l'application backend"
echo "   2. Démarrer l'application frontend"
echo "   3. Tester la création d'un nouveau partage"
echo "   4. Vérifier que les données sont stockées dans share_access_tabdata"
echo ""
echo "🔍 Pour surveiller les accès fichier, consultez les logs avec :"
echo "   grep 'ACCÈS FICHIER AUTORISÉ' logs/application.log"
echo ""


