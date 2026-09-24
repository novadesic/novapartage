/**
 * Configuration PostgreSQL pour le stockage des mots de passe utilisateur
 * Partage la même base que le backend (table ddsshare_user_credentials)
 */
const { Pool } = require('pg');

let pool = null;

const config = {
  host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
  port: parseInt(process.env.DB_PORT || process.env.PGPORT || '5432'),
  database: process.env.DB_NAME || process.env.PGDATABASE || 'novapartage',
  user: process.env.DB_USERNAME || process.env.PGUSER || 'novapartage',
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD || 'novapartage_password',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
};

/**
 * Obtient le pool de connexion PostgreSQL
 */
function getPool() {
  if (!pool) {
    pool = new Pool(config);
    pool.on('error', (err) => {
      console.error('[POSTGRES] Erreur inattendue sur le pool:', err.message);
    });
  }
  return pool;
}

/**
 * Exécute une requête
 */
async function query(text, params) {
  const p = getPool();
  try {
    return await p.query(text, params);
  } catch (error) {
    console.error('[POSTGRES] Erreur requête:', error.message);
    throw error;
  }
}

/**
 * Ferme le pool (pour les tests ou arrêt propre)
 */
async function close() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[POSTGRES] Pool fermé');
  }
}

module.exports = {
  getPool,
  query,
  close,
  config
};
