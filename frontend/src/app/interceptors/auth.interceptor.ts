import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { switchMap, catchError, tap } from 'rxjs/operators';
import { UnifiedAuthService } from '../services/unified-auth.service';
import { LoggerService } from '../services/logger.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(
    private authService: UnifiedAuthService,
    private logger: LoggerService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    this.logger.log('🔍 AuthInterceptor - Interception de la requête:', req.url);
    
    // Vérifier si l'utilisateur est connecté
    const isLoggedIn = this.authService.isLoggedIn();
    this.logger.log('🔍 AuthInterceptor - État de connexion:', isLoggedIn);
    
    if (isLoggedIn) {
      this.logger.log('✅ AuthInterceptor - Utilisateur connecté, récupération du token...');
      
      // Obtenir le token avec rafraîchissement automatique
      return from(this.authService.getTokenWithRefresh()).pipe(
        switchMap(token => {
          if (token) {
            // Cloner la requête et ajouter le header d'autorisation
            const authReq = req.clone({
              headers: req.headers.set('Authorization', `Bearer ${token}`)
            });
            
            this.logger.log('✅ AuthInterceptor - Token ajouté à la requête:', req.url);
            this.logger.log('✅ AuthInterceptor - Token présent, longueur:', token.length);
            this.logger.log('✅ AuthInterceptor - Header Authorization ajouté');
            
            return next.handle(authReq).pipe(
              catchError((error: HttpErrorResponse) => {
                // Gestion spéciale des erreurs d'authentification
                if (error.status === 401) {
                  this.logger.error('❌ AuthInterceptor - Erreur 401, token potentiellement expiré pour:', req.url);
                  this.logger.error('❌ AuthInterceptor - Token utilisé était:', token.substring(0, 50) + '...');
                }
                return throwError(() => error);
              })
            );
          } else {
            this.logger.warn('⚠️  AuthInterceptor - Aucun token disponible pour la requête:', req.url);
            this.logger.warn('⚠️  AuthInterceptor - Requête envoyée sans authentification');
            return next.handle(req);
          }
        }),
        catchError(error => {
          this.logger.error('❌ AuthInterceptor - Erreur lors de l\'obtention du token:', error);
          this.logger.error('❌ AuthInterceptor - Requête envoyée sans authentification pour:', req.url);
          // Continuer sans token en cas d'erreur
          return next.handle(req);
        })
      );
    } else {
      this.logger.log('⚠️  AuthInterceptor - Utilisateur non connecté, requête sans token:', req.url);
      this.logger.log('⚠️  AuthInterceptor - Ceci est normal si l\'utilisateur n\'est pas encore connecté');
      // Utilisateur non connecté, continuer sans token
      return next.handle(req);
    }
  }
} 