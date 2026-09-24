const crypto = require('crypto');
const redisManager = require('../config/redis');

/**
 * Gestionnaire de tokens unifié avec Redis et fallback
 * Compatible avec le système d'authentification hybride
 */
class TokenManager {
  constructor() {
    this.redis = redisManager;
    this.config = {
      tempTokenExpiresIn: this.parseDuration(process.env.TEMP_TOKEN_EXPIRES_IN || '1h'),
      verificationCodeExpiresIn: this.parseDuration(process.env.VERIFICATION_CODE_EXPIRES_IN || '15m'),
      jwtExpiresIn: this.parseDuration(process.env.JWT_EXPIRES_IN || '1h'),
      jwtRefreshExpiresIn: this.parseDuration(process.env.JWT_REFRESH_EXPIRES_IN || '7d')
    };
  }

  /**
   * Parse une durée en format humain (1h, 24h, 7d, etc.) en secondes
   * @param {string} duration - Durée à parser
   * @returns {number} Durée en secondes
   */
  parseDuration(duration) {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      console.warn(`[TOKEN_MANAGER] Format de durée invalide: ${duration}, utilisation de 1h par défaut`);
      return 3600; // 1 heure par défaut
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value; // secondes
      case 'm': return value * 60; // minutes
      case 'h': return value * 3600; // heures
      case 'd': return value * 86400; // jours
      default: return 3600;
    }
  }

  /**
   * Génère un token sécurisé
   * @param {number} length - Longueur du token en bytes
   * @returns {string} Token hexadécimal
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Génère un code de vérification à 6 chiffres
   * @returns {string} Code de vérification
   */
  generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Stocke un token temporaire pour la connexion
   * @param {string} email - Email de l'utilisateur
   * @param {string} purpose - Objectif du token (login, manage_shares, etc.)
   * @returns {Promise<{token: string, expiresAt: number}>}
   */
  async storeTempToken(email, purpose = 'login') {
    const token = this.generateSecureToken();
    const expiresAt = Date.now() + (this.config.tempTokenExpiresIn * 1000);
    
    const tokenData = {
      token,
      expiresAt,
      purpose,
      attempts: 0,
      createdAt: Date.now()
    };

    const key = `temp_token:${email}:${purpose}`;
    await this.redis.set(key, tokenData, this.config.tempTokenExpiresIn);
    
    return { token, expiresAt };
  }

  /**
   * Récupère et valide un token temporaire
   * @param {string} email - Email de l'utilisateur
   * @param {string} token - Token à valider
   * @param {string} purpose - Objectif attendu du token
   * @returns {Promise<{valid: boolean, data?: any, error?: string}>}
   */
  async validateTempToken(email, token, purpose = 'login') {
    const key = `temp_token:${email}:${purpose}`;
    const tokenData = await this.redis.get(key);

    if (!tokenData) {
      return { valid: false, error: 'Token non trouvé' };
    }

    // Vérifier l'expiration
    if (Date.now() > tokenData.expiresAt) {
      await this.redis.del(key);
      return { valid: false, error: 'Token expiré' };
    }

    // Vérifier le token
    if (tokenData.token !== token) {
      return { valid: false, error: 'Token incorrect' };
    }

    return { valid: true, data: tokenData };
  }

  /**
   * Supprime un token temporaire
   * @param {string} email - Email de l'utilisateur
   * @param {string} purpose - Objectif du token
   */
  async deleteTempToken(email, purpose = 'login') {
    const key = `temp_token:${email}:${purpose}`;
    await this.redis.del(key);
  }

  /**
   * Stocke un code de vérification
   * @param {string} email - Email de l'utilisateur
   * @param {string} purpose - Objectif du code
   * @returns {Promise<{code: string, expiresAt: number}>}
   */
  async storeVerificationCode(email, purpose = 'share_creation') {
    const code = this.generateVerificationCode();
    const expiresAt = Date.now() + (this.config.verificationCodeExpiresIn * 1000);
    
    const codeData = {
      code,
      expiresAt,
      purpose,
      attempts: 0,
      createdAt: Date.now()
    };

    const key = `verification_code:${email}:${purpose}`;
    await this.redis.set(key, codeData, this.config.verificationCodeExpiresIn);
    
    return { code, expiresAt };
  }

  /**
   * Valide un code de vérification
   * @param {string} email - Email de l'utilisateur
   * @param {string} code - Code à valider
   * @param {string} purpose - Objectif attendu du code
   * @returns {Promise<{valid: boolean, attemptsLeft?: number, error?: string}>}
   */
  async validateVerificationCode(email, code, purpose = 'share_creation') {
    const key = `verification_code:${email}:${purpose}`;
    const codeData = await this.redis.get(key);

    if (!codeData) {
      return { valid: false, error: 'Code non trouvé' };
    }

    // Vérifier l'expiration
    if (Date.now() > codeData.expiresAt) {
      await this.redis.del(key);
      return { valid: false, error: 'Code expiré' };
    }

    // Vérifier le nombre de tentatives
    if (codeData.attempts >= 3) {
      await this.redis.del(key);
      return { valid: false, error: 'Trop de tentatives' };
    }

    // Vérifier le code
    if (codeData.code !== code) {
      codeData.attempts++;
      await this.redis.set(key, codeData, this.config.verificationCodeExpiresIn);
      return { 
        valid: false, 
        attemptsLeft: 3 - codeData.attempts,
        error: 'Code incorrect' 
      };
    }

    // Code correct - supprimer le code utilisé
    await this.redis.del(key);
    return { valid: true };
  }

  /**
   * Stocke un code de changement de mot de passe avec le hash du mot de passe
   * @param {string} email - Email de l'utilisateur
   * @param {string} passwordHash - Hash bcrypt du nouveau mot de passe
   * @returns {Promise<{code: string, expiresAt: number}>}
   */
  async storePasswordChangeCode(email, passwordHash) {
    const code = this.generateVerificationCode();
    const expiresAt = Date.now() + (this.config.verificationCodeExpiresIn * 1000);
    
    const codeData = {
      code,
      passwordHash,
      expiresAt,
      purpose: 'password_change',
      attempts: 0,
      createdAt: Date.now()
    };

    const key = `verification_code:${email}:password_change`;
    await this.redis.set(key, codeData, this.config.verificationCodeExpiresIn);
    
    return { code, expiresAt };
  }

  /**
   * Valide le code de changement de mot de passe et retourne le hash
   * @param {string} email - Email de l'utilisateur
   * @param {string} code - Code à valider
   * @returns {Promise<{valid: boolean, passwordHash?: string, attemptsLeft?: number, error?: string}>}
   */
  async validatePasswordChangeCode(email, code) {
    const key = `verification_code:${email}:password_change`;
    const codeData = await this.redis.get(key);

    if (!codeData) {
      return { valid: false, error: 'Code non trouvé' };
    }

    if (Date.now() > codeData.expiresAt) {
      await this.redis.del(key);
      return { valid: false, error: 'Code expiré' };
    }

    if (codeData.attempts >= 3) {
      await this.redis.del(key);
      return { valid: false, error: 'Trop de tentatives' };
    }

    if (codeData.code !== code) {
      codeData.attempts++;
      await this.redis.set(key, codeData, this.config.verificationCodeExpiresIn);
      return { 
        valid: false, 
        attemptsLeft: 3 - codeData.attempts,
        error: 'Code incorrect' 
      };
    }

    const passwordHash = codeData.passwordHash;
    await this.redis.del(key);
    return { valid: true, passwordHash };
  }

  /**
   * Stocke un token JWT avec refresh
   * @param {string} email - Email de l'utilisateur
   * @param {string} jwtToken - Token JWT
   * @param {string} refreshToken - Token de rafraîchissement
   * @returns {Promise<void>}
   */
  async storeJWTToken(email, jwtToken, refreshToken) {
    const tokenData = {
      jwtToken,
      refreshToken,
      createdAt: Date.now(),
      lastUsed: Date.now()
    };

    const key = `jwt_token:${email}`;
    await this.redis.set(key, tokenData, this.config.jwtRefreshExpiresIn);
  }

  /**
   * Récupère un token JWT
   * @param {string} email - Email de l'utilisateur
   * @returns {Promise<{jwtToken?: string, refreshToken?: string} | null>}
   */
  async getJWTToken(email) {
    const key = `jwt_token:${email}`;
    const tokenData = await this.redis.get(key);
    
    if (!tokenData) {
      return null;
    }

    // Mettre à jour la dernière utilisation
    tokenData.lastUsed = Date.now();
    await this.redis.set(key, tokenData, this.config.jwtRefreshExpiresIn);
    
    return {
      jwtToken: tokenData.jwtToken,
      refreshToken: tokenData.refreshToken
    };
  }

  /**
   * Supprime un token JWT
   * @param {string} email - Email de l'utilisateur
   */
  async deleteJWTToken(email) {
    const key = `jwt_token:${email}`;
    await this.redis.del(key);
  }

  /**
   * Nettoie les tokens expirés
   */
  async cleanup() {
    // Redis gère automatiquement l'expiration
    // Nettoyer le fallback en mémoire
    this.redis.cleanupFallback();
  }

  /**
   * Obtient les statistiques du gestionnaire de tokens
   */
  getStats() {
    return {
      config: this.config,
      redis: this.redis.getStats()
    };
  }
}

module.exports = new TokenManager();

