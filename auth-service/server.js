const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

// Import des nouveaux modules de sécurité
const redisManager = require('./config/redis');
const tokenManager = require('./utils/tokenManager');
const cookieManager = require('./utils/cookieManager');
const validationConfig = require('./config/validation');
const csrfProtection = require('./middleware/csrf');
const securityMiddleware = require('./middleware/security');
const jwtMiddleware = require('./middleware/jwt');
const sessionManager = require('./utils/sessionManager');
const emailServiceClient = require('./utils/emailServiceClient');
const templateEmailClient = require('./utils/templateEmailClient');
const { normalizeEmail } = require('./utils/emailUtils');
const passwordManager = require('./utils/passwordManager');
const superadminManager = require('./utils/superadminManager');

/**
 * Si l'email est dans ddsshare_superadmins, ajoute is_superadmin au JWT et à l'objet user (cookie / réponse).
 * Permet aux superadmins de s'authentifier par code ou lien sans mot de passe.
 */
async function applySuperadminClaim(email, tokenPayload, user) {
  const isSuperadmin = await superadminManager.isSuperadmin(normalizeEmail(email));
  if (isSuperadmin) {
    tokenPayload.is_superadmin = true;
    if (user && typeof user === 'object') {
      user.is_superadmin = true;
      user.isSuperadmin = true;
    }
  }
  return tokenPayload;
}

const app = express();

// Configuration du trust proxy pour nginx
app.set('trust proxy', 1);

// Configuration CORS
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Middlewares de sécurité
app.use(securityMiddleware.getSecurityHeaders());
app.use(securityMiddleware.getRateLimitByIP());
app.use(securityMiddleware.getInputValidation());
app.use(securityMiddleware.getSecurityLogging());

// Middleware CSRF pour les routes qui en ont besoin
app.use(csrfProtection.generate());

// Configuration JWT (utilise maintenant validationConfig)
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

// Configuration de l'application
const appConfig = {
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost',
  authCallbackUrl: process.env.AUTH_CALLBACK_URL || 'http://localhost/auth/callback',
  environment: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info'
};

// Rate limiting pour la sécurité (utilise maintenant securityMiddleware)
const emailRateLimit = securityMiddleware.getEmailRateLimit();
const authRateLimit = securityMiddleware.getAuthRateLimit();
const tokenRateLimit = securityMiddleware.getTokenRateLimit();

// Initialisation des services de sécurité
let isInitialized = false;

const initializeSecurityServices = async () => {
  if (isInitialized) return;
  
  try {
    // Initialiser Redis
    await redisManager.initialize();
    
    // Valider la configuration
    const configValidation = validationConfig.validateConfig();
    if (!configValidation.valid) {
      console.error('[SECURITY] Erreurs de configuration:', configValidation.errors);
    }
    if (configValidation.warnings.length > 0) {
      console.warn('[SECURITY] Avertissements de configuration:', configValidation.warnings);
    }
    
    isInitialized = true;
    console.log('[SECURITY] Services de sécurité initialisés');
  } catch (error) {
    console.error('[SECURITY] Erreur lors de l\'initialisation:', error);
  }
};

// Initialiser les services au démarrage
initializeSecurityServices();

// Logging sécurisé
const log = (level, message, data = null) => {
  if (appConfig.logLevel === 'debug' || level === 'error') {
    if (data && appConfig.environment === 'production') {
      // En production, ne pas logger les données sensibles
      console.log(`[${level.toUpperCase()}] ${message}`);
    } else {
      console.log(`[${level.toUpperCase()}] ${message}`, data || '');
    }
  }
};

// Envoyer un email de connexion
app.post('/api/sign-in/email/passwordless', authRateLimit, csrfProtection.protect(), async (req, res) => {
  let { email } = req.body;
  
  // Normaliser l'email en minuscules
  email = normalizeEmail(email);
  
  // Validation de l'email
  if (!email || !validationConfig.validateEmail(email)) {
    return res.status(400).json({ 
      error: 'Email invalide',
      message: 'Veuillez fournir une adresse email valide'
    });
  }
  
  log('info', `Lien de connexion demandé pour: ${email}`);
  
  try {
    // Générer un token temporaire sécurisé avec Redis
    const { token: tempToken, expiresAt } = await tokenManager.storeTempToken(email, 'login');
    
    const loginLink = `${appConfig.frontendUrl}/login?email=${encodeURIComponent(email)}&token=${tempToken}`;
    
    // Envoyer l'email templaté via le service email
    await templateEmailClient.sendLoginLinkEmail(email, loginLink, expiresAt);
    log('info', `Email envoyé avec succès à: ${email}`);
    
    res.json({ 
      message: 'Lien de connexion envoyé', 
      email: email,
      link: appConfig.environment === 'development' ? loginLink : undefined // Ne pas exposer le lien en production
    });
  } catch (error) {
    log('error', 'Erreur lors de l\'envoi de l\'email', error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'envoi de l\'email',
      message: 'Impossible d\'envoyer l\'email de connexion'
    });
  }
});

