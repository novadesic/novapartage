# Contrôles de Statut des Accès et Shares

## Vue d'ensemble

Ce document décrit les contrôles automatiques de statut ajoutés au backend ddsshare pour gérer automatiquement les statuts des tokens d'accès et des shares.

## Fonctionnalités

### 1. Contrôle automatique des tokens d'accès expirés

**Règle :** Si un token d'accès est expiré, son statut passe automatiquement à `EXPIRED` en base de données et dans les réponses API.

**Implémentation :**
- Vérification automatique lors de l'accès aux données via un token
- Mise à jour en base de données du statut `ACTIVE` vers `EXPIRED`
- Application dans toutes les méthodes qui récupèrent des tokens d'accès

### 2. Contrôle automatique du statut des shares

**Règles :**
- Si un share ne contient aucun accès actif, son statut passe à `INACTIVE`
- Si un share contient au moins un accès actif, son statut passe à `ACTIVE`
- Les shares en statut `NEW` ou `DELETED` ne sont pas modifiés

**Implémentation :**
- Vérification automatique lors de l'accès aux données des shares
- Comptage des tokens actifs (non expirés et non révoqués)
- Mise à jour en base de données du statut du share

## Services impliqués

### StatusControlService

Service dédié aux contrôles de statut avec les méthodes principales :

```java
// Contrôle le statut d'un token d'accès
public void controlAccessTokenStatus(AccessToken token)

// Contrôle le statut d'un share
public void controlShareStatus(Share share)

// Contrôle le statut d'un share par son ID
public void controlShareStatusById(String shareId)

// Contrôle le statut d'un token par son token
public void controlAccessTokenStatusByToken(String token)

// Contrôle tous les tokens d'un share
public void controlAllAccessTokensForShare(String shareId)

// Contrôle tous les shares d'un utilisateur
public void controlAllSharesForUser(String username)

// Contrôle tous les shares d'un destinataire
public void controlAllSharesForRecipient(String userEmail)
```

### ShareService

Le `ShareService` a été modifié pour intégrer les contrôles de statut dans toutes les méthodes pertinentes :

- `getUserShares()` - Contrôle tous les shares de l'utilisateur
- `getSharedWithUser()` - Contrôle tous les shares où l'utilisateur est destinataire
- `getShare()` - Contrôle le statut du share spécifique
- `getAccessTokensForShare()` - Contrôle tous les tokens du share
- `getUserAccessTokens()` - Contrôle tous les tokens de l'utilisateur
- `accessShareWithToken()` - Contrôle le token et le share
- `getFormDataWithToken()` - Contrôle le token et le share
- `saveFormData()` - Contrôle le token et le share
- `revokeAccessToken()` - Contrôle le share après révocation
- `validateAccessToken()` - Contrôle le share après validation
- `generateRecipientLink()` - Contrôle le share après création de token
- `cleanupExpiredTokens()` - Contrôle les shares après nettoyage
- `finalizeShare()` - Contrôle le share après finalisation

## Endpoints affectés

Les contrôles de statut sont automatiquement appliqués lors de l'accès aux endpoints suivants :

### Shares
- `GET /api/shares` - Récupération des shares de l'utilisateur
- `GET /api/shares/{id}` - Récupération d'un share spécifique
- `GET /api/shares/shared-with-me` - Shares partagés avec l'utilisateur

### Tokens d'accès
- `GET /api/shares/{id}/access-tokens` - Tokens d'accès d'un share
- `GET /api/shares/my-access-tokens` - Tokens d'accès de l'utilisateur

### Accès publics
- `GET /api/shares/access/{token}` - Accès aux données via token
- `GET /api/shares/form/{token}` - Formulaire via token
- `POST /api/shares/form/{token}/save` - Sauvegarde via token
- `POST /api/shares/form/{token}/validate` - Validation via token

## Statuts des tokens d'accès

```java
public enum TokenStatus {
    ACTIVE,     // Token actif et utilisable
    EXPIRED,    // Token expiré (ajouté automatiquement)
    REVOKED,    // Token révoqué manuellement
    USED,       // Token utilisé une fois
    VALIDATED   // Token validé par le destinataire
}
```

## Statuts des shares

```java
public enum ShareStatus {
    NEW,        // Partage en cours de création (non modifié)
    ACTIVE,     // Partage actif (au moins un token actif)
    INACTIVE,   // Partage inactif (aucun token actif)
    DELETED     // Partage supprimé (non modifié)
}
```

## Logs et monitoring

Les contrôles de statut génèrent des logs informatifs :

```
INFO  Token expiré détecté, mise à jour du statut: 507f1f77bcf86cd799439011
INFO  Mise à jour du statut du share 507f1f77bcf86cd799439012: ACTIVE -> INACTIVE (tokens actifs: 0)
INFO  Nettoyage terminé: 5 tokens expirés traités, 3 shares mis à jour
```

## Tests

### Tests unitaires

Le fichier `StatusControlServiceTest.java` contient des tests pour vérifier :

- Contrôle du statut des tokens expirés
- Contrôle du statut des shares avec tokens actifs
- Contrôle du statut des shares sans tokens actifs
- Préservation des statuts NEW et DELETED

### Tests d'intégration

Le script `test_status_controls.sh` permet de tester les fonctionnalités en pratique.

## Déploiement

Les contrôles de statut sont automatiquement actifs dès le déploiement. Aucune configuration supplémentaire n'est requise.

### Compatibilité MongoDB

- **MongoDB Standalone** : ✅ Compatible (pas de transactions requises)
- **MongoDB Replica Set** : ✅ Compatible
- **MongoDB Atlas** : ✅ Compatible

### Résolution des erreurs

Si vous rencontrez l'erreur `Transaction numbers are only allowed on a replica set member or mongos`, cela signifie que vous utilisez une version antérieure du code. Les corrections apportées suppriment l'utilisation de transactions MongoDB pour assurer la compatibilité avec tous les types de déploiement MongoDB.

## Performance

Les contrôles de statut sont optimisés pour minimiser l'impact sur les performances :

- Vérifications effectuées uniquement lors de l'accès aux données
- Mises à jour en base de données uniquement si nécessaire
- Requêtes optimisées pour éviter les appels inutiles à la base de données
- Pas d'utilisation de transactions MongoDB (compatible avec MongoDB standalone)
- Logs informatifs pour le monitoring

### Optimisations techniques

- **Requêtes optimisées** : Utilisation de `count()` au lieu de `list()` pour les statistiques
- **Filtrage ciblé** : Récupération uniquement des tokens expirés au lieu de tous les tokens
- **Contrôles sélectifs** : Contrôle uniquement des shares ACTIVE qui pourraient avoir des tokens expirés
- **Pas de transactions** : Compatible avec MongoDB standalone (pas de replica set requis)

## Maintenance

### Nettoyage automatique

La méthode `cleanupExpiredTokens()` peut être appelée périodiquement pour nettoyer les tokens expirés et mettre à jour les statuts des shares.

### Monitoring

Surveillez les logs pour détecter :
- Nombre de tokens expirés traités
- Changements de statut des shares
- Erreurs lors des contrôles de statut

## Évolutions futures

Possibilités d'amélioration :

1. **Tâche planifiée** : Nettoyage automatique des tokens expirés
2. **Notifications** : Alertes lors des changements de statut
3. **Métriques** : Statistiques sur les tokens et shares
4. **API dédiée** : Endpoints pour forcer les contrôles de statut 