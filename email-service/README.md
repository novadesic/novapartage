# Email Service - DDShare

Service d'envoi d'emails pour DDShare avec support multi-relais (SMTP, Mailjet, etc.). 
API REST compatible avec Mailjet v3.1.

## Fonctionnalités

- ✅ API REST compatible Mailjet v3.1
- ✅ Support multi-relais (SMTP, Mailjet)
- ✅ Fallback automatique entre relais
- ✅ Configuration flexible via variables d'environnement
- ✅ Validation des requêtes
- ✅ Support des pièces jointes
- ✅ Support HTML et texte

## Structure

```
email-service/
├── server.js              # Point d'entrée avec API REST Express
├── package.json           # Dépendances Node.js
├── docker/
│   └── Dockerfile        # Image Docker
├── config/
│   └── emailRelays.js    # Configuration des relais
├── services/
│   ├── emailRelay.js     # Gestion des relais
│   ├── smtpRelay.js      # Implémentation SMTP
│   └── mailjetRelay.js   # Implémentation Mailjet
├── routes/
│   └── email.js          # Routes API REST
└── middleware/
    └── validation.js     # Validation des requêtes
```

## Configuration

### Variables d'environnement

#### Serveur
- `PORT` : Port du serveur (défaut: `3002`)
- `HOST` : Host du serveur (défaut: `0.0.0.0`)

#### Relais SMTP
- `SMTP_ENABLED` : Activer le relais SMTP (défaut: `false`)
- `SMTP_NAME` : Nom du relais SMTP (défaut: `smtp-default`)
- `SMTP_PRIORITY` : Priorité du relais (plus bas = priorité plus élevée, défaut: `10`)
- `SMTP_HOST` : Serveur SMTP
- `SMTP_PORT` : Port SMTP (défaut: `587`)
- `SMTP_SECURE` : Utiliser SSL/TLS (défaut: `false`)
- `SMTP_USER` : Utilisateur SMTP (optionnel)
- `SMTP_PASS` : Mot de passe SMTP (optionnel)
- `SMTP_FROM` : Adresse email expéditeur par défaut
- `SMTP_IGNORE_TLS` : Ignorer TLS (défaut: `true`)
- `SMTP_REQUIRE_TLS` : Exiger TLS (défaut: `false`)
- `SMTP_TLS_REJECT_UNAUTHORIZED` : Rejeter certificats non autorisés (défaut: `false`)

#### Relais Mailjet
- `MAILJET_ENABLED` : Activer le relais Mailjet (défaut: `false`)
- `MAILJET_NAME` : Nom du relais Mailjet (défaut: `mailjet-default`)
- `MAILJET_PRIORITY` : Priorité du relais (défaut: `5`)
- `MAILJET_API_KEY` : Clé API Mailjet
- `MAILJET_API_SECRET` : Secret API Mailjet
- `MAILJET_FROM_EMAIL` : Email expéditeur par défaut
- `MAILJET_FROM_NAME` : Nom expéditeur par défaut

## API

### POST /v3.1/send

Envoie un email (format Mailjet v3.1).

**Query params:**
- `relay` : Nom du relais à utiliser (optionnel, utilise le relais par défaut si non spécifié)

**Body:**
```json
{
  "Messages": [
    {
      "From": {
        "Email": "sender@example.com",
        "Name": "Sender Name"
      },
      "To": [
        {
          "Email": "recipient@example.com",
          "Name": "Recipient Name"
        }
      ],
      "Cc": [
        {
          "Email": "cc@example.com"
        }
      ],
      "Bcc": [
        {
          "Email": "bcc@example.com"
        }
      ],
      "Subject": "Subject",
      "TextPart": "Text content",
      "HTMLPart": "<h1>HTML content</h1>",
      "Attachments": [
        {
          "Filename": "file.pdf",
          "ContentType": "application/pdf",
          "Base64Content": "base64encodedcontent"
        }
      ],
      "CustomID": "custom-id-123"
    }
  ]
}
```

