import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { catchError, switchMap } from 'rxjs/operators';
import { from, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { UnifiedAuthService } from '../services/unified-auth.service';
import { LoggerService } from '../services/logger.service';
import { ModalService } from '../services/modal.service';
import { ConfirmationModalService } from '../services/confirmation-modal.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);
  const authService = inject(UnifiedAuthService);
  const logger = inject(LoggerService);
  const router = inject(Router);
  const modalService = inject(ModalService);
  const confirmationModal = inject(ConfirmationModalService);
  
  logger.log('🚀🚀🚀 INTERCEPTEUR FONCTIONNEL APPELÉ 🚀🚀🚀');
  logger.log('🔍 URL interceptée:', req.url);
  logger.log('🔍 Content-Type:', req.headers.get('Content-Type'));
  logger.log('🔍 Body type:', typeof req.body);
  logger.log('🔍 Body instanceof FormData:', req.body instanceof FormData);
  
  // Ignorer toutes les routes d'authentification pour éviter les boucles et 429
  // Exemple: /auth/api/auth/token, /auth/api/**, /auth/oidc/me, /auth/csrf-token
  // Ignorer aussi les routes publiques d'accès (public-access)
  const urlStr = req.url || '';
  const skipHeader = req.headers.get('X-Skip-Auth-Interceptor');
  const shouldBypassAuth = urlStr.includes('/auth/') || 
                          urlStr.includes('/backend/public-access') || 
                          skipHeader === 'true';
  
  if (shouldBypassAuth) {
    logger.log('⚠️ Bypass de l\'intercepteur pour:', urlStr);
    // Supprimer le header pour ne pas l'envoyer au serveur
    if (skipHeader) {
      const headers = req.headers.delete('X-Skip-Auth-Interceptor');
      const clonedReq = req.clone({ headers });
      return next(clonedReq);
    }
    return next(req);
  }
  
  // Vérifier si l'utilisateur est connecté via le service d'authentification
  const isLoggedIn = authService.isLoggedIn();
  logger.log('🔍 État de connexion (AuthService):', isLoggedIn);
  
  if (isLoggedIn) {
    logger.log('✅ Utilisateur connecté, récupération du token...');
    
        // Obtenir le token avec rafraîchissement automatique
    return from(authService.getTokenWithRefresh()).pipe(
      catchError(tokenError => {
        logger.error('❌❌❌ ERREUR LORS DE LA RÉCUPÉRATION DU TOKEN ❌❌❌');
        logger.error('❌ Erreur:', tokenError);
        logger.error('❌ URL:', req.url);
        
        // 🔧 NOUVEAU : Si l'erreur est 401, afficher un modal de confirmation
        if (tokenError && tokenError.status === 401) {
          logger.log('🔧 Erreur 401 lors de la récupération du token, affichage du modal de confirmation');
          
          // Récupérer l'email de l'utilisateur si disponible
          const userEmail = authService.getUserEmail();
          
          // Nettoyer l'état d'authentification
          authService.setUnauthenticated();
          
          // Afficher un modal de confirmation avec deux options
          const message = userEmail 
            ? `Votre session a expiré. Souhaitez-vous recevoir un code de reconnexion à l'adresse ${userEmail} ?`
            : 'Votre session a expiré. Souhaitez-vous recevoir un code de reconnexion ?';
          
          confirmationModal.show({
            title: 'Session expirée',
            message: message,
            type: 'warning',
            confirmText: 'Se reconnecter',
            cancelText: 'Revenir à l\'accueil',
            showCancel: true
          }, (result) => {
            if (result.confirmed) {
              // L'utilisateur choisit d'envoyer un code de reconnexion
              modalService.openEmailValidationModal({
                email: userEmail || undefined,
                isSessionExpired: true,
                reason: 'session_expired'
              });
            } else {
              // L'utilisateur choisit de revenir à l'accueil
              router.navigate(['/'], { replaceUrl: false });
            }
          });
        }
        
        logger.error('❌ Requête envoyée sans authentification');
        // Continuer sans token en cas d'erreur de récupération de token uniquement
        return [null]; // Retourner null comme token pour indiquer l'échec
      }),
      switchMap(token => {
        if (token) {
          // Cloner la requête et ajouter le header d'autorisation
          // Pour les requêtes FormData, ne pas modifier le Content-Type
          let authReq;
          if (req.body instanceof FormData) {
            logger.log('📁 REQUÊTE MULTIPART DÉTECTÉE - CLONAGE SPÉCIAL');
            authReq = req.clone({
              setHeaders: {
                'Authorization': `Bearer ${token}`
              }
              // Ne pas toucher au Content-Type pour FormData - le navigateur le gère
            });
          } else {
            authReq = req.clone({
              headers: req.headers.set('Authorization', `Bearer ${token}`)
            });
          }
          
          logger.log('✅✅✅ TOKEN AJOUTÉ À LA REQUÊTE ✅✅✅');
          logger.log('✅ URL:', req.url);
          logger.log('✅ Token longueur:', token.length);
          logger.log('✅ Header Authorization ajouté au clone de la requête');
          logger.log('✅ Content-Type final:', authReq.headers.get('Content-Type'));
          
          return next(authReq).pipe(
            catchError((error: HttpErrorResponse) => {
              // Gestion spéciale des erreurs d'authentification
              if (error.status === 401) {
                logger.error('❌❌❌ ERREUR 401 MALGRÉ LE TOKEN ❌❌❌');
                logger.error('❌ URL:', req.url);
                logger.error('❌ Token était:', token.substring(0, 50) + '...');
                
                // 🔧 NOUVEAU : Afficher un modal de confirmation
                // Récupérer l'email de l'utilisateur si disponible
                const userEmail = authService.getUserEmail();
                logger.log('🔧 Affichage du modal de confirmation (session expirée)');
                logger.log('🔧 Email utilisateur récupéré:', userEmail);
                
                // Nettoyer l'état d'authentification localement (sans requête HTTP)
                // pour éviter les boucles
                authService.setUnauthenticated();
                
                // Afficher un modal de confirmation avec deux options
                const message = userEmail 
                  ? `Votre session a expiré. Souhaitez-vous recevoir un code de reconnexion à l'adresse ${userEmail} ?`
                  : 'Votre session a expiré. Souhaitez-vous recevoir un code de reconnexion ?';
                
                confirmationModal.show({
                  title: 'Session expirée',
                  message: message,
                  type: 'warning',
                  confirmText: 'Se reconnecter',
                  cancelText: 'Revenir à l\'accueil',
                  showCancel: true
                }, (result) => {
                  if (result.confirmed) {
                    // L'utilisateur choisit d'envoyer un code de reconnexion
                    modalService.openEmailValidationModal({
                      email: userEmail || undefined,
                      isSessionExpired: true,
                      reason: 'session_expired'
                    });
                  } else {
                    // L'utilisateur choisit de revenir à l'accueil
                    router.navigate(['/'], { replaceUrl: false });
                  }
                });
                
                // Ne pas propager l'erreur pour éviter d'autres traitements
                return throwError(() => error);
              } else {
                logger.error('❌ Erreur HTTP du backend:', error.status, error.statusText);
                logger.error('❌ URL:', req.url);
                logger.error('❌ Ce n\'est PAS un problème d\'authentification');
              }
              return throwError(() => error);
            })
          );
        } else {
          logger.warn('⚠️⚠️⚠️ AUCUN TOKEN DISPONIBLE ⚠️⚠️⚠️');
          logger.warn('⚠️ URL:', req.url);
          logger.warn('⚠️ Requête envoyée sans authentification');
          return next(req);
        }
      })
    );
  } else {
    logger.log('⚠️⚠️⚠️ UTILISATEUR NON CONNECTÉ ⚠️⚠️⚠️');
    logger.log('⚠️ URL:', req.url);
    logger.log('⚠️ Ceci est normal si l\'utilisateur n\'est pas encore connecté');
    // Utilisateur non connecté, continuer sans token
    return next(req);
  }
}; 