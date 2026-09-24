#!/bin/bash

# Script pour construire et dockeriser le backend ddsshare en mode JVM
echo "Début du build et dockerisation du backend ddsshare en mode JVM..."

# Détection automatique de Java
if [ -d "/usr/lib/jvm/java-21-openjdk-amd64" ]; then
    export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64/
    echo "Utilisation de Java 21"
elif [ -d "/usr/lib/jvm/java-17-openjdk-amd64" ]; then
    export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64/
    echo "Utilisation de Java 17"
else
    echo "Erreur: Java 17 ou 21 non trouvé dans /usr/lib/jvm/"
    echo "Versions disponibles:"
    ls /usr/lib/jvm/ | grep java
    exit 1
fi

echo "JAVA_HOME: $JAVA_HOME"
echo "Version Java:"
$JAVA_HOME/bin/java -version

# Build de l'application Quarkus en mode JVM (ignorer les tests)
echo "Build de l'application Quarkus en mode JVM..."
./mvnw clean package -DskipTests

# Construction de l'image Docker JVM
echo "Construction de l'image Docker JVM..."
docker build -f src/main/docker/Dockerfile.jvm-simple -t ghcr.io/novadesic/novapartage-backend:latest .

# Push de l'image vers le registry
echo "Push de l'image vers le registry..."
docker push ghcr.io/novadesic/novapartage-backend:latest

echo "Build et dockerisation terminés avec succès!" 