**Réponse (succès):**
```json
{
  "Messages": [
    {
      "Status": "success",
      "CustomID": "custom-id-123",
      "To": [
        {
          "Email": "recipient@example.com",
          "MessageUUID": "message-id",
          "MessageID": "message-id",
          "MessageHref": "https://api.mailjet.com/v3/REST/message/message-id"
        }
      ]
    }
  ],
  "_metadata": {
    "relay": "mailjet-default",
    "relayType": "mailjet",
    "fallback": false
  }
}
```

**Réponse (erreur):**
```json
{
  "ErrorMessage": "Description de l'erreur",
  "ErrorIdentifier": "ERROR_CODE",
  "StatusCode": 500
}
```

### GET /v3.1/relays

Liste les relais disponibles.

**Réponse:**
```json
{
  "relays": [
    {
      "name": "mailjet-default",
      "type": "mailjet",
      "priority": 5,
      "enabled": true
    },
    {
      "name": "smtp-default",
      "type": "smtp",
      "priority": 10,
      "enabled": true
    }
  ]
}
```

### GET /health

Health check du service.

**Réponse:**
```json
{
  "status": "ok",
  "service": "email-service"
}
```

## Exemples d'utilisation

### Avec curl

```bash
curl -X POST http://localhost:3002/v3.1/send \
  -H "Content-Type: application/json" \
  -d '{
    "Messages": [{
      "From": {"Email": "sender@example.com", "Name": "Sender"},
      "To": [{"Email": "recipient@example.com"}],
      "Subject": "Test",
      "TextPart": "Hello World"
    }]
  }'
```

### Avec un relais spécifique

```bash
curl -X POST "http://localhost:3002/v3.1/send?relay=smtp-default" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

## Build et déploiement

### Build de l'image Docker

```bash
cd email-service
./build_and_dockerize.sh
```

### Exécution locale (pour tests)

```bash
cd email-service
npm install
PORT=3002 node server.js
```

### Exécution dans Docker

Le service doit être configuré dans docker-compose.yml :

```yaml
email-service:
  image: ghcr.io/novadesic/novapartage-email-service:latest
  ports:
    - "3002:3002"
  environment:
    - PORT=3002
    - SMTP_ENABLED=true
    - SMTP_HOST=smtp.example.com
    - SMTP_PORT=587
    - SMTP_USER=user
    - SMTP_PASS=pass
    - SMTP_FROM=noreply@example.com
    - MAILJET_ENABLED=true
    - MAILJET_API_KEY=xxx
    - MAILJET_API_SECRET=xxx
    - MAILJET_FROM_EMAIL=noreply@example.com
    - MAILJET_FROM_NAME=DDShare
```

## Intégration avec auth-service et backend

### Exemple d'appel depuis Node.js

```javascript
const axios = require('axios');

async function sendEmail(emailData) {
  const response = await axios.post('http://email-service:3002/v3.1/send', {
    Messages: [{
      From: { Email: 'noreply@ddsshare.com', Name: 'DDShare' },
      To: [{ Email: 'user@example.com' }],
      Subject: 'Bienvenue',
      HTMLPart: '<h1>Bienvenue!</h1>'
    }]
  });
  
  return response.data;
}
```

### Exemple d'appel depuis Java (backend)

```java
import org.springframework.web.client.RestTemplate;

public void sendEmail() {
    RestTemplate restTemplate = new RestTemplate();
    String url = "http://email-service:3002/v3.1/send";
    
    Map<String, Object> request = new HashMap<>();
    Map<String, Object> message = new HashMap<>();
    message.put("From", Map.of("Email", "noreply@ddsshare.com", "Name", "DDShare"));
    message.put("To", List.of(Map.of("Email", "user@example.com")));
    message.put("Subject", "Bienvenue");
    message.put("HTMLPart", "<h1>Bienvenue!</h1>");
    request.put("Messages", List.of(message));
    
    restTemplate.postForObject(url, request, Map.class);
}
```

## Fallback automatique

Si le relais par défaut échoue, le service essaie automatiquement les autres relais configurés dans l'ordre de priorité.

