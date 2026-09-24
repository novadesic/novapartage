# Nouveau Format de Données pour l'Accès aux Formulaires

## Vue d'ensemble

Le nouveau format `FormAccessData` remplace l'ancien `FormDataResponse` pour simplifier l'accès aux formulaires et rendre le format indépendant de la source de données (Excel, CSV, etc.).

## Objectifs

1. **Simplification** : Suppression des champs techniques liés à Excel
2. **Indépendance** : Format générique applicable à toute source de données
3. **Clarté** : Données structurées et faciles à utiliser côté frontend
4. **Performance** : Réduction de la taille des données transmises

## Structure du nouveau format

### Frontend (TypeScript)

```typescript
export interface FormAccessData {
  // Informations du partage
  shareId: string;
  fileName: string;
  originalFileName: string;
  ownerUsername: string;
  ownerEmail: string;
  createdAt: string;
  expiresAt: string;
  recipientEmail: string;
  
  // Configuration du formulaire
  pageTitle: string;
  pageDescription: string;
  
  // Données du tableau
  tableData: TableRow[];
  columnLabels: { [columnKey: string]: string };
  
  // Configuration des cellules
  editableCells: CellPosition[];
  
  // Métadonnées
  totalRows: number;
  totalColumns: number;
}

export interface TableRow {
  [columnKey: string]: any;
  _rowIndex?: number; // Index de la ligne dans le tableau original
}

export interface CellPosition {
  row: number;
  col: number;
}
```

### Backend (Java)

```java
public class FormAccessData {
    // Informations du partage
    public String shareId;
    public String fileName;
    public String originalFileName;
    public String ownerUsername;
    public String ownerEmail;
    public LocalDateTime createdAt;
    public LocalDateTime expiresAt;
    public String recipientEmail;
    
    // Configuration du formulaire
    public String pageTitle;
    public String pageDescription;
    
    // Données du tableau
    public List<Map<String, Object>> tableData;
    public Map<String, String> columnLabels;
    
      // Configuration des cellules
  public List<CellPosition> editableCells;
    
    // Métadonnées
    public int totalRows;
    public int totalColumns;
    
    public static class CellPosition {
        public int row;
        public int col;
    }
}
```

## Champs supprimés

Les champs suivants ont été supprimés car ils étaient spécifiques à Excel :

- `selectedSheet`
- `headerRow`
- `dataStartRow`
- `columnRange`
- `includeFormulas`
- `preserveFormatting`
- `detectedFields`
- `excelData`
- `headers`
- `recipientConfig` (remplacé par des champs directs)

## Transformation des données

Le backend se charge maintenant de transformer les données Excel en format simplifié via la classe `ExcelDataConverter` qui :

1. **Extrait les données brutes d'Excel** depuis l'objet `ExcelData`
2. **Filtre selon les cellules sélectionnées** si une sélection est définie
3. **Convertit en liste de Maps** avec les en-têtes comme clés
4. **Ajoute un index de ligne** (`_rowIndex`) pour référence
5. **Retourne un format générique** utilisable par le frontend

### Architecture de conversion

```
ExcelData (Source) → ExcelDataConverter → List<Map<String, Object>> (TableData)
     ↓                        ↓                        ↓
- fileName              - convertToTableData()      - Données filtrées
- headers               - convertToTableDataWithSelection()  - Index de ligne
- rows                  - generateTransformedColumnLabels()  - Format générique
- totalRows/totalColumns - Logs détaillés            - Labels compatibles
```

### Avantages de cette approche

- **Séparation des responsabilités** : Conversion dédiée et réutilisable
- **Évolutivité** : Facile d'ajouter de nouveaux formats de données
- **Maintenabilité** : Code centralisé et bien documenté
- **Debugging** : Logs détaillés pour diagnostiquer les problèmes
- **Flexibilité** : Support de la conversion avec ou sans sélection
- **Gestion des labels** : Génération automatique de labels compatibles avec tableData

## Avantages

### Pour le Frontend
- **Simplicité** : Plus besoin de gérer les spécificités Excel
- **Performance** : Données déjà formatées et optimisées
- **Maintenabilité** : Code plus simple et lisible

### Pour le Backend
- **Flexibilité** : Possibilité d'ajouter d'autres sources de données
- **Séparation des responsabilités** : Le backend gère la transformation
- **Évolutivité** : Format extensible pour de futures fonctionnalités

### Pour l'Architecture
- **Découplage** : Le frontend ne dépend plus du format Excel
- **Réutilisabilité** : Format applicable à d'autres types de données
- **Standardisation** : Interface cohérente pour tous les formulaires

## Migration

### Étapes effectuées

1. ✅ Création des nouvelles interfaces `FormAccessData`
2. ✅ Mise à jour du service backend `ShareService`
3. ✅ Ajout de la méthode de transformation `transformExcelDataToTableData`
4. ✅ Mise à jour du contrôleur `PublicAccessController`
5. ✅ Mise à jour du service frontend `ShareService`
6. ✅ Mise à jour du composant `ShareAccessComponent`

### Compatibilité

Le nouveau format est rétrocompatible avec les données existantes grâce à la méthode de transformation qui gère les différents formats de données Excel.

**Important :** Le composant `FormPreviewComponent` a été conçu pour être compatible avec les deux formats :
- **Nouveau format** : Utilisé pour l'accès aux partages (`share-access`)
- **Ancien format** : Utilisé pour la création de partages (`new-share`)

Cette approche hybride permet une migration progressive sans casser les fonctionnalités existantes.

### Adaptation du composant FormPreview

Le composant `FormPreviewComponent` a été adapté pour être compatible avec le nouveau format tout en maintenant la compatibilité avec l'ancien format :

#### Gestion de la colonne _rowIndex

La colonne `_rowIndex` ajoutée par le backend pour référence est automatiquement masquée de l'affichage :

- ✅ **Filtrage automatique** : Exclue de `selectedColumns`
- ✅ **Pas d'édition** : `isCellEditable()` retourne `false` pour cette colonne
- ✅ **Pas de label** : `getColumnLabel()` retourne une chaîne vide
- ✅ **Transparence** : L'utilisateur ne voit jamais cette colonne technique

- **Compatibilité hybride** : Support des deux formats (ancien et nouveau)
- **Propriétés optionnelles** : `headers`, `sheets`, `selectedSheetIndex` sont optionnelles
- **Gestion intelligente des labels** : Utilise `columnLabels` en priorité, puis `headers` si disponibles
- **Compatibilité avec les cellules** : Support des `editableCells` du nouveau format
- **Rétrocompatibilité** : Les composants de création (`new-share`) continuent de fonctionner

## Utilisation

### Côté Frontend

```typescript
// Récupération des données
this.shareService.getFormDataWithToken(token).subscribe({
  next: (formData: FormAccessData) => {
    // Utilisation directe des données
    this.tableData = formData.tableData;
    this.editableCells = formData.editableCells;
    this.pageTitle = formData.pageTitle;
  }
});
```

### Côté Backend

```java
// Génération des données
FormAccessData formData = new FormAccessData();
formData.tableData = transformExcelDataToTableData(excelData, headers);
formData.editableCells = extractEditableCells(recipient);
formData.pageTitle = recipient.pageTitle;
```

## Évolutions futures

Ce nouveau format permet d'envisager facilement :

1. **Support d'autres formats** : CSV, JSON, base de données
2. **Formulaires dynamiques** : Configuration via API
3. **Validation avancée** : Règles métier côté backend
4. **Templates** : Formulaires pré-configurés
5. **Multi-langue** : Labels dynamiques selon la langue 