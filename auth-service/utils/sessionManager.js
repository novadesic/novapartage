const redisManager = require('../config/redis');
const validationConfig = require('../config/validation');

/**
 * Gestionnaire de sessions utilisateur
 * Contrôle les limites de renouvellement et la durée maximale de session
 */
class SessionManager {
  constructor() {
    this.config = {
      maxSessionDuration: parseInt(process.env.MAX_SESSION_DURATION) || 36000, // 10h en secondes par défaut
      maxRefreshCount: parseInt(process.env.MAX_REFRESH_COUNT) || 20, // 20 renouvellements max
      maxIdleTime: parseInt(process.env.MAX_IDLE_TIME) || 1800, // 30min d'inactivité max
      tokenLifespan: validationConfig.getJWTExpiresInSeconds()
    };
  }

  /**
   * Récupère les informations de session d'un utilisateur
   * @param {string} email - Email de l'utilisateur
   * @returns {Promise<Object|null>} Informations de session ou null
   */
  async getSessionInfo(email) {
    const key = `session:${email}`;
    const session = await redisManager.get(key);
    
    if (!session) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const sessionAge = now - session.sessionStartTime;
    const timeSinceLastRefresh = now - (session.lastRefreshTime || session.sessionStartTime);
    
    // Vérifier si la session a dépassé la durée maximale
    const sessionExpired = sessionAge > this.config.maxSessionDuration;
    
    // Vérifier si l'inactivité dépasse la limite
    const idleExpired = timeSinceLastRefresh > this.config.maxIdleTime;
    
    // Vérifier si le nombre de renouvellements est dépassé
    const refreshLimitReached = session.refreshCount >= this.config.maxRefreshCount;
    
    const sessionExpiresAt = session.sessionStartTime + this.config.maxSessionDuration;
    const timeUntilSessionExpiry = Math.max(0, sessionExpiresAt - now);

    return {
      ...session,
      sessionExpired,
      idleExpired,
      refreshLimitReached,
      canRefresh: !sessionExpired && !idleExpired && !refreshLimitReached,
      forceReconnect: sessionExpired || idleExpired || refreshLimitReached,
      sessionExpiresAt,
      timeUntilSessionExpiry,
      sessionAge,
      timeSinceLastRefresh
    };
  }

  /**
   * Crée une nouvelle session pour un utilisateur
   * @param {string} email - Email de l'utilisateur
   * @returns {Promise<Object>} Informations de session créée
   */
  async createSession(email) {
    const key = `session:${email}`;
    const now = Math.floor(Date.now() / 1000);
    
    const session = {
      email,
      sessionStartTime: now,
      refreshCount: 0,
      lastRefreshTime: now,
      createdAt: now
    };
    
    // Stocker avec expiration = durée maximale de session
    await redisManager.set(key, session, this.config.maxSessionDuration);
    
    console.log(`[SESSION] Session créée pour: ${email}`);
    return session;
  }

  /**
   * Tente de renouveler une session
   * @param {string} email - Email de l'utilisateur
   * @returns {Promise<Object>} Résultat du renouvellement
   */
  async refreshSession(email) {
    const sessionInfo = await this.getSessionInfo(email);
    
    if (!sessionInfo) {
      // Créer une nouvelle session si elle n'existe pas
      await this.createSession(email);
      return {
        success: true,
        refreshCount: 0,
        maxRefreshCount: this.config.maxRefreshCount,
        sessionExpiresAt: Math.floor(Date.now() / 1000) + this.config.maxSessionDuration,
        isNewSession: true
      };
    }

    if (!sessionInfo.canRefresh) {
      // Supprimer la session expirée
      await this.deleteSession(email);
      
      return {
        success: false,
        forceReconnect: true,
        reason: sessionInfo.sessionExpired ? 'session_expired' :
                sessionInfo.idleExpired ? 'idle_expired' :
                sessionInfo.refreshLimitReached ? 'refresh_limit_reached' : 'session_invalid',
        message: sessionInfo.sessionExpired ? 'Votre session a expiré. Veuillez vous reconnecter.' :
                 sessionInfo.idleExpired ? 'Votre session a expiré par inactivité. Veuillez vous reconnecter.' :
                 sessionInfo.refreshLimitReached ? 'Limite de renouvellements atteinte. Veuillez vous reconnecter.' :
                 'Session invalide. Veuillez vous reconnecter.'
      };
    }

    const key = `session:${email}`;
    const session = await redisManager.get(key);
    
    // Incrémenter le compteur de renouvellements
    session.refreshCount += 1;
    session.lastRefreshTime = Math.floor(Date.now() / 1000);
    
    // Mettre à jour avec expiration recalculée
    const remainingTime = this.config.maxSessionDuration - (session.lastRefreshTime - session.sessionStartTime);
    await redisManager.set(key, session, Math.max(0, remainingTime));
    
    console.log(`[SESSION] Session renouvelée pour: ${email} (${session.refreshCount}/${this.config.maxRefreshCount})`);
    
    return {
      success: true,
      refreshCount: session.refreshCount,
      maxRefreshCount: this.config.maxRefreshCount,
      sessionExpiresAt: session.sessionStartTime + this.config.maxSessionDuration,
      timeUntilSessionExpiry: Math.max(0, (session.sessionStartTime + this.config.maxSessionDuration) - Math.floor(Date.now() / 1000))
    };
  }

  /**
   * Supprime une session
   * @param {string} email - Email de l'utilisateur
   * @returns {Promise<void>}
   */
  async deleteSession(email) {
    const key = `session:${email}`;
    await redisManager.del(key);
    console.log(`[SESSION] Session supprimée pour: ${email}`);
  }

  /**
   * Met à jour le temps de dernière activité
   * @param {string} email - Email de l'utilisateur
   * @returns {Promise<void>}
   */
  async updateLastActivity(email) {
    const sessionInfo = await this.getSessionInfo(email);
    if (!sessionInfo) {
      return;
    }

    const key = `session:${email}`;
    const session = await redisManager.get(key);
    if (session) {
      session.lastRefreshTime = Math.floor(Date.now() / 1000);
      const remainingTime = this.config.maxSessionDuration - (session.lastRefreshTime - session.sessionStartTime);
      await redisManager.set(key, session, Math.max(0, remainingTime));
    }
  }

  /**
   * Obtient la configuration des sessions
   * @returns {Object} Configuration
   */
  getConfig() {
    return {
      ...this.config,
      tokenLifespan: validationConfig.getJWTExpiresInSeconds()
    };
  }
}

// Instance singleton
const sessionManager = new SessionManager();

module.exports = sessionManager;

