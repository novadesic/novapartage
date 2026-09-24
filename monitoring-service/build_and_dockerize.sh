#!/bin/bash

# Script pour construire et dockeriser le monitoring-service (Node.js)
set -euo pipefail

echo "Début du build et dockerisation de monitoring-service..."

# 1. Vérifier la présence de package.json
if [ ! -f package.json ]; then
  echo "❌ ERREUR : package.json introuvable dans $(pwd)"
  exit 1
fi

# 2. Pas d'installation locale de dépendances (problèmes de permissions)
#    L'installation est faite DANS l'image Docker via le Dockerfile
echo "⏭️  Saut de l'installation npm locale (gérée dans l'image)"

# 3. Préparer le Dockerfile s'il n'existe pas
if [ ! -f docker/Dockerfile ]; then
  echo "📝 Création d'un Dockerfile minimal dans docker/Dockerfile..."
  mkdir -p docker
  cat > docker/Dockerfile <<'EOL'
FROM node:18-alpine AS base
WORKDIR /app

# Installer uniquement les dépendances de production
COPY package*.json ./
RUN npm ci --omit=dev || npm install --production

# Copier le code
COPY . .

# Variables d'environnement (surchargées au runtime par docker-compose/env)
ENV NODE_ENV=production \
    MONITORING_ENABLED=true \
    MONITORING_SCHEDULE="0 8 * * *"

CMD ["node", "server.js"]
EOL
  echo "✅ Dockerfile créé."
else
  echo "✅ Dockerfile existant détecté."
fi

# 4. Construction de l'image Docker
IMAGE_NAME="ghcr.io/novadesic/novapartage-monitoring-service:latest"
echo "🐳 Construction de l'image Docker: ${IMAGE_NAME}"
docker build -f docker/Dockerfile -t ${IMAGE_NAME} .

# 5. Push de l'image vers le registry
echo "📤 Push de l'image vers le registry: ${IMAGE_NAME}"
docker push ${IMAGE_NAME}

echo "✅ Build et dockerisation de monitoring-service terminés avec succès!"

