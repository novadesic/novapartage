# Modèle de registre des traitements — NovaPartage (self-host)

> **Document modèle** pour l'installateur self-host. À compléter avec les informations de **votre organisation** (responsable de traitement).  
> Conforme à l'article 30 du RGPD.

## Instructions

Remplacez les placeholders `[...]` par vos données réelles. Novadesic SAS n'est **pas** responsable de traitement lorsque vous hébergez vous-même cette instance.

---

## Traitement 1 : Partage de fichiers Excel

### Responsable du traitement
- **Nom** : [Nom de votre organisation]
- **Adresse** : [Adresse complète]
- **Identifiant légal** : [SIRET / numéro d'enregistrement si applicable]
- **Email contact données personnelles** : [privacy@votre-domaine]

### Finalités
Permettre aux utilisateurs de partager des fichiers Excel de manière sécurisée avec des destinataires autorisés via des formulaires interactifs.

### Catégories de personnes concernées
- Propriétaires de partages (utilisateurs authentifiés)
- Destinataires de partages (utilisateurs invités)

### Catégories de données personnelles
- Adresses email
- Noms d'affichage (optionnel)
- Fichiers Excel (peuvent contenir des données personnelles)
- Données saisies dans les formulaires
- Métadonnées (dates, permissions, accès)

### Destinataires
- Propriétaires des partages
- Destinataires autorisés par le propriétaire
- Administrateurs du service (accès technique uniquement)

### Transferts vers des pays tiers
- À documenter selon votre hébergement et fournisseurs email

### Durées de conservation
Voir `doc/RGPD_DATA_RETENTION_POLICY.md` et variables `data.retention.*` dans la configuration.

### Mesures de sécurité
- Authentification par email avec tokens JWT
- Tokens stockés dans cookies HttpOnly
- Protection CSRF, rate limiting, HTTPS
- Chiffrement applicatif des fichiers (si activé)

### Base légale
- Consentement / exécution d'un contrat (à préciser selon votre usage)

---

## Traitement 2 : Authentification par email

### Responsable du traitement
- **Nom** : [Nom de votre organisation]
- **Email** : [privacy@votre-domaine]

### Finalités
Authentification des utilisateurs sans compte permanent via validation d'email.

### Durées de conservation
- Codes de vérification : 15 minutes
- Tokens JWT : selon configuration (`JWT_EXPIRES_IN`)
- Sessions : selon configuration

---

## Traitement 3 : Soumissions de formulaires

### Responsable du traitement
- **Nom** : [Nom de votre organisation]

### Finalités
Saisie et sauvegarde de données dans les formulaires partagés.

---

## Traitement 4 : Tokens d'accès

### Responsable du traitement
- **Nom** : [Nom de votre organisation]

### Finalités
Liens d'accès sécurisés aux partages pour les destinataires.

---

## Traitement 5 : Logs et monitoring

### Responsable du traitement
- **Nom** : [Nom de votre organisation]

### Finalités
Sécurité, debugging et monitoring (données anonymisées dans les rapports si configuré).

---

## Sous-traitants (à compléter)

| Sous-traitant | Finalité | Données |
|---------------|----------|---------|
| [Votre hébergeur] | Hébergement | Toutes les données de l'instance |
| [SMTP / service email] | Envoi d'emails | Adresses email, contenu des messages |

---

## Contact

- **Email** : [privacy@votre-domaine]
- **DPO** : [Nom ou « non désigné » selon votre taille]

---

**Dernière mise à jour du modèle** : juillet 2026