// Valider un token de connexion
app.post('/api/sign-in/email/verify', authRateLimit, csrfProtection.protect(), async (req, res) => {
  let { email, token } = req.body;
  
  // Normaliser l'email en minuscules
  email = normalizeEmail(email);
  
  // Validation des paramètres
  if (!email || !token || !validationConfig.validateEmail(email)) {
    return res.status(400).json({ 
      error: 'Paramètres invalides',
      message: 'Email et token requis'
    });
  }
  
  // Valider le token avec le nouveau système
  const validation = await tokenManager.validateTempToken(email, token, 'login');
  
  if (!validation.valid) {
    return res.status(400).json({ 
      error: 'Token invalide',
      message: validation.error
    });
  }
  
  // Token correct - supprimer le token utilisé
  await tokenManager.deleteTempToken(email, 'login');
  
  log('info', `Token de connexion validé pour: ${email}`);
  
  // Générer un token JWT pour l'utilisateur validé (durée harmonisée)
  const tokenPayload = {
    sub: email,
    email: email,
    name: email.split('@')[0],
    firstName: email.split('@')[0],
    email_verified: true,
    iat: Math.floor(Date.now() / 1000),
    exp: validationConfig.getJWTExpirationTimestamp(),
    iss: validationConfig.config.jwtIssuer,
    aud: validationConfig.config.jwtAudience
  };
  
  const user = {
    email: email,
    name: email.split('@')[0],
    firstName: email.split('@')[0],
    email_verified: true
  };
  await applySuperadminClaim(email, tokenPayload, user);
  const jwtToken = jwt.sign(tokenPayload, JWT_SECRET);
  cookieManager.setAuthCookie(res, jwtToken, user);
  
  // Créer une nouvelle session pour l'utilisateur
  await sessionManager.createSession(email);
  
  res.json({ 
    message: 'Token de connexion validé', 
    email: email,
    verified: true,
    user: user
  });
});

// Connexion par mot de passe locale (PostgreSQL)
app.post('/api/sign-in/password', authRateLimit, csrfProtection.protect(), async (req, res) => {
  let { email, password } = req.body;
  
  email = normalizeEmail(email);
  
  if (!email || !validationConfig.validateEmail(email)) {
    return res.status(400).json({ 
      error: 'Paramètres invalides',
      message: 'Email et mot de passe requis'
    });
  }
  
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ 
      error: 'Paramètres invalides',
      message: 'Email et mot de passe requis'
    });
  }
  
  try {
    const isValid = await passwordManager.verifyPassword(email, password);
    if (!isValid) {
      return res.status(401).json({ 
        error: 'Authentification échouée',
        message: 'Email ou mot de passe incorrect'
      });
    }

    const isSuperadmin = await superadminManager.isSuperadmin(email);
    log('info', `Connexion par mot de passe (local) pour: ${email}`);
    const fallbackName = email.split('@')[0];
    const tokenPayload = {
      sub: email,
      email: email,
      name: fallbackName,
      firstName: fallbackName,
      email_verified: true,
      is_superadmin: isSuperadmin,
      iat: Math.floor(Date.now() / 1000),
      exp: validationConfig.getJWTExpirationTimestamp(),
      iss: validationConfig.config.jwtIssuer,
      aud: validationConfig.config.jwtAudience
    };
    const user = {
      email: email,
      name: fallbackName,
      firstName: fallbackName,
      email_verified: true,
      is_superadmin: isSuperadmin
    };

    const jwtToken = jwt.sign(tokenPayload, JWT_SECRET);
    cookieManager.setAuthCookie(res, jwtToken, user);
    await sessionManager.createSession(email);
    
    res.json({ 
      message: 'Connexion réussie', 
      email: email,
      verified: true,
      user: user
    });
  } catch (error) {
    log('error', 'Erreur connexion par mot de passe', error);
    res.status(500).json({ 
      error: 'Erreur interne',
      message: 'Impossible de vous connecter'
    });
  }
});

