# Test de la Conversion ExcelData → TableData

## Test de la classe ExcelDataConverter

### 1. Test de conversion basique

```java
// Créer des données Excel de test
List<String> headers = Arrays.asList("CATÉGORIE", "RÉFÉRENCE", "NOM DU PRODUIT", "TARIF");
List<Map<String, Object>> rows = new ArrayList<>();

Map<String, Object> row1 = new HashMap<>();
row1.put("CATÉGORIE", "Électronique");
row1.put("RÉFÉRENCE", "REF001");
row1.put("NOM DU PRODUIT", "Smartphone");
row1.put("TARIF", 299.99);
rows.add(row1);

Map<String, Object> row2 = new HashMap<>();
row2.put("CATÉGORIE", "Informatique");
row2.put("RÉFÉRENCE", "REF002");
row2.put("NOM DU PRODUIT", "Ordinateur portable");
row2.put("TARIF", 899.99);
rows.add(row2);

ExcelData excelData = new ExcelData("test.xlsx", headers, rows);

// Tester la conversion
List<Map<String, Object>> tableData = ExcelDataConverter.convertToTableData(excelData);

// Vérifier le résultat
assert tableData.size() == 2;
assert tableData.get(0).get("CATÉGORIE").equals("Électronique");
assert tableData.get(0).get("_rowIndex").equals(0);
assert tableData.get(1).get("TARIF").equals(899.99);
assert tableData.get(1).get("_rowIndex").equals(1);
```

### 2. Test de conversion avec sélection

```java
// Créer une sélection de cellules
List<ExcelDataConverter.CellPosition> selectedCells = Arrays.asList(
    new ExcelDataConverter.CellPosition(0, 0), // CATÉGORIE, ligne 0
    new ExcelDataConverter.CellPosition(0, 2), // NOM DU PRODUIT, ligne 0
    new ExcelDataConverter.CellPosition(1, 1), // RÉFÉRENCE, ligne 1
    new ExcelDataConverter.CellPosition(1, 3)  // TARIF, ligne 1
);

// Tester la conversion avec sélection
List<Map<String, Object>> tableData = ExcelDataConverter.convertToTableDataWithSelection(excelData, selectedCells);

// Vérifier le résultat
assert tableData.size() == 2;
assert tableData.get(0).size() == 3; // CATÉGORIE, NOM DU PRODUIT, _rowIndex
assert tableData.get(0).containsKey("CATÉGORIE");
assert tableData.get(0).containsKey("NOM DU PRODUIT");
assert !tableData.get(0).containsKey("RÉFÉRENCE"); // Non sélectionné
assert tableData.get(1).containsKey("RÉFÉRENCE");
assert tableData.get(1).containsKey("TARIF");
```

### 3. Test des cas d'erreur

```java
// Test avec ExcelData null
List<Map<String, Object>> result1 = ExcelDataConverter.convertToTableData(null);
assert result1.isEmpty();

// Test avec headers vides
ExcelData excelDataEmpty = new ExcelData("test.xlsx", new ArrayList<>(), rows);
List<Map<String, Object>> result2 = ExcelDataConverter.convertToTableData(excelDataEmpty);
assert result2.isEmpty();

// Test avec rows vides
ExcelData excelDataNoRows = new ExcelData("test.xlsx", headers, new ArrayList<>());
List<Map<String, Object>> result3 = ExcelDataConverter.convertToTableData(excelDataNoRows);
assert result3.isEmpty();
```

### 4. Test de génération des labels de colonnes

