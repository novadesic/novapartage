import { Component, OnInit, OnDestroy, Input, HostListener } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { UnifiedAuthService } from '../../services/unified-auth.service';
import { PASSWORD_RULES_MESSAGE, validatePassword } from '../../utils/password-rules';
import { UnifiedUser } from '../../services/unified-auth.service';
import { ThemeSelectorComponent } from '../theme-selector/theme-selector.component';
import { ModalService, LoginModalOptions } from '../../services/modal.service';
import { UnifiedAuthState } from '../../services/unified-auth.service';
import { LoggerService } from '../../services/logger.service';
import { SessionManagerService, SessionInfo } from '../../services/session-manager.service';
import { SubscriptionService, RestrictionReason } from '../../services/subscription.service';
import { AccountService, AccountData } from '../../services/account.service';
import { DemoInviteService } from '../../services/demo-invite.service';

/** Bandeau testeur masqué explicitement par l'utilisateur (réaffiché si nouvelle période démo). */
const DEMO_TESTER_BANNER_DISMISSED_KEY = 'novapartage_demo_tester_banner_dismissed';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ThemeSelectorComponent],
  template: `
    <!-- Bandeau compte testeur (période démo) -->
    <div *ngIf="showDemoTesterBanner" class="demo-tester-banner alert alert-info rounded-0 mb-0 py-2 border-0 d-flex align-items-center justify-content-between flex-wrap gap-2">
      <span>
        <i class="bi bi-flask me-2"></i>
        Compte testeur : accès gratuit jusqu'au {{ demoExpiresAt | date:'longDate' }}. Ensuite, un abonnement sera nécessaire pour créer ou modifier des contenus.
      </span>
      <button type="button" class="btn btn-sm btn-outline-primary flex-shrink-0" (click)="dismissDemoTesterBanner()">Masquer</button>
    </div>
    <!-- Bandeau mode restreint (non fermable) -->
    <div *ngIf="isRestricted" class="restricted-banner" [class.banner-temporary]="restrictionReason === 'temporary'">
      <span *ngIf="restrictionReason === 'no_subscription'">
        <i class="bi bi-info-circle me-2"></i>Vous êtes en mode consultation. Contactez un administrateur pour obtenir un accès complet.
      </span>
      <span *ngIf="restrictionReason === 'temporary'">
        <i class="bi bi-tools me-2"></i>Service temporairement indisponible. Vous pouvez consulter et télécharger vos fichiers. Réessayez plus tard.
      </span>
    </div>
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary fixed-top"
         [class.navbar-with-banner]="isRestricted"
         [class.navbar-with-demo-banner]="showDemoTesterBanner">
      <div class="container-fluid">
        <div class="navbar-nav d-flex">
        <!-- Icône de l'application à gauche -->
        <a class="navbar-brand fw-bold d-flex align-items-center" routerLink="/">
          <span class="logo-circle me-2">
            <img src="assets/logo.png" alt="NovaPartage" />
          </span>
          <span class="brand-text">NovaPartage</span>
        </a>
        
        <!-- Titre de page centré -->
        
          <span class="page-title text-light" *ngIf="pageTitle">
          <i class="bi bi-chevron-right me-1"></i> {{ pageTitle }}
          </span>
        </div>
    
        <!-- Menu utilisateur à droite -->
        <div class="navbar-nav ms-auto" *ngIf="isLoggedIn">
          <!-- Alerte de session -->
          <div class="nav-item me-3" *ngIf="showSessionWarning">
            <div class="session-warning d-none" 
                 [class.warning]="alertLevel === 1"
                 [class.critical]="alertLevel === 2">
              <i class="bi me-1" 
                 [class.bi-exclamation-triangle]="alertLevel === 1"
                 [class.bi-exclamation-circle]="alertLevel === 2"></i>
              <span *ngIf="sessionInfo">
                Session expire dans {{ formatTimeRemaining(sessionInfo.timeUntilExpiry) }}
              </span>
            </div>
          </div>
          <div class="nav-item dropdown">
            <a class="nav-link dropdown-toggle d-flex align-items-center" 
               href="#" 
               role="button" 
               aria-expanded="false"
               (click)="toggleDropdown($event)">
              <i class="bi bi-person-circle me-2"></i>
              <span class="text-light">
                {{ getDisplayName() }}
              </span>
            </a>
            <ul class="dropdown-menu dropdown-menu-end" 
                [class.show]="isDropdownOpen"
                (click)="$event.stopPropagation()">
              <li class="dropdown-item-text">
                <div class="d-flex align-items-center">
                  <i class="bi bi-person-circle me-2"></i>
                  <div>
                    <div class="fw-bold">{{ getDisplayName() }}</div>
                    <small class="text-muted">{{ userProfile?.email || '' }}</small>
                  </div>
                </div>
              </li>
              <li class="d-none"><hr class="dropdown-divider"></li>
              <li class="d-none">
                <div class="dropdown-item">
                  <app-theme-selector></app-theme-selector>
                </div>
              </li>
              <li><hr class="dropdown-divider"></li>
              <li *ngIf="!demoMode">
                <a class="dropdown-item" routerLink="/compte" (click)="isDropdownOpen = false">
                  <i class="bi bi-person-badge me-2"></i>
                  Votre compte
                </a>
              </li>
              <li *ngIf="hasAdminRole">
                <a class="dropdown-item" href="#" (click)="openDemoInviteModal(); isDropdownOpen = false; $event.preventDefault()">
                  <i class="bi bi-link-45deg me-2"></i>
                  Lien invitation testeur
                </a>
              </li>
              
              <li *ngIf="showPasswordMenuItem">
                <a class="dropdown-item" 
                   href="#" 
                   (click)="openSetPasswordModal(); $event.preventDefault()">
                  <i class="bi bi-key me-2"></i>
                  {{ userProfile?.hasPassword ? 'Changer de mot de passe' : 'Définir un mot de passe' }}
                </a>
              </li>
              <li><hr class="dropdown-divider"></li>
              <li>
                <a class="dropdown-item text-danger" 
                   href="#" 
                   (click)="logout(); $event.preventDefault()">
                  <i class="bi bi-box-arrow-right me-2"></i>
                  Déconnexion
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <!-- Boutons de connexion si non connecté -->
        <div class="navbar-nav ms-auto" *ngIf="!isLoggedIn">
          <div class="nav-item">
            <a class="nav-link" (click)="openEmailValidationModal()" style="cursor: pointer;">
              <i class="bi bi-envelope me-1"></i>Connexion par email
            </a>
          </div>
        </div>
      </div>
    </nav>
    
    <!-- Spacer pour compenser la navbar fixe + bandeau éventuel -->
    <div [style.height.px]="bannerSpacerHeight"></div>

    <!-- Modal de validation d'email -->
    <div class="modal fade show" [style.display]="showEmailValidationModal ? 'block' : 'none'" [style.background]="'rgba(0,0,0,0.4)'" style="z-index: 1050; position: fixed; top: 0; left: 0; width: 100%; height: 100%;">
      <div class="modal-dialog modal-lg">
        <div class="modal-content" style="background: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-envelope-check me-2"></i>
              Connexion par validation d'email
            </h5>
            <button type="button" class="btn-close" (click)="closeEmailValidationModal()"></button>
          </div>
          <div class="modal-body">
            <p class="text-center text-primary mb-3 fw-bold">
              Connectez-vous pour accèder à votre essai gratuit
            </p>
            <div class="alert alert-warning" *ngIf="isSessionExpired">
              <i class="bi bi-exclamation-triangle me-2"></i>
              <strong>Session expirée</strong> : Votre session a expiré. Saisissez votre code de vérification pour vous reconnecter.
            </div>
            <div class="alert alert-info" *ngIf="!isSessionExpired">
              <i class="bi bi-info-circle me-2"></i>
              <strong>Connexion rapide</strong> : Saisissez votre email puis choisissez votre mode de connexion.
            </div>
            
            <!-- Étape 1: Saisie de l'email + choix du mode -->
            <div *ngIf="!emailValidationSent && loginMethod !== 'password'" class="mb-4">
              <form (ngSubmit)="onEmailStepSubmit($event)">
                <div class="mb-3">
                  <label for="userEmail" class="form-label">Votre adresse email</label>
                  <input 
                    type="email" 
                    class="form-control" 
                    id="userEmail" 
                    [(ngModel)]="userEmail" 
                    name="userEmail"
                    placeholder="ex: utilisateur@exemple.com"
                    required
                    [disabled]="isSendingEmail || isLoggingInWithPassword">
                </div>
                
                <div class="mb-3">
                  <div class="form-check">
                    <input 
                      class="form-check-input" 
                      type="checkbox" 
                      id="acceptTerms" 
                      [(ngModel)]="acceptTerms"
                      name="acceptTerms"
                      required>
                    <label class="form-check-label" for="acceptTerms">
                      J'accepte les <a href="/conditions-utilisation" target="_blank">conditions d'utilisation</a> 
                      et la <a href="/politique-confidentialite" target="_blank">politique de confidentialité</a>
                    </label>
                  </div>
                </div>
                
                <p class="text-muted small mb-2">Choisissez votre mode de connexion :</p>
                <div class="d-grid gap-2">
                  <button 
                    type="button" 
                    class="btn btn-outline-primary"
                    (click)="choosePasswordLogin()"
                    [disabled]="isSendingEmail || isLoggingInWithPassword || !userEmail || !acceptTerms">
                    <i class="bi bi-key me-2"></i>
                    J'ai déjà un mot de passe
                  </button>
                  <button 
                    type="button" 
                    class="btn btn-primary"
                    (click)="sendEmailVerification()"
                    [disabled]="isSendingEmail || isLoggingInWithPassword || !userEmail || !acceptTerms">
                    <span *ngIf="isSendingEmail" class="spinner-border spinner-border-sm me-2"></span>
                    <i *ngIf="!isSendingEmail" class="bi bi-envelope me-2"></i>
                    {{ isSendingEmail ? 'Envoi en cours...' : 'Recevoir un code par email' }}
                  </button>
                </div>
              </form>
            </div>
            
            <!-- Mode mot de passe : saisie du mot de passe -->
            <div *ngIf="loginMethod === 'password' && !emailValidationSent" class="mb-4">
              <div class="mb-3">
                <label class="form-label">Email</label>
                <input type="text" class="form-control" [value]="userEmail" readonly>
              </div>
              <form (ngSubmit)="loginWithPassword()">
                <div class="mb-3">
                  <label for="userPassword" class="form-label">Mot de passe</label>
                  <div class="input-group">
                    <input 
                      [type]="showNavbarLoginPassword ? 'text' : 'password'" 
                      class="form-control" 
                      id="userPassword" 
                      [(ngModel)]="userPassword" 
                      name="userPassword"
                      placeholder="Votre mot de passe"
                      [disabled]="isLoggingInWithPassword">
                    <button class="btn btn-outline-secondary" type="button" (click)="showNavbarLoginPassword = !showNavbarLoginPassword" [disabled]="isLoggingInWithPassword" tabindex="-1">
                      <i class="bi" [ngClass]="showNavbarLoginPassword ? 'bi-eye-slash' : 'bi-eye'"></i>
                    </button>
                  </div>
                </div>
                <div class="alert alert-danger" *ngIf="loginPasswordError">
                  <i class="bi bi-exclamation-triangle me-2"></i>{{ loginPasswordError }}
                </div>
                <div class="d-grid gap-2">
                  <button 
                    type="submit" 
                    class="btn btn-primary"
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
            
            <!-- Étape 2: Saisie du code (flux "Recevoir un code") -->
            <div *ngIf="emailValidationSent" class="text-center">
              <div class="alert alert-success">
                <i class="bi bi-check-circle me-2"></i>
                <strong>Code envoyé !</strong>
              </div>
              
              <div class="mb-4">
                <i class="bi bi-envelope text-primary" style="font-size: 3rem;"></i>
                <h5 class="mt-3">Vérifiez votre boîte email</h5>
                <p class="text-muted">
                  Nous avons envoyé un code de vérification à <strong>{{ userEmail }}</strong>
                </p>
                <p class="text-muted small">
                  <i class="bi bi-clock me-1"></i>
                  Le code est valide pendant 15 minutes
                </p>
              </div>
              
              <form (ngSubmit)="verifyEmailCode()">
                <div class="mb-3">
                  <label for="verificationCode" class="form-label">Code de vérification</label>
                  <input 
                    type="text" 
                    class="form-control text-center" 
                    id="verificationCode" 
                    [(ngModel)]="verificationCode" 
                    name="verificationCode"
                    placeholder="ex: 123456"
                    maxlength="6"
                    pattern="[0-9]{6}"
                    required
                    [disabled]="isVerifyingCode"
                    (input)="onVerificationCodeInput($event)"
                    style="font-size: 1.5rem; letter-spacing: 0.5rem;">
                </div>
                
                <div class="d-grid gap-2">
                  <button 
                    type="submit" 
                    class="btn btn-success btn-lg"
                    [disabled]="isVerifyingCode || !verificationCode || verificationCode.length !== 6">
                    <span *ngIf="isVerifyingCode" class="spinner-border spinner-border-sm me-2"></span>
                    <i *ngIf="!isVerifyingCode" class="bi bi-check-circle me-2"></i>
                    {{ isVerifyingCode ? 'Vérification...' : 'Se connecter' }}
                  </button>
                  
                  <button 
                    type="button" 
                    class="btn btn-outline-secondary"
                    (click)="resendVerificationCode()"
                    [disabled]="isResendingCode">
                    <span *ngIf="isResendingCode" class="spinner-border spinner-border-sm me-2"></span>
                    <i *ngIf="!isResendingCode" class="bi bi-arrow-clockwise me-2"></i>
                    {{ isResendingCode ? 'Renvoi...' : 'Renvoyer le code' }}
                  </button>
                  <button 
                    type="button" 
                    class="btn btn-link"
                    (click)="backToLoginChoice()">
                    <i class="bi bi-arrow-left me-1"></i>Changer de mode
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal définir/changer mot de passe (flux en 2 étapes sans rechargement) -->
    <div class="modal fade show" [style.display]="showSetPasswordModal ? 'block' : 'none'" [style.background]="'rgba(0,0,0,0.4)'" style="z-index: 1060; position: fixed; top: 0; left: 0; width: 100%; height: 100%;">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content" style="background: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-key me-2"></i>
              {{ userProfile?.hasPassword ? 'Changer de mot de passe' : 'Définir un mot de passe' }}
            </h5>
            <button type="button" class="btn-close" (click)="closeSetPasswordModal()"></button>
          </div>
          <div class="modal-body">
            <!-- Étape 1 : Saisie du mot de passe + envoi du code -->
            <div *ngIf="!setPasswordCodeSent">
              <p class="text-muted mb-3" *ngIf="!userProfile?.hasPassword">
                Définissez un mot de passe pour vous connecter plus rapidement sans recevoir de code par email.
              </p>
              <p class="text-muted mb-3" *ngIf="userProfile?.hasPassword">
                Saisissez votre nouveau mot de passe. Un code de confirmation vous sera envoyé par email.
              </p>
              <div class="alert alert-light border mb-3 small">
                <i class="bi bi-info-circle me-2"></i>{{ passwordRulesMessage }}
              </div>
              <form (ngSubmit)="submitSetPasswordRequest()">
                <div class="mb-3">
                  <label for="navbarNewPassword" class="form-label">Nouveau mot de passe</label>
                  <div class="input-group">
                    <input 
                      [type]="showNavbarNewPassword ? 'text' : 'password'" 
                      class="form-control" 
                      id="navbarNewPassword" 
                      [(ngModel)]="newPassword" 
                      name="newPassword"
                      placeholder="Ex: MonMotDePasse1!"
                      minlength="8"
                      [disabled]="isSendingSetPasswordCode">
                    <button class="btn btn-outline-secondary" type="button" (click)="showNavbarNewPassword = !showNavbarNewPassword" [disabled]="isSendingSetPasswordCode" tabindex="-1">
                      <i class="bi" [ngClass]="showNavbarNewPassword ? 'bi-eye-slash' : 'bi-eye'"></i>
                    </button>
                  </div>
                </div>
                <div class="mb-3">
                  <label for="navbarConfirmPassword" class="form-label">Confirmer le mot de passe</label>
                  <div class="input-group">
                    <input 
                      [type]="showNavbarConfirmPassword ? 'text' : 'password'" 
                      class="form-control" 
                      id="navbarConfirmPassword" 
                      [(ngModel)]="confirmPassword" 
                      name="confirmPassword"
                      placeholder="Répétez le mot de passe"
                      [disabled]="isSendingSetPasswordCode">
                    <button class="btn btn-outline-secondary" type="button" (click)="showNavbarConfirmPassword = !showNavbarConfirmPassword" [disabled]="isSendingSetPasswordCode" tabindex="-1">
                      <i class="bi" [ngClass]="showNavbarConfirmPassword ? 'bi-eye-slash' : 'bi-eye'"></i>
                    </button>
                  </div>
                </div>
                <div class="alert alert-danger" *ngIf="setPasswordError">
                  <i class="bi bi-exclamation-triangle me-2"></i>{{ setPasswordError }}
                </div>
                <div class="d-grid gap-2">
                  <button 
                    type="submit" 
                    class="btn btn-primary"
                    [disabled]="isSendingSetPasswordCode || !newPassword || !confirmPassword">
                    <span *ngIf="isSendingSetPasswordCode" class="spinner-border spinner-border-sm me-2"></span>
                    Envoyer le code par email
                  </button>
                  <button 
                    type="button" 
                    class="btn btn-outline-secondary"
                    (click)="closeSetPasswordModal()"
                    [disabled]="isSendingSetPasswordCode">
                    Annuler
                  </button>
                </div>
              </form>
            </div>
            <!-- Étape 2 : Saisie du code reçu par email (sans rechargement) -->
            <div *ngIf="setPasswordCodeSent" class="text-center">
              <div class="alert alert-success">
                <i class="bi bi-check-circle me-2"></i>
                <strong>Code envoyé !</strong>
              </div>
              <p class="text-muted mb-3">
                Un code de confirmation a été envoyé à <strong>{{ userProfile?.email }}</strong>.
                Saisissez-le ci-dessous pour valider votre mot de passe.
              </p>
              <form (ngSubmit)="submitSetPasswordConfirm()">
                <div class="mb-3">
                  <label for="setPasswordCode" class="form-label">Code de confirmation</label>
                  <input 
                    type="text" 
                    class="form-control text-center" 
                    id="setPasswordCode" 
                    [(ngModel)]="setPasswordCode" 
                    name="setPasswordCode"
                    placeholder="ex: 123456"
                    maxlength="6"
                    [disabled]="isConfirmingSetPasswordCode"
                    (input)="onSetPasswordCodeInput($event)"
                    style="font-size: 1.5rem; letter-spacing: 0.5rem;">
                </div>
                <div class="alert alert-danger" *ngIf="setPasswordError">
                  <i class="bi bi-exclamation-triangle me-2"></i>{{ setPasswordError }}
                </div>
                <div class="d-grid gap-2">
                  <button 
                    type="submit" 
                    class="btn btn-success"
                    [disabled]="isConfirmingSetPasswordCode || !setPasswordCode || setPasswordCode.length !== 6">
                    <span *ngIf="isConfirmingSetPasswordCode" class="spinner-border spinner-border-sm me-2"></span>
                    Valider et enregistrer
                  </button>
                  <button 
                    type="button" 
                    class="btn btn-outline-secondary"
                    (click)="backToSetPasswordStep1()"
                    [disabled]="isConfirmingSetPasswordCode">
                    <i class="bi bi-arrow-left me-2"></i>Modifier le mot de passe
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal lien invitation testeur (superadmin) -->
    <div class="modal fade show" [style.display]="showDemoInviteModal ? 'block' : 'none'" [style.background]="'rgba(0,0,0,0.4)'" style="z-index: 1060; position: fixed; top: 0; left: 0; width: 100%; height: 100%;">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-link-45deg me-2"></i>Invitation testeur</h5>
            <button type="button" class="btn-close" (click)="closeDemoInviteModal()" aria-label="Fermer"></button>
          </div>
          <div class="modal-body">
            <p class="text-muted">Générez un lien à usage unique. Le testeur pourra s'inscrire avec son e-mail ; après vérification de la boîte, il aura accès gratuit pendant la durée configurée côté serveur (par défaut 30 jours).</p>
            <div *ngIf="demoInviteCreateError" class="alert alert-danger py-2">{{ demoInviteCreateError }}</div>
            <div *ngIf="demoInviteFullUrl" class="mb-3">
              <label class="form-label">Lien à transmettre</label>
              <textarea class="form-control font-monospace small" rows="3" readonly [value]="demoInviteFullUrl"></textarea>
              <div class="mt-2 text-muted small" *ngIf="demoInviteExpiresLabel">Validité du lien : {{ demoInviteExpiresLabel }}</div>
            </div>
            <button type="button" class="btn btn-outline-primary btn-sm" *ngIf="demoInviteFullUrl" (click)="copyDemoInviteLink()">
              <i class="bi bi-clipboard me-1"></i>Copier le lien
            </button>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="closeDemoInviteModal()">Fermer</button>
            <button type="button" class="btn btn-primary" (click)="generateDemoInviteLink()" [disabled]="creatingDemoInvite">
              <span *ngIf="creatingDemoInvite" class="spinner-border spinner-border-sm me-1"></span>
              Générer un nouveau lien
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .demo-tester-banner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1040;
    }
    .navbar.navbar-with-demo-banner { top: 48px !important; }
    .restricted-banner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1040;
      padding: 0.5rem 1rem;
      font-size: 0.9rem;
      text-align: center;
      background: #856404;
      color: #fff;
    }
    .restricted-banner.banner-temporary {
      background: #0d6efd;
    }
    .restricted-banner .alert-link { color: #fff; text-decoration: underline; }
    .navbar.navbar-with-banner { top: 48px !important; }
    .navbar {
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      z-index: 1030;
    }
    .logo-circle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 42px;
      width: 42px;
      border-radius: 50%;
      background: #ffffff;
      box-shadow: 0 1px 2px rgba(0,0,0,0.08);
      position: absolute;
    }
    .logo-circle img {
      height: 33px;
      width: auto;
      display: block;
    }
    
    .navbar-brand {
      font-weight: bold;
      font-size: 1.5rem;
    }

    .brand-text {
      font-size: 1.5rem;
      font-weight: bold;
      margin-left: 48px;
      color: #ffffff !important;
    }

    .page-title {
      margin-top:12px;
    }
    
    .bg-primary {
      background: linear-gradient(135deg, #2071aa 0%, #1a5d8a 100%) !important;
    }
    
    .nav-link {
      color: rgba(255, 255, 255, 0.9) !important;
    }
    
    .nav-link:hover {
      color: white !important;
    }
    
    .dropdown-toggle::after {
      margin-left: 0.5rem;
    }
    
    .dropdown-menu {
      margin-top: 0.5rem;
      border: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border-radius: 8px;
      position: absolute !important;
      right: 0.5rem ;
      left: auto;
      z-index: 1050;
      display: none;
      background: white;
      min-width: 250px;
    }
    
    .dropdown-menu.show {
      display: block !important;
    }
    
    /* Correction pour le comportement mobile du dropdown */
    @media (max-width: 991.98px) {
      .dropdown-menu {
        position: fixed !important;
        top: 56px !important;
        right: 1rem !important;
        left: auto !important;
        width: auto;
        min-width: 250px;
        max-width: calc(100vw - 2rem);
        transform: none !important;
        z-index: 1050;
        margin-top: 0.5rem;
      }
      
      /* Assurer que le dropdown ne pousse pas le contenu */
      .navbar-nav .dropdown {
        position: static;
      }
    }
    
    .dropdown-item {
      padding: 0.75rem 1rem;
    }
    
    .dropdown-item:hover {
      background-color: #f8f9fa;
    }
    
    .dropdown-item-text {
      padding: 0.75rem 1rem;
    }
    
    .text-light {
      color: rgba(255, 255, 255, 0.9) !important;
    }
    
    .navbar-text {
      font-size: 1.1rem;
    }

    .session-warning {
      display: flex;
      align-items: center;
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      background-color: rgba(255, 193, 7, 0.2);
      color: #ffc107;
      border: 1px solid rgba(255, 193, 7, 0.3);
      transition: all 0.3s ease;
    }

    .session-warning.warning {
      background-color: rgba(255, 193, 7, 0.2);
      color: #ffc107;
      border-color: rgba(255, 193, 7, 0.3);
    }

    .session-warning.critical {
      background-color: rgba(220, 53, 69, 0.2);
      color: #dc3545;
      border-color: rgba(220, 53, 69, 0.3);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.7;
      }
    }

    .session-warning .btn {
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
    }
  `]
})
export class NavbarComponent implements OnInit, OnDestroy {
  @Input() pageTitle?: string;
  