// Endpoint de callback pour la connexion (sécurisé avec cookies)
app.get('/login', async (req, res) => {
  let { email, token } = req.query;
  
  // Normaliser l'email en minuscules
  email = normalizeEmail(email);
  
  // Validation basique des paramètres
  if (!email || !token) {
    return res.status(400).json({ 
      error: 'Paramètres manquants',
      message: 'Email et token requis'
    });
  }
  
  if (!validationConfig.validateEmail(email)) {
    return res.status(400).json({ 
      error: 'Email invalide',
      message: 'Format d\'email invalide'
    });
  }
  
  log('info', `Connexion via login pour: ${email}`);
  
  try {
    // Valider le token temporaire
    const validation = await tokenManager.validateTempToken(email, token, 'login');
    
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Token invalide',
        message: validation.error
      });
    }
    
    // Supprimer le token temporaire utilisé
    await tokenManager.deleteTempToken(email, 'login');
    
    // Créer un token JWT sécurisé
    const tokenPayload = {
      sub: email,
      email: email,
      name: email.split('@')[0],
      firstName: email.split('@')[0],
      email_verified: true,
      iat: Math.floor(Date.now() / 1000),
      exp: validationConfig.getJWTExpirationTimestamp(),
      iss: validationConfig.config.jwtIssuer,
      aud: validationConfig.config.jwtAudience
    };
    
    const user = {
      email: email,
      name: email.split('@')[0],
      firstName: email.split('@')[0],
      email_verified: true
    };
    await applySuperadminClaim(email, tokenPayload, user);
    const jwtToken = jwt.sign(tokenPayload, JWT_SECRET);
    cookieManager.setAuthCookie(res, jwtToken, user);
    
    // Créer une nouvelle session pour l'utilisateur
    await sessionManager.createSession(email);
    
    // Rediriger vers le frontend sans exposer le token
    const frontendUrl = `${appConfig.frontendUrl}/?auth=success&email=${encodeURIComponent(email)}`;
    
    log('info', `Redirection vers le frontend: ${appConfig.frontendUrl}`);
    res.redirect(frontendUrl);
  } catch (error) {
    log('error', 'Erreur lors de la génération du token JWT', error);
    res.status(500).json({ 
      error: 'Erreur interne',
      message: 'Impossible de générer le token de connexion'
    });
  }
});

app.get('/callback', async (req, res) => {
  let { email, token } = req.query;
  
  // Normaliser l'email en minuscules
  email = normalizeEmail(email);
  
  // Validation basique des paramètres
  if (!email || !token) {
    return res.status(400).json({ 
      error: 'Paramètres manquants',
      message: 'Email et token requis'
    });
  }
  
  if (!validationConfig.validateEmail(email)) {
    return res.status(400).json({ 
      error: 'Email invalide',
      message: 'Format d\'email invalide'
    });
  }
  
  log('info', `Connexion via callback pour: ${email}`);
  
  try {
    // Valider le token temporaire
    const validation = await tokenManager.validateTempToken(email, token, 'manage_shares');
    
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Token invalide',
        message: validation.error
      });
    }
    
    // Supprimer le token temporaire utilisé
    await tokenManager.deleteTempToken(email, 'manage_shares');
    
    // Créer un token JWT sécurisé
    const tokenPayload = {
      sub: email,
      email: email,
      name: email.split('@')[0],
      firstName: email.split('@')[0],
      email_verified: true,
      iat: Math.floor(Date.now() / 1000),
      exp: validationConfig.getJWTExpirationTimestamp(),
      iss: validationConfig.config.jwtIssuer,
      aud: validationConfig.config.jwtAudience
    };
    
    const user = {
      email: email,
      name: email.split('@')[0],
      firstName: email.split('@')[0],
      email_verified: true
    };
    await applySuperadminClaim(email, tokenPayload, user);
    const jwtToken = jwt.sign(tokenPayload, JWT_SECRET);
    cookieManager.setAuthCookie(res, jwtToken, user);
    
    // Créer une nouvelle session pour l'utilisateur
    await sessionManager.createSession(email);
    
    // Rediriger vers le frontend sans exposer le token
    const frontendUrl = `${appConfig.frontendUrl}/?auth=success&email=${encodeURIComponent(email)}`;
    
    log('info', `Redirection vers le frontend: ${appConfig.frontendUrl}`);
    res.redirect(frontendUrl);
  } catch (error) {
    log('error', 'Erreur lors de la génération du token JWT', error);
    res.status(500).json({ 
      error: 'Erreur interne',
      message: 'Impossible de générer le token de connexion'
    });
  }
});

