const { Pool } = require('pg');

const DB_HOST = process.env.DB_HOST || 'postgres';
const DB_PORT = process.env.DB_PORT || '5432';
const DB_NAME = process.env.DB_NAME || 'ddsshare';
const DB_USERNAME = process.env.DB_USERNAME || 'novapartage';
const DB_PASSWORD = process.env.DB_PASSWORD || 'novapartage_password';

let pool = null;

/**
 * Crée et retourne le pool de connexions PostgreSQL
 */
function getPool() {
  if (!pool) {
    pool = new Pool({
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USERNAME,
      password: DB_PASSWORD,
      max: 5, // Nombre maximum de connexions dans le pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    // Gestion des erreurs du pool
    pool.on('error', (err) => {
      console.error('[POSTGRES] Erreur inattendue sur le client PostgreSQL:', err);
    });
  }
  return pool;
}

/**
 * Teste la connexion à PostgreSQL
 */
async function connect() {
  const pool = getPool();
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('[POSTGRES] Connecté à PostgreSQL:', DB_HOST, '|', result.rows[0].now);
    client.release();
    return pool;
  } catch (error) {
    console.error('[POSTGRES] Erreur de connexion:', error);
    throw error;
  }
}

/**
 * Récupère le pool de connexions
 */
function getDatabase() {
  return getPool();
}

/**
 * Ferme toutes les connexions PostgreSQL
 */
async function close() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[POSTGRES] Connexions fermées');
  }
}

module.exports = {
  connect,
  getDatabase,
  close
};






