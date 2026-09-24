/**
 * Gestionnaire de cookies sécurisés
 * Compatible avec le système d'authentification hybride
 */
const { normalizeEmail } = require('./emailUtils');

class CookieManager {
  constructor() {
    this.config = {
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: process.env.COOKIE_SAME_SITE || 'lax',
      domain: process.env.COOKIE_DOMAIN || 'localhost',
      httpOnly: process.env.COOKIE_HTTP_ONLY !== 'false',
      maxAge: parseInt(process.env.COOKIE_MAX_AGE) || 3600000, // 1 heure en millisecondes
      path: '/',
      name: {
        auth: 'novapartage_auth',
        csrf: 'novapartage_csrf',
        refresh: 'novapartage_refresh'
      }
    };
  }

  /**
   * Définit un cookie d'authentification sécurisé
   * @param {Object} res - Objet response Express
   * @param {string} token - Token JWT
   * @param {Object} user - Informations utilisateur
   * @param {Object} options - Options supplémentaires
   */
  setAuthCookie(res, token, user, options = {}) {
    const cookieOptions = {
      httpOnly: this.config.httpOnly,
      secure: this.config.secure,
      sameSite: this.config.sameSite, // Utilise la config depuis l'environnement
      domain: this.config.domain || undefined, // Vide = domaine actuel uniquement
      path: this.config.path,
      maxAge: options.maxAge || this.config.maxAge
    };

    // Cookie principal d'authentification (HttpOnly, sécurisé)
    res.cookie(this.config.name.auth, token, cookieOptions);

    // Cookie de données utilisateur (non sensible) - accessible côté client
    if (user) {
      // Normaliser l'email en minuscules
      const normalizedEmail = normalizeEmail(user.email);
      
      const userData = {
        email: normalizedEmail,
        name: user.name || user.firstName,
        email_verified: user.email_verified || true
      };
      
      res.cookie('novapartage_user', JSON.stringify(userData), {
        ...cookieOptions,
        httpOnly: false, // Accessible côté client pour l'affichage
        sameSite: 'strict', // Même politique pour la cohérence
        maxAge: cookieOptions.maxAge
      });
    }

    console.log(`[COOKIE] Cookie d'authentification défini pour: ${user?.email || 'utilisateur'}`);
  }

  /**
   * Définit un cookie CSRF
   * @param {Object} res - Objet response Express
   * @param {string} csrfToken - Token CSRF
   */
  setCSRFCookie(res, csrfToken) {
    const cookieOptions = {
      httpOnly: false, // Accessible côté client pour les requêtes
      secure: this.config.secure,
      sameSite: this.config.sameSite,
      domain: this.config.domain,
      path: this.config.path,
      maxAge: this.config.maxAge
    };

    res.cookie(this.config.name.csrf, csrfToken, cookieOptions);
  }

  /**
   * Définit un cookie de rafraîchissement
   * @param {Object} res - Objet response Express
   * @param {string} refreshToken - Token de rafraîchissement
   */
  setRefreshCookie(res, refreshToken) {
    const cookieOptions = {
      httpOnly: true, // Toujours HttpOnly pour la sécurité
      secure: this.config.secure,
      sameSite: this.config.sameSite,
      domain: this.config.domain,
      path: this.config.path,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
    };

    res.cookie(this.config.name.refresh, refreshToken, cookieOptions);
  }

  /**
   * Récupère un cookie d'authentification
   * @param {Object} req - Objet request Express
   * @returns {string|null} Token JWT ou null
   */
  getAuthCookie(req) {
    return req.cookies?.[this.config.name.auth] || null;
  }

  /**
   * Récupère un cookie CSRF
   * @param {Object} req - Objet request Express
   * @returns {string|null} Token CSRF ou null
   */
  getCSRFCookie(req) {
    return req.cookies?.[this.config.name.csrf] || null;
  }

  /**
   * Récupère un cookie de rafraîchissement
   * @param {Object} req - Objet request Express
   * @returns {string|null} Token de rafraîchissement ou null
   */
  getRefreshCookie(req) {
    return req.cookies?.[this.config.name.refresh] || null;
  }

  /**
   * Récupère les données utilisateur depuis le cookie
   * @param {Object} req - Objet request Express
   * @returns {Object|null} Données utilisateur ou null
   */
  getUserCookie(req) {
    const userCookie = req.cookies?.['novapartage_user'];
    if (!userCookie) {
      return null;
    }

    try {
      const userData = JSON.parse(userCookie);
      // Normaliser l'email en minuscules lors de la récupération
      if (userData.email) {
        userData.email = normalizeEmail(userData.email);
      }
      return userData;
    } catch (error) {
      console.error('[COOKIE] Erreur lors du parsing du cookie utilisateur:', error);
      return null;
    }
  }

  /**
   * Supprime tous les cookies d'authentification
   * @param {Object} res - Objet response Express
   */
  clearAuthCookies(res) {
    const clearOptions = {
      httpOnly: true,
      secure: this.config.secure,
      sameSite: this.config.sameSite,
      domain: this.config.domain,
      path: this.config.path,
      maxAge: 0
    };

    // Supprimer le cookie d'authentification
    res.clearCookie(this.config.name.auth, clearOptions);
    
    // Supprimer le cookie utilisateur
    res.clearCookie('novapartage_user', {
      ...clearOptions,
      httpOnly: false
    });
    
    // Supprimer le cookie CSRF
    res.clearCookie(this.config.name.csrf, {
      ...clearOptions,
      httpOnly: false
    });
    
    // Supprimer le cookie de rafraîchissement
    res.clearCookie(this.config.name.refresh, clearOptions);

    console.log('[COOKIE] Cookies d\'authentification supprimés');
  }

  /**
   * Vérifie si les cookies sont supportés
   * @param {Object} req - Objet request Express
   * @returns {boolean} True si les cookies sont supportés
   */
  areCookiesSupported(req) {
    return req.headers.cookie !== undefined;
  }

  /**
   * Génère les options de cookie pour un environnement donné
   * @param {string} environment - Environnement (development, production)
   * @returns {Object} Options de cookie
   */
  getCookieOptions(environment = 'development') {
    const isProduction = environment === 'production';
    
    return {
      httpOnly: this.config.httpOnly,
      secure: isProduction ? true : this.config.secure,
      sameSite: isProduction ? 'strict' : this.config.sameSite,
      domain: isProduction ? this.config.domain : 'localhost',
      path: this.config.path,
      maxAge: this.config.maxAge
    };
  }

  /**
   * Valide la configuration des cookies
   * @returns {Object} Résultat de la validation
   */
  validateConfig() {
    const errors = [];
    const warnings = [];

    // Vérifications critiques
    if (this.config.secure && this.config.domain === 'localhost') {
      warnings.push('Cookie sécurisé configuré avec localhost (peut causer des problèmes en développement)');
    }

    if (this.config.sameSite === 'none' && !this.config.secure) {
      errors.push('sameSite=none nécessite secure=true');
    }

    if (this.config.maxAge < 60000) { // Moins d'1 minute
      warnings.push('Durée de vie des cookies très courte');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config: this.config
    };
  }

  /**
   * Obtient les statistiques des cookies
   * @returns {Object} Statistiques
   */
  getStats() {
    return {
      config: this.config,
      validation: this.validateConfig()
    };
  }
}

module.exports = new CookieManager();

