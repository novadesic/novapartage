FROM node:18-alpine AS base
WORKDIR /app

# Installer uniquement les dépendances de production
COPY package*.json ./
RUN npm ci --omit=dev || npm install --production

# Copier le code
COPY . .

# Variables d'environnement (surchargées au runtime par docker-compose/env)
ENV NODE_ENV=production \
    PORT=3001

EXPOSE 3001
CMD ["node", "server.js"]

