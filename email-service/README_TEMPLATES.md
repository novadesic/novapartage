# Système de Templates Centralisé - Guide d'utilisation

## Installation des dépendances

Avant d'utiliser le système de templates, installez les dépendances nécessaires :

```bash
npm install
```

Les nouvelles dépendances sont :
- `html-to-text`: Conversion HTML → texte avancée
- `mime-types`: Détection des types MIME

## Structure des templates

```
templates/
└── novapartage/
    ├── base.html              # Squelette principal
    ├── assets/
    │   └── logo.png          # Logo NovaPartage (à ajouter)
    ├── login-link.html       # Sous-template
    ├── login-link.txt        # Version texte
    └── [autres templates...]
```

## Utilisation de l'API

### Envoyer un email templaté

**POST** `/v3.1/templates/novapartage/send`

```json
{
  "template": "login-link",
  "to": "user@example.com",
  "subject": "Lien de connexion NovaPartage",
  "variables": {
    "loginLink": "https://novapartage.com/login?token=..."
  }
}
```

### Lister les templates disponibles

**GET** `/v3.1/templates/novapartage/list`

### Prévisualiser un template

**GET** `/v3.1/templates/novapartage/login-link/preview`

## Templates disponibles

| Template | Variables requises |
|----------|-------------------|
| `login-link` | `loginLink` |
| `verification-code` | `verificationCode` |
| `manage-shares` | `loginLink` |
| `access-created` | `recipientEmail`, `accessUrl`, `formName`, `ownerEmail`, `validityDays` |
| `access-validated` | `formName`, `fileName`, `recipientEmail`, `validatedBy`, `validatedDate`, `shareDetailUrl` |
| `validation-notification` | `formName`, `fileName`, `recipientEmail`, `validatedBy`, `validatedDate`, `shareDetailUrl` |
| `access-expiring` | `recipientEmail`, `accessUrl`, `formName`, `ownerEmail`, `expiresAtFormatted`, `timeRemainingMessage` |
| `share-deletion-warning` | `shareName`, `monthsInactive`, `daysRemaining`, `daysRemainingPlural`, `createdAtFormatted`, `updatedAtFormatted`, `deletionDateFormatted`, `manageSharesUrl` |

## Gestion des images

Le logo est référencé via `cid:logo@novapartage` dans le template base.html.

Placez le fichier `logo.png` dans `templates/novapartage/assets/`.

Le système embed automatiquement les images comme pièces jointes inline lors de l'envoi.

## Options de configuration

Variables d'environnement :

- `EMAIL_EMBED_IMAGES=true` : Activer l'embedding d'images (défaut: true)
- `EMAIL_IMAGE_FORMAT=cid` : Format d'embedding ("cid" ou "base64")
- `EMAIL_TEXT_VERSION=auto` : Mode de génération texte ("auto", "template", "html-to-text", "none")

## Migration depuis les anciens systèmes

Les templates ont été migrés depuis :
- `auth-service/templates/` → `email-service/templates/novapartage/`
- `backend/src/main/resources/templates/` → `email-service/templates/novapartage/`

Les services `auth-service` et `backend` doivent maintenant utiliser les nouveaux endpoints de `email-service` au lieu de générer les templates localement.

