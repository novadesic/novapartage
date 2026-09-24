# Installation NovaPartage

Guide d'installation pour une instance self-host ou un environnement de développement local.

> Guide utilisateur (parcours applicatif) : [GUIDE-UTILISATEUR.md](GUIDE-UTILISATEUR.md)

## Prérequis

| Composant | Version minimale |
|-----------|------------------|
| Docker | 24+ |
| Docker Compose | v2 (`docker compose`) |
| RAM | 4 Go recommandés |
| Disque | ~2 Go (images + build) |

> [!NOTE]
> **Pour les utilisateurs Windows** : Les scripts `.sh` mentionnés dans ce guide doivent être exécutés en ajoutant `bash ` devant la commande (par exemple : `bash ./scripts/generate-secrets.sh`) via **Git Bash** (ou WSL).

**Ports utilisés (self-host)** :

| Port | Service |
|------|---------|
| 80 | Application (nginx) |
| 8025 | Mailpit (interface web emails) |
| 1025 | Mailpit (SMTP) |
| 5432 | PostgreSQL (optionnel, exposé pour debug) |

---

## Installation self-host (recommandée)

Stack complète en conteneurs : postgres, redis, auth, email, backend Quarkus, frontend Angular, nginx.

### 1. Cloner et configurer

```bash
git clone <url-du-depot> novapartage
cd novapartage
cp env.example .env
./scripts/generate-secrets.sh --write
./scripts/init-dirs.sh
```

`init-dirs.sh` crée `user_files/temp` et `user_files/users` (requis pour le stockage et le monitoring).

Le script génère et écrit dans `.env` :

- `JWT_SECRET` et `APP_AUTH_JWT_SECRET` (**identiques** — obligatoire)
- `APP_ENCRYPTION_MASTER_KEY` (Base64, 32 bytes)
- `CSRF_SECRET`
- `POSTGRES_PASSWORD` et `DB_PASSWORD` (identiques)

### 2. Démarrer la stack

```bash
docker compose -f docker-compose.selfhost.yml up --build -d
```

Le premier build peut prendre **10 à 15 minutes** (Maven + Angular).

Vérifier l'état :

```bash
docker compose -f docker-compose.selfhost.yml ps
curl http://localhost/status
```

### 3. Créer le premier superadmin

```bash
./scripts/init-superadmin.sh admin@example.com
```

Le backend doit avoir démigré la base (Flyway) au moins une fois — il démarre avec le compose.

### 4. Premier login

