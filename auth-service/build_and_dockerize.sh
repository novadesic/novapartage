#!/bin/bash

# Script pour construire et dockeriser l'auth-service (Node.js)
set -euo pipefail

echo "Début du build et dockerisation de auth-service..."

# 1. Vérifier la présence de package.json
if [ ! -f package.json ]; then
  echo "❌ ERREUR : package.json introuvable dans $(pwd)"
  exit 1
fi

# 2. Pas d'installation locale de dépendances (problèmes de permissions)
#    L'installation est faite DANS l'image Docker via le Dockerfile
echo "⏭️  Saut de l'installation npm locale (gérée dans l'image)"

# 5. Préparer le Dockerfile s'il n'existe pas
if [ ! -f docker/Dockerfile ]; then
  echo "📝 Création d'un Dockerfile minimal dans docker/Dockerfile..."
  mkdir -p docker
  cat > docker/Dockerfile <<'EOL'
FROM node:18-alpine AS base
WORKDIR /app

# Installer uniquement les dépendances de production
COPY package*.json ./
RUN npm ci --omit=dev

# Copier le code
COPY . .

# Variables d'environnement (surchargées au runtime par docker-compose/env)
ENV NODE_ENV=production \
    PORT=3001

EXPOSE 3001
CMD ["node", "server.js"]
EOL
  echo "✅ Dockerfile créé."
else
  echo "✅ Dockerfile existant détecté."
fi

# 3. Construction de l'image Docker
IMAGE_NAME="ghcr.io/novadesic/novapartage-auth-service:latest"
echo "🐳 Construction de l'image Docker: ${IMAGE_NAME}"
docker build -f docker/Dockerfile -t ${IMAGE_NAME} .

# 4. Push de l'image vers le registry
echo "📤 Push de l'image vers le registry: ${IMAGE_NAME}"
docker push ${IMAGE_NAME}

echo "✅ Build et dockerisation de auth-service terminés avec succès!"