// Endpoint pour récupérer les infos utilisateur (validation JWT sécurisée)
app.get('/oidc/me', jwtMiddleware.validate(), async (req, res) => {
  let hasPasswordFlag = false;
  try {
    hasPasswordFlag = await passwordManager.hasPassword(req.user.email);
  } catch (err) {
    log('error', 'Erreur hasPassword dans oidc/me', err);
  }
  res.json({
    sub: req.user.sub,
    email: req.user.email,
    name: req.user.name,
    firstName: req.user.firstName,
    email_verified: req.user.email_verified,
    hasPassword: hasPasswordFlag,
    isSuperadmin: req.user.is_superadmin === true,
    iat: req.user.iat,
    exp: req.user.exp
  });
});

// Endpoint pour vérifier l'état d'authentification via les cookies
app.get('/api/auth/status', jwtMiddleware.validate(), (req, res) => {
  res.json({
    authenticated: true,
    user: {
      sub: req.user.sub,
      email: req.user.email,
      name: req.user.name,
      firstName: req.user.firstName,
      lastName: req.user.lastName || '',
      username: req.user.username || req.user.email.split('@')[0],
      email_verified: req.user.email_verified,
      isSuperadmin: req.user.is_superadmin === true,
      iat: req.user.iat,
      exp: req.user.exp
    }
  });
});

