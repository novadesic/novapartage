// Configuration d'environnement pour NovaPartage avec authentification personnalisée (Production)
// Ce fichier est chargé dynamiquement par l'application en production

window.__env = {
  // Configuration de production
  PRODUCTION: true,
  
  // Configuration authentification personnalisée
  CUSTOM_AUTH_ENDPOINT: 'https://your-auth-instance.com',
  CUSTOM_AUTH_APP_ID: 'novapartage-app',
  CUSTOM_AUTH_APP_SECRET: 'your-production-secret-key',
  
  // Configuration Backend
  BACKEND_URL: 'https://your-backend-instance.com/backend',
  BACKEND_API_PATH: '/api',
  
  // Configuration Application
  APP_NAME: 'NovaPartage',
  APP_VERSION: '1.0.0'
};