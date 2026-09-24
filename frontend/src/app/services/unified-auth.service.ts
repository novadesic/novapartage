import { Injectable, Inject, Optional, forwardRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, from, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { LoggerService } from './logger.service';
import { EnvironmentService } from './environment.service';
import { UnifiedUser, UnifiedAuthState, UnifiedAuthConfig } from './auth-interfaces';

// Exporter les interfaces pour les autres services
export { UnifiedUser, UnifiedAuthState, UnifiedAuthConfig } from './auth-interfaces';

@Injectable({
  providedIn: 'root'
})
export class UnifiedAuthService {
  private readonly STORAGE_KEY = 'unified_auth_state';
  private readonly CSRF_TOKEN_KEY = 'csrf_token';
  
  private config: UnifiedAuthConfig | null = null;
  private user: UnifiedUser | null = null;
  private csrfToken: string | null = null;
  private cachedToken: string | null = null;
  private cachedTokenExpiryMs: number = 0;
  private inFlightTokenPromise: Promise<string | null> | null = null;
  
  private authStateSubject = new BehaviorSubject<UnifiedAuthState>({
    isAuthenticated: false,
    isEmailValidated: false
  });
  public authState$ = this.authStateSubject.asObservable();
  
  private isLoggedInSubject = new BehaviorSubject<boolean>(false);
  public isLoggedIn$ = this.isLoggedInSubject.asObservable();
  
  private userSubject = new BehaviorSubject<UnifiedUser | null>(null);
  public user$ = this.userSubject.asObservable();

  constructor(
    private http: HttpClient,
    private logger: LoggerService,
    private envService: EnvironmentService
  ) {
    this.loadStoredData();
    // L'initialisation CSRF se fera après la configuration
    
    // Écouter les changements de localStorage entre onglets
    this.setupStorageListener();
  }

  setConfig(config: UnifiedAuthConfig): void {
    this.config = config;
    this.logger.log('UnifiedAuthService - Configuration définie:', config);
    // Initialiser CSRF maintenant que la configuration est disponible
    this.initializeCSRF();
    
    // Vérifier l'état d'authentification maintenant que la configuration est disponible
    // Utiliser setTimeout pour éviter la dépendance circulaire
    if (this.user) {
      setTimeout(() => {
        this.verifyServerAuthState();
      }, 100);
    }
  }

  private loadStoredData(): void {
    try {
      // 1. D'abord, essayer de récupérer les données depuis les cookies (plus fiable)
      const userCookie = this.getCookie('novapartage_user');
      if (userCookie) {
        try {
          // Nettoyer le cookie avant parsing (enlever les espaces, caractères invalides)
          const cleanCookie = userCookie.trim();
          if (cleanCookie && cleanCookie !== 'undefined' && cleanCookie !== 'null') {
            this.user = JSON.parse(cleanCookie);
            this.logger.log('UnifiedAuthService - Données utilisateur récupérées depuis les cookies:', this.user);
          } else {
            this.logger.warn('UnifiedAuthService - Cookie utilisateur vide ou invalide, ignoré');
          }
        } catch (error) {
          this.logger.error('UnifiedAuthService - Erreur lors du parsing du cookie utilisateur:', error);
          this.logger.error('UnifiedAuthService - Contenu du cookie:', userCookie);
          // Supprimer le cookie corrompu
          this.deleteCookie('novapartage_user');
        }
      }

      // 2. Ensuite, vérifier localStorage comme fallback
      const userStr = localStorage.getItem(this.STORAGE_KEY);
      if (userStr && !this.user) {
        this.user = JSON.parse(userStr);
        this.logger.log('UnifiedAuthService - Données utilisateur récupérées depuis localStorage:', this.user);
      }
      
      // Charger le token CSRF depuis les cookies
      this.csrfToken = this.getCookie('novapartage_csrf');
      
      // Si on a des données utilisateur, vérifier immédiatement côté serveur
      if (this.user) {
        // Mettre à jour l'état immédiatement pour éviter le délai
        this.isLoggedInSubject.next(true);
        this.userSubject.next(this.user);
        this.updateAuthStateInternal({
          isAuthenticated: true,
          isEmailValidated: true,
          userEmail: this.user.email,
          userInfo: this.user
        });
        
        // Vérifier en arrière-plan (seulement si la configuration est disponible)
        if (this.config) {
          setTimeout(() => {
            this.verifyServerAuthState();
          }, 100);
        }
      } else {
        // Pas de données locales, état non connecté
        const isLoggedIn = false;
        this.isLoggedInSubject.next(isLoggedIn);
        this.userSubject.next(null);
        this.updateAuthStateInternal({
          isAuthenticated: false,
          isEmailValidated: false
        });
        
        this.logger.log('UnifiedAuthService - Données chargées:', {
          hasUser: false,
          hasCSRFToken: !!this.csrfToken,
          isLoggedIn: false
        });
      }
    } catch (error) {
      this.logger.error('UnifiedAuthService - Erreur lors du chargement des données:', error);
      this.clearStoredData();
    }
  }

  private verifyServerAuthState(): void {
    // Vérifier l'état d'authentification côté serveur avec /oidc/me
    this.http.get(`${this.config?.endpoint}/oidc/me`, {
      withCredentials: true
    }).subscribe({
      next: (response: any) => {
        if (response && response.email) {
          // L'utilisateur est vraiment connecté côté serveur
          this.user = response;
          this.isLoggedInSubject.next(true);
          this.userSubject.next(this.user);
          this.updateAuthStateInternal({
            isAuthenticated: true,
            isEmailValidated: true,
            userEmail: response.email,
            userInfo: response
          });
          
          this.logger.log('UnifiedAuthService - État d\'authentification vérifié côté serveur:', {
            hasUser: true,
            userEmail: response.email,
            isLoggedIn: true
          });
        } else {
          // L'utilisateur n'est pas connecté côté serveur, nettoyer immédiatement
          this.logger.log('UnifiedAuthService - Utilisateur non connecté côté serveur, suppression des données locales');
          this.clearStoredData();
        }
      },
      error: (error) => {
        // Erreur lors de la vérification, nettoyer immédiatement
        this.logger.log('UnifiedAuthService - Erreur lors de la vérification côté serveur, suppression des données locales:', error);
        this.clearStoredData();
      }
    });
  }

  private clearStoredData(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.user = null;
    this.csrfToken = null;
    this.cachedToken = null;
    this.cachedTokenExpiryMs = 0;
    this.inFlightTokenPromise = null;
    this.isLoggedInSubject.next(false);
    this.userSubject.next(null);
    this.updateAuthStateInternal({
      isAuthenticated: false,
      isEmailValidated: false
    });
  }

  private storeUserData(user: UnifiedUser): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
      this.user = user;
      this.isLoggedInSubject.next(true);
      this.userSubject.next(this.user);
      this.updateAuthStateInternal({
        isAuthenticated: true,
        isEmailValidated: true,
        userEmail: user.email,
        userInfo: user
      });
      
      this.logger.log('UnifiedAuthService - Données utilisateur stockées:', {
        hasUser: !!user,
        userEmail: user.email
      });
    } catch (error) {
      this.logger.error('UnifiedAuthService - Erreur lors du stockage des données:', error);
    }
  }

  private updateAuthStateInternal(state: UnifiedAuthState): void {
    this.authStateSubject.next(state);
    try {
      localStorage.setItem('authState', JSON.stringify(state));
    } catch (error) {
      this.logger.error('UnifiedAuthService - Erreur lors de la sauvegarde de l\'état:', error);
    }
  }

  private getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null;
    }
    return null;
  }

  private deleteCookie(name: string): void {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }

  private getCSRFHeaders(): HttpHeaders {
    const headers = new HttpHeaders();
    if (this.csrfToken) {
      return headers.set('X-CSRF-Token', this.csrfToken);
    }
    return headers;
  }

  private initializeCSRF(): void {
    // Vérifier que la configuration est disponible
    if (!this.config || !this.config.endpoint) {
      this.logger.warn('UnifiedAuthService - Configuration non disponible pour l\'initialisation CSRF');
      return;
    }

    // Récupérer le token CSRF depuis les cookies
    this.csrfToken = this.getCookie('novapartage_csrf');
    
    if (!this.csrfToken) {
      // Demander un nouveau token CSRF
      this.requestCSRFToken().subscribe({
        next: (token) => {
          this.csrfToken = token;
          this.logger.log('UnifiedAuthService - Token CSRF initialisé');
        },
        error: (error) => {
          this.logger.error('UnifiedAuthService - Erreur lors de l\'initialisation CSRF:', error);
        }
      });
    }
  }

  private requestCSRFToken(): Observable<string> {
    return this.http.get<any>(`${this.config?.endpoint}/csrf-token`).pipe(
      map(response => response.csrfToken),
      catchError(error => {
        this.logger.error('UnifiedAuthService - Erreur lors de la demande CSRF:', error);
        return throwError(() => error);
      })
    );
  }

  // Méthodes publiques
  isLoggedIn(): boolean {
    return this.isLoggedInSubject.value;
  }

  async isLoggedInAsync(): Promise<boolean> {
    if (!this.config?.useServerValidation) {
      return this.isLoggedIn();
    }

    try {
      // Valider côté serveur
      const response = await this.http.get<any>(`${this.config.endpoint}/oidc/me`, {
        headers: this.getCSRFHeaders(),
        withCredentials: true
      }).toPromise();

      if (response) {
        this.storeUserData(response);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('UnifiedAuthService - Erreur lors de la validation serveur:', error);
      this.clearStoredData();
      return false;
    }
  }

  getToken(): string | null {
    // En mode sécurisé, le token est dans les cookies HttpOnly
    // On ne peut pas l'accéder côté client
    return null;
  }

  async getTokenWithRefresh(): Promise<string | null> {
    // Utiliser le cache si disponible et non expiré (marge 30s)
    const now = Date.now();
    if (this.cachedToken && now < (this.cachedTokenExpiryMs - 30_000)) {
      return this.cachedToken;
    }

    // Mutualiser les appels concurrents
    if (this.inFlightTokenPromise) {
      return this.inFlightTokenPromise;
    }

    this.inFlightTokenPromise = (async () => {
      try {
        const resp: any = await this.http.get(`${this.config?.endpoint}/api/auth/token`, {
          withCredentials: true
        }).toPromise();

        if (resp && resp.token) {
          const token: string = resp.token;
          // Décoder l'expiration depuis le payload JWT (partie centrale)
          const parts = token.split('.');
          if (parts.length === 3) {
            try {
              const payloadJson = JSON.parse(atob(parts[1]));
              const expSec = payloadJson?.exp as number | undefined;
              if (expSec && Number.isFinite(expSec)) {
                this.cachedTokenExpiryMs = expSec * 1000;
              } else {
                // Si pas d'exp dans le token, fallback courte durée: 2 minutes
                this.cachedTokenExpiryMs = now + 120_000;
              }
            } catch {
              this.cachedTokenExpiryMs = now + 120_000;
            }
          } else {
            this.cachedTokenExpiryMs = now + 120_000;
          }

          this.cachedToken = token;
          return token;
        }
        return null;
      } catch (error) {
        this.logger.error('UnifiedAuthService - Impossible de récupérer le token via /api/auth/token:', error);
        return null;
      } finally {
        this.inFlightTokenPromise = null;
      }
    })();

    return this.inFlightTokenPromise;
  }

  getLoggedUser(): Observable<UnifiedUser> {
    return this.user$.pipe(
      map(user => user || {} as UnifiedUser)
    );
  }

  getUsername(): string {
    if (this.user) {
      return this.user.username || this.user.email || this.user.name || 'Utilisateur';
    }
    return '';
  }

  getUserRoles(): string[] {
    // Le système d'authentification unifié ne gère pas les rôles complexes
    return [];
  }

  hasRole(role: string): boolean {
    // Le système d'authentification unifié ne gère pas les rôles complexes
    return false;
  }

  login(): void {
    this.logger.log('UnifiedAuthService - Redirection vers la page de connexion');
    window.location.href = '/login';
  }

  logout(): Observable<any> {
    this.logger.log('UnifiedAuthService - Déconnexion');
    
    return this.http.post(`${this.config?.endpoint}/api/logout`, {}, {
      headers: this.getCSRFHeaders(),
      withCredentials: true
    }).pipe(
      tap(() => {
        this.clearStoredData();
        window.location.href = '/';
      }),
      catchError(error => {
        this.logger.error('UnifiedAuthService - Erreur lors de la déconnexion:', error);
        // Déconnexion locale même en cas d'erreur
        this.clearStoredData();
        window.location.href = '/';
        return throwError(() => error);
      })
    );
  }

  async loginWithEmail(email: string): Promise<void> {
    this.logger.log('UnifiedAuthService - Connexion par email:', email);
    
    try {
      const response = await this.http.post<any>(`${this.config?.endpoint}/api/sign-in/email/passwordless`, {
        email: email
      }, {
        headers: this.getCSRFHeaders(),
        withCredentials: true
      }).toPromise();

      this.logger.log('UnifiedAuthService - Email de connexion envoyé:', response);
    } catch (error: any) {
      this.logger.error('UnifiedAuthService - Erreur lors de l\'envoi de l\'email:', error);
      this.logger.error('UnifiedAuthService - Type d\'erreur:', typeof error);
      this.logger.error('UnifiedAuthService - Status de l\'erreur:', error?.status);
      this.logger.error('UnifiedAuthService - Erreur complète:', JSON.stringify(error, null, 2));
      throw error;
    }
  }

  async loginWithPassword(email: string, password: string): Promise<any> {
    this.logger.log('UnifiedAuthService - Connexion par mot de passe:', email);
    
    const response = await this.http.post<any>(`${this.config?.endpoint}/api/sign-in/password`, {
      email: email,
      password: password
    }, {
      headers: this.getCSRFHeaders(),
      withCredentials: true
    }).toPromise();

    if (response && response.user) {
      this.storeUserData(response.user);
    }
    return response;
  }

  /**
   * Étape 1 : Demande de définition/changement de mot de passe - envoie un code par email
   */
  setPasswordRequest(newPassword: string, confirmPassword: string): Observable<any> {
    return this.http.post<any>(`${this.config?.endpoint}/api/auth/set-password-request`, {
      newPassword: newPassword,
      confirmPassword: confirmPassword
    }, {
      headers: this.getCSRFHeaders(),
      withCredentials: true
    }).pipe(
      catchError(error => {
        this.logger.error('UnifiedAuthService - Erreur setPasswordRequest:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Étape 2 : Confirmer le mot de passe avec le code reçu par email
   */
  setPasswordConfirm(code: string): Observable<any> {
    return this.http.post<any>(`${this.config?.endpoint}/api/auth/set-password-confirm`, {
      code: code
    }, {
      headers: this.getCSRFHeaders(),
      withCredentials: true
    }).pipe(
      catchError(error => {
        this.logger.error('UnifiedAuthService - Erreur setPasswordConfirm:', error);
        return throwError(() => error);
      })
    );
  }

  async requestPasswordReset(email: string): Promise<void> {
    this.logger.log('UnifiedAuthService - Demande de réinitialisation mot de passe:', email);
    
    await this.http.post<any>(`${this.config?.endpoint}/api/auth/forgot-password`, {
      email: email
    }, {
      headers: this.getCSRFHeaders(),
      withCredentials: true
    }).toPromise();
  }

  verifyEmailCode(email: string, code: string): Observable<any> {
    return this.http.post<any>(`${this.config?.endpoint}/api/email/verify-code`, {
      email: email,
      code: code
    }, {
      headers: this.getCSRFHeaders(),
      withCredentials: true
    }).pipe(
      tap(response => {
        if (response.verified && response.user) {
          this.storeUserData(response.user);
        }
      }),
      catchError(error => {
        this.logger.error('UnifiedAuthService - Erreur lors de la vérification du code:', error);
        return throwError(() => error);
      })
    );
  }

  sendEmailVerification(email: string): Observable<any> {
    return this.http.post<any>(`${this.config?.endpoint}/api/email/verify`, {
      email: email,
      purpose: 'share_creation'
    }, {
      headers: this.getCSRFHeaders(),
      withCredentials: true
    }).pipe(
      catchError(error => {
        this.logger.error('UnifiedAuthService - Erreur lors de l\'envoi de la vérification:', error);
        return throwError(() => error);
      })
    );
  }

  validateLoginToken(email: string, token: string): Observable<any> {
    this.logger.log('UnifiedAuthService - Validation du token de connexion:', { 
      email, 
      token: token.substring(0, 20) + '...',
      endpoint: '/auth/api/email/verify-link'
    });
    
    // Utiliser le même format que l'ancien système (sans headers CSRF, avec l'URL complète)
    return this.http.post<any>('/auth/api/email/verify-link', {
      email: email,
      token: token
    }).pipe(
      tap(response => {
        this.logger.log('UnifiedAuthService - Token de connexion validé avec succès:', response);
        // Si la validation réussit, récupérer les informations utilisateur
        if (response && response.user) {
          this.storeUserData(response.user);
        }
      }),
      catchError(error => {
        this.logger.error('UnifiedAuthService - Erreur détaillée lors de la validation du token:', {
          status: error.status,
          statusText: error.statusText,
          url: error.url,
          error: error.error,
          headers: error.headers
        });
        return throwError(() => error);
      })
    );
  }

  public updateAuthState(): void {
    this.logger.log('UnifiedAuthService - Mise à jour de l\'état d\'authentification');
    this.loadStoredData();
  }

  // Méthode pour simuler une connexion réussie (utilisée par les callbacks)
  setAuthenticated(user: UnifiedUser): void {
    this.logger.log('UnifiedAuthService - Authentification définie:', { user: user.email });
    this.storeUserData(user);
  }

  // Méthode pour vérifier si un token est valide (validation côté serveur)
  isTokenValid(): boolean {
    if (!this.config?.useServerValidation) {
      // En mode client, on ne peut pas valider le token
      return this.isLoggedIn();
    }

    // En mode serveur, la validation se fait côté serveur
    return this.isLoggedIn();
  }

  // Méthode pour gérer les callbacks d'authentification
  handleAuthCallback(): Observable<boolean> {
    const urlParams = new URLSearchParams(window.location.search);
    const authStatus = urlParams.get('auth');
    const email = urlParams.get('email');

    if (authStatus === 'success' && email) {
      // Récupérer les informations utilisateur depuis les cookies
      return this.http.get<any>(`${this.config?.endpoint}/oidc/me`, {
        withCredentials: true
      }).pipe(
        map(response => {
          if (response) {
            this.storeUserData(response);
            return true;
          }
          return false;
        }),
        catchError(error => {
          this.logger.error('UnifiedAuthService - Erreur lors du callback:', error);
          return throwError(() => error);
        })
      );
    }

    return from([false]);
  }

  refreshUserInfo(): Observable<UnifiedUser | null> {
    return this.http.get<any>(`${this.config?.endpoint}/oidc/me`, {
      withCredentials: true
    }).pipe(
      tap(response => {
        if (response) {
          this.storeUserData(response);
        }
      }),
      map(response => response || null),
      catchError(() => {
        return from([null]);
      })
    );
  }

  // Méthode pour nettoyer l'URL après le callback
  cleanCallbackUrl(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete('auth');
    url.searchParams.delete('email');
    url.searchParams.delete('token');
    
    window.history.replaceState({}, document.title, url.toString());
  }

  // Méthodes pour la compatibilité avec l'ancien système
  getAuthState$(): Observable<UnifiedAuthState> {
    return this.authState$;
  }

  getCurrentState(): UnifiedAuthState {
    return this.authStateSubject.value;
  }

  isAuthenticated(): boolean {
    return this.authStateSubject.value.isAuthenticated;
  }

  isEmailValidated(): boolean {
    return this.authStateSubject.value.isEmailValidated;
  }

  getUserEmail(): string | undefined {
    return this.authStateSubject.value.userEmail;
  }

  getTokenFromState(): string | undefined {
    return this.authStateSubject.value.token;
  }

  getUserInfo() {
    return this.authStateSubject.value.userInfo;
  }

  setEmailValidated(email: string, token?: string, userInfo?: any): void {
    this.updateAuthStateInternal({
      isAuthenticated: !!token,
      isEmailValidated: true,
      userEmail: email,
      token: token,
      userInfo: userInfo || {
        email: email,
        name: email.split('@')[0],
        firstName: email.split('@')[0]
      }
    });
    
    if (userInfo) {
      this.storeUserData(userInfo);
    }
  }

  setUnauthenticated(): void {
    this.clearStoredData();
  }

  clearEmailValidation(): void {
    const currentState = this.authStateSubject.value;
    this.updateAuthStateInternal({
      ...currentState,
      isEmailValidated: false,
      userEmail: undefined
    });
  }

  clearAll(): void {
    this.clearStoredData();
  }

  validateAndCleanState(): void {
    const currentState = this.authStateSubject.value;
    
    // Si l'utilisateur est marqué comme authentifié mais le token n'est pas valide
    if (currentState.isAuthenticated && !this.isTokenValid()) {
      this.logger.log('Token invalide détecté, déconnexion automatique');
      this.setUnauthenticated();
    }
  }

  private setupStorageListener(): void {
    // Écouter les changements de localStorage depuis d'autres onglets
    window.addEventListener('storage', (event) => {
      if (event.key === this.STORAGE_KEY && event.newValue) {
        this.logger.log('UnifiedAuthService - Changement détecté dans un autre onglet, rechargement des données');
        this.loadStoredData();
      }
    });
  }
}