// Endpoint pour récupérer le token JWT (pour compatibilité avec le backend Java)
// Supporte le renouvellement avec ?refresh=true
// Utilise validateOptional pour permettre la récupération des infos de session même avec un token expiré
// Rate limiting spécifique avec limite plus élevée pour les utilisateurs connectés
app.get('/api/auth/token', tokenRateLimit, jwtMiddleware.validateOptional(), async (req, res) => {
  // Récupérer le token JWT depuis les cookies
  const token = req.cookies['novapartage_auth'];
  const shouldRefresh = req.query.refresh === 'true';
  
  // Si pas d'utilisateur (token invalide ou expiré), on peut quand même essayer de récupérer les infos de session
  if (!req.user && !token) {
    return res.status(401).json({
      error: 'Token non trouvé',
      message: 'Token d\'authentification non trouvé dans les cookies',
      session: {
        forceReconnect: true,
        reason: 'no_token'
      }
    });
  }

  // Si pas d'utilisateur mais token présent, le token est probablement expiré
  if (!req.user && token) {
    // Essayer de décoder le token pour récupérer l'email même s'il est expiré
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token);
      if (decoded && decoded.email) {
        // Normaliser l'email en minuscules
        const normalizedEmail = normalizeEmail(decoded.email);
        // Récupérer les infos de session même avec token expiré
        const sessionInfo = await sessionManager.getSessionInfo(normalizedEmail);
        
        if (sessionInfo) {
          // Si la session force la reconnexion, retourner l'erreur
          if (sessionInfo.forceReconnect) {
            return res.status(401).json({
              error: 'Session expirée',
              message: 'Votre session a expiré. Veuillez vous reconnecter.',
              forceReconnect: true,
              reason: sessionInfo.sessionExpired ? 'session_expired' :
                      sessionInfo.idleExpired ? 'idle_expired' :
                      sessionInfo.refreshLimitReached ? 'refresh_limit_reached' : 'token_expired',
              session: {
                forceReconnect: true,
                reason: sessionInfo.sessionExpired ? 'session_expired' :
                        sessionInfo.idleExpired ? 'idle_expired' :
                        sessionInfo.refreshLimitReached ? 'refresh_limit_reached' : 'token_expired',
                expiresAt: decoded.exp || 0,
                sessionExpiresAt: sessionInfo.sessionExpiresAt,
                refreshCount: sessionInfo.refreshCount,
                maxRefreshCount: sessionManager.getConfig().maxRefreshCount,
                canRefresh: false,
                timeUntilExpiry: Math.max(0, (decoded.exp || 0) - Math.floor(Date.now() / 1000)),
                timeUntilSessionExpiry: sessionInfo.timeUntilSessionExpiry,
                warningThreshold: 300
              }
            });
          }
          
          // Si la session est valide mais le token est expiré, retourner les infos de session
          // pour permettre au frontend de savoir qu'il peut renouveler
          const now = Math.floor(Date.now() / 1000);
          const tokenExpiresAt = decoded.exp || 0;
          const timeUntilExpiry = Math.max(0, tokenExpiresAt - now);
          
          return res.json({
            token: null, // Token expiré
            user: {
              sub: decoded.sub,
              email: normalizedEmail,
              name: decoded.name,
              firstName: decoded.firstName,
              lastName: decoded.lastName || '',
              username: decoded.username || normalizedEmail.split('@')[0],
              email_verified: decoded.email_verified,
              isSuperadmin: decoded.is_superadmin === true,
              iat: decoded.iat,
              exp: tokenExpiresAt
            },
            session: {
              expiresAt: tokenExpiresAt,
              sessionExpiresAt: sessionInfo.sessionExpiresAt,
              refreshCount: sessionInfo.refreshCount,
              maxRefreshCount: sessionManager.getConfig().maxRefreshCount,
              canRefresh: sessionInfo.canRefresh && !sessionInfo.forceReconnect,
              forceReconnect: sessionInfo.forceReconnect,
              timeUntilExpiry: timeUntilExpiry,
              timeUntilSessionExpiry: sessionInfo.timeUntilSessionExpiry,
              warningThreshold: 300
            }
          });
        }
      }
    } catch (error) {
      // Token invalide
      console.error('[AUTH] Erreur lors du décodage du token:', error);
    }
    
    return res.status(401).json({
      error: 'Token expiré',
      message: 'Votre token a expiré. Veuillez vous reconnecter.',
      forceReconnect: true,
      reason: 'token_expired',
      session: {
        forceReconnect: true,
        reason: 'token_expired'
      }
    });
  }

  let email = req.user?.email;
  if (!email) {
    return res.status(401).json({
      error: 'Utilisateur non identifié',
      message: 'Impossible d\'identifier l\'utilisateur',
      session: {
        forceReconnect: true,
        reason: 'user_not_found'
      }
    });
  }

  // Normaliser l'email en minuscules
  email = normalizeEmail(email);

  // Récupérer ou créer la session
  let sessionInfo = await sessionManager.getSessionInfo(email);
  
  if (!sessionInfo) {
    // Créer une nouvelle session si elle n'existe pas
    await sessionManager.createSession(email);
    sessionInfo = await sessionManager.getSessionInfo(email);
  }

  // Si renouvellement demandé
  if (shouldRefresh) {
    // Pour le renouvellement, on doit avoir un utilisateur valide (token valide)
    if (!req.user) {
      return res.status(401).json({
        error: 'Token invalide',
        message: 'Impossible de renouveler le token. Veuillez vous reconnecter.',
        forceReconnect: true,
        reason: 'token_invalid',
        session: {
          forceReconnect: true,
          reason: 'token_invalid'
        }
      });
    }

    const refreshResult = await sessionManager.refreshSession(email);
    
    if (!refreshResult.success) {
      // Forcer la reconnexion
      cookieManager.clearAuthCookies(res);
      
      return res.status(401).json({
        error: 'Session expirée',
        message: refreshResult.message || 'Votre session a expiré. Veuillez vous reconnecter.',
        forceReconnect: true,
        reason: refreshResult.reason,
        session: {
          forceReconnect: true,
          reason: refreshResult.reason
        }
      });
    }

    // Générer un nouveau token (statut superadmin relu en base pour rester cohérent)
    const isSuperadminRefresh = await superadminManager.isSuperadmin(email);
    const newTokenPayload = {
      sub: email,
      email: email,
      name: req.user.name,
      firstName: req.user.firstName,
      lastName: req.user.lastName || '',
      email_verified: req.user.email_verified,
      ...(isSuperadminRefresh ? { is_superadmin: true } : {}),
      iat: Math.floor(Date.now() / 1000),
      exp: validationConfig.getJWTExpirationTimestamp(),
      iss: validationConfig.config.jwtIssuer,
      aud: validationConfig.config.jwtAudience
    };
    
    const newToken = jwtMiddleware.generateToken(newTokenPayload);
    cookieManager.setAuthCookie(res, newToken, {
      email: email,
      name: req.user.name,
      firstName: req.user.firstName,
      lastName: req.user.lastName || '',
      email_verified: req.user.email_verified,
      ...(isSuperadminRefresh ? { is_superadmin: true, isSuperadmin: true } : {})
    });
    
    // Mettre à jour sessionInfo après refresh
    sessionInfo = await sessionManager.getSessionInfo(email);
    
    // Calculer les temps restants
    const now = Math.floor(Date.now() / 1000);
    const tokenExpiresAt = newTokenPayload.exp;
    const timeUntilExpiry = Math.max(0, tokenExpiresAt - now);

    return res.json({
      token: newToken,
      user: {
        sub: email,
        email: email,
        name: req.user.name,
        firstName: req.user.firstName,
        lastName: req.user.lastName || '',
        username: req.user.username || email.split('@')[0],
        email_verified: req.user.email_verified,
        isSuperadmin: isSuperadminRefresh,
        iat: newTokenPayload.iat,
        exp: tokenExpiresAt
      },
      session: {
        expiresAt: tokenExpiresAt,
        sessionExpiresAt: sessionInfo.sessionExpiresAt,
        refreshCount: sessionInfo.refreshCount,
        maxRefreshCount: sessionManager.getConfig().maxRefreshCount,
        canRefresh: sessionInfo.canRefresh,
        forceReconnect: sessionInfo.forceReconnect,
        timeUntilExpiry: timeUntilExpiry,
        timeUntilSessionExpiry: sessionInfo.timeUntilSessionExpiry,
        warningThreshold: 300 // 5 minutes avant expiration
      }
    });
  }

  // Calculer les temps restants pour le token actuel
  const now = Math.floor(Date.now() / 1000);
  const tokenExpiresAt = req.user.exp;
  const timeUntilExpiry = Math.max(0, tokenExpiresAt - now);

  res.json({
    token: token,
    user: {
      sub: req.user.sub,
      email: req.user.email,
      name: req.user.name,
      firstName: req.user.firstName,
      lastName: req.user.lastName || '',
      username: req.user.username || req.user.email.split('@')[0],
      email_verified: req.user.email_verified,
      isSuperadmin: req.user.is_superadmin === true,
      iat: req.user.iat,
      exp: req.user.exp
    },
    session: {
      expiresAt: tokenExpiresAt,
      sessionExpiresAt: sessionInfo.sessionExpiresAt,
      refreshCount: sessionInfo.refreshCount,
      maxRefreshCount: sessionManager.getConfig().maxRefreshCount,
      canRefresh: sessionInfo.canRefresh,
      forceReconnect: sessionInfo.forceReconnect,
      timeUntilExpiry: timeUntilExpiry,
      timeUntilSessionExpiry: sessionInfo.timeUntilSessionExpiry,
      warningThreshold: 300 // 5 minutes avant expiration
    }
  });
});

