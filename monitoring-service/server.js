const cron = require('node-cron');
const postgresClient = require('./config/postgres');
const statisticsService = require('./services/statistics');
const reportGenerator = require('./services/reportGenerator');
const emailService = require('./services/emailService');
const maintenanceService = require('./services/maintenance');

const MONITORING_SCHEDULE = process.env.MONITORING_SCHEDULE || '0 8 * * *'; // Tous les jours à 8h
const MONITORING_ENABLED = process.env.MONITORING_ENABLED !== 'false';

// Planification de la maintenance (nettoyage des fichiers temporaires)
const MAINTENANCE_SCHEDULE = process.env.MAINTENANCE_SCHEDULE || '0 * * * *'; // Toutes les heures
const MAINTENANCE_ENABLED = process.env.MAINTENANCE_ENABLED !== 'false';
const MAINTENANCE_MAX_AGE_HOURS = parseInt(process.env.MAINTENANCE_MAX_AGE_HOURS || '1');

console.log('[MONITORING] ========================================');
console.log('[MONITORING] Service de monitoring DDShare démarré');
console.log(`[MONITORING] Planification rapport: ${MONITORING_SCHEDULE}`);
console.log(`[MONITORING] Rapport activé: ${MONITORING_ENABLED}`);
console.log(`[MONITORING] Planification maintenance: ${MAINTENANCE_SCHEDULE}`);
console.log(`[MONITORING] Maintenance activée: ${MAINTENANCE_ENABLED}`);
console.log(`[MONITORING] Âge max fichiers temporaires: ${MAINTENANCE_MAX_AGE_HOURS}h`);
console.log('[MONITORING] ========================================');

/**
 * Exécute la maintenance (nettoyage des fichiers temporaires)
 */
async function runMaintenance() {
  try {
    console.log('[MAINTENANCE] Début de la maintenance...');
    const result = await maintenanceService.cleanupTemporaryFiles(MAINTENANCE_MAX_AGE_HOURS);
    
    if (result.errors && result.errors.length > 0) {
      console.warn('[MAINTENANCE] Erreurs lors de la maintenance:', result.errors);
    } else {
      console.log(`[MAINTENANCE] ✅ Maintenance terminée: ${result.deletedCount} fichier(s) supprimé(s)`);
    }
  } catch (error) {
    console.error('[MAINTENANCE] ❌ Erreur lors de la maintenance:', error);
  }
}

/**
 * Génère et envoie le rapport de monitoring
 */
async function generateAndSendReport() {
  let pool = null;
  try {
    console.log('[MONITORING] Début de la génération du rapport...');
    
    // Connexion PostgreSQL
    pool = await postgresClient.connect();
    
    // Générer les statistiques
    const stats = await statisticsService.generateStatistics(pool);
    console.log('[MONITORING] Statistiques générées:', {
      totalUsers: stats.total_users,
      totalShares: stats.total_shares,
      activeShares: stats.active_shares,
      tempFiles: stats.temp_files_count
    });
    
    // Générer les rapports
    console.log('[MONITORING] Génération des rapports HTML et CSV...');
    const htmlReport = reportGenerator.generateHTML(stats);
    const csvReport = reportGenerator.generateCSV(stats);
    
    // Envoyer l'email
    await emailService.sendReport(htmlReport, csvReport);
    
    console.log('[MONITORING] ✅ Rapport envoyé avec succès');
  } catch (error) {
    console.error('[MONITORING] ❌ Erreur lors de la génération du rapport:', error);
    // Ne pas faire échouer le processus, juste logger l'erreur
  }
}

// Exécution immédiate si MONITORING_RUN_ONCE=true ou MAINTENANCE_RUN_ONCE=true (pour tests)
if (process.env.MONITORING_RUN_ONCE === 'true') {
  console.log('[MONITORING] Exécution unique du rapport demandée...');
  generateAndSendReport()
    .then(() => {
      console.log('[MONITORING] Exécution terminée, arrêt du service');
      postgresClient.close();
      process.exit(0);
    })
    .catch((error) => {
      console.error('[MONITORING] Erreur:', error);
      postgresClient.close();
      process.exit(1);
    });
} else if (process.env.MAINTENANCE_RUN_ONCE === 'true') {
  console.log('[MAINTENANCE] Exécution unique de la maintenance demandée...');
  runMaintenance()
    .then(() => {
      console.log('[MAINTENANCE] Exécution terminée, arrêt du service');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[MAINTENANCE] Erreur:', error);
      process.exit(1);
    });
} else if (MONITORING_ENABLED || MAINTENANCE_ENABLED) {
  // Planification avec cron
  console.log('[MONITORING] Configuration de la planification...');
  
  // Planification du rapport de monitoring
  if (MONITORING_ENABLED) {
    cron.schedule(MONITORING_SCHEDULE, () => {
      console.log('[MONITORING] Déclenchement programmé du rapport...');
      generateAndSendReport();
    }, {
      scheduled: true,
      timezone: process.env.TZ || "Europe/Paris"
    });
    console.log(`[MONITORING] Rapport planifié: ${MONITORING_SCHEDULE}`);
  }
  
  // Planification de la maintenance (nettoyage des fichiers temporaires)
  if (MAINTENANCE_ENABLED) {
    cron.schedule(MAINTENANCE_SCHEDULE, () => {
      console.log('[MAINTENANCE] Déclenchement programmé de la maintenance...');
      runMaintenance();
    }, {
      scheduled: true,
      timezone: process.env.TZ || "Europe/Paris"
    });
    console.log(`[MAINTENANCE] Maintenance planifiée: ${MAINTENANCE_SCHEDULE}`);
    
    // Exécuter la maintenance une première fois au démarrage (optionnel)
    if (process.env.MAINTENANCE_RUN_ON_START === 'true') {
      console.log('[MAINTENANCE] Exécution de la maintenance au démarrage...');
      runMaintenance();
    }
  }
  
  console.log('[MONITORING] Planification configurée, le service continue de tourner');
  
  // Garder le processus actif
  process.on('SIGTERM', () => {
    console.log('[MONITORING] Signal SIGTERM reçu, arrêt du service...');
    postgresClient.close();
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    console.log('[MONITORING] Signal SIGINT reçu, arrêt du service...');
    postgresClient.close();
    process.exit(0);
  });
} else {
  console.log('[MONITORING] Service désactivé (MONITORING_ENABLED=false), arrêt...');
  process.exit(0);
}

