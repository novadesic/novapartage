FROM nginx:stable-alpine

# Installation de bash et sed pour le script de remplacement
RUN apk add --no-cache bash sed

# Copie des fichiers de configuration
COPY ./docker/nginx.conf /etc/nginx/nginx.conf
COPY ./scripts/replace-env.sh /usr/local/bin/replace-env.sh
COPY ./dist/ddsshare-app/browser/ /usr/share/nginx/html

# S'assurer que le fichier env.js existe dans les assets
RUN ls -la /usr/share/nginx/html/assets/ || echo "Dossier assets non trouvé"
RUN find /usr/share/nginx/html -name "env.js" || echo "Fichier env.js non trouvé"

# Rendre le script exécutable
RUN chmod +x /usr/local/bin/replace-env.sh

# Script d'entrée pour remplacer les variables d'environnement
COPY ./docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"] 