// Envoyer un code de vérification par email
app.post('/api/email/verify', emailRateLimit, csrfProtection.protect(), async (req, res) => {
  let { email, purpose = 'share_creation' } = req.body;
  
  // Normaliser l'email en minuscules
  email = normalizeEmail(email);
  
  // Validation de l'email
  if (!email || !validationConfig.validateEmail(email)) {
    return res.status(400).json({ 
      error: 'Email invalide',
      message: 'Veuillez fournir une adresse email valide'
    });
  }
  
  log('info', `Vérification demandée pour: ${email} (${purpose})`);
  
  try {
    if (purpose === 'manage_shares') {
      // Pour gérer les partages, générer un lien de connexion avec Redis
      const { token: verificationToken, expiresAt } = await tokenManager.storeTempToken(email, purpose);
      
      // Générer le lien de connexion
      const loginLink = `${appConfig.frontendUrl}/login?token=${verificationToken}&email=${encodeURIComponent(email)}`;
      
      // Envoyer l'email templaté via le service email
      await templateEmailClient.sendManageSharesEmail(email, loginLink, expiresAt);
      log('info', `Lien de connexion envoyé à: ${email}`);
      
      res.json({ 
        message: 'Lien de connexion envoyé', 
        email: email,
        expiresIn: 24 * 60 * 60 // 24 heures en secondes
      });
    } else {
      // Pour la création de partage, générer un code de vérification avec Redis
      const { code: verificationCode, expiresAt } = await tokenManager.storeVerificationCode(email, purpose);
      
      // Envoyer l'email templaté via le service email
      await templateEmailClient.sendVerificationCodeEmail(email, verificationCode, expiresAt);
      log('info', `Code de vérification envoyé à: ${email}`);
      
      res.json({ 
        message: 'Code de vérification envoyé', 
        email: email,
        expiresIn: 15 * 60 // 15 minutes en secondes
      });
    }
  } catch (error) {
    log('error', 'Erreur lors de l\'envoi du code de vérification', error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'envoi de l\'email',
      message: 'Impossible d\'envoyer le code de vérification'
    });
  }
});

