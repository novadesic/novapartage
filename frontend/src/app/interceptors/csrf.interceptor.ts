import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { LoggerService } from '../services/logger.service';

export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(LoggerService);
  
  // Vérifier si la requête nécessite un token CSRF
  if (requiresCSRFToken(req)) {
    const csrfToken = getCSRFToken();
    
    if (csrfToken) {
      // Ajouter le token CSRF aux headers
      const csrfReq = req.clone({
        setHeaders: {
          'X-CSRF-Token': csrfToken
        }
      });
      
      logger.log('CSRFInterceptor - Token CSRF ajouté à la requête:', req.url);
      return next(csrfReq);
    } else {
      logger.warn('CSRFInterceptor - Token CSRF manquant pour la requête:', req.url);
    }
  }

  return next(req);
};

function requiresCSRFToken(req: any): boolean {
  // Vérifier si la requête est vers notre service d'authentification
  const isAuthService = req.url.includes('/auth') || req.url.includes('/api/');
  
  // Vérifier si la méthode nécessite une protection CSRF
  const isModifyingMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
  
  // Vérifier si la requête n'est pas un health check
  const isNotHealthCheck = !req.url.includes('/health');
  
  return isAuthService && isModifyingMethod && isNotHealthCheck;
}

function getCSRFToken(): string | null {
  // Récupérer le token CSRF depuis les cookies
  const value = `; ${document.cookie}`;
  const parts = value.split(`; novapartage_csrf=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}
