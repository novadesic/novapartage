# Chiffrement Applicatif des Fichiers

## Vue d'ensemble

Le système de chiffrement applicatif permet de chiffrer les fichiers utilisateur avec une clé unique par utilisateur, garantissant une meilleure isolation et conformité RGPD.

## Architecture

### Clés de chiffrement

1. **Clé maître (Application)** : Chiffre les clés utilisateur stockées en base
   - Stockée dans la variable d'environnement `APP_ENCRYPTION_MASTER_KEY`
   - Format : Base64 (32 bytes = 256 bits)
   - Génération : `openssl rand -base64 32`

2. **Clé utilisateur** : Chiffre les fichiers de chaque utilisateur
   - Stockée chiffrée dans la table `user_encryption_keys`
   - Générée automatiquement lors du premier upload
   - Unique par utilisateur (email)

3. **Clé applicative** : Chiffre les fichiers temporaires
   - Identique à la clé maître
   - Utilisée pour les fichiers temporaires (avant création du partage)

### Algorithme

- **Algorithme** : AES-256-GCM (Galois/Counter Mode)
- **Taille de clé** : 256 bits (32 bytes)
- **IV (Initialization Vector)** : 12 bytes (aléatoire, stocké avec les données)
- **Tag d'authentification** : 128 bits

### Format des fichiers chiffrés

```
[IV (12 bytes)][Données chiffrées + Tag (variable)]
```

## Configuration

### 1. Générer la clé maître

```bash
openssl rand -base64 32
```

### 2. Configurer dans .env

```bash
# Clé maître pour chiffrer les clés utilisateur
APP_ENCRYPTION_MASTER_KEY=<clé_générée_en_base64>
```

⚠️ **IMPORTANT** : Stockez cette clé dans un gestionnaire de secrets en production !

### 3. Migration de la base de données

La migration `V4__add_file_encryption.sql` est exécutée automatiquement au démarrage :
- Ajoute les champs `is_encrypted` et `encryption_key_id` à la table `shares`
- Crée la table `user_encryption_keys`

## Fonctionnement

### Upload de fichier

1. **Fichier temporaire** : Chiffré avec la clé applicative lors du stockage temporaire
2. **Fichier permanent** : 
   - Déchiffré depuis le stockage temporaire
   - Re-chiffré avec la clé utilisateur
   - Stocké avec l'extension `.enc`
   - `is_encrypted = true` et `encryption_key_id = email_utilisateur` dans la base

### Download de fichier

1. Lecture du fichier depuis le stockage
2. Si `is_encrypted = true` :
   - Récupération de la clé utilisateur (déchiffrée avec la clé maître)
   - Déchiffrement du fichier
   - Retour du fichier déchiffré
3. Si `is_encrypted = false` :
   - Retour du fichier tel quel (rétrocompatibilité)

### Rétrocompatibilité

- Les fichiers existants (non chiffrés) continuent de fonctionner
- `is_encrypted = false` par défaut pour les anciens fichiers
- Tous les nouveaux fichiers sont automatiquement chiffrés

## Sécurité

### Points forts

- ✅ Isolation par utilisateur (clé unique)
- ✅ Chiffrement au repos (conforme RGPD)
- ✅ Clés utilisateur chiffrées en base
- ✅ Rétrocompatibilité avec fichiers existants
- ✅ Fichiers temporaires également chiffrés

### Bonnes pratiques

1. **Clé maître** :
   - Ne jamais commiter dans Git
   - Stocker dans un gestionnaire de secrets
   - Rotation périodique (nécessite re-chiffrement des clés utilisateur)

2. **Sauvegardes** :
   - Les fichiers chiffrés peuvent être sauvegardés tels quels
   - Les clés utilisateur doivent être sauvegardées avec la base
   - La clé maître doit être sauvegardée séparément

3. **Rotation des clés** :
   - Rotation de la clé maître : nécessite re-chiffrement de toutes les clés utilisateur
   - Rotation d'une clé utilisateur : nécessite re-chiffrement de tous ses fichiers

## Dépannage

### Erreur : "Clé applicative non configurée"

Vérifiez que `APP_ENCRYPTION_MASTER_KEY` est défini dans `.env` ou les variables d'environnement.

### Erreur : "Clé utilisateur introuvable"

La clé utilisateur est créée automatiquement lors du premier upload. Si l'erreur persiste :
1. Vérifiez que la migration `V4__add_file_encryption.sql` a été exécutée
2. Vérifiez que la table `user_encryption_keys` existe
3. Vérifiez les logs pour plus de détails

### Fichier non déchiffrable

1. Vérifiez que `is_encrypted` correspond à l'état réel du fichier
2. Vérifiez que `encryption_key_id` correspond à l'email de l'utilisateur
3. Vérifiez que la clé utilisateur existe dans `user_encryption_keys`
4. Vérifiez que la clé maître est correcte

## Migration des fichiers existants

Pour chiffrer les fichiers existants (optionnel) :

1. Créer un script de migration qui :
   - Lit chaque fichier non chiffré
   - Le chiffre avec la clé utilisateur
   - Met à jour `is_encrypted = true` et `encryption_key_id`
   - Sauvegarde le fichier avec l'extension `.enc`

2. ⚠️ **ATTENTION** : Faire une sauvegarde complète avant !

## Performance

- **Impact** : Négligeable pour les fichiers de taille raisonnable (< 50MB)
- **Mémoire** : Les fichiers sont chargés en mémoire pour le chiffrement/déchiffrement
- **Optimisation future** : Streaming pour les très gros fichiers

