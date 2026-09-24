import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { UnifiedAuthService } from '../../services/unified-auth.service';
import { LoggerService } from '../../services/logger.service';
import { ConfirmationModalService } from '../../services/confirmation-modal.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container-fluid vh-100 d-flex align-items-center justify-content-center">
      <div class="text-center">
        <div *ngIf="!error && !success" class="spinner-border text-primary mb-3" role="status">
          <span class="visually-hidden">Chargement...</span>
        </div>
        <div *ngIf="success" class="text-success mb-3">
          <i class="bi bi-check-circle" style="font-size: 3rem;"></i>
        </div>
        <h4 *ngIf="!error && !success">Connexion en cours...</h4>
        <h4 *ngIf="success" class="text-success">Email envoyé !</h4>
        <p *ngIf="!error && !success" class="text-muted">Veuillez patienter pendant que nous vous connectons.</p>
        <p *ngIf="success" class="text-muted">Un lien de connexion a été envoyé à votre adresse email. Vérifiez votre boîte de réception.</p>
        <div *ngIf="error" class="alert alert-danger mt-3">
          <h5>Erreur de connexion</h5>
          <p>{{ error }}</p>
          <button class="btn btn-primary" (click)="goHome()">Retour à l'accueil</button>
        </div>
        <div *ngIf="success" class="mt-3">
          <button class="btn btn-primary" (click)="goHome()">Retour à l'accueil</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .spinner-border {
      width: 3rem;
      height: 3rem;
    }
  `]
})
export class AuthCallbackComponent implements OnInit {
  error: string | null = null;
  success: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private authService: UnifiedAuthService,
    private logger: LoggerService,
    private confirmationModalService: ConfirmationModalService
  ) {}

  ngOnInit(): void {
    this.handleAuthCallback();
  }

  private async handleAuthCallback(): Promise<void> {
    try {
      // Récupérer les paramètres de l'URL
      const email = this.route.snapshot.queryParams['email'];
      const token = this.route.snapshot.queryParams['token'];

      this.logger.log('AuthCallback - Paramètres reçus:', { email, token });

      // Si on a un email mais pas de token, c'est une demande de connexion
      if (email && !token) {
        this.logger.log('AuthCallback - Demande de connexion par email:', email);
        await this.handleEmailLoginRequest(email);
        return;
      }

      // Si on a un email et un token, c'est un callback d'authentification
      if (email && token) {
        this.logger.log('AuthCallback - Callback d\'authentification:', { email, token });
        await this.handleAuthTokenValidation(email, token);
        return;
      }

      // Si aucun paramètre, rediriger vers l'accueil
      this.logger.log('AuthCallback - Aucun paramètre, redirection vers l\'accueil');
      this.router.navigate(['/'], { replaceUrl: true });

    } catch (error: any) {
      this.logger.error('AuthCallback - Erreur de connexion:', error);
      this.error = error.message || 'Erreur lors de la connexion';
    }
  }

  private async handleEmailLoginRequest(email: string): Promise<void> {
    try {
      this.logger.log('AuthCallback - Envoi du lien de connexion pour:', email);
      
      // Timeout de sécurité pour éviter la boucle infinie
      const timeout = setTimeout(() => {
        this.logger.error('AuthCallback - Timeout lors de l\'envoi du lien');
        this.error = 'L\'envoi du lien de connexion prend trop de temps. Veuillez réessayer.';
      }, 10000); // 10 secondes
      
      // Envoyer le lien de connexion par email
      try {
        await this.authService.loginWithEmail(email);
        clearTimeout(timeout);
        this.logger.log('AuthCallback - Lien de connexion envoyé avec succès');
        
        // Afficher un message de succès
        this.error = null;
        this.success = true;
        
        // Rediriger vers l'accueil avec un message de succès
        setTimeout(() => {
          this.router.navigate(['/'], { 
            replaceUrl: true,
            queryParams: { message: 'email-sent' }
          });
        }, 2000);
      } catch (error: any) {
        clearTimeout(timeout);
        this.logger.error('AuthCallback - Erreur lors de l\'envoi du lien:', error);
        this.logger.error('AuthCallback - Status de l\'erreur:', error?.status);
        
        // Gestion spécifique de l'erreur 429 (Too Many Requests)
        this.logger.log('AuthCallback - Vérification du status de l\'erreur:', error?.status);
        this.logger.log('AuthCallback - Type d\'erreur:', typeof error);
        this.logger.log('AuthCallback - Erreur complète:', error);
        
        if (error?.status === 429) {
          this.logger.log('AuthCallback - Erreur 429 détectée, affichage du modal');
          this.logger.log('AuthCallback - Service de modal disponible:', !!this.confirmationModalService);
          
          try {
            this.confirmationModalService.alertWarning(
              'Trop de tentatives de connexion. Veuillez patienter quelques minutes avant de réessayer.',
              'Trop de requêtes'
            ).then(() => {
              this.logger.log('AuthCallback - Modal 429 affiché et fermé');
              // Rediriger vers l'accueil après la fermeture du modal
              setTimeout(() => {
                this.router.navigate(['/'], { replaceUrl: true });
              }, 500);
            }).catch((modalError) => {
              this.logger.error('AuthCallback - Erreur lors de l\'affichage du modal:', modalError);
              this.error = 'Trop de tentatives de connexion. Veuillez patienter quelques minutes avant de réessayer.';
            });
          } catch (modalCallError) {
            this.logger.error('AuthCallback - Exception lors de l\'appel au modal:', modalCallError);
            this.error = 'Trop de tentatives de connexion. Veuillez patienter quelques minutes avant de réessayer.';
          }
        } else {
          this.error = 'Erreur lors de l\'envoi du lien de connexion. Veuillez réessayer.';
        }
      }

    } catch (error: any) {
      this.logger.error('AuthCallback - Erreur lors de l\'envoi du lien:', error);
      this.error = 'Erreur lors de l\'envoi du lien de connexion. Veuillez réessayer.';
    }
  }

  private async handleAuthTokenValidation(email: string, token: string): Promise<void> {
    try {
      // Valider le token avec le backend
      this.authService.validateLoginToken(email, token).subscribe({
        next: (response) => {
          this.logger.log('AuthCallback - Token validé:', response);

          // Le backend a défini les cookies HttpOnly, maintenant vérifier l'état d'authentification
          this.checkAuthenticationStatus();
        },
        error: (error) => {
          this.logger.error('AuthCallback - Erreur lors de la validation du token:', error);
          // Au lieu d'afficher l'erreur, rediriger vers l'accueil avec le modal de connexion
          this.redirectToHomeWithLoginModal(email);
        }
      });

    } catch (error: any) {
      this.logger.error('AuthCallback - Erreur lors de la validation du token:', error);
      // Au lieu d'afficher l'erreur, rediriger vers l'accueil avec le modal de connexion
      this.redirectToHomeWithLoginModal(email);
    }
  }

  private checkAuthenticationStatus(): void {
    // Récupérer le token JWT depuis les cookies HttpOnly
    this.http.get('/auth/api/auth/token').subscribe({
      next: (response: any) => {
        this.logger.log('AuthCallback - Token JWT récupéré:', response);

        if (response.token && response.user) {
          // Créer un utilisateur pour le système d'authentification
          const user: any = {
            sub: response.user.sub,
            email: response.user.email,
            name: response.user.name,
            firstName: response.user.firstName,
            lastName: response.user.lastName || '',
            username: response.user.username || response.user.email.split('@')[0],
            email_verified: response.user.email_verified
          };

          // Utiliser le mode sécurisé pour définir l'utilisateur connecté
          this.authService.setEmailValidated(response.user.email, response.token, user);

          // Forcer la mise à jour de l'état d'authentification
          this.authService.updateAuthState();

          this.logger.log('AuthCallback - État d\'authentification après mise à jour:', {
            isEmailValidated: this.authService.isEmailValidated(),
            isLoggedIn: this.authService.isLoggedIn(),
            userEmail: this.authService.getUserEmail()
          });

          this.logger.log('AuthCallback - Utilisateur connecté, redirection vers /home');

          // Attendre un peu pour s'assurer que l'état est propagé
          setTimeout(() => {
            this.router.navigate(['/home'], { replaceUrl: true });
          }, 1000);
        } else {
          this.logger.error('AuthCallback - Token ou utilisateur manquant');
          this.error = 'Échec de l\'authentification. Veuillez réessayer.';
        }
      },
      error: (error) => {
        this.logger.error('AuthCallback - Erreur lors de la récupération du token:', error);
        this.error = 'Erreur lors de la récupération du token d\'authentification. Veuillez réessayer.';
      }
    });
  }

  goHome(): void {
    this.router.navigate(['/'], { replaceUrl: true });
  }

  private redirectToHomeWithLoginModal(email: string): void {
    this.logger.log('AuthCallback - Redirection vers l\'accueil avec modal de connexion pour:', email);
    // Rediriger vers l'accueil avec les paramètres pour ouvrir le modal et pré-remplir l'email
    this.router.navigate(['/'], { 
      queryParams: { 
        showLogin: 'true', 
        email: email,
        expired: 'true' // Indiquer que c'est un lien expiré
      },
      replaceUrl: true 
    });
  }
}
