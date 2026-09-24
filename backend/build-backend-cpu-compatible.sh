#!/bin/bash

echo "🔧 Construction de l'image backend compatible CPU (options explicites)..."
echo ""

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "../backend/pom.xml" ]; then
    echo "❌ Erreur: Ce script doit être exécuté depuis le répertoire MEP/"
    echo "   Le répertoire backend doit être accessible via ../backend/"
    exit 1
fi

# Aller dans le répertoire backend
cd ../backend

echo "📁 Répertoire backend: $(pwd)"
echo ""

# Configuration pour compatibilité CPU
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64/
echo "🔧 Configuration Java:"
echo "   JAVA_HOME: $JAVA_HOME"
echo "   Version Java:"
$JAVA_HOME/bin/java -version

echo ""
echo "🏗️ Build de l'application Quarkus en mode native avec compatibilité CPU..."

# Build avec options de compatibilité CPU explicites
./mvnw clean package -Dnative \
    -Dquarkus.native.additional-build-args="--no-server,--initialize-at-build-time=io.quarkus.runtime.graal.QuarkusNativeImageBanner,--report-unsupported-elements-at-runtime,--allow-incomplete-classpath,--no-fallback,-march=x86-64,-mtune=generic,-mno-avx,-mno-avx2,-mno-bmi,-mno-bmi2,-mno-fma,-mno-sse4.1,-mno-sse4.2,-mno-popcnt,-mno-lzcnt" \
    -Dquarkus.native.container-build=true \
    -Dquarkus.native.builder-image=quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-21 \
    -DskipTests

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors du build native avec options CPU"
    echo ""
    echo "🔄 Tentative avec build JVM comme fallback..."
    ./mvnw clean package -DskipTests
    
    if [ $? -ne 0 ]; then
        echo "❌ Erreur lors du build JVM"
        exit 1
    fi
    
    echo "✅ Build JVM réussi, construction de l'image JVM..."
    
    # Construction de l'image JVM
    docker build -f src/main/docker/Dockerfile.jvm \
        -t ghcr.io/novadesic/novapartage-backend:latest .
else
    echo "✅ Build native réussi, construction de l'image native..."
    
    # Construction de l'image native
    docker build -f src/main/docker/Dockerfile.native-compatible \
        -t ghcr.io/novadesic/novapartage-backend:latest .
fi

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de la construction de l'image Docker"
    exit 1
fi

echo ""
echo "📤 Push de l'image vers le registry..."

# Push de l'image
docker push ghcr.io/novadesic/novapartage-backend:latest

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors du push de l'image"
    exit 1
fi

echo ""
echo "✅ Image backend compatible CPU construite et poussée avec succès!"
echo ""
echo "🔄 Pour appliquer les changements :"
echo "   cd ../MEP"
echo "   sudo docker compose down"
echo "   sudo docker compose up -d"
echo ""
echo "🔍 Pour vérifier :"
echo "   ./test-backend-config.sh" 