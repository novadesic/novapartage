#!/bin/bash

# Script d'entrée pour le conteneur Docker
echo "Démarrage du conteneur ddsshare-frontend..."

# Remplacement des variables d'environnement dans env.js
echo "Remplacement des variables d'environnement..."
/usr/local/bin/replace-env.sh

# Démarrage de nginx
echo "Démarrage de nginx..."
exec nginx -g "daemon off;" 