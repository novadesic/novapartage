# Build et Dockerisation - DDS Share Backend

## Vue d'ensemble

Le backend DDS Share utilise Quarkus en mode natif pour des performances optimales et une image Docker légère.

## Prérequis

- Java 17 ou supérieur
- GraalVM pour la compilation native
- Docker
- Accès au registry GitLab

## Script de Build et Dockerisation

### Utilisation Simple

```bash
# Build et dockerisation complète (détection automatique Java 21/17)
./build_and_dockerize.sh

# Ou avec Java 17 spécifiquement (modifie temporairement pom.xml)
./build_and_dockerize_java17.sh
```

### Étapes Détaillées

Le script `build_and_dockerize.sh` effectue les opérations suivantes :

1. **Détection Java** : Détecte automatiquement Java 21 ou 17 disponible
2. **Configuration Java** : Définit `JAVA_HOME` pour la version détectée
3. **Build Natif** : Compile l'application Quarkus en mode natif
4. **Construction Docker** : Crée l'image avec le tag `ghcr.io/novadesic/novapartage-backend:latest`
5. **Push Registry** : Pousse l'image vers le registry GitLab

Le script `build_and_dockerize_java17.sh` est une alternative qui :
1. **Force Java 17** : Utilise spécifiquement Java 17
2. **Modifie pom.xml** : Change temporairement la version Java dans pom.xml
3. **Restaure pom.xml** : Remet le fichier original après le build

### Build Manuel

Si vous souhaitez effectuer les étapes manuellement :

```bash
# Option 1: Avec Java 21 (recommandé si disponible)
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64/
./mvnw clean package -Dnative

# Option 2: Avec Java 17 (modifier pom.xml temporairement)
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64/
sed -i 's/<maven.compiler.release>21<\/maven.compiler.release>/<maven.compiler.release>17<\/maven.compiler.release>/g' pom.xml
./mvnw clean package -Dnative
# Restaurer pom.xml après le build

# Construction Docker
docker build -f src/main/docker/Dockerfile.native-simple -t ghcr.io/novadesic/novapartage-backend:latest .

# Push vers le registry
docker push ghcr.io/novadesic/novapartage-backend:latest
```

## Dockerfile Simplifié

Le `Dockerfile.native-simple` est optimisé pour :

- **Image de base légère** : UBI 9 minimal
- **Dépendances minimales** : Seulement curl et ca-certificates
- **Sécurité** : Utilisateur non-root (1001)
- **Performance** : Mode natif Quarkus

### Différences avec ddspublishing

Contrairement à ddspublishing qui nécessite Chrome et de nombreuses dépendances pour la génération de PDF, le backend ddsshare utilise un Dockerfile simplifié car il n'a pas besoin de :

- Chrome/Chromium
- Node.js
- Polices de caractères
- Outils de conversion PDF
- Puppeteer

## Déploiement

### Exécution Locale

```bash
docker run -d \
  -p 8080:8080 \
  -e QUARKUS_PROFILE=prod \
  ghcr.io/novadesic/novapartage-backend:latest
```

### Déploiement avec docker-compose

```yaml
version: '3.8'
services:
  ddsshare-backend:
    image: ghcr.io/novadesic/novapartage-backend:latest
    ports:
      - "8080:8080"
    environment:
      - QUARKUS_PROFILE=prod
    restart: unless-stopped
```

## Variables d'Environnement

Le backend Quarkus supporte les variables d'environnement standard :

- `QUARKUS_PROFILE` : Profil de configuration (dev, prod, test)
- `QUARKUS_HTTP_PORT` : Port d'écoute (défaut: 8080)
- `QUARKUS_HTTP_HOST` : Interface d'écoute (défaut: 0.0.0.0)

## Avantages du Mode Natif

1. **Démarrage rapide** : < 50ms vs plusieurs secondes en JVM
2. **Consommation mémoire réduite** : ~50MB vs ~200MB
3. **Image Docker légère** : ~100MB vs ~400MB
4. **Performance optimale** : Pas de warmup JVM

## Dépannage

### Erreur de Build Natif

Si le build natif échoue, vérifiez :

1. **GraalVM installé** :
   ```bash
   java -version
   # Doit afficher GraalVM
   ```

2. **Variables d'environnement** :
   ```bash
   echo $JAVA_HOME
   echo $GRAALVM_HOME
   ```

3. **Dépendances système** :
   ```bash
   # Sur Ubuntu/Debian
   sudo apt-get install build-essential libz-dev zlib1g-dev
   ```

### Erreur Docker

Si la construction Docker échoue :

1. **Espace disque** : Vérifiez l'espace disponible
2. **Permissions** : Assurez-vous d'avoir les droits Docker
3. **Registry** : Vérifiez l'accès au registry GitLab 