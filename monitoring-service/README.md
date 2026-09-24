# Monitoring Service - DDShare

Service de monitoring pour DDShare qui génère et envoie automatiquement des rapports d'utilisation de l'application.

## Fonctionnalités

- ✅ Génération automatique de rapports d'utilisation
- ✅ Planification via cron (node-cron)
- ✅ Anonymisation des données personnelles (emails, noms, fichiers)
- ✅ Envoi d'emails HTML avec résumé
- ✅ Fichier CSV joint avec données détaillées
- ✅ **Nettoyage automatique des fichiers temporaires** (maintenance)
- ✅ Intégration native avec Docker et PostgreSQL

## Métriques collectées

- Nombre d'utilisateurs uniques
- Nombre total de partages
- Nombre de partages actifs
- Nombre de partages par utilisateur (anonymisé)
- Fichiers temporaires non partagés
- Statistiques par extension de fichier

## Structure

```
monitoring-service/
├── server.js              # Point d'entrée principal
├── package.json           # Dépendances Node.js
├── docker/
│   └── Dockerfile        # Image Docker
├── config/
│   └── postgres.js       # Configuration PostgreSQL
├── services/
│   ├── statistics.js     # Génération des statistiques
│   ├── reportGenerator.js # Génération HTML/CSV
│   └── emailService.js   # Envoi d'emails
└── utils/
    └── anonymizer.js     # Anonymisation des données
```

## Configuration

### Variables d'environnement

#### PostgreSQL
- `DB_HOST` : Host PostgreSQL (défaut: `postgres`)
- `DB_PORT` : Port PostgreSQL (défaut: `5432`)
- `DB_NAME` : Nom de la base de données (défaut: `ddsshare`)
- `DB_USERNAME` : Nom d'utilisateur PostgreSQL (défaut: `novapartage`)
- `DB_PASSWORD` : Mot de passe PostgreSQL (défaut: `novapartage_password`)

#### Planification
- `MONITORING_SCHEDULE` : Expression cron (défaut: `0 8 * * *` = tous les jours à 8h)
- `MONITORING_ENABLED` : Activer/désactiver le service (défaut: `true`)
- `MONITORING_RUN_ONCE` : Exécuter une seule fois puis arrêter (pour tests)

#### Maintenance (nettoyage des fichiers temporaires)
- `MAINTENANCE_SCHEDULE` : Expression cron (défaut: `0 * * * *` = toutes les heures)
- `MAINTENANCE_ENABLED` : Activer/désactiver la maintenance (défaut: `true`)
- `MAINTENANCE_MAX_AGE_HOURS` : Âge maximum des fichiers en heures avant suppression (défaut: `1`)
- `MAINTENANCE_RUN_ON_START` : Exécuter la maintenance au démarrage (défaut: `false`)

#### Email
- `SMTP_HOST` : Serveur SMTP
- `SMTP_PORT` : Port SMTP
- `SMTP_USER` : Utilisateur SMTP (optionnel)
- `SMTP_PASS` : Mot de passe SMTP (optionnel)
- `SMTP_FROM` : Adresse email expéditeur
- `SMTP_SECURE` : Utiliser SSL/TLS (défaut: `false`)
- `SMTP_IGNORE_TLS` : Ignorer TLS (défaut: `true`)
- `SMTP_REQUIRE_TLS` : Exiger TLS (défaut: `false`)
- `SMTP_TLS_REJECT_UNAUTHORIZED` : Rejeter certificats non autorisés (défaut: `false`)
- `MONITORING_EMAIL_TO` : Destinataire des rapports

#### Fichiers temporaires
- `TEMP_FILES_DIR` : Répertoire des fichiers temporaires (défaut: `/app/files/temp`)

## Planification (format cron)

Format: `minute heure jour mois jour-semaine`

Exemples:
- `0 8 * * *` : Tous les jours à 8h00
- `0 0 * * 1` : Tous les lundis à minuit
- `0 0 1 * *` : Le 1er de chaque mois à minuit
- `0 */6 * * *` : Toutes les 6 heures
- `30 14 * * *` : Tous les jours à 14h30

### Maintenance automatique

La maintenance nettoie automatiquement les fichiers temporaires qui ont dépassé l'âge maximum configuré. Par défaut :
- **Exécution** : Toutes les heures (`0 * * * *`)
- **Âge maximum** : 1 heure
- **Action** : Suppression des fichiers temporaires de plus de 1 heure

Pour modifier la fréquence, changez `MAINTENANCE_SCHEDULE` :
- `0 */2 * * *` : Toutes les 2 heures
- `0 0 * * *` : Une fois par jour à minuit
- `*/30 * * * *` : Toutes les 30 minutes

## Build et déploiement

### Build de l'image Docker

```bash
cd monitoring-service
./build_and_dockerize.sh
```

### Exécution locale (pour tests)

```bash
cd monitoring-service
npm install
MONITORING_RUN_ONCE=true node server.js
```

### Exécution dans Docker

Le service est automatiquement démarré avec docker-compose :

```bash
docker-compose up -d monitoring-service
```

### Logs

```bash
docker logs -f ddsshare-monitoring
```

## Anonymisation des données

Pour des raisons de confidentialité, toutes les données personnelles sont anonymisées :

- **Emails** : `user@domain.com` → `a1b2c3d4@domain.com` (hash du nom local)
- **Usernames** : `john.doe` → `user_a1b2c3d4` (hash)
- **Noms de fichiers** : `document.xlsx` → `a1b2c3d4.xlsx` (hash du nom, extension conservée)

Les domaines sont conservés pour permettre des analyses par domaine.

## Format des rapports

### Rapport HTML
- Vue d'ensemble avec statistiques principales
- Tableau des partages par utilisateur (top 20)
- Statistiques sur les fichiers temporaires
- Répartition par extension

### Rapport CSV
- Section statistiques générales
- Section partages par utilisateur (tous les utilisateurs)
- Section fichiers temporaires (limité à 50)

## Intégration dans docker-compose

Le service est déjà configuré dans `MEP/docker-compose.yml`. Il nécessite :

- PostgreSQL (pour récupérer les données)
- Volume `./user_files` monté en lecture/écriture (pour accéder aux fichiers temporaires)

## Troubleshooting

### Le service ne s'exécute pas
- Vérifier que `MONITORING_ENABLED=true`
- Vérifier les logs : `docker logs ddsshare-monitoring`

### Erreur de connexion PostgreSQL
- Vérifier que PostgreSQL est démarré
- Vérifier les variables `DB_*`

### Erreur d'envoi d'email
- Vérifier la configuration SMTP
- Vérifier que `MONITORING_EMAIL_TO` est défini
- Tester avec `MONITORING_RUN_ONCE=true` pour voir les logs détaillés

### Fichiers temporaires non détectés / répertoire temp introuvable
- Sur l'hôte : `./scripts/init-dirs.sh` (crée `user_files/temp` et `user_files/users`)
- Vérifier que le volume `./user_files` est monté
- Vérifier que `TEMP_FILES_DIR` pointe vers le bon répertoire
- Le monitoring crée désormais `/app/files/temp` s'il est manquant (si le volume est accessible en écriture)