// Vérifier un code de vérification
app.post('/api/email/verify-code', authRateLimit, csrfProtection.protect(), async (req, res) => {
  let { email, code, purpose = 'share_creation' } = req.body;
  
  // Normaliser l'email en minuscules
  email = normalizeEmail(email);
  
  // Validation des paramètres
  if (!email || !code || !validationConfig.validateEmail(email)) {
    return res.status(400).json({ 
      error: 'Paramètres invalides',
      message: 'Email et code requis'
    });
  }
  
  // Valider le code avec le nouveau système
  const validation = await tokenManager.validateVerificationCode(email, code, purpose);
  
  if (!validation.valid) {
    return res.status(400).json({ 
      error: 'Code invalide',
      message: validation.error,
      attemptsLeft: validation.attemptsLeft
    });
  }
  
  log('info', `Code de vérification validé pour: ${email}`);
  
  // Générer un token JWT pour l'utilisateur validé
  const tokenPayload = {
    sub: email,
    email: email,
    name: email.split('@')[0],
    firstName: email.split('@')[0],
    email_verified: true,
    iat: Math.floor(Date.now() / 1000),
    exp: validationConfig.getJWTExpirationTimestamp(),
    iss: validationConfig.config.jwtIssuer,
    aud: validationConfig.config.jwtAudience
  };
  
  const user = {
    email: email,
    name: email.split('@')[0],
    firstName: email.split('@')[0],
    email_verified: true
  };
  await applySuperadminClaim(email, tokenPayload, user);
  const token = jwt.sign(tokenPayload, JWT_SECRET);
  cookieManager.setAuthCookie(res, token, user);
  
  // Créer une nouvelle session pour l'utilisateur
  await sessionManager.createSession(email);
  
  res.json({ 
    message: 'Code de vérification validé', 
    email: email,
    verified: true,
    user: user
  });
});

// Valider un lien de connexion
app.post('/api/email/verify-link', authRateLimit, csrfProtection.protect(), async (req, res) => {
  let { email, token } = req.body;
  
  // Normaliser l'email en minuscules
  email = normalizeEmail(email);
  
  // Validation des paramètres
  if (!email || !token || !validationConfig.validateEmail(email)) {
    return res.status(400).json({ 
      error: 'Paramètres invalides',
      message: 'Email et token requis'
    });
  }
  
  // Valider le token avec le nouveau système
  const validation = await tokenManager.validateTempToken(email, token, 'login');
  
  if (!validation.valid) {
    return res.status(400).json({ 
      error: 'Token invalide',
      message: validation.error
    });
  }
  
  // Token correct - supprimer le token utilisé
  await tokenManager.deleteTempToken(email, 'login');
  
  log('info', `Lien de connexion validé pour: ${email}`);
  
  // Générer un token JWT pour l'utilisateur validé
  const tokenPayload = {
    sub: email,
    email: email,
    name: email.split('@')[0],
    firstName: email.split('@')[0],
    email_verified: true,
    iat: Math.floor(Date.now() / 1000),
    exp: validationConfig.getJWTExpirationTimestamp(),
    iss: validationConfig.config.jwtIssuer,
    aud: validationConfig.config.jwtAudience
  };
  
  const user = {
    email: email,
    name: email.split('@')[0],
    firstName: email.split('@')[0],
    email_verified: true
  };
  await applySuperadminClaim(email, tokenPayload, user);
  const jwtToken = jwt.sign(tokenPayload, JWT_SECRET);
  cookieManager.setAuthCookie(res, jwtToken, user);
  
  // Créer une nouvelle session pour l'utilisateur
  await sessionManager.createSession(email);
  
  res.json({ 
    message: 'Lien de connexion validé', 
    email: email,
    verified: true,
    user: user
  });
});

// Étape 1 : Demander la définition/changement de mot de passe - envoie un code par email
app.post('/api/auth/set-password-request', authRateLimit, csrfProtection.protect(), jwtMiddleware.validate(), async (req, res) => {
  const { newPassword, confirmPassword } = req.body;
  const email = normalizeEmail(req.user.email);
  
  if (!newPassword || typeof newPassword !== 'string') {
    return res.status(400).json({ 
      error: 'Paramètres invalides',
      message: 'Nouveau mot de passe requis'
    });
  }
  
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ 
      error: 'Validation échouée',
      message: 'Les mots de passe ne correspondent pas'
    });
  }
  
  const validation = validationConfig.validatePassword(newPassword);
  if (!validation.valid) {
    return res.status(400).json({ 
      error: 'Mot de passe invalide',
      message: validation.error
    });
  }
  
  try {
    const passwordHash = await require('bcryptjs').hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS || '10', 10));
    const { code, expiresAt } = await tokenManager.storePasswordChangeCode(email, passwordHash);
    
    await templateEmailClient.sendVerificationCodeEmail(email, code, expiresAt);
    log('info', `Code de confirmation mot de passe envoyé à: ${email}`);
    
    res.json({ 
      message: 'Code de confirmation envoyé par email',
      success: true,
      email: email
    });
  } catch (error) {
    log('error', 'Erreur set-password-request', error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'envoi',
      message: 'Impossible d\'envoyer le code de confirmation'
    });
  }
});

