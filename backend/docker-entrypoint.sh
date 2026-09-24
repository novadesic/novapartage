#!/bin/sh
set -e

# Corrige les permissions du volume monté (bind mount hôte souvent UID 1000)
mkdir -p /app/files/temp /app/files/users
chown -R novapartage:novapartage /app/files

exec su-exec novapartage:novapartage java -jar /app/quarkus-app/quarkus-run.jar "$@"
