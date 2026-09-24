# NovaPartage

Partage sécurisé de fichiers Excel avec formulaires interactifs, authentification par magic link et déploiement self-host.

## Licence

Apache License 2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE).

## Stack

| Composant | Technologie |
|-----------|-------------|
| Backend | Quarkus 3, Java 21, PostgreSQL, Flyway |
| Frontend | Angular 17 |
| Auth | Node.js (magic link, JWT, Redis) |
| Email | Node.js (SMTP / Mailjet) |
| Monitoring | Node.js (maintenance, stats anonymisées) |

## Documentation

| Guide | Description |
|-------|-------------|
| [docs/INSTALL.md](docs/INSTALL.md) | Installation self-host et développement local |
| [docs/GUIDE-UTILISATEUR.md](docs/GUIDE-UTILISATEUR.md) | Utilisation de l'application |

## Installation

### Démarrage rapide (self-host)

```bash
cp env.example .env
./scripts/generate-secrets.sh --write
./scripts/init-dirs.sh
docker compose -f docker-compose.selfhost.yml up --build -d
./scripts/init-superadmin.sh admin@example.com
```

Application : [http://localhost](http://localhost) — emails de test : [http://localhost:8025](http://localhost:8025)

### Développement (hot-reload)

```bash
docker compose up -d                    # infra (postgres, auth, nginx…)
cd backend && ./start.sh                # port 8083
cd frontend && ./start.sh               # port 4200
```

Voir [docs/INSTALL.md](docs/INSTALL.md) pour le détail.

## Sécurité

- [SECURITY.md](SECURITY.md) — signalement de vulnérabilités
- [README-SECURITY.md](README-SECURITY.md) — notes self-host

## Contribution

[CONTRIBUTING.md](CONTRIBUTING.md) — [CONTRIBUTORS.md](CONTRIBUTORS.md)

## Propriété intellectuelle

Copyright (c) 2024-2026 **Novadesic SAS**.  
Third-party components: [THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md).

## CI

GitHub Actions: [`.github/workflows/ci.yml`](.github/workflows/ci.yml)  
Scan secrets local: `./scripts/run-gitleaks.sh`
