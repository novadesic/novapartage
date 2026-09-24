#!/bin/bash

# Script pour construire et dockeriser le backend ddsshare avec Java 17
echo "Début du build et dockerisation du backend ddsshare avec Java 17..."

# Configuration Java 17
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64/

if [ ! -d "$JAVA_HOME" ]; then
    echo "Erreur: Java 17 non trouvé dans $JAVA_HOME"
    echo "Versions disponibles:"
    ls /usr/lib/jvm/ | grep java
    exit 1
fi

echo "JAVA_HOME: $JAVA_HOME"
echo "Version Java:"
$JAVA_HOME/bin/java -version

# Sauvegarde du pom.xml original
echo "Sauvegarde du pom.xml original..."
cp pom.xml pom.xml.backup

# Modification temporaire du pom.xml pour Java 17
echo "Modification du pom.xml pour Java 17..."
sed -i 's/<maven.compiler.release>21<\/maven.compiler.release>/<maven.compiler.release>17<\/maven.compiler.release>/g' pom.xml

# Build de l'application Quarkus en mode native (ignorer les tests)
echo "Build de l'application Quarkus en mode native..."
./mvnw clean package -Dnative -DskipTests

# Restauration du pom.xml original
echo "Restauration du pom.xml original..."
mv pom.xml.backup pom.xml

# Construction de l'image Docker
echo "Construction de l'image Docker..."
docker build -f src/main/docker/Dockerfile.native-simple -t ghcr.io/novadesic/novapartage-backend:latest .

# Push de l'image vers le registry
echo "Push de l'image vers le registry..."
docker push ghcr.io/novadesic/novapartage-backend:latest

echo "Build et dockerisation terminés avec succès!" 