# Tests d'intégration pour la page New-Share - MVP
# Ce fichier contient les tests de base essentiels pour éviter les régressions
# sur les fonctionnalités fondamentales du POC/MVP

@new-share @integration @mvp
Feature: Création et modification de partages de fichiers Excel - MVP
  En tant qu'utilisateur authentifié
  Je veux pouvoir créer et modifier des partages de fichiers Excel
  Afin de partager des données avec des destinataires spécifiques

  # Tests de base et navigation du wizard
  @wizard @navigation
  Scenario: Navigation basique dans le wizard de création
    # Test de la navigation entre les étapes du wizard
    Given je suis connecté à l'application
    And je suis sur la page de création de partage
    When je consulte l'étape actuelle
    Then je vois que je suis à l'étape 1 "Sélectionner un fichier"
    And je vois un indicateur de progression avec 4 étapes
    And les étapes 2, 3 et 4 sont désactivées (verrouillées)
    And je vois un bouton "Suivant" activé
    And je vois un bouton "Précédent" désactivé

  @wizard @navigation
  Scenario: Navigation conditionnelle entre les étapes
    # Test de la logique de navigation conditionnelle
    Given je suis connecté à l'application
    And je suis sur la page de création de partage
    When je sélectionne un fichier Excel valide
    And je passe à l'étape 2
    Then je peux naviguer vers l'étape 1
    And je peux naviguer vers l'étape 2
    And je ne peux pas accéder à l'étape 3 (verrouillée)
    And je ne peux pas accéder à l'étape 4 (verrouillée)

  # Tests de sélection et upload de fichiers
  @file-upload @validation
  Scenario: Sélection de fichier via le bouton de sélection
    # Test de la sélection manuelle de fichier
    Given je suis connecté à l'application
    And je suis sur la page de création de partage
    When je clique sur la zone de dépôt de fichier
    And je sélectionne un fichier Excel (.xlsx) valide
    Then le fichier est affiché dans la zone de dépôt
    And je vois le nom du fichier sélectionné
    And je vois un message de succès
    And le bouton "Suivant" devient actif

  @file-upload @drag-drop
  Scenario: Upload de fichier par glisser-déposer
    # Test de la fonctionnalité de drag & drop
    Given je suis connecté à l'application
    And je suis sur la page de création de partage
    When je glisse un fichier Excel valide sur la zone de dépôt
    Then le fichier est automatiquement sélectionné
    And l'upload commence automatiquement
    And je vois un indicateur de chargement
    And après l'upload, je vois les informations du fichier

  @file-upload @validation
  Scenario: Validation des types de fichiers supportés
    # Test de la validation des formats de fichiers
    Given je suis connecté à l'application
    And je suis sur la page de création de partage
    When j'essaie de sélectionner un fichier .txt
    Then le fichier est rejeté
    And je vois un message d'erreur approprié
    And le bouton "Suivant" reste désactivé

  # Tests de gestion des destinataires
  @recipients @management
  Scenario: Ajout manuel de destinataires
    # Test de l'ajout manuel de destinataires
    Given je suis connecté à l'application
    And j'ai sélectionné un fichier Excel valide
    And je suis à l'étape 2 "Destinataires & sélection des cellules"
    When j'ajoute un destinataire avec email "test@exemple.com"
    Then le destinataire apparaît dans la liste
    And le bouton "Suivant" devient actif

  @recipients @validation
  Scenario: Validation des adresses email
    # Test de la validation des formats d'email
    Given je suis connecté à l'application
    And j'ai sélectionné un fichier Excel valide
    And je suis à l'étape 2 "Destinataires & sélection des cellules"
    When j'essaie d'ajouter un destinataire avec email invalide "email-invalide"
    Then l'email est rejeté
    And je vois un message d'erreur de validation
    And le destinataire n'est pas ajouté

  @recipients @management
  Scenario: Suppression de destinataires
    # Test de la suppression de destinataires
    Given je suis connecté à l'application
    And j'ai sélectionné un fichier Excel valide
    And j'ai ajouté plusieurs destinataires
    When je supprime un destinataire de la liste
    Then le destinataire disparaît de la liste
    And si c'était le dernier destinataire, le bouton "Suivant" devient inactif

  # Tests de sélection des cellules
  @cell-selection @tableau
  Scenario: Sélection de cellules dans le tableau
    # Test de la sélection de cellules pour un destinataire
    Given je suis connecté à l'application
    And j'ai sélectionné un fichier Excel valide
    And j'ai ajouté un destinataire
    And je suis à l'étape 2 "Destinataires & sélection des cellules"
    When je sélectionne des cellules dans le tableau
    Then les cellules sélectionnées sont mises en surbrillance
    And la sélection est sauvegardée pour ce destinataire

  @cell-selection @validation
  Scenario: Validation de la sélection de cellules obligatoire
    # Test de la validation qu'un destinataire a des cellules sélectionnées
    Given je suis connecté à l'application
    And j'ai sélectionné un fichier Excel valide
    And j'ai ajouté un destinataire sans sélectionner de cellules
    When j'essaie de passer à l'étape suivante
    Then je vois un message d'avertissement
    And je ne peux pas continuer

  # Tests de configuration des droits
  @permissions @configuration
  Scenario: Configuration des droits de modification
    # Test de la configuration des cellules éditables
    Given je suis connecté à l'application
    And j'ai sélectionné un fichier Excel valide
    And j'ai configuré des destinataires avec sélections de cellules
    And je suis à l'étape 3 "Droits de modification"
    When je configure des cellules comme éditables pour un destinataire
    Then les cellules éditables sont mises en surbrillance
    And la configuration est sauvegardée

  # Tests de prévisualisation
  @preview @forms
  Scenario: Prévisualisation des formulaires
    # Test de la prévisualisation des formulaires générés
    Given je suis connecté à l'application
    And j'ai sélectionné un fichier Excel valide
    And j'ai configuré des destinataires et des droits
    And je suis à l'étape 4 "Prévisualisation des formulaires"
    When je consulte la prévisualisation d'un formulaire
    Then je vois le formulaire tel qu'il apparaîtra au destinataire
    And je peux modifier le titre et la description de la page

  # Tests de sauvegarde et finalisation
  @save @persistence
  Scenario: Sauvegarde d'un partage en cours
    # Test de la sauvegarde d'un partage non finalisé
    Given je suis connecté à l'application
    And j'ai sélectionné un fichier Excel valide
    And j'ai configuré au moins un destinataire
    And je suis à une étape après la première
    When je clique sur le bouton "Sauvegarder"
    Then le partage est sauvegardé en statut "NEW"
    And je vois un message de confirmation
    And je peux continuer à travailler sur le partage

  @finalization @creation
  Scenario: Finalisation d'un nouveau partage
    # Test de la finalisation complète d'un partage
    Given je suis connecté à l'application
    And j'ai sélectionné un fichier Excel valide
    And j'ai configuré tous les destinataires avec leurs droits
    And je suis à l'étape 4 "Prévisualisation des formulaires"
    When je clique sur "Finaliser le partage"
    Then le partage est créé et finalisé
    And les formulaires sont générés pour chaque destinataire
    And je vois un message de succès
    And je suis redirigé vers la liste des partages

  # Tests de gestion des erreurs et cas limites
  @error-handling @validation
  Scenario: Tentative de finalisation sans configuration complète
    # Test de la validation avant finalisation
    Given je suis connecté à l'application
    And j'ai sélectionné un fichier Excel valide
    And j'ai ajouté un destinataire mais sans sélectionner de cellules
    When j'essaie de finaliser le partage
    Then je vois un message d'erreur explicite
    And le partage n'est pas finalisé
    And je reste sur la page actuelle

  @error-handling @network
  Scenario: Gestion des erreurs de connexion
    # Test de la gestion des erreurs réseau
    Given je suis connecté à l'application
    And j'ai sélectionné un fichier Excel valide
    And la connexion au serveur est perdue
    When j'essaie de sauvegarder ou finaliser le partage
    Then je vois un message d'erreur de connexion
    And je peux réessayer l'opération

  # Tests de base d'intégration avec les services
  @integration @basic
  Scenario: Intégration basique avec le service Excel
    # Test de l'intégration basique avec le service de traitement Excel
    Given je suis connecté à l'application
    And le service Excel est disponible
    When je sélectionne un fichier Excel simple
    Then le fichier est correctement analysé
    And les données sont extraites correctement

  @integration @basic
  Scenario: Intégration basique avec le service de partage
    # Test de l'intégration basique avec le service de gestion des partages
    Given je suis connecté à l'application
    And le service de partage est disponible
    When je finalise un partage
    Then le partage est créé dans le système
    And les formulaires sont générés
    And le partage apparaît dans ma liste de partages

  # Tests de base d'UX
  @ux @basic
  Scenario: Responsive design basique
    # Test de la responsivité basique sur différentes tailles d'écran
    Given je suis connecté à l'application
    And je suis sur la page de création de partage
    When je redimensionne la fenêtre du navigateur
    Then l'interface s'adapte correctement
    And tous les éléments restent visibles et utilisables
    And la navigation reste fonctionnelle
