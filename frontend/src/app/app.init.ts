import { UnifiedAuthService } from './services/unified-auth.service';
import { EnvironmentService } from './services/environment.service';

export function initializeUnifiedAuth(unifiedAuthService: UnifiedAuthService, envService: EnvironmentService) {
  return () => {
    // Logger sera initialisé plus tard, on ne peut pas l'utiliser ici
    // Les logs d'initialisation sont critiques, on les garde en console
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('Initializing unified authentication service');
    }
    
    // Initialiser le service d'authentification unifié
    const customConfig = envService.getCustomAuthConfig();
    const unifiedConfig = {
      endpoint: customConfig.endpoint,
      appId: customConfig.appId,
      appSecret: customConfig.appSecret,
      redirectUri: window.location.origin + '/auth/callback',
      postLogoutRedirectUri: window.location.origin + '/',
      scopes: ['openid', 'profile', 'email'],
      useCookies: true, // Toujours utiliser les cookies en mode sécurisé
      useServerValidation: true // Toujours valider côté serveur
    };
    unifiedAuthService.setConfig(unifiedConfig);
    
    return Promise.resolve();
  };
} 