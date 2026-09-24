const fs = require('fs').promises;
const path = require('path');

/**
 * Nettoie les fichiers temporaires qui ont plus d'une heure
 * @param {number} maxAgeHours - Âge maximum en heures (défaut: 1)
 * @returns {Promise<Object>} Statistiques du nettoyage
 */
async function cleanupTemporaryFiles(maxAgeHours = 1) {
  const tempDir = process.env.TEMP_FILES_DIR || '/app/files/temp';
  const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
  
  let deletedCount = 0;
  let deletedSize = 0;
  const errors = [];
  
  try {
    // Créer le répertoire s'il n'existe pas encore (volume bind souvent vide au 1er démarrage)
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (error) {
      console.warn(`[MAINTENANCE] Impossible de créer le répertoire temp ${tempDir}: ${error.message}`);
      return {
        deletedCount: 0,
        deletedSize: 0,
        errors: [`Répertoire inaccessible: ${tempDir}`]
      };
    }
    
    const files = await fs.readdir(tempDir);
    console.log(`[MAINTENANCE] Analyse de ${files.length} fichiers dans ${tempDir}`);
    console.log(`[MAINTENANCE] Seuil de suppression: fichiers de plus de ${maxAgeHours}h (avant ${new Date(cutoffTime).toISOString()})`);
    
    // Vérifier les permissions du répertoire
    try {
      const dirStats = await fs.stat(tempDir);
      const dirMode = (dirStats.mode & parseInt('777', 8)).toString(8);
      console.log(`[MAINTENANCE] Permissions du répertoire: ${dirMode}`);
    } catch (error) {
      console.warn(`[MAINTENANCE] Impossible de vérifier les permissions du répertoire: ${error.message}`);
    }
    
    for (const file of files) {
      try {
        const filePath = path.join(tempDir, file);
        
        // Ignorer les fichiers cachés et les répertoires
        if (file.startsWith('.')) {
          continue;
        }
        
        const stats = await fs.stat(filePath);
        
        if (stats.isDirectory()) {
          continue;
        }
        
        // Vérifier l'âge du fichier
        const fileAge = stats.mtime.getTime();
        
        if (fileAge < cutoffTime) {
          // Fichier trop ancien, le supprimer
          const fileSize = stats.size;
          const fileAgeHours = Math.round((Date.now() - fileAge) / (1000 * 60 * 60) * 100) / 100;
          
          try {
            await fs.unlink(filePath);
            deletedCount++;
            deletedSize += fileSize;
            console.log(`[MAINTENANCE] ✅ Fichier supprimé: ${file} (${formatSize(fileSize)}, ${fileAgeHours}h)`);
          } catch (unlinkError) {
            const errorMsg = `Impossible de supprimer ${file}: ${unlinkError.message}`;
            console.error(`[MAINTENANCE] ❌ ${errorMsg}`);
            errors.push(errorMsg);
            
            // Vérifier si c'est une erreur de permissions
            if (unlinkError.code === 'EACCES' || unlinkError.code === 'EPERM') {
              console.error(`[MAINTENANCE] ⚠️  Problème de permissions sur ${file}`);
            }
          }
        } else {
          // Fichier encore récent, ne pas supprimer
          const fileAgeHours = Math.round((Date.now() - fileAge) / (1000 * 60 * 60) * 100) / 100;
          if (fileAgeHours < maxAgeHours * 0.1) { // Log seulement les fichiers très récents pour éviter le spam
            console.log(`[MAINTENANCE] ℹ️  Fichier conservé: ${file} (${fileAgeHours}h < ${maxAgeHours}h)`);
          }
        }
      } catch (error) {
        const errorMsg = `Erreur lors du traitement de ${file}: ${error.message}`;
        console.error(`[MAINTENANCE] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }
    
    console.log(`[MAINTENANCE] Nettoyage terminé: ${deletedCount} fichier(s) supprimé(s), ${formatSize(deletedSize)} libéré(s)`);
    
    return {
      deletedCount,
      deletedSize,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    console.error('[MAINTENANCE] Erreur lors du nettoyage:', error);
    return {
      deletedCount: 0,
      deletedSize: 0,
      errors: [error.message]
    };
  }
}

/**
 * Formate une taille en octets en format lisible
 */
function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

module.exports = {
  cleanupTemporaryFiles
};

