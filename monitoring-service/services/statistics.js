const path = require('path');
const fs = require('fs').promises;
const anonymizer = require('../utils/anonymizer');

/**
 * Génère les statistiques depuis PostgreSQL
 * @param {Object} pool - Pool de connexions PostgreSQL
 * @returns {Promise<Object>} Statistiques complètes
 */
async function generateStatistics(pool) {
  console.log('[STATS] Récupération des données depuis PostgreSQL...');
  
  // Récupérer tous les partages depuis PostgreSQL
  const query = `
    SELECT 
      owner_email,
      owner_username,
      status
    FROM shares
    WHERE owner_email IS NOT NULL AND owner_email != ''
  `;
  
  const result = await pool.query(query);
  const shares = result.rows;
  console.log(`[STATS] ${shares.length} partages trouvés`);
  
  // Calculer les statistiques
  const uniqueUsers = new Set();
  const sharesByUser = {};
  let totalShares = 0;
  let activeShares = 0;
  
  for (const share of shares) {
    const ownerEmail = share.owner_email || '';
    const ownerUsername = share.owner_username || '';
    
    if (ownerEmail) {
      uniqueUsers.add(ownerEmail);
      const anonymizedEmail = anonymizer.anonymizeEmail(ownerEmail);
      
      if (!sharesByUser[anonymizedEmail]) {
        sharesByUser[anonymizedEmail] = {
          anonymized_email: anonymizedEmail,
          anonymized_username: anonymizer.anonymizeUsername(ownerUsername),
          share_count: 0,
          active_share_count: 0
        };
      }
      
      sharesByUser[anonymizedEmail].share_count++;
      
      if (share.status === 'ACTIVE') {
        sharesByUser[anonymizedEmail].active_share_count++;
        activeShares++;
      }
    }
    
    totalShares++;
  }
  
  // Récupérer les fichiers temporaires
  console.log('[STATS] Récupération des fichiers temporaires...');
  const tempFiles = await getTemporaryFiles();
  console.log(`[STATS] ${tempFiles.length} fichiers temporaires trouvés`);
  
  // Analyser les fichiers temporaires
  const tempFilesByExt = {};
  let totalTempSize = 0;
  
  for (const tempFile of tempFiles) {
    const ext = path.extname(tempFile.filename) || 'no-ext';
    tempFilesByExt[ext] = (tempFilesByExt[ext] || 0) + 1;
    totalTempSize += tempFile.size || 0;
  }
  
  return {
    total_users: uniqueUsers.size,
    total_shares: totalShares,
    active_shares: activeShares,
    shares_by_user: Object.values(sharesByUser),
    temp_files_count: tempFiles.length,
    temp_files: tempFiles.slice(0, 50), // Limiter à 50 pour le CSV
    temp_files_by_ext: tempFilesByExt,
    total_temp_size_mb: Math.round((totalTempSize / (1024 * 1024)) * 100) / 100,
    report_date: new Date().toISOString().replace('T', ' ').substring(0, 19)
  };
}

/**
 * Récupère la liste des fichiers temporaires non partagés
 * @returns {Promise<Array>} Liste des fichiers temporaires
 */
async function getTemporaryFiles() {
  const tempDir = process.env.TEMP_FILES_DIR || '/app/files/temp';
  
  try {
    // Créer le répertoire s'il n'existe pas encore (volume bind souvent vide au 1er démarrage)
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (error) {
      console.warn(`[STATS] Impossible d'accéder au répertoire temp ${tempDir}: ${error.message}`);
      return [];
    }
    
    const files = await fs.readdir(tempDir);
    const fileStats = await Promise.all(
      files.map(async (file) => {
        try {
          const filePath = path.join(tempDir, file);
          const stats = await fs.stat(filePath);
          
          // Ignorer les fichiers cachés et les répertoires
          if (file.startsWith('.') || stats.isDirectory()) {
            return null;
          }
          
          return {
            filename: file,
            size: stats.size,
            date: stats.mtime.toISOString(),
            anonymized_filename: anonymizer.anonymizeFilename(file)
          };
        } catch (error) {
          console.warn(`[STATS] Erreur lors de la lecture de ${file}:`, error.message);
          return null;
        }
      })
    );
    
    return fileStats.filter(f => f !== null);
  } catch (error) {
    console.warn('[STATS] Impossible d\'accéder au répertoire temp:', error.message);
    return [];
  }
}

module.exports = {
  generateStatistics
};

