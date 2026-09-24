import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { LoggerService } from '../services/logger.service';
import { EnvironmentService } from '../services/environment.service';

@Injectable({
  providedIn: 'root'
})
export class CSRFGuard implements CanActivate {
  constructor(
    private http: HttpClient,
    private router: Router,
    private logger: LoggerService,
    private envService: EnvironmentService
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    // Vérifier si la protection CSRF est activée
    const useSecureMode = this.envService.getConfigValue('USE_SECURE_AUTH', 'false') === 'true';
    
    if (!useSecureMode) {
      // En mode non sécurisé, autoriser l'accès
      return of(true);
    }

    // Vérifier si un token CSRF est disponible
    const csrfToken = this.getCSRFToken();
    
    if (!csrfToken) {
      // Demander un nouveau token CSRF
      return this.requestCSRFToken().pipe(
        map(() => true),
        catchError(error => {
          this.logger.error('CSRFGuard - Erreur lors de la demande du token CSRF:', error);
          // En cas d'erreur, autoriser l'accès mais logger l'erreur
          return of(true);
        })
      );
    }

    // Token CSRF disponible, autoriser l'accès
    return of(true);
  }

  private getCSRFToken(): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; novapartage_csrf=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null;
    }
    return null;
  }

  private requestCSRFToken(): Observable<any> {
    const authEndpoint = this.envService.getConfigValue('CUSTOM_AUTH_ENDPOINT', 'http://localhost/auth');
    
    return this.http.get(`${authEndpoint}/csrf-token`, {
      withCredentials: true
    });
  }
}

