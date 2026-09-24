/**
 * Lecture de la table ddsshare_superadmins (remplie manuellement en base).
 * Aucune écriture : pas d'API, pas de front. Utilisé uniquement pour le login (auth-service).
 */
const postgres = require('../config/postgres');
const { normalizeEmail } = require('./emailUtils');

/**
 * Indique si l'email appartient à un superadmin.
 * @param {string} email - Email de l'utilisateur
 * @returns {Promise<boolean>}
 */
async function isSuperadmin(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;
  try {
    const result = await postgres.query(
      'SELECT 1 FROM ddsshare_superadmins WHERE email = $1',
      [normalizedEmail]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('[SUPERADMIN] Erreur isSuperadmin:', error.message);
    return false;
  }
}

module.exports = {
  isSuperadmin
};
