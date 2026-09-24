# Correction des Tokens d'Accès

## Problème identifié

L'utilisateur ne pouvait pas voir les accès reçus dans la liste des shares, même s'il en avait au moins un.

## Cause du problème

La méthode `getUserAccessTokens()` dans le backend filtrait les tokens pour ne retourner que ceux avec le statut `ACTIVE` :

```java
// AVANT - Filtrage côté backend
return AccessToken.findByRecipientEmail(userEmail)
    .stream()
    .filter(token -> token.isActive()) // ❌ Seulement les tokens actifs
    .map(token -> { ... })
    .collect(Collectors.toList());
```

Cela empêchait l'affichage des tokens expirés et révoqués, même si le frontend avait des filtres pour les afficher.

## Solution implémentée

### 1. Suppression du filtrage côté backend

**Fichier modifié :** `ShareService.java`

```java
// APRÈS - Pas de filtrage côté backend
java.util.List<AccessTokenResponse> result = AccessToken.findByRecipientEmail(userEmail)
    .stream()
    .map(token -> { ... }) // ✅ Tous les tokens
    .collect(Collectors.toList());
```

### 2. Filtrage côté frontend

Le frontend gère maintenant le filtrage avec les options :
- **Accès expirés** : `showExpiredAccess`
- **Accès révoqués** : `showRevokedAccess`

### 3. Ajout de logs de débogage

**Backend :**
- Logs dans `ShareController.getMyAccessTokens()`
- Logs dans `ShareService.getUserAccessTokens()`

**Frontend :**
- Logs détaillés dans `SharesListComponent.loadShares()`

## Fichiers modifiés

### Backend
- `ShareService.java` : Suppression du filtrage `.filter(token -> token.isActive())`
- `ShareController.java` : Ajout de logs de débogage

### Frontend
- `shares-list.component.ts` : Ajout de logs détaillés pour le débogage

## Tests et validation

### Script de test
- `test_access_tokens.sh` : Script pour tester l'endpoint `/api/shares/my-access-tokens`

### Compilation
```bash
# Backend
cd ddsshare/backend
./mvnw compile

# Frontend
cd ddsshare/frontend
npm run build
```

## Logs de débogage

### Backend
```
🔍 Demande de tokens d'accès pour l'utilisateur: user@example.com
🔍 Récupération des tokens d'accès pour l'utilisateur: user@example.com
🔍 Tokens expirés trouvés: 2
🔍 Tokens retournés: 5
🔍 Tokens récupérés: 5
```

### Frontend
```
✅ Tokens d'accès récupérés: {tokens: Array(5), total: 5}
🔍 Structure de la réponse: {hasResponse: true, hasTokens: true, tokensLength: 5, responseKeys: ["tokens", "total"]}
🔍 userAccessTokens après assignation: 5
🔍 sortedUserAccessTokens après tri: 5
```

## Fonctionnalités maintenant disponibles

### Filtres pour les accès reçus
- ✅ **Accès actifs** : Affichés par défaut
- ✅ **Accès expirés** : Optionnel (checkbox)
- ✅ **Accès révoqués** : Optionnel (checkbox)
- ✅ **Compteur** : "X sur Y accès"

### Indicateurs visuels
- **Accès actifs** : Bouton "Accéder" vert
- **Accès expirés** : Badge jaune "Expiré"
- **Accès révoqués** : Badge rouge "Révoqué"

## Utilisation

1. **Démarrer l'application** :
   ```bash
   cd ddsshare/backend
   ./mvnw quarkus:dev
   ```

2. **Se connecter** via le frontend

3. **Vérifier les accès reçus** dans la section "Accès reçus"

4. **Utiliser les filtres** pour afficher les accès expirés/révoqués

## Vérification

Pour vérifier que la correction fonctionne :

1. **Vérifier les logs du backend** lors du chargement de la page
2. **Vérifier la console du navigateur** pour les logs frontend
3. **Tester les filtres** pour afficher différents types d'accès
4. **Vérifier le compteur** "X sur Y accès"

## Évolutions futures

### Améliorations possibles
1. **Pagination** : Pour les grandes listes d'accès
2. **Recherche** : Recherche dans les titres de formulaires
3. **Tri avancé** : Par date d'expiration, par créateur, etc.
4. **Actions en lot** : Révoquer plusieurs accès
5. **Notifications** : Alertes pour les accès expirant bientôt

### Optimisations
1. **Cache** : Mise en cache des tokens d'accès
2. **Lazy loading** : Chargement progressif
3. **Mise à jour en temps réel** : WebSockets pour les changements de statut
