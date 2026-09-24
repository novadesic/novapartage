/**
 * Configuration de validation et parsing des durées
 * Harmonise toutes les durées de validité des tokens
 */
class ValidationConfig {
  constructor() {
    this.config = {
      // Durées configurables via variables d'environnement
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
      tempTokenExpiresIn: process.env.TEMP_TOKEN_EXPIRES_IN || '1h',
      verificationCodeExpiresIn: process.env.VERIFICATION_CODE_EXPIRES_IN || '15m',
      jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      
      // Configuration JWT
      jwtAlgorithm: process.env.JWT_ALGORITHM || 'HS256',
      jwtIssuer: process.env.JWT_ISSUER || 'novapartage-auth',
      jwtAudience: process.env.JWT_AUDIENCE || 'novapartage-frontend',
      
      // Configuration de sécurité
      maxAttempts: parseInt(process.env.MAX_ATTEMPTS) || 3,
      lockoutDuration: this.parseDuration(process.env.LOCKOUT_DURATION || '15m')
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
      console.warn(`[VALIDATION] Format de durée invalide: ${duration}, utilisation de 1h par défaut`);
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
   * Parse une durée en format humain en millisecondes
   * @param {string} duration - Durée à parser
   * @returns {number} Durée en millisecondes
   */
  parseDurationMs(duration) {
    return this.parseDuration(duration) * 1000;
  }

  /**
   * Obtient la durée JWT en secondes
   * @returns {number} Durée en secondes
   */
  getJWTExpiresInSeconds() {
    return this.parseDuration(this.config.jwtExpiresIn);
  }

  /**
   * Obtient la durée JWT en millisecondes
   * @returns {number} Durée en millisecondes
   */
  getJWTExpiresInMs() {
    return this.parseDurationMs(this.config.jwtExpiresIn);
  }

  /**
   * Obtient la durée des tokens temporaires en secondes
   * @returns {number} Durée en secondes
   */
  getTempTokenExpiresInSeconds() {
    return this.parseDuration(this.config.tempTokenExpiresIn);
  }

  /**
   * Obtient la durée des codes de vérification en secondes
   * @returns {number} Durée en secondes
   */
  getVerificationCodeExpiresInSeconds() {
    return this.parseDuration(this.config.verificationCodeExpiresIn);
  }

  /**
   * Obtient la durée des tokens de rafraîchissement en secondes
   * @returns {number} Durée en secondes
   */
  getJWTRefreshExpiresInSeconds() {
    return this.parseDuration(this.config.jwtRefreshExpiresIn);
  }

  /**
   * Calcule l'expiration timestamp pour un token JWT
   * @returns {number} Timestamp d'expiration
   */
  getJWTExpirationTimestamp() {
    return Math.floor(Date.now() / 1000) + this.getJWTExpiresInSeconds();
  }

  /**
   * Calcule l'expiration timestamp pour un token temporaire
   * @returns {number} Timestamp d'expiration
   */
  getTempTokenExpirationTimestamp() {
    return Date.now() + this.parseDurationMs(this.config.tempTokenExpiresIn);
  }

  /**
   * Calcule l'expiration timestamp pour un code de vérification
   * @returns {number} Timestamp d'expiration
   */
  getVerificationCodeExpirationTimestamp() {
    return Date.now() + this.parseDurationMs(this.config.verificationCodeExpiresIn);
  }

  /**
   * Valide une durée
   * @param {string} duration - Durée à valider
   * @returns {boolean} True si valide
   */
  isValidDuration(duration) {
    return /^\d+[smhd]$/.test(duration);
  }

  /**
   * Valide un email
   * @param {string} email - Email à valider
   * @returns {boolean} True si valide
   */
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Valide un code de vérification
   * @param {string} code - Code à valider
   * @returns {boolean} True si valide
   */
  validateVerificationCode(code) {
    return /^\d{6}$/.test(code);
  }

  /**
   * Valide un token
   * @param {string} token - Token à valider
   * @returns {boolean} True si valide
   */
  validateToken(token) {
    return typeof token === 'string' && token.length >= 32;
  }

  /**
   * Valide un mot de passe (longueur et complexité minimale)
   * Règles : min 8 caractères, 1 majuscule, 1 minuscule/chiffre, 1 caractère spécial
   * @param {string} password - Mot de passe à valider
   * @returns {{valid: boolean, error?: string}}
   */
  validatePassword(password) {
    if (typeof password !== 'string') {
      return { valid: false, error: 'Mot de passe requis' };
    }
    const trimmed = password.trim();
    if (trimmed.length < 8) {
      return { valid: false, error: 'Le mot de passe doit contenir au moins 8 caractères' };
    }
    if (trimmed.length > 128) {
      return { valid: false, error: 'Le mot de passe ne peut pas dépasser 128 caractères' };
    }
    if (!/[a-zA-Z]/.test(trimmed)) {
      return { valid: false, error: 'Le mot de passe doit contenir au moins une lettre' };
    }
    if (!/[A-Z]/.test(trimmed)) {
      return { valid: false, error: 'Le mot de passe doit contenir au moins une majuscule' };
    }
    if (!/[0-9]/.test(trimmed)) {
      return { valid: false, error: 'Le mot de passe doit contenir au moins un chiffre' };
    }
    // Caractère spécial : tout sauf lettres et chiffres (ex: !@#$%^&*()_+-=[]{}|;':",./<>?`~)
    if (!/[^A-Za-z0-9]/.test(trimmed)) {
      return { valid: false, error: 'Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*...)' };
    }
    return { valid: true };
  }

  /**
   * Sanitise une entrée utilisateur
   * @param {string} input - Entrée à sanitiser
   * @returns {string} Entrée sanitée
   */
  sanitizeInput(input) {
    if (typeof input !== 'string') {
      return '';
    }
    
    return input
      .trim()
      .replace(/[<>\"'&]/g, '') // Supprimer les caractères dangereux
      .substring(0, 255); // Limiter la longueur
  }

  /**
   * Valide la configuration
   * @returns {Object} Résultat de la validation
   */
  validateConfig() {
    const errors = [];
    const warnings = [];

    // Vérifier les durées
    if (!this.isValidDuration(this.config.jwtExpiresIn)) {
      errors.push(`Durée JWT invalide: ${this.config.jwtExpiresIn}`);
    }

    if (!this.isValidDuration(this.config.tempTokenExpiresIn)) {
      errors.push(`Durée token temporaire invalide: ${this.config.tempTokenExpiresIn}`);
    }

    if (!this.isValidDuration(this.config.verificationCodeExpiresIn)) {
      errors.push(`Durée code de vérification invalide: ${this.config.verificationCodeExpiresIn}`);
    }

    // Vérifier les durées de sécurité
    if (this.getJWTExpiresInSeconds() > 86400) { // Plus de 24h
      warnings.push('Durée JWT très longue (>24h), considérer une durée plus courte');
    }

    if (this.getVerificationCodeExpiresInSeconds() > 1800) { // Plus de 30min
      warnings.push('Durée code de vérification très longue (>30min)');
    }

    // Vérifier la configuration JWT
    if (!this.config.jwtIssuer || this.config.jwtIssuer.length < 3) {
      errors.push('JWT issuer invalide ou trop court');
    }

    if (!this.config.jwtAudience || this.config.jwtAudience.length < 3) {
      errors.push('JWT audience invalide ou trop court');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config: this.config
    };
  }

  /**
   * Obtient la configuration complète
   * @returns {Object} Configuration
   */
  getConfig() {
    return {
      ...this.config,
      durations: {
        jwtExpiresInSeconds: this.getJWTExpiresInSeconds(),
        tempTokenExpiresInSeconds: this.getTempTokenExpiresInSeconds(),
        verificationCodeExpiresInSeconds: this.getVerificationCodeExpiresInSeconds(),
        jwtRefreshExpiresInSeconds: this.getJWTRefreshExpiresInSeconds()
      },
      timestamps: {
        jwtExpiration: this.getJWTExpirationTimestamp(),
        tempTokenExpiration: this.getTempTokenExpirationTimestamp(),
        verificationCodeExpiration: this.getVerificationCodeExpirationTimestamp()
      }
    };
  }

  /**
   * Obtient les statistiques de validation
   * @returns {Object} Statistiques
   */
  getStats() {
    return {
      config: this.getConfig(),
      validation: this.validateConfig()
    };
  }
}

module.exports = new ValidationConfig();

