# 🔍 Diagnostic - Accès validés qui n'apparaissent plus

## Problème
Les accès validés (statut `VALIDATED`) n'apparaissent plus dans l'interface utilisateur malgré l'ajout du filtre dédié.

## 🔧 Diagnostic étape par étape

### 1. Vérification des logs frontend

**Ouvrir la console du navigateur (F12) et chercher :**

```javascript
// Logs de diagnostic ajoutés
🔍 DIAGNOSTIC - Tous les tokens: [...]
🔍 Répartition par statut: {ACTIVE: X, VALIDATED: X, EXPIRED: X, REVOKED: X, TOTAL: X}
🔍 applyAccessSort - Filtres actuels: {showActiveAccess: true, showValidatedAccess: true, showTerminatedAccess: false}
🔍 applyAccessSort - Tokens avant filtrage: [...]
🔍 Filtrage du token X (VALIDATED): {...}
✅ Token X conservé: VALIDATED
```

### 2. Vérification de l'API backend

**Tester l'endpoint directement :**

```bash
# Dans le terminal backend
cd ddsshare/backend
./test_validated_tokens.sh

# Ou manuellement
curl -X GET 'http://localhost:8080/api/shares/my-access-tokens' \
  -H 'Accept: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

**Vérifier dans la réponse :**
- Présence de tokens avec `"status": "VALIDATED"`
- Nombre total de tokens
- Structure de la réponse

### 3. Vérification de la base de données

**Connecter à MongoDB et vérifier :**

```javascript
// Dans MongoDB
use ddsshare
db.accessTokens.find({status: "VALIDATED"})
db.accessTokens.find({}, {status: 1, recipientEmail: 1, _id: 1})
```

### 4. Vérification des filtres frontend

**Dans l'interface utilisateur :**
1. Vérifier que le filtre "Accès validés" est coché par défaut
2. Décocher puis recocher le filtre
3. Vérifier que les tokens VALIDATED apparaissent

### 5. Logs de débogage ajoutés

**Nouveaux logs dans le code :**

```typescript
// Dans loadShares()
this.debugAllTokens(); // Affiche tous les tokens et leur répartition

// Dans applyAccessSort()
this.logger.log('🔍 applyAccessSort - Filtres actuels:', {...});
this.logger.log('🔍 applyAccessSort - Tokens avant filtrage:', [...]);
this.logger.log(`🔍 Filtrage du token ${token.id} (${token.status}):`, {...});

// Dans les méthodes toggle
this.logger.log('🔄 Filtre "Accès validés" changé:', this.showValidatedAccess);
```

## 🎯 Causes possibles

### 1. Problème de données
- **Aucun token VALIDATED en base** : Vérifier la base de données
- **Statut incorrect** : Vérifier que le statut est exactement `"VALIDATED"` (majuscules)
- **Tokens non retournés par l'API** : Vérifier les logs backend

### 2. Problème de filtrage frontend
- **Filtre désactivé** : Vérifier que `showValidatedAccess` est à `true`
- **Logique de filtrage incorrecte** : Vérifier les logs de filtrage
- **Problème de comparaison** : Vérifier la casse du statut

### 3. Problème d'affichage
- **Tokens filtrés mais non affichés** : Vérifier le template HTML
- **Problème de tri** : Vérifier que `sortedUserAccessTokens` contient les données
- **Problème de binding** : Vérifier les propriétés dans le template

## 🔧 Solutions

### Si aucun token VALIDATED en base :
1. Créer un token de test avec le statut VALIDATED
2. Vérifier le processus de validation des tokens

### Si les tokens existent mais ne s'affichent pas :
1. Vérifier les logs de filtrage
2. Vérifier que `showValidatedAccess` est à `true`
3. Vérifier la logique de filtrage dans `applyAccessSort()`

### Si le problème persiste :
1. Ajouter plus de logs de débogage
2. Vérifier la structure des données retournées par l'API
3. Tester avec des données de test

## 📝 Scripts de test

### Frontend
```bash
cd ddsshare/frontend
./test_validated_access.sh
```

### Backend
```bash
cd ddsshare/backend
./test_validated_tokens.sh
```

## 🚨 Actions immédiates

1. **Démarrer l'application** avec les logs de débogage
2. **Ouvrir la console du navigateur** et recharger la page
3. **Analyser les logs** pour identifier le problème
4. **Tester l'API** directement si nécessaire
5. **Vérifier la base de données** si les tokens existent

## 📊 Métriques à surveiller

- Nombre de tokens avant filtrage
- Nombre de tokens après filtrage
- Répartition par statut
- État des filtres
- Erreurs dans la console