  isLoggedIn = false;
  userProfile: UnifiedUser | null = null;
  hasAdminRole = false;
  isDropdownOpen = false;
  private authStateSubscription?: Subscription;
  private sessionSubscription?: Subscription;

  // Propriétés pour la validation d'email
  showEmailValidationModal = false;
  userEmail = '';
  acceptTerms = false;
  verificationCode = '';
  isSendingEmail = false;
  isVerifyingCode = false;
  isResendingCode = false;
  emailValidationSent = false;
  // Mode de connexion : null = choix, 'password' = mot de passe, 'code' = code par email
  loginMethod: 'password' | 'code' | null = null;
  userPassword = '';
  showNavbarLoginPassword = false;
  isLoggingInWithPassword = false;
  loginPasswordError = '';
  // Modal définir/changer mot de passe (flux en 2 étapes)
  passwordRulesMessage = PASSWORD_RULES_MESSAGE;
  showSetPasswordModal = false;
  newPassword = '';
  confirmPassword = '';
  setPasswordCode = '';
  setPasswordCodeSent = false;
  showNavbarNewPassword = false;
  showNavbarConfirmPassword = false;
  isSendingSetPasswordCode = false;
  isConfirmingSetPasswordCode = false;
  setPasswordError = '';

  // Propriétés pour la gestion de session
  sessionInfo: SessionInfo | null = null;
  showSessionWarning = false;
  alertLevel: 0 | 1 | 2 = 0;
  isSessionExpired = false; // Pour indiquer si le modal s'ouvre suite à une session expirée

