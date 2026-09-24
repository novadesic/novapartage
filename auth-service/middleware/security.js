const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

/**
 * Middleware de sécurité renforcée
 * Compatible avec le système d'authentification hybride
 */
class SecurityMiddleware {
  constructor() {
    this.config = {
      environment: process.env.NODE_ENV || 'development',
      enableSecurityHeaders: process.env.SECURITY_HEADERS_ENABLED !== 'false',
      enableRateLimit: process.env.RATE_LIMIT_ENABLED !== 'false',
      enableCSP: process.env.CSP_ENABLED !== 'false',
      enableHSTS: process.env.HSTS_ENABLED !== 'false'
    };
  }

  /**
   * Configuration des headers de sécurité
   */
  getSecurityHeaders() {
    if (!this.config.enableSecurityHeaders) {
      return (req, res, next) => next();
    }

    return helmet({
      // Protection contre le clickjacking
      frameguard: { action: 'deny' },
      
      // Protection contre le sniffing de type MIME
      noSniff: true,
      
      // Protection contre l'injection de scripts
      xssFilter: true,
      
      // Masquer la version d'Express
      hidePoweredBy: true,
      
      // Politique de sécurité du contenu (CSP)
      contentSecurityPolicy: this.config.enableCSP ? {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
          scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          upgradeInsecureRequests: this.config.environment === 'production' ? [] : null
        }
      } : false,
      
      // HSTS (HTTP Strict Transport Security)
      hsts: this.config.enableHSTS && this.config.environment === 'production' ? {
        maxAge: 31536000, // 1 an
        includeSubDomains: true,
        preload: true
      } : false,
      
      // Protection contre les attaques de timing
      crossOriginEmbedderPolicy: false,
      
      // Politique de référent
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    });
  }

  /**
   * Rate limiting avancé par IP
   * Exclut /api/auth/token qui a son propre rate limiting
   */
  getRateLimitByIP() {
    if (!this.config.enableRateLimit) {
      return (req, res, next) => next();
    }

    return rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requêtes par fenêtre
      message: {
        error: 'Trop de requêtes',
        message: 'Limite de requêtes dépassée. Veuillez réessayer plus tard.',
        retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000 / 60)
      },
      standardHeaders: true,
      legacyHeaders: false,
      // Ignorer les requêtes de health check et /api/auth/token
      skip: (req) => req.path === '/health' || req.path === '/api/auth/token',
      // Clé personnalisée pour le rate limiting
      keyGenerator: (req) => {
        return req.ip + ':' + (req.user?.email || 'anonymous');
      }
    });
  }

  /**
   * Rate limiting strict pour les endpoints d'authentification
   */
  getAuthRateLimit() {
    return rateLimit({
      windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 5, // 5 tentatives par fenêtre
      message: {
        error: 'Trop de tentatives de connexion',
        message: 'Trop de tentatives de connexion. Veuillez réessayer plus tard.',
        retryAfter: Math.ceil((parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000 / 60)
      },
      standardHeaders: true,
      legacyHeaders: false,
      // Clé basée sur l'IP et l'email
      keyGenerator: (req) => {
        const email = req.body?.email || req.query?.email || 'unknown';
        return req.ip + ':' + email;
      }
    });
  }

  /**
   * Rate limiting pour l'endpoint /api/auth/token (utilisateurs connectés)
   * Limite plus élevée car cet endpoint est appelé fréquemment pour vérifier la session
   */
  getTokenRateLimit() {
    if (!this.config.enableRateLimit) {
      return (req, res, next) => next();
    }

    return rateLimit({
      windowMs: parseInt(process.env.TOKEN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.TOKEN_RATE_LIMIT_MAX_REQUESTS) || 300, // 300 requêtes par fenêtre (10x plus que le général)
      message: {
        error: 'Trop de requêtes',
        message: 'Limite de requêtes dépassée. Veuillez réessayer plus tard.',
        retryAfter: Math.ceil((parseInt(process.env.TOKEN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000 / 60)
      },
      standardHeaders: true,
      legacyHeaders: false,
      // Clé basée sur l'IP et l'email de l'utilisateur (si connecté)
      keyGenerator: (req) => {
        // Si l'utilisateur est connecté, utiliser son email pour une limite par utilisateur
        // Sinon, utiliser uniquement l'IP (limite plus stricte pour les non-connectés)
        let userEmail = req.user?.email || 'anonymous';
        
        // Si pas d'utilisateur dans req.user, essayer de récupérer depuis le cookie
        if (userEmail === 'anonymous' && req.cookies?.novapartage_user) {
          try {
            const userData = JSON.parse(req.cookies.novapartage_user);
            userEmail = userData?.email || 'anonymous';
          } catch (error) {
            // Ignorer les erreurs de parsing
            userEmail = 'anonymous';
          }
        }
        
        return req.ip + ':' + userEmail;
      }
    });
  }

  /**
   * Rate limiting pour les emails
   */
  getEmailRateLimit() {
    return rateLimit({
      windowMs: parseInt(process.env.EMAIL_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000, // 1 heure
      max: parseInt(process.env.EMAIL_RATE_LIMIT_MAX_REQUESTS) || 10, // 10 emails par heure
      message: {
        error: 'Trop d\'emails envoyés',
        message: 'Limite d\'envoi d\'emails dépassée. Veuillez réessayer plus tard.',
        retryAfter: Math.ceil((parseInt(process.env.EMAIL_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000) / 1000 / 60)
      },
      standardHeaders: true,
      legacyHeaders: false,
      // Clé basée sur l'IP et l'email
      keyGenerator: (req) => {
        const email = req.body?.email || req.query?.email || 'unknown';
        return req.ip + ':' + email;
      }
    });
  }

  /**
   * Middleware de validation des entrées
   */
  getInputValidation() {
    return (req, res, next) => {
      try {
        // Sanitiser les entrées
        if (req.body) {
          req.body = this.sanitizeObject(req.body);
        }
        
        if (req.query) {
          req.query = this.sanitizeObject(req.query);
        }
        
        if (req.params) {
          req.params = this.sanitizeObject(req.params);
        }
        
        next();
      } catch (error) {
        console.error('[SECURITY] Erreur lors de la validation des entrées:', error);
        return res.status(400).json({
          error: 'Entrées invalides',
          message: 'Les données fournies sont invalides'
        });
      }
    };
  }

  /**
   * Sanitise un objet récursivement
   * @param {any} obj - Objet à sanitiser
   * @returns {any} Objet sanitée
   */
  sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return this.sanitizeString(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    
    const sanitized = {};
    // Champs à ne pas sanitiser (peuvent contenir des caractères spéciaux valides)
    const skipSanitizationKeys = ['password', 'newPassword', 'confirmPassword'];
    for (const [key, value] of Object.entries(obj)) {
      if (skipSanitizationKeys.includes(key) && typeof value === 'string') {
        // Pour les mots de passe : uniquement trim et limiter la longueur (sécurité DoS)
        sanitized[key] = value.trim().substring(0, 128);
      } else {
        sanitized[key] = this.sanitizeObject(value);
      }
    }
    
    return sanitized;
  }

  /**
   * Sanitise une chaîne de caractères
   * @param {any} str - Chaîne à sanitiser
   * @returns {string} Chaîne sanitée
   */
  sanitizeString(str) {
    if (typeof str !== 'string') {
      return str;
    }
    
    return str
      .trim()
      .replace(/[<>\"'&]/g, '') // Supprimer les caractères dangereux
      .substring(0, 1000); // Limiter la longueur
  }

  /**
   * Middleware de logging des tentatives de sécurité
   */
  getSecurityLogging() {
    return (req, res, next) => {
      const originalSend = res.send;
      
      res.send = function(data) {
        // Logger les tentatives d'authentification échouées
        if (res.statusCode === 401 || res.statusCode === 403) {
          console.warn(`[SECURITY] Tentative d'accès refusée: ${req.method} ${req.path} - IP: ${req.ip} - Status: ${res.statusCode}`);
        }
        
        // Logger les erreurs de rate limiting
        if (res.statusCode === 429) {
          console.warn(`[SECURITY] Rate limit dépassé: ${req.method} ${req.path} - IP: ${req.ip}`);
        }
        
        return originalSend.call(this, data);
      };
      
      next();
    };
  }

  /**
   * Middleware de validation des tokens JWT
   */
  getJWTValidation() {
    return (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({
            error: 'Token manquant',
            message: 'Header Authorization avec Bearer token requis'
          });
        }
        
        const token = authHeader.substring(7);
        
        // Vérifier la structure du token
        if (!token || token.split('.').length !== 3) {
          return res.status(401).json({
            error: 'Token invalide',
            message: 'Format de token JWT invalide'
          });
        }
        
        // Ajouter le token à la requête pour validation ultérieure
        req.jwtToken = token;
        next();
      } catch (error) {
        console.error('[SECURITY] Erreur lors de la validation JWT:', error);
        return res.status(401).json({
          error: 'Token invalide',
          message: 'Erreur lors de la validation du token'
        });
      }
    };
  }

  /**
   * Obtient tous les middlewares de sécurité
   */
  getAllMiddlewares() {
    return {
      securityHeaders: this.getSecurityHeaders(),
      rateLimitByIP: this.getRateLimitByIP(),
      tokenRateLimit: this.getTokenRateLimit(),
      authRateLimit: this.getAuthRateLimit(),
      emailRateLimit: this.getEmailRateLimit(),
      inputValidation: this.getInputValidation(),
      securityLogging: this.getSecurityLogging(),
      jwtValidation: this.getJWTValidation()
    };
  }

  /**
   * Obtient les statistiques de sécurité
   */
  getStats() {
    return {
      config: this.config,
      enabled: {
        securityHeaders: this.config.enableSecurityHeaders,
        rateLimit: this.config.enableRateLimit,
        csp: this.config.enableCSP,
        hsts: this.config.enableHSTS
      }
    };
  }
}

module.exports = new SecurityMiddleware();

