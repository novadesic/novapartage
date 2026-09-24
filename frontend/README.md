# NovaPartage Frontend

Application Angular 17 pour NovaPartage.

## Prérequis

- Node.js 18+
- npm

## Installation

Guide principal : **[docs/INSTALL.md](../docs/INSTALL.md)**

## Démarrage rapide (développement)

À la racine du projet, lancer l'infrastructure Docker puis le frontend :

```bash
# Terminal 1 — infra (depuis la racine)
cp env.example .env
./scripts/generate-secrets.sh --write
docker compose up -d

# Terminal 2 — backend
cd backend && ./start.sh

# Terminal 3 — frontend
cd frontend
npm install   # première fois
./start.sh
```

- **Port** : `4200`
- **Proxy dev** : `/backend` → `localhost:8083`, `/auth` → `localhost:3001`
- **Accès** : [http://localhost:4200](http://localhost:4200) ou [http://localhost](http://localhost) via nginx

Le script `./start.sh` génère `src/assets/env.js` à partir des variables d'environnement (voir `env.example` à la racine).

Équivalent manuel : `npm start` (nécessite un `env.js` déjà configuré).

## Build production

```bash
npm run build
```

Artefacts dans `dist/ddsshare-app/`.

## Tests

```bash
npm test              # unitaires (Karma)
npm run e2e           # Cypress
npm run test:integration
```
