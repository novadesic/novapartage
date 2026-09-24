# NovaPartage Backend

Service backend Quarkus pour NovaPartage (API REST, fichiers Excel, partages sécurisés).

## Prérequis

- Java 21+
- Maven 3.8+ (ou `./mvnw`)
- PostgreSQL (via Docker ou local)

## Installation

Voir le guide principal : **[docs/INSTALL.md](../docs/INSTALL.md)**

## Démarrage rapide (développement)

```bash
# À la racine du projet : .env avec secrets générés
./scripts/generate-secrets.sh --write

# Infra Docker (postgres, redis, mailpit, auth, email…)
docker compose up -d

# Backend
cd backend
./start.sh
```

- **Port** : `8083`
- **Stockage fichiers** : `./user_files` (dev)
- **Secrets requis** : `APP_AUTH_JWT_SECRET` (= `JWT_SECRET`), `APP_ENCRYPTION_MASTER_KEY`

Frontend (terminal séparé) : `cd frontend && ./start.sh`

## Mode production (JVM)

```bash
./mvnw clean package -DskipTests
java -jar target/quarkus-app/quarkus-run.jar
```

Ou image Docker :

```bash
docker build -f Dockerfile -t novapartage-backend .
```

## APIs

Documentation OpenAPI : `http://localhost:8083/openapi` (ou via nginx : `http://localhost/backend/openapi`)

Exemple upload Excel : **POST** `/api/excel/upload`

## Configuration

Variables principales (voir `env.example` à la racine) :

| Variable | Description |
|----------|-------------|
| `APP_AUTH_JWT_SECRET` | Secret JWT (identique à auth-service) |
| `APP_ENCRYPTION_MASTER_KEY` | Clé chiffrement fichiers (Base64 32 bytes) |
| `DB_HOST`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` | PostgreSQL |

Profil Quarkus : `%dev` (local) / `%prod` (Docker self-host).
