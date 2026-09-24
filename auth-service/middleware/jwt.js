const jwt = require('jsonwebtoken');
const validationConfig = require('../config/validation');
const { normalizeEmail } = require('../utils/emailUtils');

/**
 * Middleware de validation JWT sécurisé
 * Compatible avec le système d'authentification hybride
 */
class JWTMiddleware {
  constructor() {
    this.config = {
      secret: process.env.JWT_SECRET,
      algorithm: validationConfig.config.jwtAlgorithm,
      issuer: validationConfig.config.jwtIssuer,
      audience: validationConfig.config.jwtAudience
    };
  }

  /**
   * Valide un token JWT de manière sécurisée
   * @param {string} token - Token JWT à valider
   * @returns {Promise<{valid: boolean, payload?: any, error?: string}>}
   */
  async validateToken(token) {
    try {
      if (!token) {
        return { valid: false, error: 'Token manquant' };
      }

      // Vérifier la structure du token
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { valid: false, error: 'Format de token invalide' };
      }

      // Décoder et valider le token
      const payload = jwt.verify(token, this.config.secret, {
        algorithms: [this.config.algorithm],
        issuer: this.config.issuer,
        audience: this.config.audience,
        clockTolerance: 30 // Tolérance de 30 secondes pour les différences d'horloge
      });

      // Vérifications supplémentaires
      if (!payload.sub || !payload.email) {
        return { valid: false, error: 'Token malformé' };
      }

      // Vérifier l'expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return { valid: false, error: 'Token expiré' };
      }

      return { valid: true, payload };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return { valid: false, error: 'Token expiré' };
      } else if (error.name === 'JsonWebTokenError') {
        return { valid: false, error: 'Token invalide' };
      } else if (error.name === 'NotBeforeError') {
        return { valid: false, error: 'Token pas encore valide' };
      } else {
        console.error('[JWT] Erreur lors de la validation:', error);
        return { valid: false, error: 'Erreur de validation' };
      }
    }
  }

  /**
   * Middleware pour valider les tokens JWT
   */
  validate() {
    return async (req, res, next) => {
      try {
        // Récupérer le token depuis les headers ou les cookies
        const token = req.jwtToken || 
                     req.headers.authorization?.replace('Bearer ', '') ||
                     req.cookies?.novapartage_auth;

        if (!token) {
          return res.status(401).json({
            error: 'Token manquant',
            message: 'Token d\'authentification requis'
          });
        }

        // Valider le token
        const validation = await this.validateToken(token);
        
        if (!validation.valid) {
          return res.status(401).json({
            error: 'Token invalide',
            message: validation.error
          });
        }

        // Normaliser l'email en minuscules
        const normalizedEmail = normalizeEmail(validation.payload.email);
        
        // Ajouter les informations utilisateur à la requête
        req.user = {
          email: normalizedEmail,
          sub: normalizedEmail, // sub doit aussi être normalisé
          name: validation.payload.name,
          firstName: validation.payload.firstName,
          lastName: validation.payload.lastName || '',
          email_verified: validation.payload.email_verified,
          is_superadmin: validation.payload.is_superadmin === true,
          iat: validation.payload.iat,
          exp: validation.payload.exp
        };

        next();
      } catch (error) {
        console.error('[JWT] Erreur dans le middleware:', error);
        return res.status(500).json({
          error: 'Erreur de validation',
          message: 'Erreur interne lors de la validation du token'
        });
      }
    };
  }

  /**
   * Middleware optionnel pour valider les tokens JWT
   */
  validateOptional() {
    return async (req, res, next) => {
      try {
        const token = req.jwtToken || 
                     req.headers.authorization?.replace('Bearer ', '') ||
                     req.cookies?.novapartage_auth;

        if (token) {
          const validation = await this.validateToken(token);
          if (validation.valid) {
            // Normaliser l'email en minuscules
            const normalizedEmail = normalizeEmail(validation.payload.email);
            
            req.user = {
              email: normalizedEmail,
              sub: normalizedEmail, // sub doit aussi être normalisé
              name: validation.payload.name,
              firstName: validation.payload.firstName,
              lastName: validation.payload.lastName || '',
              email_verified: validation.payload.email_verified,
              is_superadmin: validation.payload.is_superadmin === true,
              iat: validation.payload.iat,
              exp: validation.payload.exp
            };
          }
        }

        next();
      } catch (error) {
        console.error('[JWT] Erreur dans le middleware optionnel:', error);
        next(); // Continuer même en cas d'erreur
      }
    };
  }

  /**
   * Génère un token JWT sécurisé
   * @param {Object} payload - Données à inclure dans le token
   * @param {Object} options - Options de génération
   * @returns {string} Token JWT
   */
  generateToken(payload, options = {}) {
    const tokenPayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: validationConfig.getJWTExpirationTimestamp(),
      iss: this.config.issuer,
      aud: this.config.audience
    };

    return jwt.sign(tokenPayload, this.config.secret, {
      algorithm: this.config.algorithm,
      ...options
    });
  }

  /**
   * Génère un token de rafraîchissement
   * @param {string} email - Email de l'utilisateur
   * @returns {string} Token de rafraîchissement
   */
  generateRefreshToken(email) {
    // Normaliser l'email en minuscules
    const normalizedEmail = normalizeEmail(email);
    
    const payload = {
      sub: normalizedEmail,
      email: normalizedEmail,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, this.config.secret, {
      algorithm: this.config.algorithm,
      expiresIn: validationConfig.config.jwtRefreshExpiresIn,
      issuer: this.config.issuer,
      audience: this.config.audience
    });
  }

  /**
   * Valide un token de rafraîchissement
   * @param {string} token - Token de rafraîchissement
   * @returns {Promise<{valid: boolean, payload?: any, error?: string}>}
   */
  async validateRefreshToken(token) {
    try {
      const payload = jwt.verify(token, this.config.secret, {
        algorithms: [this.config.algorithm],
        issuer: this.config.issuer,
        audience: this.config.audience
      });

      if (payload.type !== 'refresh') {
        return { valid: false, error: 'Type de token invalide' };
      }

      return { valid: true, payload };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return { valid: false, error: 'Token de rafraîchissement expiré' };
      } else {
        return { valid: false, error: 'Token de rafraîchissement invalide' };
      }
    }
  }

  /**
   * Middleware pour vérifier les rôles utilisateur
   * @param {string|Array<string>} roles - Rôles autorisés
   */
  requireRole(roles) {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Non authentifié',
          message: 'Authentification requise'
        });
      }

      // Pour l'instant, tous les utilisateurs ont le rôle 'user'
      // À étendre selon les besoins
      const userRole = req.user.role || 'user';
      
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          error: 'Accès refusé',
          message: 'Rôle insuffisant pour accéder à cette ressource'
        });
      }

      next();
    };
  }

  /**
   * Middleware pour vérifier la vérification email
   */
  requireEmailVerified() {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Non authentifié',
          message: 'Authentification requise'
        });
      }

      if (!req.user.email_verified) {
        return res.status(403).json({
          error: 'Email non vérifié',
          message: 'Vérification de l\'email requise'
        });
      }

      next();
    };
  }

  /**
   * Obtient les statistiques JWT
   */
  getStats() {
    return {
      config: {
        algorithm: this.config.algorithm,
        issuer: this.config.issuer,
        audience: this.config.audience
      },
      validation: validationConfig.getStats()
    };
  }
}

module.exports = new JWTMiddleware();