  isRestricted = false;
  restrictionReason: RestrictionReason = null;
  demoMode = false;
  demoExpiresAt: string | null = null;
  /** Bandeau testeur masqué via « Masquer » (persisté). */
  private demoTesterBannerDismissed = false;
  private subscriptionStatusSub?: Subscription;

  showDemoInviteModal = false;
  demoInviteFullUrl = '';
  demoInviteExpiresLabel = '';
  creatingDemoInvite = false;
  demoInviteCreateError = '';
  accountData: AccountData | null = null;
  private accountDataSub?: Subscription;

  constructor(
    private authService: UnifiedAuthService,
    private modalService: ModalService,
    private http: HttpClient,
    private logger: LoggerService,
    private sessionManager: SessionManagerService,
    private subscriptionService: SubscriptionService,
    private accountService: AccountService,
    private demoInviteService: DemoInviteService
  ) {}

  /** Bandeau bleu testeur affiché (pas masqué par l'utilisateur). */
  get showDemoTesterBanner(): boolean {
    return (
      this.demoMode &&
      !this.isRestricted &&
      !!this.demoExpiresAt &&
      !this.demoTesterBannerDismissed
    );
  }

  /** Mot de passe : superadmin (comportement historique) ou compte testeur démo. */
  get showPasswordMenuItem(): boolean {
    if (this.demoMode) {
      return true;
    }
    return this.hasAdminRole && this.userProfile?.hasPassword !== undefined;
  }

