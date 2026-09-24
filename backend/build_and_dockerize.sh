#!/bin/bash

# Script pour construire et dockeriser le backend ddsshare
echo "Début du build et dockerisation du backend ddsshare..."


export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64/
echo "Utilisation de Java 21"

echo "JAVA_HOME: $JAVA_HOME"
echo "Version Java:"
$JAVA_HOME/bin/java -version

# Build de l'application Quarkus en mode native (ignorer les tests)
echo "Build de l'application Quarkus en mode native..."
./mvnw clean package -Dnative -DskipTests

# Construction de l'image Docker
echo "Construction de l'image Docker..."
docker build -f src/main/docker/Dockerfile.native-simple -t ghcr.io/novadesic/novapartage-backend:latest .

# Push de l'image vers le registry
echo "Push de l'image vers le registry..."
docker push ghcr.io/novadesic/novapartage-backend:latest

echo "Build et dockerisation terminés avec succès!" 