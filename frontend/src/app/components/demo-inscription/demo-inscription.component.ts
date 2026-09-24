import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { NavbarComponent } from '../navbar/navbar.component';
import { FooterComponent } from '../footer/footer.component';
import { DemoInviteService } from '../../services/demo-invite.service';
import { UnifiedAuthService } from '../../services/unified-auth.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-demo-inscription',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NavbarComponent, FooterComponent],
  templateUrl: './demo-inscription.component.html',
  styleUrl: './demo-inscription.component.scss'
})
export class DemoInscriptionComponent implements OnInit {
  token = '';
  email = '';
  loading = false;
  validating = true;
  inviteValid = false;
  validateReason: string | null = null;
  inviteExpiresAt: string | null = null;
  entitlementDays = 30;
  errorMessage = '';
  successReserve = false;
  activateDone = false;
  activateError = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private demoInviteService: DemoInviteService,
    private authService: UnifiedAuthService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const t = params.get('t') || '';
      if (t) {
        this.token = t;
        this.demoInviteService.persistTokenForLaterActivation(t);
      } else {
        this.token = this.demoInviteService.getStoredToken() || '';
      }
      this.runValidationAndMaybeActivate();
    });
  }

  private runValidationAndMaybeActivate(): void {
    if (!this.token) {
      this.validating = false;
      this.inviteValid = false;
      this.validateReason = 'missing';
      return;
    }
    this.validating = true;
    this.demoInviteService.validateToken(this.token).subscribe({
      next: res => {
        this.validating = false;
        this.inviteValid = res.valid === true;
        this.validateReason = res.reason || null;
        this.inviteExpiresAt = res.inviteExpiresAt || null;
        if (res.entitlementDays != null) {
          this.entitlementDays = res.entitlementDays;
        }
        if (this.authService.isLoggedIn()) {
          this.tryActivateAfterLogin();
        }
      },
      error: () => {
        this.validating = false;
        this.inviteValid = false;
        this.validateReason = 'error';
      }
    });
  }

  private tryActivateAfterLogin(): void {
    this.demoInviteService.tryActivatePendingInvite().subscribe(ok => {
      if (ok) {
        this.activateDone = true;
        this.logger.log('Demo invitation activated');
      }
    });
  }

  submitReserve(): void {
    this.errorMessage = '';
    if (!this.email || !this.token) {
      this.errorMessage = 'Saisissez une adresse e-mail valide.';
      return;
    }
    this.loading = true;
    this.demoInviteService.reserve(this.token, this.email).subscribe({
      next: res => {
        this.loading = false;
        if (res.ok) {
          this.successReserve = true;
          this.demoInviteService.persistTokenForLaterActivation(this.token);
          this.authService.loginWithEmail(this.email).then(
            () => {
              this.logger.log('E-mail de connexion envoyé (inscription démo)');
            },
            err => {
              this.logger.error('Erreur envoi lien connexion', err);
              this.errorMessage = 'Impossible d\'envoyer l\'e-mail de connexion. Réessayez.';
            }
          );
        } else {
          this.errorMessage = res.message || 'Réservation impossible.';
        }
      },
      error: err => {
        this.loading = false;
        const body = err?.error;
        const msg = body?.message ?? body?.error ?? err?.message;
        this.errorMessage = typeof msg === 'string' ? msg : 'Réservation impossible.';
      }
    });
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }
}
