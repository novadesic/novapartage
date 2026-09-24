# Endpoints des Droits RGPD - NovaPartage

## Vue d'ensemble

Ce document décrit les endpoints REST implémentés pour permettre aux utilisateurs d'exercer leurs droits RGPD.

**Date d'implémentation** : 25 novembre 2025  
**Statut** : ✅ Implémenté et compilé

---

## Endpoints Disponibles

### 1. Export des Données (Article 15 & 20 RGPD)

**Endpoint** : `GET /api/user/data-export`

**Description** : Permet à un utilisateur d'exporter toutes ses données personnelles au format JSON.

**Authentification** : Requise (Bearer Token)

**Paramètres de requête** :
- `format` (optionnel) : Format de l'export (`json` par défaut, `csv` non implémenté)

**Exemple de requête** :
```bash
curl -X GET "http://localhost:8080/api/user/data-export?format=json" \
  -H "Authorization: Bearer <token>"
```

**Réponse** :
```json
{
  "exportDate": "2025-11-25T17:30:00",
  "userEmail": "user@example.com",
  "exportFormat": "json",
  "exportPurpose": "RGPD - Droit d'accès (Article 15) et Portabilité (Article 20)",
  "legalBasis": "Règlement Général sur la Protection des Données (RGPD)",
  "user": {
    "email": "user@example.com",
    "exportDate": "2025-11-25T17:30:00"
  },
  "ownedShares": [
    {
      "id": "uuid",
      "fileName": "example.xlsx",
      "status": "ACTIVE",
      "createdAt": "2025-11-01T10:00:00",
      "recipientsCount": 3,
      "recipients": [...]
    }
  ],
  "ownedSharesCount": 5,
  "createdTokens": [...],
  "createdTokensCount": 10,
  "sharedWithMe": [...],
  "sharedWithMeCount": 2,
  "receivedTokens": [...],
  "receivedTokensCount": 8,
  "formSubmissions": [...],
  "formSubmissionsCount": 15
}
```

**Données exportées** :
- Informations utilisateur de base
- Tous les partages créés par l'utilisateur
- Tous les tokens d'accès créés par l'utilisateur
- Tous les partages où l'utilisateur est destinataire
- Tous les tokens d'accès reçus par l'utilisateur
- Toutes les soumissions de formulaires de l'utilisateur

---

### 2. Suppression de Compte (Article 17 RGPD)

**Endpoint** : `DELETE /api/user/account`

**Description** : Supprime complètement toutes les données d'un utilisateur (irréversible).

**Authentification** : Requise (Bearer Token)

**Paramètres de requête** :
- `confirm` (optionnel) : Confirmation de suppression (`true` ou `yes`)

**Exemple de requête** :
```bash
curl -X DELETE "http://localhost:8080/api/user/account?confirm=true" \
  -H "Authorization: Bearer <token>"
```

**Réponse** :
```json
{
  "userEmail": "user@example.com",
  "deletionDate": "2025-11-25T17:30:00",
  "deletionPurpose": "RGPD - Droit à l'effacement (Article 17)",
  "legalBasis": "Règlement Général sur la Protection des Données (RGPD)",
  "irreversible": true,
  "sharesDeleted": 5,
  "tokensDeleted": 18,
  "formSubmissionsDeleted": 15,
  "tabdataDeleted": 12,
  "filesDeleted": 5,
  "totalDeleted": 50
}
```

**Actions effectuées** :
1. Suppression de tous les partages créés par l'utilisateur (avec fichiers)
2. Suppression de tous les tokens d'accès créés par l'utilisateur
3. Suppression de tous les tokens reçus par l'utilisateur
4. Suppression de toutes les soumissions de formulaires
5. Suppression de tous les tabdata associés
6. Retrait de l'utilisateur des destinataires des autres partages

**⚠️ ATTENTION** : Cette action est **irréversible** !

---

### 3. Mise à Jour du Profil (Article 16 RGPD)

**Endpoint** : `PUT /api/user/profile`

**Description** : Permet à un utilisateur de rectifier ses données personnelles.

**Authentification** : Requise (Bearer Token)

**Corps de la requête** :
```json
{
  "email": "newemail@example.com",  // Optionnel (nécessite procédure manuelle)
  "displayName": "Nouveau Nom"      // Optionnel
}
```

**Exemple de requête** :
```bash
curl -X PUT "http://localhost:8080/api/user/profile" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"displayName": "Nouveau Nom"}'
```

**Réponse** :
```json
{
  "userEmail": "user@example.com",
  "updateDate": "2025-11-25T17:30:00",
  "updatePurpose": "RGPD - Droit de rectification (Article 16)",
  "legalBasis": "Règlement Général sur la Protection des Données (RGPD)",
  "updatedFields": ["displayName"],
  "displayName": "Nouveau Nom"
}
```

