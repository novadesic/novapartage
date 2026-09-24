const redis = require('redis');

/**
 * Configuration Redis avec fallback en mémoire
 * Compatible avec le système d'authentification hybride
 */
class RedisManager {
  constructor() {
    this.client = null;
    this.fallbackStore = new Map();
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // 1 seconde
    
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || null,
      db: parseInt(process.env.REDIS_DB) || 0,
      enabled: process.env.REDIS_ENABLED === 'true',
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    };
  }

  /**
   * Initialise la connexion Redis
   */
  async initialize() {
    if (!this.config.enabled) {
      console.log('[REDIS] Redis désactivé, utilisation du stockage en mémoire');
      return;
    }

    try {
      this.client = redis.createClient({
        socket: {
          host: this.config.host,
          port: this.config.port,
          reconnectStrategy: (retries) => {
            if (retries > this.maxReconnectAttempts) {
              console.error('[REDIS] Nombre maximum de tentatives de reconnexion atteint');
              return false;
            }
            return Math.min(retries * this.reconnectDelay, 5000);
          }
        },
        password: this.config.password,
        database: this.config.db
      });

      // Gestion des événements Redis
      this.client.on('connect', () => {
        console.log('[REDIS] Connexion établie');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.client.on('error', (err) => {
        console.error('[REDIS] Erreur:', err.message);
        this.isConnected = false;
      });

      this.client.on('end', () => {
        console.log('[REDIS] Connexion fermée');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        this.reconnectAttempts++;
        console.log(`[REDIS] Tentative de reconnexion ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      });

      await this.client.connect();
      console.log('[REDIS] Client Redis initialisé avec succès');
    } catch (error) {
      console.error('[REDIS] Erreur lors de l\'initialisation:', error.message);
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Stocke une valeur avec expiration
   * @param {string} key - Clé de stockage
   * @param {any} value - Valeur à stocker
   * @param {number} ttlSeconds - Durée de vie en secondes
   */
  async set(key, value, ttlSeconds = 3600) {
    const serializedValue = JSON.stringify(value);
    
    if (this.isConnected && this.client) {
      try {
        await this.client.setEx(key, ttlSeconds, serializedValue);
        return true;
      } catch (error) {
        console.error('[REDIS] Erreur lors du stockage:', error.message);
        // Fallback vers le stockage en mémoire
        this.fallbackStore.set(key, {
          value: serializedValue,
          expiresAt: Date.now() + (ttlSeconds * 1000)
        });
        return true;
      }
    } else {
      // Utilisation du fallback en mémoire
      this.fallbackStore.set(key, {
        value: serializedValue,
        expiresAt: Date.now() + (ttlSeconds * 1000)
      });
      return true;
    }
  }

  /**
   * Récupère une valeur
   * @param {string} key - Clé de récupération
   */
  async get(key) {
    if (this.isConnected && this.client) {
      try {
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        console.error('[REDIS] Erreur lors de la récupération:', error.message);
        // Fallback vers le stockage en mémoire
        return this.getFromFallback(key);
      }
    } else {
      return this.getFromFallback(key);
    }
  }

  /**
   * Supprime une valeur
   * @param {string} key - Clé à supprimer
   */
  async del(key) {
    if (this.isConnected && this.client) {
      try {
        await this.client.del(key);
      } catch (error) {
        console.error('[REDIS] Erreur lors de la suppression:', error.message);
      }
    }
    
    // Supprimer aussi du fallback
    this.fallbackStore.delete(key);
  }

  /**
   * Vérifie si une clé existe
   * @param {string} key - Clé à vérifier
   */
  async exists(key) {
    if (this.isConnected && this.client) {
      try {
        return await this.client.exists(key) === 1;
      } catch (error) {
        console.error('[REDIS] Erreur lors de la vérification:', error.message);
        return this.fallbackStore.has(key);
      }
    } else {
      return this.fallbackStore.has(key);
    }
  }

  /**
   * Récupère une valeur depuis le fallback en mémoire
   * @param {string} key - Clé de récupération
   */
  getFromFallback(key) {
    const item = this.fallbackStore.get(key);
    if (!item) {
      return null;
    }

    // Vérifier l'expiration
    if (Date.now() > item.expiresAt) {
      this.fallbackStore.delete(key);
      return null;
    }

    return JSON.parse(item.value);
  }

  /**
   * Nettoie les entrées expirées du fallback
   */
  cleanupFallback() {
    const now = Date.now();
    for (const [key, item] of this.fallbackStore.entries()) {
      if (now > item.expiresAt) {
        this.fallbackStore.delete(key);
      }
    }
  }

  /**
   * Ferme la connexion Redis
   */
  async close() {
    if (this.client && this.isConnected) {
      try {
        await this.client.quit();
        console.log('[REDIS] Connexion fermée proprement');
      } catch (error) {
        console.error('[REDIS] Erreur lors de la fermeture:', error.message);
      }
    }
  }

  /**
   * Obtient les statistiques de connexion
   */
  getStats() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      fallbackSize: this.fallbackStore.size,
      config: {
        enabled: this.config.enabled,
        host: this.config.host,
        port: this.config.port,
        db: this.config.db
      }
    };
  }
}

// Instance singleton
const redisManager = new RedisManager();

module.exports = redisManager;

