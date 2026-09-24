# Politique de Conservation des Données - NovaPartage

## Vue d'ensemble

Ce document décrit la politique de conservation des données personnelles de NovaPartage, conforme au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés.

## Principes généraux

- **Minimisation** : Conservation uniquement des données nécessaires
- **Durée limitée** : Conservation pour une durée déterminée
- **Suppression automatique** : Nettoyage automatique des données obsolètes
- **Traçabilité** : Conservation des logs pour audit et sécurité

## Durées de conservation par type de donnée

### 1. Fichiers Excel

| Statut | Durée | Justification | Implémentation |
|--------|-------|---------------|----------------|
| Partages actifs | Jusqu'à suppression manuelle | Nécessaire au service | Manuel |
| Partages supprimés | 30 jours | Délai de récupération | ✅ Automatique (`cleanupDeletedShares`) |
| Fichiers temporaires | 24 heures | Fichiers non finalisés | ✅ Automatique (`cleanupTemporaryFiles`) |

### 2. Partages (métadonnées)

| Statut | Durée | Justification | Implémentation |
|--------|-------|---------------|----------------|
| NEW (non finalisés) | 7 jours | Nettoyage des brouillons | ✅ Automatique (`cleanupNewShares`) |
| DELETED | 30 jours | Délai de récupération | ✅ Automatique (`cleanupDeletedShares`) |
| FINISHED | 18 mois | Conservation pour historique | ✅ Automatique (`cleanupFinishedShares`) |
| INACTIVE | 7 mois | Nettoyage progressif | ✅ Automatique (`cleanupInactiveShares`) |
| ACTIVE | Indéfinie | Service principal | Jusqu'à suppression manuelle |

### 3. Soumissions de formulaires

| Statut | Durée | Justification | Implémentation |
|--------|-------|---------------|----------------|
| Actives | Lié au partage parent | Cohérence avec le partage | Suppression en cascade |
| Orphelines | 1 an sans modification | Nettoyage des données isolées | ✅ Automatique (`cleanupOrphanFormSubmissions`) |

### 4. Tokens d'accès

| Statut | Durée | Justification | Implémentation |
|--------|-------|---------------|----------------|
| ACTIVE | Jusqu'à expiration | Nécessaires pour l'accès | Gestion automatique |
| EXPIRED | 90 jours après expiration | Traçabilité et audit | ✅ Automatique (`cleanupExpiredTokens`) |
| REVOKED | 90 jours après révocation | Traçabilité et audit | ✅ Automatique (`cleanupExpiredTokens`) |
| VALIDATED | 1 an après validation | Historique des validations | ✅ Automatique (`cleanupValidatedTokens`) |

### 5. Logs

| Type | Durée | Justification | Implémentation |
|------|-------|---------------|----------------|
| Logs d'audit | 12 mois | Sécurité et conformité | ⚠️ À configurer |
| Logs d'application | 3 mois | Debug et maintenance | ⚠️ À configurer |

## Implémentation technique

### Service de nettoyage

Le service `DataRetentionService` gère automatiquement le nettoyage des données selon les durées configurées.

**Fichier** : `backend/src/main/java/com/datadesic/ddsshare/backend/service/DataRetentionService.java`

### Tâches planifiées

| Tâche | Horaire | Méthode | Description |
|-------|---------|---------|-------------|
| Nettoyage partages NEW | 2h00 | `cleanupNewShares()` | Supprime les partages non finalisés après 7 jours |
| Nettoyage partages FINISHED | 3h00 | `cleanupFinishedShares()` | Supprime les partages terminés après 18 mois |
| Nettoyage partages INACTIVE | 4h00 | `cleanupInactiveShares()` | Supprime les partages inactifs après 7 mois |
| Nettoyage tokens expirés | 5h00 | `cleanupExpiredTokens()` | Supprime les tokens expirés après 90 jours |
| Nettoyage tokens validés | 5h30 | `cleanupValidatedTokens()` | Supprime les tokens validés après 1 an |
| Nettoyage soumissions orphelines | 6h00 | `cleanupOrphanFormSubmissions()` | Supprime les soumissions orphelines après 1 an |

### Configuration

Les durées sont configurables via `application.properties` :

```properties
# Partages
data.retention.shares.deleted.days=30
data.retention.shares.new.days=7
data.retention.shares.finished.months=18
data.retention.shares.inactive.months=7
data.retention.shares.inactive.warning.months=6

# Fichiers temporaires
data.retention.temp.files.hours=24

# Tokens
data.retention.tokens.expired.days=90
data.retention.tokens.validated.years=1

# Soumissions
data.retention.form.submissions.orphan.years=1

# Logs
data.retention.logs.audit.months=12
data.retention.logs.application.months=3
```

## Procédures de nettoyage

### Suppression complète d'un partage

La méthode `deleteShareCompletely()` supprime en cascade :
1. Le fichier physique
2. Les tokens d'accès associés
3. Les soumissions de formulaires
4. Les tabdata et leurs lignes
5. Le partage et ses destinataires (cascade)

### Logs et traçabilité

Toutes les suppressions sont loggées avec :
- Date et heure
- Type de donnée supprimée
- Identifiant de l'entité
- Raison de la suppression

## Exceptions et cas particuliers

### Données nécessaires à des obligations légales

Certaines données peuvent être conservées plus longtemps si nécessaire pour :
- Respecter des obligations légales (comptabilité, fiscalité)
- Répondre à des demandes judiciaires
- Assurer la sécurité du service

### Données anonymisées

Les données anonymisées (dans les rapports de monitoring) peuvent être conservées indéfiniment car elles ne sont plus considérées comme des données personnelles.

## Droits des utilisateurs

Les utilisateurs peuvent à tout moment :
- Demander l'accès à leurs données
- Demander la rectification de leurs données
- Demander la suppression de leurs données
- Demander la portabilité de leurs données

**Contact** : privacy@novadesic.com

## Révision de la politique

Cette politique est révisée régulièrement et mise à jour si nécessaire. La dernière mise à jour est indiquée en haut du document.

## Conformité RGPD

Cette politique respecte les principes du RGPD :
- ✅ **Minimisation** : Collecte uniquement des données nécessaires
- ✅ **Durée limitée** : Conservation pour une durée déterminée
- ✅ **Exactitude** : Données exactes et à jour
- ✅ **Intégrité et confidentialité** : Sécurité des données
- ✅ **Responsabilité** : Documentation et traçabilité