```java
// Test de génération de labels par défaut
List<String> headers = Arrays.asList("CATÉGORIE", "RÉFÉRENCE", "NOM_DU_PRODUIT", "TARIF");
Map<String, String> defaultLabels = ExcelDataConverter.generateDefaultColumnLabels(headers);

assert defaultLabels.size() == 4;
assert defaultLabels.get("CATÉGORIE").equals("CATÉGORIE");
assert defaultLabels.get("RÉFÉRENCE").equals("RÉFÉRENCE");

// Test de génération de labels lisibles
Map<String, String> readableLabels = ExcelDataConverter.generateReadableColumnLabels(headers);

assert readableLabels.size() == 4;
assert readableLabels.get("CATÉGORIE").equals("Catégorie");
assert readableLabels.get("RÉFÉRENCE").equals("Référence");
assert readableLabels.get("NOM_DU_PRODUIT").equals("Nom Du Produit");
assert readableLabels.get("TARIF").equals("Tarif");

// Test de génération de labels transformés (compatibles avec tableData)
Map<String, String> transformedLabels = ExcelDataConverter.generateTransformedColumnLabels(headers);

assert transformedLabels.size() == 4;
assert transformedLabels.containsKey("Catégorie");
assert transformedLabels.containsKey("Référence");
assert transformedLabels.containsKey("Nom Du Produit");
assert transformedLabels.containsKey("Tarif");
assert transformedLabels.get("Catégorie").equals("Catégorie");
assert transformedLabels.get("Référence").equals("Référence");

// Test de conversion avec données d'exemple
List<Map<String, Object>> testData = new ArrayList<>();
Map<String, Object> row1 = new HashMap<>();
row1.put("_rowIndex", 1);
row1.put("Catégorie", "Vêtements");
row1.put("Référence", "VE-7700");
testData.add(row1);

// Vérifier que _rowIndex est présent dans les données mais sera filtré côté frontend
assert testData.get(0).containsKey("_rowIndex");
assert testData.get(0).containsKey("Catégorie");
assert testData.get(0).containsKey("Référence");

## Test d'intégration

### 1. Test via l'API

```bash
# Tester l'endpoint avec un token valide
curl -X GET "http://localhost:8080/api/shares/form/{token}" \
  -H "Content-Type: application/json"
```

**Réponse attendue :**
```json
{
  "shareId": "68808eefb3669af5fa6163cf",
  "fileName": "Tarifs_B.xlsx",
  "pageTitle": "Prix catalogue 2025",
  "pageDescription": "Valables jusqu'au 31/12/2025",
  "tableData": [
    {
      "CATÉGORIE": "Électronique",
      "RÉFÉRENCE": "REF001",
      "NOM DU PRODUIT": "Smartphone",
      "TARIF": 299.99,
      "_rowIndex": 0
    },
    {
      "CATÉGORIE": "Informatique",
      "RÉFÉRENCE": "REF002",
      "NOM DU PRODUIT": "Ordinateur portable",
      "TARIF": 899.99,
      "_rowIndex": 1
    }
  ],
  "columnLabels": {
    "CATÉGORIE": "Catégorie de produit",
    "RÉFÉRENCE": "Référence produit",
    "NOM DU PRODUIT": "Nom du produit",
    "TARIF": "Prix en euros"
  },
  "editableCells": [
    {"row": 0, "col": 3},
    {"row": 1, "col": 3}
  ],
  "totalRows": 2,
  "totalColumns": 4
}
```

### 2. Vérification des logs

Les logs suivants doivent apparaître :

```
🔍 Données Excel reçues: ExcelData
🔍 Headers: [CATÉGORIE, RÉFÉRENCE, NOM DU PRODUIT, TARIF]
🔄 Conversion ExcelData vers TableData
📊 Headers: [CATÉGORIE, RÉFÉRENCE, NOM DU PRODUIT, TARIF]
📊 Nombre de lignes: 2
📋 Ligne 0 convertie: 4 champs
📋 Ligne 1 convertie: 4 champs
✅ Conversion terminée: 2 lignes générées
🔍 TableData transformé: 2 lignes
```

## Cas d'usage spécifiques

### 1. Conversion avec sélection partielle

Si seulement certaines cellules sont sélectionnées, seules ces cellules doivent apparaître dans `tableData`.

### 2. Conversion sans sélection

Si aucune sélection n'est définie, toutes les données doivent être incluses.

### 3. Gestion des données manquantes

Les cellules vides ou nulles doivent être gérées correctement.

## Performance

### Mesures attendues

- **Conversion de 1000 lignes** : < 100ms
- **Conversion avec sélection** : < 50ms
- **Mémoire utilisée** : < 10MB pour 1000 lignes

### Optimisations

- Utilisation de `HashMap` pour les performances
- Logs conditionnels (debug level)
- Gestion efficace des collections

## Évolutions futures

### 1. Support d'autres formats

La classe `ExcelDataConverter` peut être étendue pour supporter :
- CSV
- JSON
- Base de données
- API externes

### 2. Filtres avancés

- Filtrage par valeur
- Tri des données
- Agrégation
- Calculs

### 3. Cache

- Mise en cache des conversions
- Invalidation intelligente
- Compression des données 