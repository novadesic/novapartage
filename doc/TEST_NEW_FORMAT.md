# Test du Nouveau Format FormAccessData

## Test de compatibilité

### 1. Test du Backend

Pour tester que le backend génère correctement le nouveau format :

```bash
# Tester l'endpoint avec un token valide
curl -X GET "http://localhost:8080/api/shares/form/{token}" \
  -H "Content-Type: application/json"
```

**Réponse attendue :**
```json
{
  "shareId": "507f1f77bcf86cd799439011",
  "fileName": "example.xlsx",
  "originalFileName": "example.xlsx",
  "ownerUsername": "user@example.com",
  "ownerEmail": "user@example.com",
  "createdAt": "2024-01-15T10:30:00",
  "expiresAt": "2024-01-22T10:30:00",
  "recipientEmail": "recipient@example.com",
  "pageTitle": "Formulaire de saisie",
  "pageDescription": "Veuillez remplir les informations ci-dessous.",
  "tableData": [
    {
      "Nom": "Dupont",
      "Prénom": "Jean",
      "Email": "jean.dupont@example.com",
      "_rowIndex": 0
    }
  ],
  "columnLabels": {
    "Nom": "Nom de famille",
    "Prénom": "Prénom",
    "Email": "Adresse email"
  },
  "editableCells": [
    {"row": 0, "col": 0},
    {"row": 0, "col": 1}
  ],
  "selectedCells": [
    {"row": 0, "col": 0},
    {"row": 0, "col": 1},
    {"row": 0, "col": 2}
  ],
  "totalRows": 1,
  "totalColumns": 3
}
```

### 2. Test du Frontend

Pour tester que le frontend utilise correctement le nouveau format :

1. **Ouvrir la console du navigateur**
2. **Accéder à un lien de formulaire**
3. **Vérifier les logs :**

```javascript
// Dans la console, vérifier que les données sont bien reçues
console.log('FormData:', formData);
console.log('TableData:', tableData);
console.log('EditableCells:', editableCells);
console.log('SelectedCells:', selectedCells);
```

### 3. Vérifications à effectuer

#### ✅ Backend
- [ ] La méthode `getFormDataWithToken()` retourne un `FormAccessData`
- [ ] La transformation `transformExcelDataToTableData()` fonctionne
- [ ] Les cellules éditables sont correctement extraites
- [ ] Les labels de colonnes sont préservés

#### ✅ Frontend
- [ ] Le composant `ShareAccessComponent` reçoit les données
- [ ] Le composant `FormPreviewComponent` affiche correctement le tableau
- [ ] Les cellules éditables sont bien identifiées
- [ ] Les labels de colonnes sont affichés
- [ ] Le formulaire est fonctionnel

#### ✅ Interface utilisateur
- [ ] Le titre et la description s'affichent
- [ ] Le tableau de données est visible
- [ ] Les cellules éditables sont mises en évidence
- [ ] La saisie fonctionne dans les champs éditables
- [ ] Le bouton "Enregistrer" apparaît si des champs sont éditables

### 4. Cas d'erreur à tester

#### Token invalide
```bash
curl -X GET "http://localhost:8080/api/shares/form/invalid-token"
```
**Attendu :** Erreur 400 ou 401

#### Token expiré
```bash
# Utiliser un token expiré
curl -X GET "http://localhost:8080/api/shares/form/expired-token"
```
**Attendu :** Erreur 401

#### Données Excel manquantes
```bash
# Tester avec un partage sans données
curl -X GET "http://localhost:8080/api/shares/form/valid-token-no-data"
```
**Attendu :** Réponse avec `tableData: []`

### 5. Performance

#### Taille des données
- [ ] Vérifier que la taille des données transmises est réduite
- [ ] Comparer avec l'ancien format `FormDataResponse`

#### Temps de chargement
- [ ] Mesurer le temps de chargement du formulaire
- [ ] Vérifier que la transformation côté backend est rapide

### 6. Compatibilité

#### Anciens partages
- [ ] Tester avec des partages créés avant la migration
- [ ] Vérifier que les données sont correctement transformées

#### Nouveaux partages
- [ ] Créer un nouveau partage
- [ ] Vérifier que le nouveau format est utilisé

## Résolution des problèmes

### Erreur : "Property 'headers' does not exist"
**Solution :** Vérifier que tous les composants utilisent le nouveau format sans référence aux `headers`.

### Erreur : "Property 'sheets' does not exist"
**Solution :** Supprimer les références aux `sheets` dans les composants.

### Erreur : "Property 'selection' does not exist"
**Solution :** Remplacer `selection` par `selectedCells` dans les composants.

### Erreur : "Property 'recipientConfig' does not exist"
**Solution :** Utiliser directement les propriétés du nouveau format (`pageTitle`, `pageDescription`, etc.). 