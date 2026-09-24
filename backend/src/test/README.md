# Tests unitaires - Configuration

## ⚠️ PostgreSQL requis

Les tests **nécessitent PostgreSQL** car les entités utilisent le type `JSONB` qui est spécifique à PostgreSQL. H2 ne supporte pas ce type.

## Installation rapide de PostgreSQL

### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### macOS
```bash
brew install postgresql
brew services start postgresql
```

### Windows
Télécharger et installer depuis : https://www.postgresql.org/download/windows/

## Configuration de la base de données de test

1. **Créer la base de données de test** :
```bash
# Se connecter à PostgreSQL
sudo -u postgres psql
# Ou: psql -U postgres

# Créer la base de données
CREATE DATABASE novapartage_test;

# Quitter
\q
```

2. **Vérifier la configuration** dans `src/test/resources/application.properties` :
```properties
quarkus.datasource.db-kind=postgresql
quarkus.datasource.jdbc.url=jdbc:postgresql://localhost:5432/novapartage_test
quarkus.datasource.username=postgres
quarkus.datasource.password=postgres
```

3. **Ajuster les identifiants** si nécessaire (variables d'environnement) :
```bash
export DB_USERNAME=postgres
export DB_PASSWORD=votre_mot_de_passe
```

## Exécution des tests

```bash
# Tous les tests
./mvnw test

# Un test spécifique
./mvnw test -Dtest=AccessTokenTest

# Plusieurs tests
./mvnw test -Dtest=AccessTokenTest,ShareTest
```

## Tests disponibles

- **AccessTokenTest** (15 tests) - Tests pour `deleteExpiredTokens()` et `deleteValidatedTokens()`
- **ShareTest** (12 tests) - Tests pour les méthodes de recherche et les statuts
- **DataRetentionServiceTest** (12 tests) - Tests pour tous les nettoyages automatiques
- **EmailServiceTest** (3 tests) - Tests pour l'envoi d'emails de notification

**Total : 42 tests unitaires**

## Dépannage

### Erreur : "Unable to find datasource"
- Vérifier que PostgreSQL est démarré : `sudo systemctl status postgresql`
- Vérifier que la base de données existe : `psql -U postgres -l | grep novapartage_test`
- Vérifier les identifiants dans `application.properties`

### Erreur : "Connection refused"
- Vérifier que PostgreSQL écoute sur le port 5432 : `sudo netstat -tlnp | grep 5432`
- Vérifier le fichier `pg_hba.conf` pour les permissions de connexion

### Tests ignorés (skipped)
- Normal si PostgreSQL n'est pas configuré ou accessible
- Les tests seront exécutés une fois PostgreSQL configuré

## Alternative : Docker avec Testcontainers

Si Docker est disponible, vous pouvez utiliser Testcontainers qui démarre automatiquement PostgreSQL :

1. Démarrer Docker
2. Dans `application.properties`, commenter `quarkus.devservices.enabled=false`
3. Les tests utiliseront automatiquement Testcontainers
