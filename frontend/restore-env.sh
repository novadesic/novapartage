#!/bin/bash

# Script pour restaurer la configuration originale avec les placeholders
echo "=== Restauration de la configuration originale ==="
echo

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
    echo "❌ Erreur: Ce script doit être exécuté depuis le répertoire frontend/"
    exit 1
fi

# Restaurer le fichier env.js original avec les placeholders
echo "🔧 Restauration de la configuration originale..."
cat > src/assets/env.js << 'EOF'
(function(window) {
  window.__env = window.__env || {};
  window.__env.KEYCLOAK_URL = '%%KEYCLOAK_URL%%';
  window.__env.KEYCLOAK_REALM = '%%KEYCLOAK_REALM%%';
  window.__env.KEYCLOAK_CLIENT_ID = '%%KEYCLOAK_CLIENT_ID%%';
  window.__env.BACKEND_URL = '%%BACKEND_URL%%';
  window.__env.BACKEND_API_PATH = '%%BACKEND_API_PATH%%';
  window.__env.APP_NAME = '%%APP_NAME%%';
  window.__env.APP_VERSION = '%%APP_VERSION%%';
  window.__env.PRODUCTION = %%PRODUCTION%%;
})(this);
EOF

echo "✅ Configuration restaurée avec les placeholders"
echo "   Le fichier env.js contient maintenant les placeholders %%VARIABLE%%"
echo "   Ces placeholders seront remplacés lors du build de production"
echo 