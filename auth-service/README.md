# Service d'Authentification NovaPartage

Service d'authentification sécurisé pour NovaPartage avec support de la connexion sans mot de passe par email.

## 🚀 Fonctionnalités

- ✅ Authentification sans mot de passe par email
- ✅ Génération de tokens JWT sécurisés
- ✅ Rate limiting pour la protection contre les attaques
- ✅ Validation d'email
- ✅ Configuration flexible via variables d'environnement
- ✅ Support SMTP externe pour la production
- ✅ CORS configurable
- ✅ Logging sécurisé
- ✅ Health check endpoint

## 🔧 Configuration

### Variables d'environnement

Le service est entièrement configurable via des variables d'environnement. Voir le fichier `../env.example` pour la liste complète des paramètres.

### Configuration de développement

Pour le développement local, utilisez la configuration par défaut avec MailHog :

```bash
# Démarrer les services
docker-compose up -d

# Le service sera disponible sur http://localhost:3001
# MailHog UI sur http://localhost:8025
```

### Configuration de production

Pour la production, configurez les variables suivantes :

```bash
# Variables obligatoires
NODE_ENV=production
JWT_SECRET=your-very-long-and-secure-random-string-here
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=your-email@yourdomain.com
SMTP_PASS=your-secure-password
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
FRONTEND_URL=https://yourdomain.com
AUTH_CALLBACK_URL=https://yourdomain.com/auth/callback
```

## 📡 Endpoints

### POST `/api/sign-in/email/passwordless`
Envoie un lien de connexion par email.

**Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "Lien de connexion envoyé",
  "email": "user@example.com"
}
```

### GET `/callback`
Endpoint de callback pour la connexion via le lien email.

**Query parameters:**
- `email`: Adresse email de l'utilisateur
- `token`: Token temporaire de connexion

**Response:** Redirection vers le frontend avec le token JWT.

### GET `/oidc/me`
Récupère les informations de l'utilisateur connecté.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "sub": "user@example.com",
  "email": "user@example.com",
  "name": "user",
  "firstName": "user",
  "email_verified": true,
  "iat": 1234567890,
  "exp": 1234571490
}
```

### GET `/health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "environment": "development",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 🔒 Sécurité

### Améliorations implémentées

1. **Clé JWT sécurisée** : Utilisation de variables d'environnement
2. **Rate limiting** : Protection contre les attaques par force brute
3. **Validation d'email** : Vérification du format des emails
4. **CORS configurable** : Limitation des domaines autorisés
5. **Logging sécurisé** : Pas d'exposition de données sensibles en production
6. **Tokens temporaires sécurisés** : Génération cryptographique
7. **Validation JWT** : Vérification de l'issuer et audience

### Recommandations pour la production

1. Utilisez une clé JWT longue et aléatoire
2. Configurez HTTPS
3. Limitez les domaines CORS
4. Utilisez un service SMTP sécurisé
5. Activez les logs d'audit
6. Configurez un reverse proxy (nginx)
7. Utilisez des secrets management (Docker secrets, Kubernetes secrets, etc.)

## 🐳 Déploiement

### Docker Compose

```bash
# Développement
docker-compose up -d

# Production (avec fichier .env)
docker-compose --env-file .env up -d
```

### Variables d'environnement

Créez un fichier `.env` basé sur `../env.example` et configurez les valeurs appropriées pour votre environnement.

## 📝 Logs

Le service utilise un système de logging configurable :

- `debug` : Tous les logs (développement)
- `info` : Logs informatifs (par défaut)
- `warn` : Avertissements et erreurs
- `error` : Erreurs uniquement

En production, les données sensibles ne sont pas loggées.

## 🔄 Durée de validité des JWT

Les tokens JWT sont valables pendant **1 heure** par défaut, configurable via la variable `JWT_EXPIRES_IN`.

## 🛠️ Développement

```bash
# Installer les dépendances
npm install

# Démarrer en mode développement
npm start

# Le service sera disponible sur http://localhost:3001
```
