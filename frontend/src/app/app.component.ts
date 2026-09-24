import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { EnvironmentService } from './services/environment.service';
import { LoggerService } from './services/logger.service';
import { ToastContainerComponent } from './components/toast-container/toast-container.component';
import { ThemeService } from './services/theme.service';
import { CookieConsentModalComponent } from './components/cookie-consent-modal/cookie-consent-modal.component';
import { ConfirmationModalComponent } from './components/confirmation-modal/confirmation-modal.component';
import { UnifiedAuthService } from './services/unified-auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainerComponent, CookieConsentModalComponent, ConfirmationModalComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'ddsshare-app';
  private routerSubscription: Subscription | null = null;
  private authInitialized = false;
  constructor(
    private router: Router,
    private envService: EnvironmentService,
    private logger: LoggerService,
    private themeService: ThemeService,
    private authService: UnifiedAuthService
  ) {}

  async ngOnInit() {
    try {
      // Attendre que l'environnement soit chargé
      await this.waitForEnvironment();
      
      // Mettre à jour le LoggerService avec l'information de production
      this.logger.updateDevelopmentMode(this.envService.isProduction());
      
      // L'initialisation de l'authentification se fait maintenant dans APP_INITIALIZER
      this.logger.log('AppComponent initialized, authentication should be ready');
      this.authInitialized = true;
      
      // Gérer le token de callback AVANT la vérification de l'authentification
      this.handleAuthCallback();
      
      // Vérification initiale seulement
      this.redirectBasedOnAuth();
      
      // Écouter les changements de route pour debug seulement
      this.routerSubscription = this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe((event: any) => {
        if (event instanceof NavigationEnd) {
          this.logger.log('Navigation ended to:', event.url);
          
          // Vérifier si l'utilisateur est connecté et essaie d'accéder à une route publique
          const isLoggedIn = this.authService.isLoggedIn();
          
          if (isLoggedIn && event.url.startsWith('/access/')) {
            this.logger.log('Authenticated user accessing public route:', event.url, '- allowing access');
          }
        }
      });
    } catch (error) {
      this.logger.error('Failed to initialize app:', error);
      // Continue even if initialization fails
      this.logger.log('Continuing without full initialization');
    }
  }

  private async waitForEnvironment(): Promise<void> {
    return new Promise((resolve) => {
      const checkEnv = () => {
        if (this.envService.isEnvironmentLoaded()) {
          this.logger.log('Environment is loaded, proceeding with authentication initialization');
          resolve();
        } else {
          this.logger.log('Environment not yet loaded, waiting...');
          setTimeout(checkEnv, 100);
        }
      };
      checkEnv();
    });
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  private handleAuthCallback(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const email = urlParams.get('email');
    
    // Vérifier si c'est un token de connexion par email (route /auth/login)
    if (token && email && window.location.pathname === '/auth/login') {
      this.logger.log('Token de connexion par email détecté, laisser AuthCallbackComponent le traiter');
      return; // Laisser AuthCallbackComponent traiter ce token
    }
    
    if (token && email) {
      this.logger.log('Token reçu via callback dans AppComponent:', { email, token: token.substring(0, 20) + '...' });
      
      // Vérifier si c'est un token temporaire (pas un JWT)
      if (!token.includes('.')) {
        this.logger.log('Token temporaire détecté, laisser AuthCallbackComponent le traiter');
        return; // Laisser AuthCallbackComponent traiter ce token temporaire
      }
      
      try {
        // Décoder le token JWT pour extraire les informations utilisateur
        const payload = JSON.parse(atob(token.split('.')[1]));
        this.logger.log('Token JWT décodé:', payload);
        
        // Créer l'objet utilisateur
        const user = {
          sub: payload.sub || email,
          email: payload.email || email,
          name: payload.name || email.split('@')[0],
          firstName: payload.firstName || email.split('@')[0],
          lastName: payload.lastName || '',
          username: payload.username || email.split('@')[0],
          email_verified: true
        };
        
        // Utiliser le service d'authentification unifié pour définir l'utilisateur connecté
        this.authService.setEmailValidated(email, token, user);
        
        // Forcer la mise à jour de l'état d'authentification
        this.authService.updateAuthState();
        
        // Nettoyer l'URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        this.logger.log('Connexion réussie via callback dans AppComponent pour:', email);
      } catch (error) {
        this.logger.error('Erreur lors du traitement du token JWT:', error);
        // En cas d'erreur, nettoyer l'URL quand même
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }

  private redirectBasedOnAuth(): void {
    if (!this.authInitialized) {
      this.logger.log('Authentication not yet initialized, skipping redirect check');
      return;
    }
    
    const isLoggedIn = this.authService.isLoggedIn();
    
    // Utiliser window.location.pathname pour obtenir l'URL réelle que l'utilisateur essaie d'atteindre
    const currentPath = window.location.pathname;
    
    this.logger.log('redirectBasedOnAuth - isLoggedIn:', isLoggedIn, 'currentPath:', currentPath);
    this.logger.log('redirectBasedOnAuth - router.url:', this.router.url, 'window.location.pathname:', currentPath);
    
    // Ne pas rediriger si l'utilisateur est sur une route d'accès (share-access)
    if (currentPath.startsWith('/access/')) {
      this.logger.log('User is on access route, not redirecting');
      return;
    }
    
    // Ne pas rediriger si l'utilisateur est sur des routes publiques
    const publicRoutes = ['/access/', '/mentions-legales', '/conditions-utilisation', '/politique-cookies'];
    const isOnPublicRoute = publicRoutes.some(route => currentPath.startsWith(route));
    
    if (isOnPublicRoute) {
      this.logger.log('User is on public route:', currentPath, 'not redirecting');
      return;
    }
    
    // Ne rediriger que si l'utilisateur est connecté ET sur la page d'accueil publique ET que ce n'est pas une route d'accès
    // Cette redirection ne doit se faire que lors de l'initialisation de l'app, pas lors de la navigation
    if (isLoggedIn && (currentPath === '/' || currentPath === '') && !currentPath.startsWith('/access/')) {
      this.logger.log('Redirecting authenticated user from / to /home during initialization');
      this.router.navigate(['/home'], { replaceUrl: true });
    } else if (isLoggedIn && currentPath.startsWith('/share/')) {
      this.logger.log('User is on share route, not redirecting');
    } else if (isLoggedIn && currentPath.startsWith('/home')) {
      this.logger.log('User is on home route, not redirecting');
    } else if (isLoggedIn && currentPath.startsWith('/access/')) {
      this.logger.log('User is on access route, not redirecting');
    } else if (isLoggedIn) {
      this.logger.log('User is logged in on other route:', currentPath, 'not redirecting');
    } else {
      this.logger.log('User is not logged in, not redirecting');
    }
  }

}
