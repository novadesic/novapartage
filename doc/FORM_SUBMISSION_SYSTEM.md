# Système de Sauvegarde des Données Saisies

## Vue d'ensemble

Le système de sauvegarde des données saisies permet aux destinataires de sauvegarder leurs modifications dans un formulaire partagé, tout en conservant les données originales séparément. Cette approche permet au propriétaire du partage de choisir s'il souhaite importer les données saisies dans le fichier Excel source.

## Architecture

### Backend

#### 1. Modèle FormSubmission

```java
@MongoEntity(collection = "form_submissions")
public class FormSubmission extends PanacheMongoEntity {
    public String shareId;           // Référence au partage
    public String recipientEmail;    // Email du destinataire
    public Map<String, String> submittedValues; // Données saisies
    public LocalDateTime submittedAt;
    public LocalDateTime lastModifiedAt;
    public boolean isActive = true;
}
```

**Format des données soumises :**
- Clé : `"rowIndex-colIndex"` (ex: `"0-3"` pour ligne 0, colonne 3)
- Valeur : `"valeur_saisie"`

#### 2. Service FormSubmissionService

**Méthodes principales :**
- `saveFormSubmission()` : Sauvegarde ou met à jour les données
- `getFormSubmission()` : Récupère les données soumises
- `convertFormDataToSubmittedValues()` : Conversion du format frontend

#### 3. Intégration dans ShareService

**Fusion des données :**
- `getFormDataWithToken()` : Récupère et fusionne les données
- `mergeSubmittedValues()` : Remplace les valeurs originales par les valeurs soumises
- `saveFormData()` : Utilise FormSubmissionService pour la sauvegarde

### Frontend

#### 1. Composant ShareAccessComponent

**Nouvelles propriétés :**
```typescript
originalValues: { [key: string]: any } = {}; // Valeurs originales
modifiedCells: Set<string> = new Set(); // Cellules modifiées
```

**Nouvelles méthodes :**
- `initializeOriginalValues()` : Initialise les valeurs de référence
- `onCellModified()` : Gère les événements de modification
- `getModifiedCount()` : Compte les modifications
- `updateOriginalValuesAfterSave()` : Met à jour après sauvegarde

#### 2. Composant FormPreviewComponent

**Nouvelles fonctionnalités :**
- Détection des modifications en temps réel
- Affichage visuel des cellules modifiées
- Émission d'événements de modification

**Indicateurs visuels :**
- Bordure jaune pour les cellules modifiées
- Fond jaune clair
- Texte "Modifié" sous la cellule

## Flux de données

### 1. Chargement initial

```
1. getFormDataWithToken() → Récupère les données Excel
2. getFormSubmission() → Récupère les données soumises
3. mergeSubmittedValues() → Fusionne les données
4. Frontend affiche les données fusionnées
5. initializeOriginalValues() → Stocke les valeurs de référence
```

### 2. Modification par l'utilisateur

```
1. Utilisateur modifie une cellule
2. onInputChange() → Détecte la modification
3. cellModifiedChange.emit() → Notifie le parent
4. onCellModified() → Met à jour modifiedCells
5. Affichage visuel mis à jour
```

### 3. Sauvegarde

```
1. saveForm() → Filtre les modifications
2. saveFormData() → Envoie au backend
3. FormSubmissionService.saveFormSubmission() → Sauvegarde en base
4. updateOriginalValuesAfterSave() → Met à jour les références
5. modifiedCells.clear() → Réinitialise les modifications
```

## Avantages

### Séparation des données
- **Données originales** : Conservées dans le fichier Excel source
- **Données soumises** : Stockées séparément en base de données
- **Fusion à la volée** : Uniquement lors de l'affichage

### Flexibilité pour le propriétaire
- Possibilité d'importer ou non les données saisies
- Conservation de l'intégrité des données source
- Traçabilité des modifications par destinataire

### Expérience utilisateur
- Indicateurs visuels des modifications
- Sauvegarde incrémentale (seules les modifications)
- Bouton Enregistrer intelligent (activé seulement si modifications)

## Utilisation

### Pour les destinataires
1. Accéder au formulaire via le lien partagé
2. Modifier les champs éditables (bordure bleue → jaune)
3. Voir le compteur de modifications
4. Cliquer sur "Enregistrer" pour sauvegarder

### Pour les propriétaires
1. Les données originales restent intactes
2. Possibilité de récupérer les données soumises via l'API
3. Choix d'importer ou non dans le fichier source

## Sécurité

- Validation des tokens d'accès
- Vérification des permissions par destinataire
- Isolation des données par partage et destinataire
- Pas de modification des données source

## Évolutions futures

- Interface pour visualiser les données soumises
- Export des données soumises
- Historique des modifications
- Notifications de nouvelles soumissions 