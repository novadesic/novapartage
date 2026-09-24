import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { LoggerService } from '../services/logger.service';
import { EnvironmentService } from '../services/environment.service';
import { UnifiedAuthService } from '../services/unified-auth.service';

@Injectable({
  providedIn: 'root'
})
export class SecureJWTGuard implements CanActivate {
  constructor(
    private http: HttpClient,
    private router: Router,
    private logger: LoggerService,
    private envService: EnvironmentService,
    private authService: UnifiedAuthService
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    // En mode sécurisé, toujours valider côté serveur
    return this.validateTokenOnServer().pipe(
      map(isValid => {
        if (!isValid) {
          this.logger.warn('SecureJWTGuard - Token invalide, redirection vers la page de connexion');
          this.router.navigate(['/login']);
          return false;
        }
        return true;
      }),
      catchError(error => {
        this.logger.error('SecureJWTGuard - Erreur lors de la validation du token:', error);
        this.router.navigate(['/login']);
        return of(false);
      })
    );
  }

  private validateTokenOnServer(): Observable<boolean> {
    const authEndpoint = this.envService.getConfigValue('CUSTOM_AUTH_ENDPOINT', 'http://localhost/auth');
    
    return this.http.get(`${authEndpoint}/oidc/me`, {
      withCredentials: true
    }).pipe(
      map(response => {
        // Si la requête réussit, le token est valide
        return !!response;
      }),
      catchError(error => {
        // Si la requête échoue, le token est invalide
        return of(false);
      })
    );
  }
}

