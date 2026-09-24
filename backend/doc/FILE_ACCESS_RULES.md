# Règles d'Accès aux Fichiers - Backend

## ⚠️ RÈGLE CRITIQUE DE SÉCURITÉ

### Principe Fondamental

**Le backend NE DOIT JAMAIS accéder au fichier Excel en dehors de l'édition d'un partage par son propriétaire.**

## Contexte

Le système stocke les données Excel dans la base de données (tabdata) pour éviter les accès répétés aux fichiers. Cette architecture permet :

1. **Accès public sécurisé** : Les utilisateurs peuvent accéder aux données via un token sans nécessiter l'accès au fichier
2. **Performance** : Les données sont pré-calculées et stockées en base
3. **Sécurité** : Limitation des accès fichiers aux seuls propriétaires

## Règles d'Accès aux Fichiers

### ✅ AUTORISÉ : Accès au fichier par le propriétaire

Les accès fichiers sont **autorisés uniquement** dans les cas suivants :

1. **Édition d'un partage par le propriétaire**
   - Méthode : `ShareTabdataService.computeAndStoreTabdata()`
   - Contexte : Le propriétaire modifie son partage
   - Accès : `fileStorageService.getFile(share.filePath)`

2. **Recalcul du tabdata par le propriétaire**
   - Méthode : `ShareTabdataService.rebuildTabdataForAllRecipients()`
   - Contexte : Le propriétaire demande un recalcul
   - Accès : Via `computeAndStoreTabdata()` qui vérifie la propriété

3. **Téléchargement du fichier original par le propriétaire**
   - Méthode : `ShareService.getShareFile()`
   - Contexte : Le propriétaire télécharge son fichier
   - Vérification : `share.ownerUsername.equals(username)`

### ❌ INTERDIT : Accès au fichier pour les accès publics

Les accès fichiers sont **interdits** dans les cas suivants :

1. **Récupération des données du formulaire (accès public)**
   - Méthode : `ShareTabdataService.getTabdataFromDatabase()`
   - Contexte : Accès public via token
   - ❌ **INTERDIT** : `fileStorageService.getFile()` dans cette méthode
   - ✅ **AUTORISÉ** : Utiliser uniquement les données en base (`ShareAccessTabdata`)

2. **Récupération des données pour un destinataire (accès public)**
   - Méthode : `ShareService.getFormDataWithToken()`
   - Contexte : Accès public via token
   - ❌ **INTERDIT** : Accès au fichier
   - ✅ **AUTORISÉ** : Utiliser `getTabdataFromDatabase()` qui lit uniquement la base

3. **Vérification de cohérence lors de la récupération**
   - ❌ **INTERDIT** : Vérifier la cohérence en accédant au fichier dans `getTabdataFromDatabase()`
   - ✅ **AUTORISÉ** : La vérification de cohérence est une méthode séparée (`isTabdataConsistent()`) utilisée uniquement par le propriétaire

## Méthodes Concernées

### `ShareTabdataService.getTabdataFromDatabase()`

**Règle** : Cette méthode NE DOIT JAMAIS accéder au fichier.

**Raison** :
- Utilisée pour les accès publics (via token)
- Les données sont déjà en base
- L'accès fichier est réservé au propriétaire

**Implémentation** :
```java
// ✅ CORRECT : Utiliser uniquement les données en base
ShareAccessTabdata tabdata = ShareAccessTabdata.find(...);
List<String> headers = deserialize(tabdata.headers);
List<Map<String, Object>> rows = getRowsFromDatabase(tabdata.id, page, limit);

// ❌ INCORRECT : Ne jamais faire cela
fileStorageService.getFile(share.filePath); // INTERDIT !
```

### `ShareTabdataService.computeAndStoreTabdata()`

**Règle** : Cette méthode PEUT accéder au fichier car elle est appelée uniquement par le propriétaire.

**Vérification** :
- Vérifier que l'utilisateur est propriétaire avant l'accès
- Utilisée uniquement lors de l'édition par le propriétaire

## Vérification de Cohérence

La vérification de cohérence entre le tabdata et le fichier est gérée séparément :

- **Méthode** : `ShareTabdataService.isTabdataConsistent()`
- **Usage** : Uniquement par le propriétaire lors de l'édition
- **Accès fichier** : Autorisé car le propriétaire a les droits

## Recalcul du Tabdata

Le recalcul du tabdata est géré par le propriétaire :

- **Méthode** : `ShareTabdataService.rebuildTabdataForAllRecipients()`
- **Contexte** : Appelée lors de l'édition par le propriétaire
- **Vérification** : `share.ownerUsername.equals(ownerUsername)`
- **Accès fichier** : Autorisé car le propriétaire a les droits

## Points de Contrôle

Lors de toute modification du code, vérifier :

1. ✅ `getTabdataFromDatabase()` n'appelle jamais `fileStorageService.getFile()`
2. ✅ `getFormDataWithToken()` n'appelle jamais `fileStorageService.getFile()`
3. ✅ Les accès fichiers sont uniquement dans les méthodes d'édition par le propriétaire
4. ✅ Les méthodes d'édition vérifient la propriété avant l'accès fichier

## Exemples d'Erreurs à Éviter

### ❌ ERREUR : Vérification de cohérence dans getTabdataFromDatabase

```java
// ❌ INCORRECT
public Object getTabdataFromDatabase(...) {
    // ...
    String fingerprint = calculateFileFingerprint(fileStorageService.getFile(share.filePath)); // INTERDIT !
    if (!tabdata.isConsistentWithFile(fingerprint)) {
        throw new SecurityException("Tabdata obsolète");
    }
}
```

### ✅ CORRECT : Utiliser uniquement les données en base

```java
// ✅ CORRECT
public Object getTabdataFromDatabase(...) {
    // Récupérer uniquement depuis la base
    ShareAccessTabdata tabdata = ShareAccessTabdata.find(...);
    // Utiliser les données stockées
    List<String> headers = deserialize(tabdata.headers);
    List<Map<String, Object>> rows = getRowsFromDatabase(tabdata.id, page, limit);
    // Pas d'accès fichier !
}
```

## Historique

- **2025-11-24** : Suppression de la vérification de cohérence dans `getTabdataFromDatabase()` qui accédait au fichier
- **Raison** : Cette vérification violait la règle d'accès fichiers et causait des erreurs 500 pour les accès publics




























