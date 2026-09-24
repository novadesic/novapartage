const crypto = require('crypto');
const redisManager = require('../config/redis');

/**
 * Middleware de protection CSRF
 * Compatible avec le système d'authentification hybride
 */
class CSRFProtection {
  constructor() {
    this.config = {
      secret: process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex'),
      tokenLength: 32,
      tokenExpiry: 3600, // 1 heure
      headerName: 'X-CSRF-Token',
      cookieName: 'novapartage_csrf',
      methods: ['POST', 'PUT', 'DELETE', 'PATCH']
    };
  }

  /**
   * Génère un token CSRF sécurisé
   * @param {string} email - Email de l'utilisateur
   * @returns {Promise<string>} Token CSRF
   */
  async generateToken(email) {
    const token = crypto.randomBytes(this.config.tokenLength).toString('hex');
    const key = `csrf_token:${email}`;
    
    // Stocker le token avec expiration dans Redis
    await redisManager.set(key, {
      token,
      createdAt: Date.now(),
      email
    }, this.config.tokenExpiry);
    
    return token;
  }

  /**
   * Valide un token CSRF
   * @param {string} email - Email de l'utilisateur
   * @param {string} token - Token à valider
   * @returns {Promise<boolean>} True si valide
   */
  async validateToken(email, token) {
    if (!token || !email) {
      return false;
    }

    const key = `csrf_token:${email}`;
    
    // Récupérer depuis Redis uniquement
    const storedData = await redisManager.get(key);
    
    if (!storedData) {
      return false;
    }

    return storedData.token === token;
  }

  /**
   * Supprime un token CSRF
   * @param {string} email - Email de l'utilisateur
   */
  async deleteToken(email) {
    const key = `csrf_token:${email}`;
    await redisManager.del(key);
  }

  /**
   * Middleware pour générer et envoyer un token CSRF
   */
  generateMiddleware() {
    return async (req, res, next) => {
      try {
        // Obtenir l'email depuis les paramètres de requête ou le body
        const email = req.query.email || req.body.email;

        console.log('[CSRF] Génération token pour email:', email);
        
        // Toujours générer un token générique pour les routes publiques
        // L'email sera utilisé lors de la validation, pas lors de la génération
        const csrfToken = crypto.randomBytes(this.config.tokenLength).toString('hex');
        res.locals.csrfToken = csrfToken;
        res.setHeader('X-CSRF-Token', csrfToken);
        res.cookie(this.config.cookieName, csrfToken, {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: this.config.tokenExpiry * 1000
        });
        
        // Si on a un email, stocker le token pour cet email aussi
        if (email) {
          try {
            const key = `csrf_token:${email}`;
            await redisManager.set(key, { token: csrfToken }, this.config.tokenExpiry);
            console.log('[CSRF] Token stocké pour email:', email);
          } catch (error) {
            console.error('[CSRF] Erreur lors du stockage du token pour email:', error);
          }
        }
        
        return next();
      } catch (error) {
        console.error('[CSRF] Erreur lors de la génération du token:', error);
        next();
      }
    };
  }

  /**
   * Middleware pour valider les tokens CSRF
   */
  validateMiddleware() {
    return async (req, res, next) => {
      try {
        // Vérifier si la méthode nécessite une protection CSRF
        if (!this.config.methods.includes(req.method)) {
          return next();
        }

        // Récupérer le token depuis les headers ou le body
        const token = req.headers[this.config.headerName.toLowerCase()] || 
                     req.body._csrf || 
                     req.query._csrf;

        console.log('[CSRF] Token reçu:', token ? token.substring(0, 10) + '...' : 'null');

        if (!token) {
          return res.status(403).json({
            error: 'Token CSRF manquant',
            message: 'Token CSRF requis pour cette opération'
          });
        }

        // Obtenir l'email depuis les paramètres de requête ou le body
        const email = req.query.email || req.body.email;
        console.log('[CSRF] Validation token pour email:', email);

        // Valider le token (avec ou sans email)
        let isValid = false;
        
        // D'abord, vérifier le token générique (depuis le cookie)
        const cookieToken = req.cookies[this.config.cookieName];
        if (cookieToken === token) {
          isValid = true;
          console.log('[CSRF] Token générique validé');
        }
        
        // Si pas valide et qu'on a un email, vérifier le token spécifique à l'email
        if (!isValid && email) {
          isValid = await this.validateToken(email, token);
          if (isValid) {
            console.log('[CSRF] Token spécifique à l\'email validé');
          }
        }
        
        console.log('[CSRF] Validation résultat:', isValid);
        
        if (!isValid) {
          return res.status(403).json({
            error: 'Token CSRF invalide',
            message: 'Token CSRF invalide ou expiré'
          });
        }

        // Token valide, continuer
        next();
      } catch (error) {
        console.error('[CSRF] Erreur lors de la validation:', error);
        return res.status(500).json({
          error: 'Erreur de validation CSRF',
          message: 'Erreur interne lors de la validation'
        });
      }
    };
  }

  /**
   * Middleware pour les routes qui nécessitent une protection CSRF
   */
  protect() {
    return this.validateMiddleware();
  }

  /**
   * Middleware pour les routes qui génèrent des tokens CSRF
   */
  generate() {
    return this.generateMiddleware();
  }

  /**
   * Middleware pour les routes publiques (pas de protection CSRF)
   */
  skip() {
    return (req, res, next) => {
      next();
    };
  }

  /**
   * Obtient les statistiques CSRF
   */
  async getStats() {
    return {
      config: this.config,
      redis: redisManager.getStats()
    };
  }
}

module.exports = new CSRFProtection();

