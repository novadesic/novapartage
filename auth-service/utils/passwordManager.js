/**
 * Gestionnaire des mots de passe utilisateur
 * Stockage dans PostgreSQL (table ddsshare_user_credentials)
 * Hash bcrypt - jamais de stockage en clair
 */
const bcrypt = require('bcryptjs');
const postgres = require('../config/postgres');
const { normalizeEmail } = require('./emailUtils');
const validationConfig = require('../config/validation');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

/**
 * Vérifie si un utilisateur a un mot de passe défini
 * @param {string} email - Email de l'utilisateur
 * @returns {Promise<boolean>}
 */
async function hasPassword(email) {
  const normalizedEmail = normalizeEmail(email);
  try {
    const result = await postgres.query(
      'SELECT 1 FROM ddsshare_user_credentials WHERE email = $1',
      [normalizedEmail]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('[PASSWORD] Erreur hasPassword:', error.message);
    return false;
  }
}

/**
 * Vérifie un mot de passe
 * @param {string} email - Email de l'utilisateur
 * @param {string} password - Mot de passe en clair
 * @returns {Promise<boolean>} true si le mot de passe est correct
 */
async function verifyPassword(email, password) {
  const normalizedEmail = normalizeEmail(email);
  try {
    const result = await postgres.query(
      'SELECT password_hash FROM ddsshare_user_credentials WHERE email = $1',
      [normalizedEmail]
    );
    if (result.rows.length === 0) {
      // Pas de compte - retourner false sans révéler l'information
      return false;
    }
    const passwordHash = result.rows[0].password_hash;
    return await bcrypt.compare(password, passwordHash);
  } catch (error) {
    console.error('[PASSWORD] Erreur verifyPassword:', error.message);
    return false;
  }
}

/**
 * Définit ou met à jour le mot de passe d'un utilisateur
 * @param {string} email - Email de l'utilisateur
 * @param {string} password - Nouveau mot de passe (en clair)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function setPassword(email, password) {
  const normalizedEmail = normalizeEmail(email);
  
  const validation = validationConfig.validatePassword(password);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await postgres.query(
      `INSERT INTO ddsshare_user_credentials (email, password_hash, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         updated_at = NOW()`,
      [normalizedEmail, passwordHash]
    );
    return { success: true };
  } catch (error) {
    console.error('[PASSWORD] Erreur setPassword:', error.message);
    return { success: false, error: 'Erreur lors de l\'enregistrement du mot de passe' };
  }
}

/**
 * Enregistre un mot de passe à partir d'un hash (utilisé après validation du code)
 * @param {string} email - Email de l'utilisateur
 * @param {string} passwordHash - Hash bcrypt du mot de passe
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function setPasswordFromHash(email, passwordHash) {
  const normalizedEmail = normalizeEmail(email);
  try {
    await postgres.query(
      `INSERT INTO ddsshare_user_credentials (email, password_hash, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         updated_at = NOW()`,
      [normalizedEmail, passwordHash]
    );
    return { success: true };
  } catch (error) {
    console.error('[PASSWORD] Erreur setPasswordFromHash:', error.message);
    return { success: false, error: 'Erreur lors de l\'enregistrement du mot de passe' };
  }
}

module.exports = {
  hasPassword,
  verifyPassword,
  setPassword,
  setPasswordFromHash
};
