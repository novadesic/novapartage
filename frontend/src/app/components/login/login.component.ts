import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UnifiedAuthService } from '../../services/unified-auth.service';
import { EnvironmentService } from '../../services/environment.service';
import { LoggerService } from '../../services/logger.service';
import { ConfirmationModalService } from '../../services/confirmation-modal.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container mt-5">
      <div class="row justify-content-center">
        <div class="col-md-6">
          <div class="card">
            <div class="card-header">
              <h3 class="text-center">Connexion DDShare</h3>
            </div>
            <div class="card-body">
              <div class="text-center mb-3">
                <p class="text-primary fw-bold">Connectez-vous pour accèder à votre essai gratuit</p>
                <p>Connectez-vous avec votre email</p>
                <small class="text-muted">Choisissez entre mot de passe ou lien de connexion</small>
              </div>
              
              <!-- Choix email + mode -->
              <div *ngIf="loginMethod !== 'password' && !emailSent">
                <form (ngSubmit)="onEmailStepSubmit($event)" #emailForm="ngForm">
                  <div class="mb-3">
                    <label for="email" class="form-label">Adresse email</label>
                    <input 
                      type="email" 
                      class="form-control" 
                      id="email" 
                      name="email"
                      [(ngModel)]="email"
                      required
                      email
                      placeholder="ex: utilisateur@exemple.com"
                      [disabled]="isLoading || isLoggingInWithPassword">
                  </div>
                  
                  <p class="text-muted small mb-2">Choisissez votre mode de connexion :</p>
                  <div class="d-grid gap-2">
                    <button 
                      type="button"
                      class="btn btn-outline-primary btn-lg" 
                      (click)="choosePasswordLogin()"
                      [disabled]="isLoading || isLoggingInWithPassword || !emailForm.valid">
                      <i class="bi bi-key me-2"></i>
                      J'ai déjà un mot de passe
                    </button>
                    <button 
                      type="button"
                      class="btn btn-primary btn-lg" 
                      (click)="loginWithEmail()"
                      [disabled]="isLoading || isLoggingInWithPassword || !emailForm.valid">
                      <span *ngIf="isLoading" class="spinner-border spinner-border-sm me-2"></span>
                      <i *ngIf="!isLoading" class="bi bi-envelope me-2"></i>
                      {{ isLoading ? 'Envoi en cours...' : 'Recevoir le lien de connexion' }}
                    </button>
                    
                    <button 
                      type="button"
                      class="btn btn-outline-secondary" 
                      (click)="login()"
                      [disabled]="isLoading || isLoggingInWithPassword">
                      <i class="bi bi-box-arrow-in-right me-2"></i>
                      Connexion classique
                    </button>
                  </div>
                </form>
              </div>
              
              <!-- Mode mot de passe -->
              <div *ngIf="loginMethod === 'password' && !emailSent">
                <div class="mb-3">
                  <label class="form-label">Email</label>
                  <input type="text" class="form-control" [value]="email" readonly>
                </div>
                <form (ngSubmit)="loginWithPassword()">
                  <div class="mb-3">
                    <label for="loginPassword" class="form-label">Mot de passe</label>
                    <div class="input-group">
                      <input 
                        [type]="showLoginPassword ? 'text' : 'password'" 
                        class="form-control" 
                        id="loginPassword" 
                        [(ngModel)]="userPassword" 
                        name="userPassword"
                        placeholder="Votre mot de passe"
                        [disabled]="isLoggingInWithPassword">
                      <button class="btn btn-outline-secondary" type="button" (click)="showLoginPassword = !showLoginPassword" [disabled]="isLoggingInWithPassword" tabindex="-1">
                        <i class="bi" [ngClass]="showLoginPassword ? 'bi-eye-slash' : 'bi-eye'"></i>
                      </button>
                    </div>
                  </div>
                  <div class="alert alert-danger" *ngIf="loginPasswordError">
                    <i class="bi bi-exclamation-triangle me-2"></i>{{ loginPasswordError }}
                  </div>
                  <div class="d-grid gap-2">
                    <button 
                      type="submit" 
                      class="btn btn-primary btn-lg"
                      [disabled]="isLoggingInWithPassword || !userPassword">
                      <span *ngIf="isLoggingInWithPassword" class="spinner-border spinner-border-sm me-2"></span>
                      <i *ngIf="!isLoggingInWithPassword" class="bi bi-box-arrow-in-right me-2"></i>
                      {{ isLoggingInWithPassword ? 'Connexion...' : 'Se connecter' }}
                    </button>
                    <button 
                      type="button" 
                      class="btn btn-outline-secondary"
                      (click)="backToLoginChoice()"
                      [disabled]="isLoggingInWithPassword">
                      <i class="bi bi-arrow-left me-2"></i>Retour
                    </button>
                  </div>
                </form>
              </div>
              
              <!-- Message de confirmation -->
              <div *ngIf="emailSent" class="alert alert-success mt-3">
                <i class="bi bi-check-circle me-2"></i>
                Un lien de connexion a été envoyé à <strong>{{ email }}</strong>
                <br>
                <small>Vérifiez votre boîte de réception et cliquez sur le lien pour vous connecter.</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .card {
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      border: none;
    }
    .card-header {
      background: linear-gradient(135deg, #2071aa 0%, #1a5d8a 100%);
      color: white;
      border: none;
    }
    .btn-primary {
      background: linear-gradient(135deg, #2071aa 0%, #1a5d8a 100%);
      border: none;
    }
    .btn-primary:hover {
      background: linear-gradient(135deg, #1a5d8a 0%, #155080 100%);
    }
  `]
})
export class LoginComponent {
  isLoading = false;
  email = '';
  emailSent = false;
  loginMethod: 'password' | 'code' | null = null;
  userPassword = '';
  showLoginPassword = false;
  isLoggingInWithPassword = false;
  loginPasswordError = '';

  constructor(
    private authService: UnifiedAuthService,
    private envService: EnvironmentService,
    private logger: LoggerService,
    private confirmationModalService: ConfirmationModalService
  ) {}

  async login(): Promise<void> {
    this.isLoading = true;
    try {
      this.authService.login();
    } catch (error) {
      this.logger.error('Erreur de connexion:', error);
      this.isLoading = false;
    }
  }

  async loginWithEmail(): Promise<void> {
    if (!this.email) {
      return;
    }

    this.isLoading = true;
    this.emailSent = false;
    
    try {
      await this.authService.loginWithEmail(this.email);
      this.emailSent = true;
      this.isLoading = false;
    } catch (error: any) {
      this.logger.error('Erreur lors de l\'envoi du lien de connexion:', error);
      
      // Gestion spécifique de l'erreur 429 (Too Many Requests)
      if (error?.status === 429) {
        this.confirmationModalService.alertWarning(
          'Trop de tentatives de connexion. Veuillez patienter quelques minutes avant de réessayer.',
          'Trop de requêtes'
        );
      } else {
        this.confirmationModalService.alertError('Erreur lors de l\'envoi du lien de connexion. Veuillez réessayer.');
      }
      
      this.isLoading = false;
    }
  }

  choosePasswordLogin(): void {
    this.loginMethod = 'password';
    this.loginPasswordError = '';
  }

  backToLoginChoice(): void {
    this.loginMethod = null;
    this.userPassword = '';
    this.showLoginPassword = false;
    this.loginPasswordError = '';
  }

  onEmailStepSubmit(event: Event): void {
    event.preventDefault();
  }

  async loginWithPassword(): Promise<void> {
    if (!this.email || !this.userPassword) return;
    
    this.isLoggingInWithPassword = true;
    this.loginPasswordError = '';
    
    try {
      await this.authService.loginWithPassword(this.email, this.userPassword);
      window.location.href = '/home';
    } catch (error: any) {
      this.loginPasswordError = error?.error?.message || 'Email ou mot de passe incorrect';
    } finally {
      this.isLoggingInWithPassword = false;
    }
  }
} 