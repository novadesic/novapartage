# Spécifications - Système de Templates Centralisé NovaPartage

## 1. Vue d'ensemble

Le système de templates centralisé permet de gérer tous les emails de NovaPartage depuis email-service avec :
- Un squelette commun (header, logo, footer)
- Des sous-templates pour chaque type d'email
- Embedding automatique des images (logo)
- Génération automatique de versions texte

## 2. Structure des templates

```
email-service/
├── templates/
│   └── novapartage/              # Groupe de templates NovaPartage
│       ├── base.html            # Squelette principal
│       ├── base.txt             # Squelette texte (optionnel)
│       ├── assets/              # Images et ressources
│       │   └── logo.png         # Logo NovaPartage
│       ├── login-link.html      # Sous-template : lien de connexion
│       ├── login-link.txt       # Version texte
│       ├── verification-code.html
│       ├── verification-code.txt
│       ├── manage-shares.html
│       ├── manage-shares.txt
│       ├── access-created.html
│       ├── access-created.txt
│       ├── access-validated.html
│       ├── access-validated.txt
│       ├── validation-notification.html
│       ├── validation-notification.txt
│       ├── access-expiring.html
│       └── access-expiring.txt
```

## 3. API Endpoints

### 3.1 POST `/v3.1/templates/novapartage/send`

Envoie un email templaté du groupe "novapartage".

**Body:**
```json
{
  "template": "login-link",
  "to": "user@example.com",
  "subject": "Lien de connexion NovaPartage",
  "variables": {
    "loginLink": "https://..."
  },
  "options": {
    "embedImages": true,
    "imageFormat": "cid",
    "textVersion": "auto"
  }
}
```

**Réponse:**
```json
{
  "status": "success",
  "messageId": "message-id",
  "template": "login-link",
  "templateGroup": "novapartage"
}
```

### 3.2 GET `/v3.1/templates/novapartage/list`

Liste tous les sous-templates disponibles.

### 3.3 GET `/v3.1/templates/novapartage/{templateName}/preview`

Prévisualise un template avec des données d'exemple.

## 4. Gestion des images

- Images stockées dans `templates/novapartage/assets/`
- Référencées via `cid:logo@novapartage` dans le HTML
- Embedding automatique comme pièces jointes inline
- Support CID (recommandé) et base64 (fallback)

## 5. Génération de versions texte

- Priorité 1 : Template `.txt` dédié s'il existe
- Priorité 2 : Génération depuis HTML avec `html-to-text`
- Priorité 3 : Extraction simple (regex)

## 6. Templates disponibles

| Template | Variables requises | Description |
|----------|-------------------|-------------|
| `login-link` | `loginLink` | Lien de connexion passwordless |
| `verification-code` | `verificationCode` | Code de vérification |
| `manage-shares` | `loginLink` | Accès à la gestion des partages |
| `access-created` | `recipientEmail`, `accessUrl`, `formName`, `ownerEmail`, `validityDays` | Notification de création d'accès |
| `access-validated` | `formName`, `fileName`, `recipientEmail`, `validatedBy`, `validatedDate`, `shareDetailUrl` | Confirmation de validation |
| `validation-notification` | `formName`, `fileName`, `recipientEmail`, `validatedBy`, `validatedDate`, `shareDetailUrl` | Notification au propriétaire |
| `access-expiring` | `recipientEmail`, `accessUrl`, `formName`, `ownerEmail`, `expiresAtFormatted`, `timeRemainingMessage` | Expiration prochaine |
| `share-deletion-warning` | `shareName`, `monthsInactive`, `daysRemaining`, `daysRemainingPlural`, `createdAtFormatted`, `updatedAtFormatted`, `deletionDateFormatted`, `manageSharesUrl` | Avertissement de suppression (RGPD) |

## 7. Variables d'environnement

```bash
EMAIL_EMBED_IMAGES=true
EMAIL_IMAGE_FORMAT=cid
EMAIL_TEXT_VERSION=auto
```

## 8. Dépendances

- `html-to-text`: Conversion HTML → texte avancée
- `mime-types`: Détection des types MIME