1. Ouvrir [http://localhost](http://localhost)
2. Saisir l'email superadmin
3. Ouvrir [http://localhost:8025](http://localhost:8025) (Mailpit) et cliquer le lien de connexion
4. Vous êtes connecté avec les droits superadmin (invitations démo, etc.)

### 5. Arrêt et suppression

```bash
docker compose -f docker-compose.selfhost.yml down
# Supprimer aussi les volumes (données) :
docker compose -f docker-compose.selfhost.yml down -v
```

---

## Installation développement (hot-reload)

Pour modifier le code backend/frontend sans rebuild Docker à chaque changement.

### Terminal 1 — Infrastructure

```bash
cp env.example .env
./scripts/generate-secrets.sh --write
./scripts/init-dirs.sh
docker compose up -d
```

Démarre postgres, redis, mailpit, auth-service, email-service, monitoring, nginx (sans backend/frontend conteneurisés).

### Terminal 2 — Backend

```bash
cd backend
./start.sh
```

- Port **8083**
- Stockage fichiers : `./user_files`
- Charge `.env` depuis `backend/` ou la racine du projet

### Terminal 3 — Frontend

```bash
cd frontend
npm install   # première fois uniquement
./start.sh
```

- Port **4200** avec proxy vers `/backend` (8083) et `/auth` (3001) — `proxy.conf.json`
- Accès direct : [http://localhost:4200](http://localhost:4200)
- Ou via nginx : [http://localhost](http://localhost) — dans ce cas, définir `CUSTOM_AUTH_ENDPOINT=http://localhost/auth` et `BACKEND_URL=http://localhost/backend` dans `.env`

Équivalent : `npm start` (sans génération automatique de `env.js`).

### Superadmin en dev

```bash
./scripts/init-superadmin.sh --compose-file docker-compose.yml admin@example.com
```

*(Adapter si postgres du dev compose utilise un mot de passe différent — aligner `.env`.)*

---

## Variables obligatoires

| Variable | Service | Description |
|----------|---------|-------------|
| `JWT_SECRET` | auth-service | Secret HS256 pour émettre les JWT |
| `APP_AUTH_JWT_SECRET` | backend | **Doit être identique à `JWT_SECRET`** |
| `APP_ENCRYPTION_MASTER_KEY` | backend | Chiffrement fichiers (Base64 32 bytes) |
| `CSRF_SECRET` | auth-service | Protection CSRF |
| `POSTGRES_PASSWORD` / `DB_PASSWORD` | postgres, auth, backend | Mot de passe PostgreSQL |

Génération manuelle (alternative au script) :

```bash
openssl rand -base64 32
```

---

## Dépannage

### 502 sur `/backend/` ou `/auth/`

```bash
docker compose -f docker-compose.selfhost.yml logs backend
docker compose -f docker-compose.selfhost.yml logs auth-service
```

Causes fréquentes :

- Backend pas encore démarré (Flyway, compilation JVM) — attendre 1–2 min
- `APP_ENCRYPTION_MASTER_KEY` invalide ou vide en prod — regénérer avec `./scripts/generate-secrets.sh --force`
- `JWT_SECRET` ≠ `APP_AUTH_JWT_SECRET` — regénérer avec `--write`

### Erreur clé de chiffrement

Message du type « APP_ENCRYPTION_MASTER_KEY invalide » : la valeur doit être du Base64 représentant **exactement 32 bytes** après décodage. Utilisez `./scripts/generate-secrets.sh --write`.

### Mot de passe PostgreSQL après régénération des secrets

Si vous régénérez `POSTGRES_PASSWORD` dans `.env` alors qu'un volume PostgreSQL existe déjà, le backend échouera avec « password authentication failed ». Réinitialisez les volumes :

```bash
docker compose -f docker-compose.selfhost.yml down -v
docker compose -f docker-compose.selfhost.yml up -d
```

### Permissions `user_files` / répertoire temp introuvable

Symptôme monitoring : `Répertoire temp introuvable: /app/files/temp`.

```bash
./scripts/init-dirs.sh
# Linux (UID backend Docker) :
sudo chown -R 1001:1001 user_files
# macOS (Docker Desktop) : le mkdir suffit en général, puis :
docker compose restart backend monitoring-service
```

### Frontend vide ou 502

```bash
docker compose -f docker-compose.selfhost.yml logs frontend
docker compose -f docker-compose.selfhost.yml logs nginx
```

### Table superadmin absente

Flyway n'a pas encore tourné. Redémarrer le backend :

```bash
docker compose -f docker-compose.selfhost.yml up -d backend
```

---

## Production (indications)

- Remplacer Mailpit par un relais SMTP réel (`SMTP_HOST`, credentials dans `.env`)
- `COOKIE_SECURE=true` si HTTPS
- `HSTS_ENABLED=true` derrière TLS
- Ne pas exposer le port PostgreSQL (5432) publiquement
- Regénérer tous les secrets (`./scripts/generate-secrets.sh --force`) — ne jamais réutiliser les secrets de dev
- Sauvegarder le volume `postgres_data` et le répertoire `user_files`

---

## Fichiers utiles

| Fichier | Rôle |
|---------|------|
| `docker-compose.selfhost.yml` | Stack complète self-host |
| `docker-compose.yml` | Infra dev (sans backend/frontend buildés) |
| `scripts/generate-secrets.sh` | Génération secrets |
| `scripts/init-superadmin.sh` | Premier administrateur |
| `env.example` | Modèle de configuration |