// Étape 2 : Confirmer le mot de passe avec le code reçu par email
app.post('/api/auth/set-password-confirm', authRateLimit, csrfProtection.protect(), jwtMiddleware.validate(), async (req, res) => {
  const { code } = req.body;
  const email = normalizeEmail(req.user.email);
  
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ 
      error: 'Paramètres invalides',
      message: 'Code de confirmation requis'
    });
  }
  
  const cleanCode = code.replace(/\D/g, '');
  if (cleanCode.length !== 6) {
    return res.status(400).json({ 
      error: 'Code invalide',
      message: 'Le code doit contenir 6 chiffres'
    });
  }
  
  const validation = await tokenManager.validatePasswordChangeCode(email, cleanCode);
  
  if (!validation.valid) {
    return res.status(400).json({ 
      error: 'Code invalide',
      message: validation.error,
      attemptsLeft: validation.attemptsLeft
    });
  }
  
  try {
    const result = await passwordManager.setPasswordFromHash(email, validation.passwordHash);
    if (!result.success) {
      return res.status(500).json({ 
        error: 'Erreur serveur',
        message: 'Impossible d\'enregistrer le mot de passe'
      });
    }
    
    log('info', `Mot de passe défini pour: ${email}`);
    res.json({ 
      message: 'Mot de passe enregistré avec succès',
      success: true
    });
  } catch (error) {
    log('error', 'Erreur set-password-confirm', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Impossible d\'enregistrer le mot de passe'
    });
  }
});

// Mot de passe oublié - réutilise le flux magic link
app.post('/api/auth/forgot-password', authRateLimit, csrfProtection.protect(), async (req, res) => {
  let { email } = req.body;
  email = normalizeEmail(email);
  
  if (!email || !validationConfig.validateEmail(email)) {
    return res.status(400).json({ 
      error: 'Paramètres invalides',
      message: 'Adresse email valide requise'
    });
  }
  
  try {
    const { token: tempToken, expiresAt } = await tokenManager.storeTempToken(email, 'login');
    const loginLink = `${appConfig.frontendUrl}/login?email=${encodeURIComponent(email)}&token=${tempToken}`;
    await templateEmailClient.sendLoginLinkEmail(email, loginLink, expiresAt);
    log('info', `Lien de réinitialisation envoyé à: ${email}`);
    
    res.json({ 
      message: 'Si un compte existe avec cette adresse, un lien de connexion vous a été envoyé',
      email: email
    });
  } catch (error) {
    log('error', 'Erreur forgot-password', error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'envoi',
      message: 'Impossible d\'envoyer le lien'
    });
  }
});

// Endpoint de déconnexion
app.post('/api/logout', csrfProtection.protect(), async (req, res) => {
  try {
    // Récupérer l'email depuis les cookies avant de les supprimer
    const userCookie = cookieManager.getUserCookie(req);
    let email = userCookie?.email || req.body?.email;
    
    // Normaliser l'email en minuscules
    email = normalizeEmail(email);
    
    // Supprimer la session si l'email est disponible
    if (email) {
      await sessionManager.deleteSession(email);
    }
    
    // Supprimer les cookies d'authentification
    cookieManager.clearAuthCookies(res);
    
    res.json({ 
      message: 'Déconnexion réussie',
      success: true
    });
  } catch (error) {
    log('error', 'Erreur lors de la déconnexion', error);
    res.status(500).json({ 
      error: 'Erreur de déconnexion',
      message: 'Impossible de se déconnecter'
    });
  }
});

// Endpoint pour récupérer le token CSRF
app.get('/csrf-token', csrfProtection.generate(), (req, res) => {
  try {
    // Le token CSRF est généré par notre middleware personnalisé
    // et mis dans res.locals.csrfToken
    res.json({ 
      csrfToken: res.locals.csrfToken || null,
      message: 'Token CSRF généré',
      email: req.query.email || null
    });
  } catch (error) {
    log('error', 'Erreur lors de la génération du token CSRF', error);
    res.status(500).json({ 
      error: 'Erreur de génération CSRF',
      message: 'Impossible de générer le token CSRF'
    });
  }
});

// Endpoint de santé pour les health checks
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    environment: appConfig.environment,
    timestamp: new Date().toISOString(),
    services: {
      redis: redisManager.getStats(),
      security: securityMiddleware.getStats(),
      csrf: csrfProtection.getStats(),
      jwt: jwtMiddleware.getStats()
    }
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  log('info', `Service d'authentification démarré sur le port ${PORT}`);
  log('info', `Environnement: ${appConfig.environment}`);
  log('info', `Frontend URL: ${appConfig.frontendUrl}`);
  log('info', `CORS Origins: ${corsOptions.origin.join(', ')}`);
});
