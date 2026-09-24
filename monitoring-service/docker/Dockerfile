FROM node:18-alpine AS base
WORKDIR /app

# Installer les dépendances de production
COPY package*.json ./
RUN npm ci --omit=dev || npm install --production

# Copier le code
COPY . .

# Variables d'environnement par défaut
ENV NODE_ENV=production \
    MONITORING_ENABLED=true \
    MONITORING_SCHEDULE="0 8 * * *"

CMD ["node", "server.js"]

