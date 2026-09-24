#!/bin/bash

# Script pour construire et dockeriser le frontend ddsshare
echo "Début du build et dockerisation du frontend ddsshare..."

# 1. Création d'un fichier env.js template avec des placeholders
echo "📝 Création du fichier env.js template..."
  cat > src/assets/env.js <<EOL
(function(window) {
  window.__env = window.__env || {};
  window.__env.CUSTOM_AUTH_ENDPOINT = '%%CUSTOM_AUTH_ENDPOINT%%';
  window.__env.BACKEND_URL = '%%BACKEND_URL%%';
  window.__env.BACKEND_API_PATH = '%%BACKEND_API_PATH%%';
  window.__env.APP_NAME = '%%APP_NAME%%';
  window.__env.APP_VERSION = '%%APP_VERSION%%';
  window.__env.PRODUCTION = %%PRODUCTION%%;
  window.__env.MAX_RECIPIENTS_PER_SHARE = %%MAX_RECIPIENTS_PER_SHARE%%;
})(this);
EOL

echo "✅ Fichier env.js template créé avec des placeholders"

# 2. Build de l'application Angular en mode production
echo "Build de l'application Angular..."
ng build --verbose --configuration production

# 3. Vérification/copie manuelle de dist/ddsshare-app/assets/env.js
if [ ! -f dist/ddsshare-app/assets/env.js ]; then
  echo "⚠️  AVERTISSEMENT : dist/ddsshare-app/assets/env.js est absent après le build. Copie manuelle..."
  mkdir -p dist/ddsshare-app/assets
  cp src/assets/env.js dist/ddsshare-app/assets/env.js
  if [ -f dist/ddsshare-app/assets/env.js ]; then
    echo "✅ Copie manuelle réussie."
  else
    echo "❌ ERREUR : Impossible de copier env.js dans le build !"
    exit 1
  fi
else
  echo "✅ dist/ddsshare-app/assets/env.js présent."
fi

# 4. Vérification du contenu du fichier env.js
echo "📄 Contenu du fichier env.js dans le build :"
cat dist/ddsshare-app/assets/env.js

# 5. Construction de l'image Docker
echo "Construction de l'image Docker..."
docker build -f docker/Dockerfile -t ghcr.io/novadesic/novapartage-frontend:latest .

# 6. Push de l'image vers le registry
echo "Push de l'image vers le registry..."
docker push ghcr.io/novadesic/novapartage-frontend:latest

echo "Build et dockerisation terminés avec succès!" 
echo ""
echo "ℹ️  L'image utilise maintenant les variables d'environnement au runtime"
echo "ℹ️  Les placeholders seront remplacés au démarrage du conteneur"
echo "ℹ️  Le script replace-env.sh gère le remplacement des placeholders" 