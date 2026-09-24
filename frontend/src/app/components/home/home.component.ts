import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { UnifiedAuthService } from '../../services/unified-auth.service';
import { PASSWORD_RULES_MESSAGE, validatePassword } from '../../utils/password-rules';
import { SharesListComponent } from '../shares-list/shares-list.component';
import { ThemeSelectorComponent } from '../theme-selector/theme-selector.component';
import { NavbarComponent } from '../navbar/navbar.component';
import { FooterComponent } from '../footer/footer.component';
import { UnifiedAuthState } from '../../services/unified-auth.service';
import { LoggerService } from '../../services/logger.service';
import { DemoInviteService } from '../../services/demo-invite.service';

const SET_PASSWORD_BANNER_DISMISSED_KEY = 'novapartage_set_password_dismissed';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SharesListComponent, ThemeSelectorComponent, NavbarComponent, FooterComponent]
})
export class HomeComponent implements OnInit, OnDestroy {
  isLoggedIn = false;
  showSetPasswordBanner = false;
  showSetPasswordModal = false;
  newPassword = '';
  confirmPassword = '';
  setPasswordCode = '';
  setPasswordCodeSent = false;
  isSendingSetPasswordCode = false;
  isConfirmingSetPasswordCode = false;
  setPasswordError = '';
  showNewPassword = false;
  showConfirmPassword = false;
  passwordRulesMessage = PASSWORD_RULES_MESSAGE;
  private authStateSubscription?: Subscription;

  constructor(
    private authService: UnifiedAuthService,
    private logger: LoggerService,
    private demoInviteService: DemoInviteService
  ) {}

  ngOnInit(): void {
    this.authStateSubscription = this.authService.getAuthState$().subscribe(
      (authState: UnifiedAuthState) => {
        this.isLoggedIn = authState.isAuthenticated && authState.isEmailValidated;
      }
    );
    
    // Vérifier si l'utilisateur admin a un mot de passe (bandeau réservé aux admins)
    this.authService.refreshUserInfo().subscribe(user => {
      if (user && user.isSuperadmin && user.hasPassword === false && !localStorage.getItem(SET_PASSWORD_BANNER_DISMISSED_KEY)) {
        this.showSetPasswordBanner = true;
      }
    });

    // Activation automatique période testeur après connexion par lien (invitation démo)
    this.demoInviteService.tryActivatePendingInvite().subscribe(activated => {
      if (activated) {
        this.logger.log('Période testeur activée depuis une invitation en attente');
      }
    });
  }

  ngOnDestroy(): void {
    if (this.authStateSubscription) {
      this.authStateSubscription.unsubscribe();
    }
  }

  nouveauPartage(): void {
    // Redirection vers la page de nouveau partage
    window.location.href = '/share/new';
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.logger.log('Déconnexion réussie');
      },
      error: (error) => {
        this.logger.error('Erreur lors de la déconnexion:', error);
      }
    });
  }

  openSetPasswordModal(): void {
    this.showSetPasswordModal = true;
    this.newPassword = '';
    this.confirmPassword = '';
    this.setPasswordCode = '';
    this.setPasswordCodeSent = false;
    this.showNewPassword = false;
    this.showConfirmPassword = false;
    this.setPasswordError = '';
  }

  closeSetPasswordModal(): void {
    this.showSetPasswordModal = false;
    this.newPassword = '';
    this.confirmPassword = '';
    this.setPasswordCode = '';
    this.setPasswordCodeSent = false;
    this.showNewPassword = false;
    this.showConfirmPassword = false;
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

  dismissSetPasswordBanner(): void {
    this.showSetPasswordBanner = false;
    localStorage.setItem(SET_PASSWORD_BANNER_DISMISSED_KEY, 'true');
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
        this.showSetPasswordBanner = false;
        localStorage.setItem(SET_PASSWORD_BANNER_DISMISSED_KEY, 'true');
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
}