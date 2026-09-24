#!/bin/bash

# Script pour construire et dockeriser le backend ddsshare avec fallback JVM
echo "Début du build et dockerisation du backend ddsshare..."

export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64/
echo "Utilisation de Java 21"
echo "JAVA_HOME: $JAVA_HOME"
echo "Version Java:"
$JAVA_HOME/bin/java -version

# Essayer le build natif d'abord
echo "Tentative de build natif..."
if ./mvnw clean package -Dnative -DskipTests; then
    echo "✅ Build natif réussi !"
    echo "Construction de l'image Docker native..."
    docker build -f src/main/docker/Dockerfile.native-simple -t ghcr.io/novadesic/novapartage-backend:latest .
else
    echo "❌ Build natif échoué, basculement vers le mode JVM..."
    echo "Build de l'application Quarkus en mode JVM..."
    ./mvnw clean package -DskipTests
    
    echo "Construction de l'image Docker JVM..."
    docker build -f src/main/docker/Dockerfile.jvm-simple -t ghcr.io/novadesic/novapartage-backend:latest .
fi

# Push de l'image vers le registry
echo "Push de l'image vers le registry..."
docker push ghcr.io/novadesic/novapartage-backend:latest

echo "Build et dockerisation terminés avec succès!" 