  get bannerSpacerHeight(): number {
    let h = 56;
    if (this.isRestricted) {
      h += 48;
    }
    if (this.showDemoTesterBanner) {
      h += 48;
    }
    return h;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    // Fermer le dropdown si on clique ailleurs
    if (!(event.target as Element).closest('.dropdown')) {
      this.isDropdownOpen = false;
    }
  }

  async ngOnInit(): Promise<void> {
    this.isLoggedIn = this.authService.isLoggedIn();
    
    // S'abonner aux changements d'état d'authentification
        this.authStateSubscription = this.authService.getAuthState$().subscribe(
      (authState: UnifiedAuthState) => {
        // Vérifier que l'utilisateur est authentifié ET que le token est valide
        this.isLoggedIn = authState.isAuthenticated && authState.isEmailValidated;
        
        if (this.isLoggedIn) {
          this.isRestricted = this.subscriptionService.isRestricted;
          this.restrictionReason = this.subscriptionService.restrictionReason;
          this.subscriptionService.getSubscriptionStatus().subscribe();
          // Utiliser les informations du service d'état d'authentification
          if (authState.userInfo) {
            this.userProfile = authState.userInfo as any;
            this.hasAdminRole = !!this.userProfile?.isSuperadmin;
          } else {
            // Fallback vers le service d'authentification classique
            this.authService.getLoggedUser().subscribe(
              (profile: any) => {
                this.userProfile = profile;
                this.hasAdminRole = !!profile?.isSuperadmin;
              },
              (error: any) => {
                this.logger.error('Erreur lors du chargement du profil:', error);
              }
            );
          }
          
          // Démarrer le monitoring de session si connecté
          // Attendre un peu pour que la configuration soit chargée
          setTimeout(() => {
            this.sessionManager.startSessionMonitoring();
            // Récupérer immédiatement les infos de session
            this.sessionManager.getSessionInfo();
          }, 500);
        } else {
          this.userProfile = null;
          this.hasAdminRole = false;
          this.isRestricted = false;
          this.restrictionReason = null;
          this.demoMode = false;
          this.demoExpiresAt = null;
          this.demoTesterBannerDismissed = false;
          this.sessionManager.stopSessionMonitoring();
          this.sessionInfo = null;
          this.showSessionWarning = false;
        }
      }
    );

    this.subscriptionStatusSub = this.subscriptionService.subscriptionStatus$.subscribe(s => {
      this.isRestricted = s.restricted;
      this.restrictionReason = s.reason;
      this.demoMode = s.demoMode === true;
      this.demoExpiresAt = s.demoExpiresAt ?? null;
      if (!this.demoMode) {
        try {
          localStorage.removeItem(DEMO_TESTER_BANNER_DISMISSED_KEY);
        } catch {
          // ignore
        }
        this.demoTesterBannerDismissed = false;
      } else {
        this.loadDemoTesterBannerDismissed();
      }
    });

    this.accountDataSub = this.accountService.accountData$.subscribe(data => {
      this.accountData = data;
    });

    // S'abonner aux changements d'information de session
    this.sessionSubscription = this.sessionManager.getSessionInfo$().subscribe(
      (sessionInfo: SessionInfo | null) => {
        this.sessionInfo = sessionInfo;
        this.updateSessionWarning();
      }
    );

    // S'abonner aux événements d'ouverture du modal de validation d'email
    this.modalService.openEmailValidationModal$.subscribe((options: LoginModalOptions | void) => {
      if (options) {
        this.openEmailValidationModalWithOptions(options);
      } else {
        this.openEmailValidationModal();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.authStateSubscription) {
      this.authStateSubscription.unsubscribe();
    }
    if (this.sessionSubscription) {
      this.sessionSubscription.unsubscribe();
    }
    if (this.subscriptionStatusSub) {
      this.subscriptionStatusSub.unsubscribe();
    }
    if (this.accountDataSub) {
      this.accountDataSub.unsubscribe();
    }
    this.sessionManager.stopSessionMonitoring();
  }

  toggleDropdown(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDropdownOpen = !this.isDropdownOpen;
    // Rafraîchir les infos utilisateur (dont hasPassword) quand on ouvre le menu
    if (this.isDropdownOpen && this.isLoggedIn) {
      this.authService.refreshUserInfo().subscribe();
    }
  }

  logout(): void {
    this.accountService.clear();
    this.authService.logout().subscribe({
      next: () => {
        this.logger.log('Déconnexion réussie');
      },
      error: (error) => {
        this.logger.error('Erreur lors de la déconnexion:', error);
        // La déconnexion locale est déjà gérée dans le service
      }
    });
  }

  /**
   * Obtient le nom d'affichage de l'utilisateur
   */
  getDisplayName(): string {
    const member = (this.accountData?.member ?? this.accountService.current?.member) as Record<string, unknown> | undefined;
    if (member?.['firstname'] || member?.['lastname']) {
      const first = (member?.['firstname'] as string)?.trim() || '';
      const last = (member?.['lastname'] as string)?.trim() || '';
      const full = [first, last].filter(Boolean).join(' ');
      if (full) return full;
    }
    if (!this.userProfile) {
      return 'Utilisateur';
    }
    const customUser = this.userProfile as UnifiedUser;
    return customUser.firstName || customUser.name || customUser.email || customUser.username || 'Utilisateur';
  }

  openLoginModal(): void {
    this.modalService.openLoginModal();
  }

  openDemoInviteModal(): void {
    this.showDemoInviteModal = true;
    this.demoInviteCreateError = '';
    this.demoInviteFullUrl = '';
    this.demoInviteExpiresLabel = '';
  }

  closeDemoInviteModal(): void {
    this.showDemoInviteModal = false;
  }

  generateDemoInviteLink(): void {
    this.creatingDemoInvite = true;
    this.demoInviteCreateError = '';
    this.demoInviteService.createInvite().subscribe({
      next: res => {
        this.creatingDemoInvite = false;
        const base = typeof window !== 'undefined' ? window.location.origin : '';
        this.demoInviteFullUrl = base + (res.relativePath || '');
        this.demoInviteExpiresLabel = res.inviteExpiresAt
          ? new Date(res.inviteExpiresAt).toLocaleString()
          : '';
      },
      error: err => {
        this.creatingDemoInvite = false;
        this.demoInviteCreateError =
          err?.error?.error || err?.message || 'Impossible de créer l\'invitation (réservé aux administrateurs).';
      }
    });
  }

  copyDemoInviteLink(): void {
    if (!this.demoInviteFullUrl || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    navigator.clipboard.writeText(this.demoInviteFullUrl).then(
      () => this.logger.log('Lien invitation copié'),
      () => this.logger.error('Copie presse-papiers refusée')
    );
  }

  private loadDemoTesterBannerDismissed(): void {
    try {
      this.demoTesterBannerDismissed = localStorage.getItem(DEMO_TESTER_BANNER_DISMISSED_KEY) === '1';
    } catch {
      this.demoTesterBannerDismissed = false;
    }
  }

  dismissDemoTesterBanner(): void {
    try {
      localStorage.setItem(DEMO_TESTER_BANNER_DISMISSED_KEY, '1');
    } catch {
      // ignore
    }
    this.demoTesterBannerDismissed = true;
  }

  // ===== MÉTHODES DE VALIDATION D'EMAIL =====

  openEmailValidationModal(): void {
    this.showEmailValidationModal = true;
    this.emailValidationSent = false;
    this.userEmail = '';
    this.verificationCode = '';
    this.acceptTerms = false;
    this.loginMethod = null;
    this.userPassword = '';
    this.showNavbarLoginPassword = false;
    this.loginPasswordError = '';
  }

  openEmailValidationModalWithOptions(options: LoginModalOptions): void {
    this.showEmailValidationModal = true;
    this.emailValidationSent = false;
    this.userEmail = options.email || '';
    this.verificationCode = '';
    this.isSessionExpired = options.isSessionExpired || false;
    this.acceptTerms = false;
    
    // Si l'email est prérempli et que c'est une session expirée, 
    // cocher automatiquement les conditions d'utilisation
    if (options.email && options.isSessionExpired) {
      this.acceptTerms = true;
      // Ne pas envoyer automatiquement le code - l'utilisateur doit cliquer sur le bouton
    }
    
    this.logger.log('Navbar - Modal de validation d\'email ouvert avec options:', options);
  }

  closeEmailValidationModal(): void {
    this.showEmailValidationModal = false;
    this.emailValidationSent = false;
    this.verificationCode = '';
    this.userEmail = '';
    this.acceptTerms = false;
    this.loginMethod = null;
    this.userPassword = '';
    this.showNavbarLoginPassword = false;
    this.loginPasswordError = '';
  }

  choosePasswordLogin(): void {
    this.loginMethod = 'password';
    this.loginPasswordError = '';
  }

  backToLoginChoice(): void {
    this.loginMethod = null;
    this.emailValidationSent = false;
    this.verificationCode = '';
    this.userPassword = '';
    this.showNavbarLoginPassword = false;
    this.loginPasswordError = '';
  }

  onEmailStepSubmit(event: Event): void {
    event.preventDefault();
    // Empêcher la soumission par défaut du formulaire
  }

  async loginWithPassword(): Promise<void> {
    if (!this.userEmail || !this.userPassword) return;
    
    this.isLoggingInWithPassword = true;
    this.loginPasswordError = '';
    
    try {
      await this.authService.loginWithPassword(this.userEmail, this.userPassword);
      this.checkAuthenticationStatus();
      this.closeEmailValidationModal();
    } catch (error: any) {
      this.loginPasswordError = error?.error?.message || 'Email ou mot de passe incorrect';
    } finally {
      this.isLoggingInWithPassword = false;
    }
  }

  // ===== MÉTHODES DÉFINIR/CHANGER MOT DE PASSE =====

  openSetPasswordModal(): void {
    // Interdire l'action "changer de mot de passe" aux non-admins.
    // L'option "définir un mot de passe" reste accessible (hasPassword === false).
    if (this.userProfile?.hasPassword && !this.hasAdminRole) {
      return;
    }
    this.isDropdownOpen = false;
    this.showSetPasswordModal = true;
    this.newPassword = '';
    this.confirmPassword = '';
    this.setPasswordCode = '';
    this.setPasswordCodeSent = false;
    this.showNavbarNewPassword = false;
    this.showNavbarConfirmPassword = false;
    this.setPasswordError = '';
  }

  closeSetPasswordModal(): void {
    this.showSetPasswordModal = false;
    this.newPassword = '';
    this.confirmPassword = '';
    this.setPasswordCode = '';
    this.setPasswordCodeSent = false;
    this.showNavbarNewPassword = false;
    this.showNavbarConfirmPassword = false;
    this.setPasswordError = '';
  }

  backToSetPasswordStep1(): void {
    this.setPasswordCodeSent = false;
    this.setPasswordCode = '';
    this.setPasswordError = '';
  }

  onSetPasswordCodeInput(event: any): void {
    const value = event.target.value;
    const numericValue = value.replace(/\D/g, '');
    if (numericValue !== value) {
      this.setPasswordCode = numericValue;
      event.target.value = numericValue;
    }
  }

  submitSetPasswordRequest(): void {
    if (!this.newPassword || !this.confirmPassword) return;
    if (this.newPassword !== this.confirmPassword) {
      this.setPasswordError = 'Les mots de passe ne correspondent pas';
      return;
    }
    const pwdValidation = validatePassword(this.newPassword);
    if (!pwdValidation.valid) {
      this.setPasswordError = pwdValidation.error || 'Mot de passe invalide';
      return;
    }
    
    this.isSendingSetPasswordCode = true;
    this.setPasswordError = '';
    
    this.authService.setPasswordRequest(this.newPassword, this.confirmPassword).subscribe({
      next: () => {
        this.setPasswordCodeSent = true;
        this.setPasswordCode = '';
      },
      error: (error: any) => {
        this.setPasswordError = error?.error?.message || 'Erreur lors de l\'envoi du code';
      },
      complete: () => {
        this.isSendingSetPasswordCode = false;
      }
    });
  }

  submitSetPasswordConfirm(): void {
    if (!this.setPasswordCode || this.setPasswordCode.length !== 6) return;
    
    this.isConfirmingSetPasswordCode = true;
    this.setPasswordError = '';
    
    this.authService.setPasswordConfirm(this.setPasswordCode).subscribe({
      next: () => {
        this.closeSetPasswordModal();
        this.authService.refreshUserInfo().subscribe();
      },
      error: (error: any) => {
        this.setPasswordError = error?.error?.message || 'Code invalide. Vérifiez et réessayez.';
      },
      complete: () => {
        this.isConfirmingSetPasswordCode = false;
      }
    });
  }

  sendEmailVerification(): void {
    if (!this.userEmail || !this.acceptTerms) {
      return;
    }
    
    this.isSendingEmail = true;
    this.loginMethod = 'code';
    
    this.authService.sendEmailVerification(this.userEmail).subscribe({
      next: (response: any) => {
        this.emailValidationSent = true;
        this.isSendingEmail = false;
      },
      error: (error: any) => {
        this.logger.error('Erreur lors de l\'envoi du code de vérification:', error);
        this.isSendingEmail = false;
      }
    });
  }

  verifyEmailCode(): void {
    if (!this.verificationCode || this.verificationCode.length !== 6) {
      return;
    }
    
    // Nettoyer le code (supprimer les espaces et caractères non numériques)
    const cleanCode = this.verificationCode.replace(/\D/g, '');
    
    if (cleanCode.length !== 6) {
      return;
    }
    
    this.isVerifyingCode = true;
    
    this.authService.verifyEmailCode(this.userEmail, cleanCode).subscribe({
      next: (response: any) => {
        // Code validé avec succès !
        this.authService.setEmailValidated(this.userEmail, response.token, response.user);
        
        // Récupérer l'état d'authentification depuis l'auth-service
        this.checkAuthenticationStatus();
        
        // Fermer la modal
        this.closeEmailValidationModal();
        
        this.isVerifyingCode = false;
      },
      error: (error: any) => {
        this.logger.error('Erreur de vérification:', error);
        this.isVerifyingCode = false;
      }
    });
  }

  resendVerificationCode(): void {
    this.isResendingCode = true;
    
    this.authService.sendEmailVerification(this.userEmail).subscribe({
      next: (response: any) => {
        this.isResendingCode = false;
      },
      error: (error: any) => {
        this.logger.error('Erreur lors du renvoi du code:', error);
        this.isResendingCode = false;
      }
    });
  }

  private checkAuthenticationStatus(): void {
    // Récupérer le token JWT et l'utilisateur depuis les cookies HttpOnly via l'auth-service
    this.http.get('/auth/api/auth/token', { withCredentials: true }).subscribe({
      next: (response: any) => {
        if (response && response.token && response.user) {
          // Propager l'état au système d'authentification global
          this.authService.setEmailValidated(response.user.email, response.token, response.user);
          this.authService.updateAuthState();

          // Mettre à jour l'état local de la navbar
          this.isLoggedIn = true;
          this.userProfile = {
            sub: response.user.sub,
            email: response.user.email,
            name: response.user.name,
            firstName: response.user.firstName,
            lastName: response.user.lastName || '',
            username: response.user.username || response.user.email.split('@')[0],
            picture: '',
            email_verified: response.user.email_verified
          } as any;
        } else {
          this.isLoggedIn = false;
          this.userProfile = null;
        }
      },
      error: (error) => {
        this.logger.error('Navbar - Erreur lors de la récupération de /auth/api/auth/token:', error);
        this.isLoggedIn = false;
        this.userProfile = null;
      }
    });
  }

  onVerificationCodeInput(event: any): void {
    const value = event.target.value;
    const numericValue = value.replace(/\D/g, '');
    if (numericValue !== value) {
      this.verificationCode = numericValue;
      event.target.value = numericValue;
    }
  }

  // ===== MÉTHODES DE GESTION DE SESSION =====

  updateSessionWarning(): void {
    this.showSessionWarning = this.sessionManager.shouldShowWarning();
    this.alertLevel = this.sessionManager.getAlertLevel();
  }

  formatTimeRemaining(seconds: number): string {
    return this.sessionManager.formatTimeRemaining(seconds);
  }
} 