import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ConfirmationModalService } from '../services/confirmation-modal.service';
import { LoggerService } from '../services/logger.service';

/**
 * Intercepteur global pour gérer les erreurs 429 (Too Many Requests)
 * Affiche un modal d'avertissement à l'utilisateur
 */
export const rateLimitInterceptor: HttpInterceptorFn = (req, next) => {
  const confirmationModal = inject(ConfirmationModalService);
  const logger = inject(LoggerService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Gestion spécifique de l'erreur 429 (Too Many Requests)
      if (error.status === 429) {
        logger.log('RateLimitInterceptor - Erreur 429 détectée pour:', req.url);
        
        // Ne pas afficher de modal pour les requêtes de connexion
        // Les composants gèrent eux-mêmes l'affichage de l'erreur dans leur modal
        const isLoginRequest = req.url.includes('/api/sign-in/email/passwordless') || 
                              req.url.includes('/api/email/verify');
        
        if (!isLoginRequest) {
          logger.log('RateLimitInterceptor - Affichage du modal d\'avertissement');
          
          // Afficher un modal d'avertissement uniquement pour les autres requêtes
          confirmationModal.alertWarning(
            'Trop de tentatives de connexion. Veuillez patienter quelques minutes avant de réessayer.',
            'Trop de requêtes'
          ).catch((modalError) => {
            logger.error('RateLimitInterceptor - Erreur lors de l\'affichage du modal:', modalError);
          });
        } else {
          logger.log('RateLimitInterceptor - Requête de connexion, le composant gérera l\'affichage de l\'erreur');
        }
      }
      
      // Propager l'erreur pour que les composants puissent aussi la gérer
      return throwError(() => error);
    })
  );
};