**Limitations** :
- Le changement d'email nécessite une procédure manuelle (contactez `privacy@novadesic.com`)
- Le `displayName` est mis à jour dans tous les partages où l'utilisateur apparaît comme destinataire

---

## Implémentation Technique

### Fichiers Créés

1. **`UserRightsService.java`**
   - Service métier pour gérer les droits RGPD
   - Méthodes : `exportUserData()`, `deleteUserAccount()`, `updateUserProfile()`
   - Localisation : `backend/src/main/java/com/datadesic/ddsshare/backend/service/`

2. **`UserRightsController.java`**
   - Contrôleur REST pour exposer les endpoints
   - Localisation : `backend/src/main/java/com/datadesic/ddsshare/backend/controller/`

### Dépendances

- `ShareService` : Pour accéder aux partages
- `FileStorageService` : Pour supprimer les fichiers
- `ShareTabdataService` : Pour gérer les tabdata
- `EmailService` : Pour les notifications (futur)
- `CustomAuthService` : Pour l'authentification

### Modèles Utilisés

- `Share` : Partages de fichiers
- `AccessToken` : Tokens d'accès
- `FormSubmission` : Soumissions de formulaires
- `Recipient` : Destinataires
- `ShareAccessTabdata` : Données tabulaires
- `ShareAccessTabdataRow` : Lignes de données

---

## Sécurité

### Authentification

Tous les endpoints nécessitent une authentification via Bearer Token JWT :
```
Authorization: Bearer <token>
```

### Autorisation

- Les utilisateurs ne peuvent accéder qu'à leurs propres données
- L'email est extrait du token JWT et utilisé pour filtrer les données

### Validation

- Vérification de l'authentification avant chaque opération
- Validation des paramètres d'entrée
- Gestion des erreurs avec messages appropriés

---

## Conformité RGPD

### Articles RGPD Couverts

| Article | Droit | Endpoint | Statut |
|---------|-------|----------|--------|
| **Art. 15** | Droit d'accès | `GET /api/user/data-export` | ✅ Implémenté |
| **Art. 16** | Droit de rectification | `PUT /api/user/profile` | ✅ Implémenté |
| **Art. 17** | Droit à l'effacement | `DELETE /api/user/account` | ✅ Implémenté |
| **Art. 20** | Droit à la portabilité | `GET /api/user/data-export?format=json` | ✅ Implémenté |

### Traçabilité

Toutes les opérations sont loggées avec :
- Date et heure
- Email de l'utilisateur
- Type d'opération
- Nombre d'entités affectées

---

## Tests

### Tests Unitaires

**Statut** : ⚠️ À implémenter

Les tests unitaires pour ces endpoints doivent couvrir :
- Export des données avec différents scénarios
- Suppression de compte avec vérification de la cascade
- Mise à jour du profil avec validation
- Gestion des erreurs et cas limites

### Tests d'Intégration

**Statut** : ⚠️ À implémenter

Les tests d'intégration doivent vérifier :
- Authentification correcte
- Autorisation (accès uniquement à ses propres données)
- Suppression en cascade complète
- Export de toutes les données

---

## Utilisation Frontend

### Exemple Angular

```typescript
// Export des données
exportUserData(): Observable<any> {
  return this.http.get('/api/user/data-export', {
    headers: this.getAuthHeaders()
  });
}

// Suppression de compte
deleteAccount(confirm: boolean = false): Observable<any> {
  return this.http.delete(`/api/user/account?confirm=${confirm}`, {
    headers: this.getAuthHeaders()
  });
}

// Mise à jour du profil
updateProfile(displayName: string): Observable<any> {
  return this.http.put('/api/user/profile', {
    displayName: displayName
  }, {
    headers: this.getAuthHeaders()
  });
}
```

---

## Prochaines Étapes

1. **Tests Unitaires** : Implémenter les tests pour `UserRightsService`
2. **Tests d'Intégration** : Implémenter les tests pour `UserRightsController`
3. **Format CSV** : Implémenter l'export CSV pour la portabilité
4. **Notifications** : Envoyer un email de confirmation lors de la suppression de compte
5. **Interface Frontend** : Créer les composants Angular pour exercer ces droits
6. **Documentation API** : Ajouter à Swagger/OpenAPI

---

## Contact

Pour toute question concernant ces endpoints ou pour exercer vos droits RGPD :
- **Email** : privacy@novadesic.com
- **Documentation** : Voir `EVALUATION_RGPD.md`

