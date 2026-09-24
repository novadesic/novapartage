FROM node:18-alpine AS base
WORKDIR /app

# Installer les dépendances de production
COPY package*.json ./
RUN npm ci --omit=dev || npm install --production

# Copier le code
COPY . .

# Variables d'environnement par défaut
ENV NODE_ENV=production \
    PORT=3002 \
    HOST=0.0.0.0

EXPOSE 3002

CMD ["node", "server.js"]

