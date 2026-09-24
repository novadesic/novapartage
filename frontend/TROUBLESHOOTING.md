# Guide de dépannage - Variables d'environnement

## Nouvelle approche : Variables d'environnement au runtime

### Principe
Les variables d'environnement sont maintenant remplacées **au runtime** dans le conteneur Docker, pas au build time. Cela permet de redéfinir les variables via le docker-compose.yml sur le serveur de déploiement.

### Avantages
- ✅ Variables configurables au déploiement
- ✅ Même image Docker pour différents environnements
- ✅ Pas de rebuild nécessaire pour changer les variables
- ✅ Séparation claire entre build et configuration

## Problème : "Erreur: Fichier env.js non trouvé"

### Cause
Le conteneur Docker ne trouve pas le fichier `env.js` dans le bon répertoire lors de l'exécution du script `replace-env.sh`.

### Solution

1. **Vérifier que le fichier env.js existe** :
   ```bash
   ls -la src/assets/env.js
   ```

2. **Tester le remplacement localement** :
   ```bash
   cd ddsshare/frontend
   ./test-env-replacement.sh
   ```

3. **Vérifier les variables d'environnement dans docker-compose.yml** :
   Assurez-vous que le service `frontend` contient toutes les variables nécessaires :
   ```yaml
   environment:
     KEYCLOAK_URL: https://${DDSSHARE_DOMAIN}/auth
     KEYCLOAK_REALM: ddsshare
     KEYCLOAK_CLIENT_ID: ddsshare-frontend
     BACKEND_URL: https://${DDSSHARE_DOMAIN}/backend
     BACKEND_API_PATH: /api
     APP_NAME: DDS Share
     APP_VERSION: 1.0.0
     PRODUCTION: true
   ```

4. **Rebuilder l'image Docker** :
   ```bash
   cd ddsshare/frontend
   ./build_and_dockerize.sh
   ```

5. **Redémarrer les conteneurs** :
   ```bash
   cd ddsshare/MEP
   docker-compose down
   docker-compose up -d
   ```

### Variables d'environnement requises

Voir aussi [docs/INSTALL.md](../docs/INSTALL.md) et `env.example`. Keycloak n’est **plus** utilisé : authentification = auth-service (magic link).

| Variable | Description | Exemple |
|----------|-------------|---------|
| `CUSTOM_AUTH_ENDPOINT` | URL auth-service (côté navigateur) | `http://localhost/auth` |
| `BACKEND_URL` | URL du backend | `http://localhost/backend` |
| `BACKEND_API_PATH` | Chemin de l'API backend | `/api` |
| `APP_NAME` | Nom de l'application | `NovaPartage` |
| `APP_VERSION` | Version de l'application | `1.0.0` |
| `PRODUCTION` | Mode production | `true` |

### Exemple de déploiement

```yaml
# Extrait — variables frontend (self-host)
services:
  frontend:
    image: ghcr.io/novadesic/novapartage-frontend:latest
    environment:
      CUSTOM_AUTH_ENDPOINT: https://example.com/auth
      BACKEND_URL: https://example.com/backend
      PRODUCTION: "true"
```

### Debug

Pour déboguer le problème :

1. **Vérifier les logs du conteneur** :
   ```bash
   docker logs novapartage-frontend
   ```

2. **Entrer dans le conteneur** :
   ```bash
   docker exec -it novapartage-frontend /bin/sh
   ```

3. **Vérifier le fichier env.js dans le conteneur** :
   ```bash
   cat /usr/share/nginx/html/assets/env.js
   ```

4. **Tester le script manuellement** :
   ```bash
   /usr/local/bin/replace-env.sh
   ```

### Différence avec l'ancienne approche

| Aspect | Ancienne approche | Nouvelle approche |
|--------|-------------------|-------------------|
| **Timing** | Build time | Runtime |
| **Flexibilité** | Variables figées dans l'image | Variables configurables au déploiement |
| **Rebuild** | Nécessaire pour changer les variables | Pas nécessaire |
| **Environnements** | Image différente par environnement | Même image, configuration différente | 